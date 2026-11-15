from datetime import time
from typing import Literal
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


class Service(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=300)
    price: str = Field(default='', max_length=80)


class FAQ(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    question: str = Field(min_length=1, max_length=200)
    answer: str = Field(min_length=1, max_length=500)


class Hours(BaseModel):
    model_config = ConfigDict(extra='forbid')
    day: Literal['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    closed: bool = False
    opens: str = '10:00'
    closes: str = '19:00'

    @model_validator(mode='after')
    def valid_times(self):
        if not self.closed:
            try:
                start, end = time.fromisoformat(self.opens), time.fromisoformat(self.closes)
                if start.tzinfo or end.tzinfo or start >= end:
                    raise ValueError()
            except ValueError:
                raise ValueError('Open hours must be valid local times with closing after opening.') from None
        return self


class BusinessSettings(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(default='Pearl Dental Care, Karachi', min_length=1, max_length=120)
    industry: str = Field(default='Dental clinic', min_length=1, max_length=80)
    introduction: str = Field(default='A welcoming place to explore care, ask questions and plan your next visit.', max_length=800)
    phone: str = Field(default='', max_length=50)
    address: str = Field(default='', max_length=300)
    timezone: str = Field(default='Asia/Karachi', max_length=80)
    logo_url: str = Field(default='', max_length=500)
    brand_color: str = Field(default='#123f38', pattern=r'^#[0-9a-fA-F]{6}$')
    greeting: str = Field(default='Assalam o Alaikum! Welcome to our fictional demo. How can reception help you?', min_length=1, max_length=300)
    tone: Literal['friendly', 'professional', 'concise'] = 'friendly'
    handoff_contact: str = Field(default='', max_length=200)
    appointment_rules: str = Field(default='Requests require reception confirmation. Please use sample details only.', max_length=500)
    services: list[Service] = Field(default_factory=lambda: [
        Service(name='Dental checkup', description='Explore what a routine dental visit can cover.'),
        Service(name='Teeth cleaning', description='Learn about a professional cleaning appointment.'),
        Service(name='Restorative care', description='Explore sample services such as fillings and crowns.'),
    ], min_length=1, max_length=20)
    faqs: list[FAQ] = Field(default_factory=list, max_length=20)
    hours: list[Hours] = Field(default_factory=lambda: [Hours(day=day, closed=day == 'Sunday') for day in DAYS], min_length=7, max_length=7)

    @field_validator('timezone')
    @classmethod
    def valid_zone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError('Use a valid IANA timezone, such as Asia/Karachi.') from None
        return value

    @field_validator('logo_url')
    @classmethod
    def valid_logo(cls, value):
        if value:
            url = urlparse(value)
            if url.scheme != 'https' or not url.hostname or url.username or url.password:
                raise ValueError('Logo must be a public HTTPS image URL without credentials.')
        return value

    @model_validator(mode='after')
    def unique_entries(self):
        if {row.day for row in self.hours} != set(DAYS):
            raise ValueError('Include each weekday exactly once.')
        names = [service.name.casefold() for service in self.services]
        if len(names) != len(set(names)):
            raise ValueError('Service names must be unique.')
        return self


class SettingsDocument(BaseModel):
    settings: BusinessSettings
    version: int = Field(ge=0)


def load_business(database, business_id=None):
    import os
    try:
        query = database.table('businesses').select('*')
        query = query.eq('id', business_id) if business_id else query.eq('slug', os.getenv('BUSINESS_SLUG', ''))
        result = query.limit(1).execute()
        if not result.data:
            raise HTTPException(503, 'Business settings are unavailable.')
        business = result.data[0]
        raw = dict(business.get('settings') or {})
        raw.update(name=business['name'], timezone=business.get('timezone', 'Asia/Karachi'))
        settings = BusinessSettings.model_validate(raw)
        return business, settings
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Could not load business settings.') from None
