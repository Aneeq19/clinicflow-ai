import os
from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from typing import Annotated, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, SecretStr, field_validator
from supabase import create_client
from supabase.client import ClientOptions
from supabase_auth.errors import AuthApiError
from business_settings import SettingsDocument, load_business


router = APIRouter(prefix="/admin", tags=["Owner dashboard"])
bearer = HTTPBearer(auto_error=False)
attempts = defaultdict(deque)
attempt_lock = Lock()
AppointmentStatus = Literal["New", "Contacted", "Confirmed", "Completed", "Cancelled"]


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr

    @field_validator("email")
    @classmethod
    def trim_email(cls, value):
        return value.strip()


class StatusUpdate(BaseModel):
    status: AppointmentStatus
    expected_status: AppointmentStatus


class OwnerContext(BaseModel):
    user_id: str
    business_id: str
    business_name: str


class LoginResponse(BaseModel):
    access_token: str
    expires_in: int
    business_name: str


class AppointmentRow(BaseModel):
    id: UUID
    customer_name: str
    phone: str
    service: str
    preferred_date: str
    preferred_time: str
    message: str
    status: AppointmentStatus
    created_at: str


class DashboardResponse(BaseModel):
    business_name: str
    total: int
    new: int
    confirmed: int
    page: int
    page_size: int
    appointments: list[AppointmentRow]


def check_limit(request: Request, bucket: str, limit: int):
    ip = request.client.host if request.client else "unknown"
    key = (bucket, ip)
    now = monotonic()
    with attempt_lock:
        expired = [entry for entry, times in attempts.items() if not times or now - times[-1] >= 60]
        for entry in expired:
            del attempts[entry]
        times = attempts[key]
        while times and now - times[0] >= 60:
            times.popleft()
        if len(times) >= limit:
            raise HTTPException(429, "Too many attempts. Wait one minute.", headers={"Retry-After": "60"})
        times.append(now)


def find_owner(database, user_id: str) -> OwnerContext:
    try:
        businesses = (
            database.table("businesses").select("id,name")
            .eq("slug", os.getenv("BUSINESS_SLUG", "")).limit(1).execute()
        )
        if not businesses.data:
            raise HTTPException(503, "Business configuration is unavailable.")
        business = businesses.data[0]
        membership = (
            database.table("business_members").select("role")
            .eq("business_id", business["id"]).eq("user_id", user_id)
            .eq("role", "owner").limit(1).execute()
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Could not verify owner access.") from None
    if not membership.data:
        raise HTTPException(403, "This account does not have owner access to this business.")
    return OwnerContext(user_id=user_id, business_id=business["id"], business_name=business["name"])


def require_owner(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> OwnerContext:
    check_limit(request, "admin", 60)
    if not credentials:
        raise HTTPException(401, "Please sign in.", headers={"WWW-Authenticate": "Bearer"})
    database = request.app.state.database
    try:
        verified = database.auth.get_user(credentials.credentials)
    except AuthApiError:
        raise HTTPException(401, "Session expired or invalid. Please sign in again.") from None
    except Exception:
        raise HTTPException(503, "Login verification is temporarily unavailable.") from None
    if not verified.user:
        raise HTTPException(401, "Please sign in again.")
    return find_owner(database, str(verified.user.id))


Owner = Annotated[OwnerContext, Depends(require_owner)]


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request):
    check_limit(request, "login", 5)
    try:
        # A separate client prevents a user's session from replacing the shared
        # service client's authorization used for scoped database operations.
        with httpx.Client(timeout=10.0) as transport:
            auth_client = create_client(
                os.environ["SUPABASE_URL"],
                os.environ["SUPABASE_SECRET_KEY"],
                options=ClientOptions(
                    auto_refresh_token=False, persist_session=False,
                    httpx_client=transport,
                ),
            )
            result = auth_client.auth.sign_in_with_password({
                "email": body.email,
                "password": body.password.get_secret_value(),
            })
    except AuthApiError:
        raise HTTPException(401, "Could not sign in. Check your email and password.") from None
    except Exception:
        raise HTTPException(503, "Sign-in is temporarily unavailable.") from None
    if not result.user or not result.session:
        raise HTTPException(401, "Could not sign in.")
    owner = find_owner(request.app.state.database, str(result.user.id))
    return LoginResponse(
        access_token=result.session.access_token,
        expires_in=result.session.expires_in,
        business_name=owner.business_name,
    )


@router.get("/appointments", response_model=DashboardResponse)
def list_appointments(request: Request, owner: Owner, page: int = Query(default=1, ge=1, le=10000)):
    database = request.app.state.database
    page_size = 20
    start = (page - 1) * page_size
    try:
        rows = (
            database.table("appointments")
            .select("id,customer_name,phone,service,preferred_date,preferred_time,message,status,created_at", count="exact")
            .eq("business_id", owner.business_id)
            .order("created_at", desc=True).order("id", desc=True)
            .range(start, start + page_size - 1).execute()
        )
        new = (
            database.table("appointments").select("id", count="exact", head=True)
            .eq("business_id", owner.business_id).eq("status", "New").execute()
        )
        confirmed = (
            database.table("appointments").select("id", count="exact", head=True)
            .eq("business_id", owner.business_id).eq("status", "Confirmed").execute()
        )
        if any(value is None for value in (rows.count, new.count, confirmed.count)):
            raise HTTPException(503, "Appointment counts are unavailable.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Could not load appointments.") from None
    return DashboardResponse(
        business_name=owner.business_name,
        total=rows.count, new=new.count, confirmed=confirmed.count,
        page=page, page_size=page_size, appointments=rows.data,
    )


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentRow)
def update_status(appointment_id: UUID, body: StatusUpdate, request: Request, owner: Owner):
    try:
        saved = (
            request.app.state.database.table("appointments")
            .update({"status": body.status})
            .eq("business_id", owner.business_id).eq("id", str(appointment_id))
            .eq("status", body.expected_status).execute()
        )
        if saved.data:
            return AppointmentRow(**saved.data[0])
        existing = (
            request.app.state.database.table("appointments").select("id")
            .eq("business_id", owner.business_id).eq("id", str(appointment_id))
            .limit(1).execute()
        )
    except Exception:
        raise HTTPException(503, "Could not update the status. Refresh to check the latest value.") from None
    if not existing.data:
        raise HTTPException(404, "Appointment not found.")
    raise HTTPException(409, "Status changed since you loaded it. Refresh and try again.")


@router.get("/settings", response_model=SettingsDocument)
def get_settings(request: Request, owner: Owner):
    business, settings = load_business(request.app.state.database, owner.business_id)
    return SettingsDocument(settings=settings, version=business.get("settings_version", 0))


@router.put("/settings", response_model=SettingsDocument)
def save_settings(body: SettingsDocument, request: Request, owner: Owner):
    try:
        saved = (
            request.app.state.database.table("businesses")
            .update({"name": body.settings.name, "timezone": body.settings.timezone,
                     "settings": body.settings.model_dump(), "settings_version": body.version + 1})
            .eq("id", owner.business_id).eq("settings_version", body.version).execute()
        )
    except Exception:
        raise HTTPException(503, "Could not save settings. Check that migration 003 has been run.") from None
    if not saved.data:
        raise HTTPException(409, "Settings changed in another session. Reload settings before saving.")
    return SettingsDocument(settings=body.settings, version=body.version + 1)


@router.get("/chat-stats")
def chat_stats(request: Request, owner: Owner):
    try:
        result = request.app.state.database.rpc("business_chat_stats", {"p_business_id": owner.business_id}).execute()
        if not result.data:
            raise ValueError()
        return {key: int(result.data[0][key]) for key in ("messages", "conversations", "fallback_messages")}
    except Exception:
        raise HTTPException(503, "Chat statistics unavailable. Check migration 003.") from None
