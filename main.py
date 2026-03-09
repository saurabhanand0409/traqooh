from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import models
from database import engine, get_db
from passlib.context import CryptContext

# Auth setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

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

# Pydantic Schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    userId: int
    email: str
    role: str
    gstRegistrationId: Optional[int] = None
    companyId: Optional[int] = None
    token: str

class CompanyResponse(BaseModel):
    id: int
    name: str
    roc_attachment_url: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

import datetime

@app.get("/")
def read_root():
    return {"message": "Welcome to the TraqOOH Python API!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# API Routes with /api prefix
@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.email)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    # Get companyId if gstRegistrationId exists
    company_id = None
    if user.gst_registration_id:
        gst = db.query(models.GstRegistration).filter(models.GstRegistration.id == user.gst_registration_id).first()
        if gst:
            company_id = gst.company_id
            
    return LoginResponse(
        userId=user.id,
        email=user.email,
        role=user.role,
        gstRegistrationId=user.gst_registration_id,
        companyId=company_id,
        token="token-placeholder" # Placeholder for JWT
    )

@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db)):
    """Fetches list of companies from your existing PostgreSQL database."""
    companies = db.query(models.Company).all()
    return companies
