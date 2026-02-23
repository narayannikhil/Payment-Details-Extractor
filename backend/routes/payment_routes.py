import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
from models import Payment, User, Sport
from schemas import PaymentResponse, PaymentUpdate
from auth import get_current_user
from ocr_service import extract_payment_details
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/payments", tags=["Payments"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}


@router.post("/upload", response_model=PaymentResponse, status_code=201)
async def upload_payment(
    file: UploadFile = File(...),
    sport_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a UPI payment screenshot, run OCR, and save the payment."""
    # Validate file type
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")

    # Validate sport_id if provided
    if sport_id is not None:
        sport = db.query(Sport).filter(Sport.id == sport_id).first()
        if not sport:
            raise HTTPException(status_code=404, detail="Sport category not found")

    # Save file
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="File size must be under 10 MB")
    with open(filepath, "wb") as f:
        f.write(content)

    # Run OCR
    ocr_result = extract_payment_details(filepath)
    extracted = ocr_result.get("extracted", {})

    # Create payment record
    payment = Payment(
        user_id=current_user.id,
        sport_id=sport_id,
        transaction_id=extracted.get("transaction_id"),
        amount=extracted.get("amount"),
        sender_name=extracted.get("sender_name"),
        receiver_name=extracted.get("receiver_name"),
        date=extracted.get("date"),
        status=extracted.get("status", "Completed"),
        upi_id=extracted.get("upi_id"),
        screenshot_path=filename,
        raw_ocr_text=ocr_result.get("raw_text", ""),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Eagerly load sport relationship
    if payment.sport_id:
        db.refresh(payment, ["sport"])

    return payment


@router.get("", response_model=list[PaymentResponse])
def list_payments(
    sport_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all payments for the current user with optional filters."""
    query = (
        db.query(Payment)
        .options(joinedload(Payment.sport))
        .filter(Payment.user_id == current_user.id)
    )
    if sport_id is not None:
        query = query.filter(Payment.sport_id == sport_id)
    if status:
        query = query.filter(Payment.status.ilike(f"%{status}%"))
    if search:
        query = query.filter(
            (Payment.transaction_id.ilike(f"%{search}%"))
            | (Payment.sender_name.ilike(f"%{search}%"))
            | (Payment.receiver_name.ilike(f"%{search}%"))
            | (Payment.upi_id.ilike(f"%{search}%"))
        )

    payments = query.order_by(Payment.created_at.desc()).all()
    return payments


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single payment by ID."""
    payment = (
        db.query(Payment)
        .options(joinedload(Payment.sport))
        .filter(Payment.id == payment_id, Payment.user_id == current_user.id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update payment details (e.g. correct OCR mistakes)."""
    payment = db.query(Payment).filter(Payment.id == payment_id, Payment.user_id == current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(payment, key, value)

    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}", status_code=204)
def delete_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a payment record."""
    payment = db.query(Payment).filter(Payment.id == payment_id, Payment.user_id == current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Remove screenshot file
    filepath = os.path.join(UPLOAD_DIR, payment.screenshot_path)
    if os.path.exists(filepath):
        os.remove(filepath)

    db.delete(payment)
    db.commit()
