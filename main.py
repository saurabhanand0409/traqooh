# TraqOOH Backend v2.0
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, inspect
from pydantic import BaseModel
from typing import Optional, List
import datetime
import models
from database import engine, get_db, Base
import traceback
import logging
import os
import shutil
import hashlib
import bcrypt
from utils import log_activity, site_to_dict, upload_to_r2

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Password Hashing ---
def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty")
    pw_digest = hashlib.sha256(password.encode('utf-8')).hexdigest()
    hashed = bcrypt.hashpw(pw_digest.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            return False
        pw_digest = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
        if bcrypt.checkpw(pw_digest.encode('utf-8'), hashed_password.encode('utf-8')):
            return True
        truncated = plain_password.encode('utf-8')[:72]
        if bcrypt.checkpw(truncated, hashed_password.encode('utf-8')):
            return True
        return False
    except Exception as e:
        logger.error(f"Verify error: {e}")
        return False

# --- Self-Healing Migration ---
def run_migrations():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("All tables created/verified successfully")
        # Add missing columns to existing tables
        with engine.connect() as conn:
            inspector = inspect(engine)
            # Companies table extensions
            co_cols = [c["name"] for c in inspector.get_columns("companies")]
            for col, typ in [("contact_person","VARCHAR"),("phone","VARCHAR"),("email","VARCHAR"),
                             ("gst_number","VARCHAR"),("city","VARCHAR"),("state","VARCHAR"),
                             ("notes","TEXT"),("vendor_status","VARCHAR DEFAULT 'ACTIVE'"),("address","VARCHAR")]:
                if col not in co_cols:
                    conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col} {typ}"))
                    conn.commit()
            # Sites table extensions
            si_cols = [c["name"] for c in inspector.get_columns("sites")]
            for col, typ in [("area_locality","VARCHAR"),("address","VARCHAR"),("base_rate","FLOAT DEFAULT 0"),
                             ("remarks","TEXT"),("availability_status","VARCHAR DEFAULT 'AVAILABLE'"),
                             ("available_from","DATE"),("available_till","DATE"),
                             ("occupied_from","DATE"),("occupied_till","DATE"),
                             ("current_campaign_id","INTEGER"),("latitude","FLOAT"),("longitude","FLOAT")]:
                if col not in si_cols:
                    conn.execute(text(f"ALTER TABLE sites ADD COLUMN {col} {typ}"))
                    conn.commit()
            # UserAccounts extensions
            ua_cols = [c["name"] for c in inspector.get_columns("user_accounts")]
            for col, typ in [("advertiser_id","INTEGER"),("display_name","VARCHAR"),
                             ("is_active","BOOLEAN DEFAULT TRUE"),("created_at","TIMESTAMP DEFAULT NOW()")]:
                if col not in ua_cols:
                    conn.execute(text(f"ALTER TABLE user_accounts ADD COLUMN {col} {typ}"))
                    conn.commit()
        logger.info("Migration complete")
    except Exception as e:
        logger.error(f"Migration error: {e}\n{traceback.format_exc()}")

# --- App Setup ---
app = FastAPI(title="TraqOOH API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

run_migrations()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- Include Routers ---
from routes.vendors import router as vendors_router
from routes.advertisers import router as advertisers_router
from routes.campaigns import router as campaigns_router
from routes.audits import router as audits_router
from routes.dashboard import router as dashboard_router
from routes.admin import router as admin_router

app.include_router(vendors_router)
app.include_router(advertisers_router)
app.include_router(campaigns_router)
app.include_router(audits_router)
app.include_router(dashboard_router)
app.include_router(admin_router)

# --- Pydantic Schemas ---
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
    advertiserId: Optional[int] = None
    displayName: Optional[str] = None
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

class SiteCreate(BaseModel):
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
    baseRate: Optional[float] = 0.0
    occupancy: Optional[int] = 0
    imageUrl: Optional[str] = None
    ownerCompanyId: Optional[int] = None
    areaLocality: Optional[str] = None
    address: Optional[str] = None
    remarks: Optional[str] = None
    availabilityStatus: Optional[str] = "AVAILABLE"
    availableFrom: Optional[str] = None
    availableTill: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# --- Core Routes ---
@app.get("/health")
def health_check():
    return {"status": "ok", "version": "2.1.0", "time": str(datetime.datetime.now())}

@app.get("/")
def read_root():
    return {"message": "Welcome to the TraqOOH API v2.0!"}

# --- TEMP: List all users (DELETE AFTER USE) ---
@app.get("/api/temp/list-users")
def temp_list_users(db: Session = Depends(get_db)):
    users = db.query(models.UserAccount).all()
    return [{"id": u.id, "email": u.email, "role": u.role} for u in users]

# --- TEMP: Fix admin by ID — clean email + reset password (DELETE AFTER USE) ---
@app.put("/api/temp/fix-admin")
def temp_fix_admin(user_id: int, new_email: str, new_password: str, db: Session = Depends(get_db)):
    user = db.query(models.UserAccount).filter(models.UserAccount.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email = new_email.strip()
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"success": True, "email": user.email, "role": user.role}

# --- TEMP: One-time email update utility (DELETE AFTER USE) ---
@app.put("/api/temp/update-email")
def temp_update_email(old_email: str, new_email: str, db: Session = Depends(get_db)):
    user = db.query(models.UserAccount).filter(models.UserAccount.email == old_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email = new_email
    db.commit()
    return {"success": True, "message": f"Email updated from {old_email} to {new_email}"}

# --- TEMP: One-time password reset utility (DELETE AFTER USE) ---
@app.put("/api/temp/reset-password")
def temp_reset_password(email: str, new_password: str, db: Session = Depends(get_db)):
    user = db.query(models.UserAccount).filter(models.UserAccount.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"success": True, "message": f"Password updated for {email}"}

# --- Auth ---
@app.post("/api/auth/login", response_model=LoginResponse)
@app.post("/api/mobile/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.email.strip())).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Normalize legacy roles
    role = user.role
    if role in ("MEDIA_OWNER", "TEAM_MEMBER"):
        role = "EMPLOYEE"
    company_id = None
    company_name = None
    if user.gst_registration_id:
        gst = db.query(models.GstRegistration).filter(models.GstRegistration.id == user.gst_registration_id).first()
        if gst:
            company_id = gst.company_id
            company = db.query(models.Company).filter(models.Company.id == gst.company_id).first()
            if company:
                company_name = company.name
    log_activity(db, "User logged in", "user", user.id, user.email, user.email)
    return LoginResponse(
        userId=user.id, email=user.email, role=role,  # normalized role
        gstRegistrationId=user.gst_registration_id, companyId=company_id,
        companyName=company_name, advertiserId=user.advertiser_id,
        displayName=user.display_name, token="token-placeholder", success=True
    )

@app.post("/api/auth/register")
@app.post("/api/media-owners")
def create_media_owner(req: CreateMediaOwnerRequest, db: Session = Depends(get_db)):
    try:
        existing_user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.primaryEmail.strip())).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="Email already registered")
        existing_gst = db.query(models.GstRegistration).filter(models.GstRegistration.gst_number == req.gstNumber.strip()).first()
        if existing_gst:
            user_linked = db.query(models.UserAccount).filter(models.UserAccount.gst_registration_id == existing_gst.id).first()
            if not user_linked:
                db.query(models.Contact).filter(models.Contact.gst_registration_id == existing_gst.id).delete()
                db.delete(existing_gst)
                db.commit()
            else:
                raise HTTPException(status_code=409, detail="GST number already registered")
        company = db.query(models.Company).filter(models.Company.name.ilike(req.companyName.strip())).first()
        if not company:
            company = models.Company(name=req.companyName.strip(), roc_attachment_url=req.rocAttachmentUrl)
            db.add(company)
            db.flush()
        gst = models.GstRegistration(
            company_id=company.id, gst_number=req.gstNumber.strip(),
            gst_certificate_url=req.gstCertificateUrl, address=req.gstAddress,
            director_name=req.directorName, director_phone=req.directorPhone,
            primary_email=req.primaryEmail.strip(), primary_phone=req.primaryPhone
        )
        db.add(gst)
        db.flush()
        user_account = models.UserAccount(
            email=req.primaryEmail.lower().strip(), password_hash=hash_password(req.accountPassword),
            role=req.role or "MEDIA_OWNER", gst_registration_id=gst.id, is_active=True
        )
        db.add(user_account)
        for c in req.contacts:
            db.add(models.Contact(gst_registration_id=gst.id, name=c.name, email=c.email.strip(), phone=c.phone))
        db.commit()
        log_activity(db, "New registration", "user", user_account.id, req.primaryEmail)
        return {"message": "Success", "gst_id": gst.id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Registration Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Sites ---
@app.get("/api/sites")
@app.get("/api/mobile/sites")
def get_sites(ownerId: Optional[int] = None, vendorId: Optional[int] = None,
              availabilityStatus: Optional[str] = None, city: Optional[str] = None,
              siteType: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Site).options(joinedload(models.Site.owner))
    if ownerId:
        query = query.filter(models.Site.owner_company_id == ownerId)
    if vendorId:
        query = query.filter(models.Site.owner_company_id == vendorId)
    if availabilityStatus:
        query = query.filter(models.Site.availability_status == availabilityStatus)
    if city:
        query = query.filter(models.Site.city.ilike(f"%{city}%"))
    if siteType:
        query = query.filter(models.Site.type == siteType)
    return [site_to_dict(s) for s in query.order_by(models.Site.city).all()]

@app.get("/api/mobile/sites/{site_id}")
@app.get("/api/sites/{site_id}")
def get_site_details(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).options(joinedload(models.Site.owner)).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    result = site_to_dict(site)
    # Campaign history
    assignments = db.query(models.CampaignSiteAssignment).filter(
        models.CampaignSiteAssignment.site_id == site_id).all()
    result["campaignHistory"] = [{
        "campaignId": a.campaign_id, "bookedFrom": str(a.booked_from) if a.booked_from else None,
        "bookedTill": str(a.booked_till) if a.booked_till else None,
        "agreedCost": a.agreed_cost, "status": a.status
    } for a in assignments]
    return result

@app.post("/api/sites")
def create_site(req: SiteCreate, db: Session = Depends(get_db)):
    from datetime import date
    site = models.Site(
        name=req.name, city=req.city, type=req.type, status=req.status, size=req.size,
        width=req.width or 0, length=req.length or 0,
        total_area=(req.width or 0) * (req.length or 0),
        facing=req.facing, potential_monthly=float(req.potentialMonthly or 0),
        base_rate=float(req.baseRate or 0), occupancy=req.occupancy or 0,
        image_url=req.imageUrl, owner_company_id=req.ownerCompanyId,
        area_locality=req.areaLocality, address=req.address, remarks=req.remarks,
        availability_status=req.availabilityStatus or "AVAILABLE",
        available_from=date.fromisoformat(req.availableFrom) if req.availableFrom else None,
        available_till=date.fromisoformat(req.availableTill) if req.availableTill else None,
        latitude=req.latitude, longitude=req.longitude,
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    log_activity(db, "Created site", "site", site.id, site.name)
    return site_to_dict(site)

@app.put("/api/sites/{site_id}")
def update_site(site_id: int, req: SiteCreate, db: Session = Depends(get_db)):
    from datetime import date
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    site.name = req.name; site.city = req.city; site.type = req.type
    site.status = req.status; site.size = req.size
    site.width = req.width or 0; site.length = req.length or 0
    site.total_area = (req.width or 0) * (req.length or 0)
    site.facing = req.facing
    site.potential_monthly = float(req.potentialMonthly or 0)
    site.base_rate = float(req.baseRate or 0)
    site.occupancy = req.occupancy or 0; site.image_url = req.imageUrl
    site.area_locality = req.areaLocality; site.address = req.address
    site.remarks = req.remarks
    site.availability_status = req.availabilityStatus or site.availability_status
    site.available_from = date.fromisoformat(req.availableFrom) if req.availableFrom else site.available_from
    site.available_till = date.fromisoformat(req.availableTill) if req.availableTill else site.available_till
    site.latitude = req.latitude; site.longitude = req.longitude
    db.commit()
    db.refresh(site)
    log_activity(db, "Updated site", "site", site.id, site.name)
    return site_to_dict(site)

@app.delete("/api/sites/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    db.delete(site)
    db.commit()
    return {"message": "Site deleted successfully"}

@app.get("/api/sites/{site_id}/bookings")
def get_site_bookings(site_id: int, db: Session = Depends(get_db)):
    """Fetch booking schedule for a specific site from CampaignSiteAssignment."""
    assignments = db.query(models.CampaignSiteAssignment).options(
        joinedload(models.CampaignSiteAssignment.campaign).joinedload(models.Campaign.advertiser)
    ).filter(
        models.CampaignSiteAssignment.site_id == site_id,
        models.CampaignSiteAssignment.status.in_(["ACTIVE", "PLANNED"])
    ).order_by(models.CampaignSiteAssignment.booked_from).all()

    bookings = []
    for a in assignments:
        camp = a.campaign
        adv = camp.advertiser if camp else None
        bookings.append({
            "assignmentId": a.id,
            "campaignId": a.campaign_id,
            "campaignName": camp.name if camp else "Unknown",
            "advertiserName": adv.company_name if adv else "Unknown",
            "bookedFrom": str(a.booked_from) if a.booked_from else None,
            "bookedTill": str(a.booked_till) if a.booked_till else None,
            "status": a.status
        })
    return bookings

# --- Uploads ---
@app.post("/api/upload")
@app.post("/api/mobile/upload")
async def upload_file(file: UploadFile = File(...), folder: Optional[str] = "sites"):
    try:
        url = await upload_to_r2(file, folder=folder or "sites")
        return {"imageUrl": url, "success": True}
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return {"success": False, "error": str(e)}

# --- Legacy endpoints ---
@app.get("/api/media-owners/all")
def get_all_media_owners(db: Session = Depends(get_db)):
    gsts = db.query(models.GstRegistration).options(joinedload(models.GstRegistration.company)).all()
    return [{"companyId": g.company_id, "companyName": g.company.name if g.company else "Unknown",
             "gstNumber": g.gst_number, "gstId": g.id} for g in gsts]

@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db)):
    return db.query(models.Company).all()

# --- Access token validation (public, no auth) ---
@app.get("/api/access/{token}")
def validate_public_access(token: str, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    link = db.query(models.AdvertiserAccessLink).filter(
        models.AdvertiserAccessLink.token_hash == token_hash,
        models.AdvertiserAccessLink.is_revoked == False
    ).first()
    if not link or link.expires_at < datetime.datetime.utcnow():
        raise HTTPException(403, "Invalid or expired access link")
    link.used_count += 1
    db.commit()
    adv = db.query(models.Advertiser).filter(models.Advertiser.id == link.advertiser_id).first()
    campaigns = db.query(models.Campaign).filter(models.Campaign.advertiser_id == link.advertiser_id)
    if link.campaign_id:
        campaigns = campaigns.filter(models.Campaign.id == link.campaign_id)
    result = []
    for c in campaigns.all():
        assigns = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.campaign_id == c.id).all()
        audits = db.query(models.SiteAudit).filter(
            models.SiteAudit.campaign_id == c.id, models.SiteAudit.status == "DONE").all()
        result.append({
            "name": c.name, "status": c.status,
            "startDate": str(c.start_date) if c.start_date else None,
            "endDate": str(c.end_date) if c.end_date else None,
            "sites": [{"bookedFrom": str(a.booked_from), "bookedTill": str(a.booked_till)} for a in assigns],
            "audits": [{"type": au.audit_type, "date": str(au.actual_audit_date),
                        "images": au.image_urls} for au in audits]
        })
    return {"advertiser": adv.company_name if adv else None, "campaigns": result}
