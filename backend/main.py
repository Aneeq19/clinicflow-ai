import os
from collections import defaultdict, deque
from datetime import date, datetime, time
from pathlib import Path
from threading import Lock
from time import monotonic
from typing import Literal
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from supabase import create_client
from receptionist import router as receptionist_router
from owner_admin import router as owner_router


load_dotenv(Path(__file__).resolve().parent / ".env")

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SECRET_KEY")
business_slug = os.getenv("BUSINESS_SLUG")

if not all([supabase_url, supabase_key, business_slug]):
    raise RuntimeError("Required settings are missing from backend/.env")

supabase = create_client(supabase_url, supabase_key)

app = FastAPI(title="ClinicFlow AI")
app.state.database = supabase
app.include_router(receptionist_router)
app.include_router(owner_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST", "PATCH"],
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
    service: Literal[
        "Dental checkup",
        "Teeth cleaning",
        "Restorative care",
    ]
    preferred_date: date
    preferred_time: time
    message: str = Field(default="", max_length=500)

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
            raise ValueError("Use Karachi time without a timezone offset.")
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

    preferred_datetime = datetime.combine(
        appointment.preferred_date,
        appointment.preferred_time,
        tzinfo=ZoneInfo("Asia/Karachi"),
    )

    if preferred_datetime <= datetime.now(ZoneInfo("Asia/Karachi")):
        raise HTTPException(
            status_code=422,
            detail="Please choose a future date and time in Karachi.",
        )

    try:
        business = (
            supabase.table("businesses")
            .select("id")
            .eq("slug", business_slug)
            .limit(1)
            .execute()
        )

        if not business.data:
            raise HTTPException(
                status_code=503,
                detail="Business configuration is unavailable.",
            )

        appointment_data = appointment.model_dump(mode="json")
        appointment_data["business_id"] = business.data[0]["id"]
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
