from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import datetime
import models
from database import engine, get_db
from passlib.context import CryptContext
import traceback
import logging

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Auth setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password):
    return pwd_context.hash(password)

# Connect DB schema
try:
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
except Exception as e:
    logger.error(f"DB Error on startup: {e}")

app = FastAPI(
    title="TraqOOH API",
    description="Backend API for TraqOOH SaaS Platform",
    version="1.1.0"
)

# CORS configuration - Explicitly allowing the brandsculpt domain
origins = [
    "https://traqooh.brandsculpt.com",
    "http://traqooh.brandsculpt.com",
    "https://traqooh.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For debug, allowing all
    allow_credentials=False,
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

class ContactRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None

class CreateMediaOwnerRequest(BaseModel):
    companyName: str
    rocAttachmentUrl: Optional[str] = None
    companyAddress: Optional[str] = None
    gstNumber: str
    gstCertificateUrl: Optional[str] = None
    gstAddress: str
    directorName: str
    directorPhone: str
    primaryEmail: str
    primaryPhone: Optional[str] = None
    accountPassword: str
    role: Optional[str] = "MEDIA_OWNER"
    contacts: List[ContactRequest]

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

@app.get("/")
def read_root():
    return {"message": "Welcome to the TraqOOH Python API!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# API Routes
@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/media-owners")
def create_media_owner(req: CreateMediaOwnerRequest, db: Session = Depends(get_db)):
    try:
        logger.info(f"Registering media owner: {req.primaryEmail}")
        # 1. Check if GST already exists
        existing_gst = db.query(models.GstRegistration).filter(models.GstRegistration.gst_number == req.gstNumber).first()
        if existing_gst:
            logger.warning(f"Conflict: GST {req.gstNumber} already exists")
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="GST number already registered")

        # 2. Check if Email already exists in UserAccounts
        existing_user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.primaryEmail)).first()
        if existing_user:
            logger.warning(f"Conflict: Email {req.primaryEmail} already exists")
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        # 3. Find or Create Company
        company = db.query(models.Company).filter(models.Company.name.ilike(req.companyName)).first()
        if not company:
            company = models.Company(
                name=req.companyName,
                roc_attachment_url=req.rocAttachmentUrl
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        # 4. Create GST Registration
        gst = models.GstRegistration(
            company_id=company.id,
            gst_number=req.gstNumber,
            gst_certificate_url=req.gstCertificateUrl,
            address=req.gstAddress,
            director_name=req.directorName,
            director_phone=req.directorPhone,
            primary_email=req.primaryEmail,
            primary_phone=req.primaryPhone
        )
        db.add(gst)
        db.commit()
        db.refresh(gst)

        # 5. Create User Account
        password_hash = hash_password(req.accountPassword)
        user_account = models.UserAccount(
            email=req.primaryEmail.lower().strip(),
            password_hash=password_hash,
            role=req.role or "MEDIA_OWNER",
            gst_registration_id=gst.id
        )
        db.add(user_account)
        db.commit()

        # 6. Create Contacts
        for c in req.contacts:
            contact = models.Contact(
                gst_registration_id=gst.id,
                name=c.name,
                email=c.email,
                phone=c.phone
            )
            db.add(contact)
        db.commit()

        logger.info(f"Successfully created media owner for {req.primaryEmail}")
        return {"message": "Success", "gst_id": gst.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration Error: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db)):
    companies = db.query(models.Company).all()
    return companies
