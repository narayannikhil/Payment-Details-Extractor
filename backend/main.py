from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from models import Sport
from database import SessionLocal
from routes import auth_routes, payment_routes, sport_routes
from config import UPLOAD_DIR

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Payment Details Extractor API",
    description="Upload UPI payment screenshots, extract details via OCR, and track payments.",
    version="1.0.0",
)

# CORS – allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded screenshots
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Register route modules
app.include_router(auth_routes.router)
app.include_router(payment_routes.router)
app.include_router(sport_routes.router)


@app.on_event("startup")
def seed_sports():
    """Seed default sports categories on first run."""
    db = SessionLocal()
    try:
        if db.query(Sport).count() == 0:
            defaults = [
                Sport(name="Cricket", icon="🏏", description="Cricket match fees and tournament payments"),
                Sport(name="Football", icon="⚽", description="Football league and match payments"),
                Sport(name="Badminton", icon="🏸", description="Badminton court and tournament fees"),
                Sport(name="Tennis", icon="🎾", description="Tennis coaching and match payments"),
                Sport(name="Basketball", icon="🏀", description="Basketball league payments"),
                Sport(name="Swimming", icon="🏊", description="Swimming pool and coaching fees"),
                Sport(name="Gym", icon="🏋️", description="Gym membership and trainer payments"),
                Sport(name="Other", icon="🏆", description="Other sports and miscellaneous payments"),
            ]
            db.add_all(defaults)
            db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Payment Details Extractor API", "docs": "/docs"}
