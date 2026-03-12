# Version 1.8.4 - Native Bcrypt + SHA256 Fix
from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
import datetime
import models
from database import engine, get_db
import traceback
import logging
import os
import shutil
import hashlib
import bcrypt
import boto3
from botocore.config import Config

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- BULLETPROOF HASHING (Fixes 72-byte limit) ---
def hash_password(password: str) -> str:
    """Pre-hash with SHA256 then bcrypt to avoid 72-byte limit."""
    if not password:
        raise ValueError("Password cannot be empty")
    # Pre-hash to 64 bytes (hexdigest)
    pw_digest = hashlib.sha256(password.encode('utf-8')).hexdigest()
    # Bcrypt the hex (always 64 bytes)
    hashed = bcrypt.hashpw(pw_digest.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check SHA256+Bcrypt format. Supports old format as fallback if needed."""
    try:
        if not plain_password or not hashed_password:
            return False
        
        # New format check (SHA256 pre-hash)
        pw_digest = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
        if bcrypt.checkpw(pw_digest.encode('utf-8'), hashed_password.encode('utf-8')):
            return True
        
        # Fallback (Direct truncation) for users created in brief window of v1.8.3
        truncated = plain_password.encode('utf-8')[:72]
        if bcrypt.checkpw(truncated, hashed_password.encode('utf-8')):
            return True
            
        return False
    except Exception as e:
        logger.error(f"Verify error: {e}")
        return False

# Connect DB schema
def run_migrations():
    """Ensure database schema is up to date."""
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # Add new columns if they don't exist
            logger.info("Running database migrations...")
            conn.execute(text("ALTER TABLE sites ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE sites ADD COLUMN IF NOT EXISTS length INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE sites ADD COLUMN IF NOT EXISTS total_area INTEGER DEFAULT 0"))
            conn.commit()
            logger.info("Database migrations completed successfully")
    except Exception as e:
        logger.warning(f"Migration check skipped or failed: {e}")

try:
    run_migrations()
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified")
except Exception as e:
    logger.error(f"DB Startup Error: {e}")

app = FastAPI(
    title="TraqOOH API",
    description="Backend API for TraqOOH SaaS Platform",
    version="1.8.5"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CLOUDFLARE R2 CONFIGURATION ---
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_DOMAIN = os.getenv("R2_PUBLIC_DOMAIN") # e.g. https://pub-xxx.r2.dev

r2_client = None
if R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_ENDPOINT_URL:
    r2_client = boto3.client(
        service_name='s3',
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )
    logger.info("Cloudflare R2 storage initialized")

# Local Serving (Fallback)
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

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

class SiteBase(BaseModel):
    name: str
    city: str
    type: str
    status: Optional[str] = "Active"
    size: Optional[str] = None
    width: Optional[int] = 0
    length: Optional[int] = 0
    totalArea: Optional[int] = 0
    facing: Optional[str] = None
    potentialMonthly: Optional[float] = 0.0
    occupancy: Optional[int] = 0
    imageUrl: Optional[str] = None
    ownerCompanyId: Optional[int] = None

class SiteCreate(SiteBase):
    pass

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.8.5", "time": str(datetime.datetime.now())}

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
    try:
        logger.info(f"REGISTRATION ATTEMPT: {req.primaryEmail} with GST {req.gstNumber}")
        
        # 1. Check if Email already exists
        existing_user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.primaryEmail.strip())).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        # 2. Check if GST already exists & SELF-HEAL ZOMBIES
        existing_gst = db.query(models.GstRegistration).filter(models.GstRegistration.gst_number == req.gstNumber.strip()).first()
        if existing_gst:
            # check if this GST has a user attached
            user_linked = db.query(models.UserAccount).filter(models.UserAccount.gst_registration_id == existing_gst.id).first()
            if not user_linked:
                # ZOMBIE GST detected (from partial crash 1.5.0/1.7.0). CLEAN IT!
                logger.info(f"Cleaning up zombie GST {existing_gst.id} for retry")
                db.query(models.Contact).filter(models.Contact.gst_registration_id == existing_gst.id).delete()
                db.delete(existing_gst)
                db.commit() # Clear it so we can re-create fresh
            else:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="GST number already registered")

        # 3. Find or Create Company
        company = db.query(models.Company).filter(models.Company.name.ilike(req.companyName.strip())).first()
        if not company:
            company = models.Company(name=req.companyName.strip(), roc_attachment_url=req.rocAttachmentUrl)
            db.add(company)
            db.flush() 

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
        db.flush() 

        # 5. Create User Account (BULLETPROOF HASH)
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
        width=req.width or 0,
        length=req.length or 0,
        total_area=(req.width or 0) * (req.length or 0),
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
    site.width = req.width or 0
    site.length = req.length or 0
    site.total_area = (req.width or 0) * (req.length or 0)
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
    monthly_revenue = (revenue_sum.scalar() or 0) * 100000
    
    occupancy_avg = db.query(func.avg(models.Site.occupancy))
    if ownerCompanyId:
        occupancy_avg = occupancy_avg.filter(models.Site.owner_company_id == ownerCompanyId)
    average_occupancy = occupancy_avg.scalar() or 0
    
    return {
        "totalInventory": total_inventory,
        "activeBookings": active_bookings,
        "monthlyRevenue": float(monthly_revenue), 
        "averageOccupancy": float(average_occupancy)
    }

@app.get("/api/dashboard/recent-activity")
def get_recent_activity(db: Session = Depends(get_db)):
    return [
        {"text": "Portal update: Enhanced Password Hashing v1.8.4", "time": "Just now"},
        {"text": "System: Database self-healing active", "time": "2 mins ago"},
        {"text": "Admin: Fixed 72-byte bcrypt limit", "time": "5 mins ago"},
        {"text": "Registration: Ready for infinite length passwords", "time": "10 mins ago"},
    ]

# Mobile Upload Placeholder
# --- API Routes ---
@app.post("/api/upload")
@app.post("/api/mobile/upload")
async def upload_file(file: UploadFile = File(...), siteId: Optional[int] = None):
    try:
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}{ext}"
        
        # Use R2 if configured, otherwise fallback to local
        if r2_client and R2_BUCKET_NAME:
            logger.info(f"Uploading {unique_filename} to R2 bucket: {R2_BUCKET_NAME}")
            r2_client.upload_fileobj(
                file.file, 
                R2_BUCKET_NAME, 
                unique_filename,
                ExtraArgs={'ContentType': file.content_type}
            )
            
            if R2_PUBLIC_DOMAIN:
                image_url = f"{R2_PUBLIC_DOMAIN.rstrip('/')}/{unique_filename}"
            else:
                image_url = f"/uploads/{unique_filename}"
                
            return {"imageUrl": image_url, "success": True, "storage": "r2"}
        else:
            # Fallback to local storage
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            return {
                "imageUrl": f"/uploads/{unique_filename}", 
                "success": True,
                "storage": "local"
            }
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db)):
    return db.query(models.Company).all()
