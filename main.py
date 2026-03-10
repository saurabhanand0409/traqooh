# Version 1.8.2 - Build Compatibility Check
from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
import datetime
import models
from database import engine, get_db
from passlib.context import CryptContext
import traceback
import logging
import os
import shutil

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Auth setup - Robustly handle the 72 byte bcrypt limit
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__truncate_error=False
)

def safe_truncate_password(password: str) -> str:
    """Manually truncate to 72 bytes to be 100% sure we never hit the bcrypt limit."""
    if not password:
        return ""
    # Encode to bytes, slice to 72, then decode back (safely)
    pw_bytes = password.encode('utf-8')[:72]
    return pw_bytes.decode('utf-8', errors='ignore')

def verify_password(plain_password, hashed_password):
    try:
        # Truncate input before verification
        truncated = safe_truncate_password(plain_password)
        return pwd_context.verify(truncated, hashed_password)
    except Exception as e:
        logger.error(f"Verify error: {e}")
        return False

def hash_password(password):
    if not password:
        raise ValueError("Password cannot be empty")
    truncated = safe_truncate_password(password)
    return pwd_context.hash(truncated)

# Connect DB schema
try:
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified")
except Exception as e:
    logger.error(f"DB Startup Error: {e}")

app = FastAPI(
    title="TraqOOH API",
    description="Backend API for TraqOOH SaaS Platform",
    version="1.8.2"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    companyName: Optional[str] = None
    token: str
    success: bool = True

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

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.8.2", "time": str(datetime.datetime.now())}

@app.get("/")
def read_root():
    return {"message": "Welcome to the TraqOOH Python API!"}

# Auth & User Routes
@app.post("/api/auth/login", response_model=LoginResponse)
@app.post("/api/mobile/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.email.strip())).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        
        company_id = None
        company_name = None
        if user.gst_registration_id:
            gst = db.query(models.GstRegistration).filter(models.GstRegistration.id == user.gst_registration_id).first()
            if gst:
                company_id = gst.company_id
                company = db.query(models.Company).filter(models.Company.id == gst.company_id).first()
                if company:
                    company_name = company.name
                
        return LoginResponse(
            userId=user.id,
            email=user.email,
            role=user.role,
            gstRegistrationId=user.gst_registration_id,
            companyId=company_id,
            companyName=company_name,
            token="token-placeholder",
            success=True
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/media-owners")
def create_media_owner(req: CreateMediaOwnerRequest, db: Session = Depends(get_db)):
    """
    Transactions: We only commit at the VERY END to prevent partial data (zombie GSTs).
    """
    try:
        logger.info(f"REGISTRATION ATTEMPT: {req.primaryEmail} with GST {req.gstNumber}")
        
        # 1. Check if Email already exists
        existing_user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.primaryEmail.strip())).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        # 2. Check if GST already exists
        existing_gst = db.query(models.GstRegistration).filter(models.GstRegistration.gst_number == req.gstNumber.strip()).first()
        if existing_gst:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="GST number already registered")

        # 3. Find or Create Company
        company = db.query(models.Company).filter(models.Company.name.ilike(req.companyName.strip())).first()
        if not company:
            company = models.Company(name=req.companyName.strip(), roc_attachment_url=req.rocAttachmentUrl)
            db.add(company)
            db.flush() # Get company.id without committing

        # 4. Create GST Registration
        gst = models.GstRegistration(
            company_id=company.id,
            gst_number=req.gstNumber.strip(),
            gst_certificate_url=req.gstCertificateUrl,
            address=req.gstAddress,
            director_name=req.directorName,
            director_phone=req.directorPhone,
            primary_email=req.primaryEmail.strip(),
            primary_phone=req.primaryPhone
        )
        db.add(gst)
        db.flush() # Get gst.id

        # 5. Create User Account
        pw_hash = hash_password(req.accountPassword)
        user_account = models.UserAccount(
            email=req.primaryEmail.lower().strip(),
            password_hash=pw_hash,
            role=req.role or "MEDIA_OWNER",
            gst_registration_id=gst.id
        )
        db.add(user_account)

        # 6. Create Contacts
        for c in req.contacts:
            contact = models.Contact(
                gst_registration_id=gst.id,
                name=c.name,
                email=c.email.strip(),
                phone=c.phone
            )
            db.add(contact)
        
        # FINAL COMMIT - All or nothing
        db.commit()
        logger.info(f"REGISTRATION SUCCESS: {req.primaryEmail}")
        return {"message": "Success", "gst_id": gst.id}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Registration Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/media-owners/all")
def get_all_media_owners(db: Session = Depends(get_db)):
    gsts = db.query(models.GstRegistration).options(joinedload(models.GstRegistration.company)).all()
    results = []
    for g in gsts:
        results.append({
            "companyId": g.company_id,
            "companyName": g.company.name if g.company else "Unknown",
            "gstNumber": g.gst_number,
            "gstId": g.id
        })
    return results

# Inventory / Site Routes
@app.get("/api/sites")
@app.get("/api/mobile/sites")
def get_sites(ownerId: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Site).options(joinedload(models.Site.owner))
    if ownerId:
        query = query.filter(models.Site.owner_company_id == ownerId)
    sites = query.all()
    
    results = []
    for s in sites:
        results.append({
            "id": s.id,
            "name": s.name,
            "city": s.city,
            "type": s.type,
            "status": s.status,
            "size": s.size,
            "facing": s.facing,
            "potentialMonthly": float(s.potential_monthly or 0),
            "occupancy": s.occupancy,
            "imageUrl": s.image_url,
            "owner": {
                "id": s.owner.id,
                "name": s.owner.name
            } if s.owner else None,
            "created_at": s.created_at
        })
    return results

@app.get("/api/mobile/sites/{site_id}")
def get_site_details(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).options(joinedload(models.Site.owner)).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return {
        "id": site.id,
        "name": site.name,
        "city": site.city,
        "type": site.type,
        "status": site.status,
        "size": site.size,
        "facing": site.facing,
        "potentialMonthly": float(site.potential_monthly or 0),
        "occupancy": site.occupancy,
        "imageUrl": site.image_url,
        "owner": {
            "id": site.owner.id,
            "name": site.owner.name
        } if site.owner else None
    }

@app.post("/api/sites")
def create_site(req: SiteCreate, db: Session = Depends(get_db)):
    site = models.Site(
        name=req.name,
        city=req.city,
        type=req.type,
        status=req.status,
        size=req.size,
        facing=req.facing,
        potential_monthly=int(req.potentialMonthly or 0),
        occupancy=req.occupancy or 0,
        image_url=req.imageUrl,
        owner_company_id=req.ownerCompanyId
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    db.refresh(site, ["owner"])
    return site

@app.put("/api/sites/{site_id}")
def update_site(site_id: int, req: SiteCreate, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    site.name = req.name
    site.city = req.city
    site.type = req.type
    site.status = req.status
    site.size = req.size
    site.facing = req.facing
    site.potential_monthly = int(req.potentialMonthly or 0)
    site.occupancy = req.occupancy or 0
    site.image_url = req.imageUrl
    
    db.commit()
    db.refresh(site, ["owner"])
    return site

# Dashboard Routes
@app.get("/api/dashboard/summary")
def get_dashboard_summary(ownerCompanyId: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Site)
    if ownerCompanyId:
        query = query.filter(models.Site.owner_company_id == ownerCompanyId)
    
    total_inventory = query.count()
    active_bookings = query.filter(models.Site.status == "Active").count()
    
    revenue_sum = db.query(func.sum(models.Site.potential_monthly))
    if ownerCompanyId:
        revenue_sum = revenue_sum.filter(models.Site.owner_company_id == ownerCompanyId)
    monthly_revenue = revenue_sum.scalar() or 0
    
    occupancy_avg = db.query(func.avg(models.Site.occupancy))
    if ownerCompanyId:
        occupancy_avg = occupancy_avg.filter(models.Site.owner_company_id == ownerCompanyId)
    average_occupancy = occupancy_avg.scalar() or 0
    
    return {
        "totalInventory": total_inventory,
        "activeBookings": active_bookings,
        "monthlyRevenue": float(monthly_revenue) * 100000, 
        "averageOccupancy": float(average_occupancy)
    }

@app.get("/api/dashboard/recent-activity")
def get_recent_activity(db: Session = Depends(get_db)):
    return [
        {"text": "Portal update: Added new Site model", "time": "Just now"},
        {"text": "System: Database tables verified", "time": "2 mins ago"},
        {"text": "Admin: Connected Mobile App API", "time": "1 hour ago"},
        {"text": "Registration: New Media Owner joined", "time": "3 hours ago"},
    ]

# Mobile Upload Placeholder
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/mobile/upload")
async def upload_file(file: UploadFile = File(...), siteId: Optional[int] = None):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"imageUrl": f"https://traqooh-backend-python.onrender.com/uploads/{file.filename}", "success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db)):
    return db.query(models.Company).all()
