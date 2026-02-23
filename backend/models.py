from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")


class Sport(Base):
    __tablename__ = "sports"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    icon = Column(String(10), default="🏆")
    description = Column(String(200), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    payments = relationship("Payment", back_populates="sport")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sport_id = Column(Integer, ForeignKey("sports.id"), nullable=True)
    transaction_id = Column(String(100), nullable=True)
    amount = Column(Float, nullable=True)
    sender_name = Column(String(100), nullable=True)
    receiver_name = Column(String(100), nullable=True)
    date = Column(String(50), nullable=True)
    status = Column(String(20), default="Completed")
    upi_id = Column(String(100), nullable=True)
    screenshot_path = Column(String(255), nullable=False)
    raw_ocr_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="payments")
    sport = relationship("Sport", back_populates="payments")
