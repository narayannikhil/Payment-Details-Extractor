from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Sport
from schemas import SportCreate, SportResponse

router = APIRouter(prefix="/api/sports", tags=["Sports"])


@router.get("", response_model=list[SportResponse])
def list_sports(db: Session = Depends(get_db)):
    """List all sports categories."""
    return db.query(Sport).order_by(Sport.name).all()


@router.post("", response_model=SportResponse, status_code=201)
def create_sport(data: SportCreate, db: Session = Depends(get_db)):
    """Create a new sport category."""
    existing = db.query(Sport).filter(Sport.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Sport already exists")

    sport = Sport(name=data.name, icon=data.icon, description=data.description)
    db.add(sport)
    db.commit()
    db.refresh(sport)
    return sport


@router.delete("/{sport_id}", status_code=204)
def delete_sport(sport_id: int, db: Session = Depends(get_db)):
    """Delete a sport category."""
    sport = db.query(Sport).filter(Sport.id == sport_id).first()
    if not sport:
        raise HTTPException(status_code=404, detail="Sport not found")
    db.delete(sport)
    db.commit()
