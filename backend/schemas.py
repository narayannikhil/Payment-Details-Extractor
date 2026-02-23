from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# ── Auth Schemas ──────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Sport Schemas ─────────────────────────────────────────────

class SportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    icon: str = Field(default="🏆", max_length=10)
    description: str = Field(default="", max_length=200)


class SportResponse(BaseModel):
    id: int
    name: str
    icon: str
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Payment Schemas ───────────────────────────────────────────

class PaymentResponse(BaseModel):
    id: int
    user_id: int
    sport_id: Optional[int] = None
    transaction_id: Optional[str] = None
    amount: Optional[float] = None
    sender_name: Optional[str] = None
    receiver_name: Optional[str] = None
    date: Optional[str] = None
    status: str
    upi_id: Optional[str] = None
    screenshot_path: str
    raw_ocr_text: Optional[str] = None
    created_at: datetime
    sport: Optional[SportResponse] = None

    class Config:
        from_attributes = True


class PaymentUpdate(BaseModel):
    sport_id: Optional[int] = None
    transaction_id: Optional[str] = None
    amount: Optional[float] = None
    sender_name: Optional[str] = None
    receiver_name: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    upi_id: Optional[str] = None


class OCRResultResponse(BaseModel):
    raw_text: str
    extracted: dict
    message: str
