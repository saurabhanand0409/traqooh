from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from database import engine, get_db

# Connect DB schema
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TraqOOH API",
    description="Backend API for TraqOOH SaaS Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the TraqOOH Python API!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/companies")
def get_companies(db: Session = Depends(get_db)):
    """Fetches list of companies from your existing PostgreSQL database."""
    companies = db.query(models.Company).all()
    return companies
