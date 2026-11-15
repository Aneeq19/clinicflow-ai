import os
import hashlib
import json
from uuid import UUID
from postgrest.exceptions import APIError
from collections import defaultdict, deque
from datetime import date, datetime, time
from pathlib import Path
from threading import Lock
from time import monotonic
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from supabase import create_client
from supabase.client import ClientOptions
from business_settings import load_business
from receptionist import router as receptionist_router
from owner_admin import router as owner_router


load_dotenv(Path(__file__).resolve().parent / ".env")

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SECRET_KEY")
business_slug = os.getenv("BUSINESS_SLUG")

if not all([supabase_url, supabase_key, business_slug]):
    raise RuntimeError("Required settings are missing from backend/.env")

supabase = create_client(supabase_url, supabase_key, options=ClientOptions(
    postgrest_client_timeout=10, postgrest_client_retry=False,
    auto_refresh_token=False, persist_session=False,
))

app = FastAPI(title="ClinicFlow AI")
app.state.database = supabase
app.include_router(receptionist_router)
app.include_router(owner_router)

allowed_origins = [origin.strip() for origin in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]
if "*" in allowed_origins:
    raise RuntimeError("ALLOWED_ORIGINS must list explicit frontend origins.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def prevent_admin_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/admin"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def database_health():
    try:
        result = (
            supabase.table("businesses")
            .select("id")
            .eq("slug", business_slug)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed.",
        ) from None

    if not result.data:
        raise HTTPException(
            status_code=503,
            detail="Demo business record was not found.",
        )

    return {"status": "ok", "database": "connected"}


class AppointmentRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=7, max_length=30)
    service: str = Field(min_length=1, max_length=100)
    preferred_date: date
    preferred_time: time
    message: str = Field(default="", max_length=500)
    request_key: UUID | None = None

    @field_validator("customer_name", "phone", mode="before")
    @classmethod
    def trim_text(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        digits = "".join(
            character for character in value if character.isdigit()
        )

        if not 7 <= len(digits) <= 15:
            raise ValueError("Phone must contain 7 to 15 digits.")

        if any(character not in "0123456789+()- " for character in value):
            raise ValueError("Phone contains unsupported characters.")

        return value

    @field_validator("preferred_time")
    @classmethod
    def validate_time(cls, value):
        if value.tzinfo is not None:
            raise ValueError("Use the business local time without a timezone offset.")
        return value


request_history = defaultdict(deque)
rate_limit_lock = Lock()


@app.post("/appointments", status_code=201)
def create_appointment(appointment: AppointmentRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    current_time = monotonic()

    with rate_limit_lock:
        expired_ips = [
            ip
            for ip, timestamps in request_history.items()
            if not timestamps or current_time - timestamps[-1] >= 60
        ]

        for ip in expired_ips:
            del request_history[ip]

        timestamps = request_history[client_ip]

        while timestamps and current_time - timestamps[0] >= 60:
            timestamps.popleft()

        if len(timestamps) >= 5:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait one minute.",
                headers={"Retry-After": "60"},
            )

        timestamps.append(current_time)

    business, settings = load_business(supabase)
    payload = appointment.model_dump(mode="json", exclude={"request_key"})
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    if appointment.request_key:
        existing = existing_appointment(supabase, business["id"], appointment.request_key, fingerprint)
        if existing:
            return existing
    if appointment.service not in {service.name for service in settings.services}:
        raise HTTPException(422, "Select a currently listed service. Refresh the form.")
    preferred_datetime = datetime.combine(
        appointment.preferred_date, appointment.preferred_time,
        tzinfo=ZoneInfo(settings.timezone),
    )
    if preferred_datetime <= datetime.now(ZoneInfo(settings.timezone)):
        raise HTTPException(422, "Please choose a future date and time in the business timezone.")

    try:
        appointment_data = dict(payload)
        if appointment.request_key:
            appointment_data["request_key"] = str(appointment.request_key)
            appointment_data["request_fingerprint"] = fingerprint
        appointment_data["business_id"] = business["id"]
        appointment_data["status"] = "New"

        saved = (
            supabase.table("appointments")
            .insert(appointment_data)
            .execute()
        )

        if not saved.data:
            raise HTTPException(
                status_code=503,
                detail="Could not verify that the request was saved.",
            )

    except HTTPException:
        raise
    except APIError as error:
        if error.code == "23505" and appointment.request_key:
            existing = existing_appointment(supabase, business["id"], appointment.request_key, fingerprint)
            if existing:
                return existing
        raise HTTPException(503, "Could not save the request. Retry without changing the form.") from None
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not save the request. Please contact reception.",
        ) from None

    return {
        "request_id": saved.data[0]["id"],
        "status": "New",
        "message": "Appointment request received. Reception must confirm it.",
    }


@app.get("/business")
def public_business():
    business, settings = load_business(supabase)
    return {"settings": settings.model_dump(), "version": business.get("settings_version", 0), "is_demo": True}


def existing_appointment(database, business_id, request_key, fingerprint):
    try:
        result = (database.table("appointments").select("id,status,request_fingerprint")
                  .eq("business_id", business_id).eq("request_key", str(request_key)).limit(1).execute())
    except Exception:
        raise HTTPException(503, "Could not check the previous request. Please retry later.") from None
    if not result.data:
        return None
    row = result.data[0]
    if row.get("request_fingerprint") != fingerprint:
        raise HTTPException(409, "This request reference was already used. Change a field to start a new request.")
    return {"request_id": row["id"], "status": row["status"],
            "message": "This appointment request was already received. Reception handles confirmation."}
