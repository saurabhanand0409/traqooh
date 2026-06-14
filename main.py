# TraqOOH Backend v2.1
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request
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
from jwt_utils import create_access_token, get_current_user, get_current_user_optional, require_roles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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
                             ("is_active","BOOLEAN DEFAULT TRUE"),("created_at","TIMESTAMP DEFAULT NOW()"),
                             ("vendor_id","INTEGER REFERENCES companies(id) ON DELETE SET NULL")]:
                if col not in ua_cols:
                    conn.execute(text(f"ALTER TABLE user_accounts ADD COLUMN {col} {typ}"))
                    conn.commit()
            # Sites additional extensions
            si_cols2 = [c["name"] for c in inspector.get_columns("sites")]
            if "added_by_user_id" not in si_cols2:
                conn.execute(text("ALTER TABLE sites ADD COLUMN added_by_user_id INTEGER"))
                conn.commit()
            # Sites phase-2 columns
            si_cols3 = [c["name"] for c in inspector.get_columns("sites")]
            for col, typ in [("state", "VARCHAR"), ("lighting_type", "VARCHAR")]:
                if col not in si_cols3:
                    conn.execute(text(f"ALTER TABLE sites ADD COLUMN {col} {typ}"))
                    conn.commit()
            # Campaigns: employee ownership
            ca_cols = [c["name"] for c in inspector.get_columns("campaigns")]
            if "created_by_user_id" not in ca_cols:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN created_by_user_id INTEGER REFERENCES user_accounts(id) ON DELETE SET NULL"))
                conn.commit()
            # CampaignSiteAssignment: advertiser shortlist & cost fields
            csa_cols = [c["name"] for c in inspector.get_columns("campaign_site_assignments")]
            for col, typ in [
                ("is_shortlisted", "BOOLEAN DEFAULT FALSE"),
                ("final_start_date", "DATE"),
                ("final_end_date", "DATE"),
                ("printing_type", "VARCHAR"),
                ("printing_cost", "FLOAT DEFAULT 0"),
                ("mounting_cost", "FLOAT DEFAULT 0"),
                ("other_cost", "FLOAT DEFAULT 0"),
                ("execution_remarks", "TEXT"),
            ]:
                if col not in csa_cols:
                    conn.execute(text(f"ALTER TABLE campaign_site_assignments ADD COLUMN {col} {typ}"))
                    conn.commit()
            # CampaignActivity (campaign execution log) — self-heal columns
            if inspector.has_table("campaign_activities"):
                act_cols = [c["name"] for c in inspector.get_columns("campaign_activities")]
                for col, typ in [
                    ("assignment_id", "INTEGER"),
                    ("status", "VARCHAR DEFAULT 'PENDING'"),
                    ("performed_by", "VARCHAR"),
                    ("activity_date", "DATE"),
                    ("notes", "TEXT"),
                    ("image_urls", "TEXT"),
                    ("latitude", "FLOAT"),
                    ("longitude", "FLOAT"),
                    ("source", "VARCHAR DEFAULT 'web'"),
                    ("created_by_user_id", "INTEGER"),
                    ("updated_at", "TIMESTAMP DEFAULT NOW()"),
                ]:
                    if col not in act_cols:
                        conn.execute(text(f"ALTER TABLE campaign_activities ADD COLUMN {col} {typ}"))
                        conn.commit()
        # OTP tokens table
        if not inspector.has_table("otp_tokens"):
            conn.execute(text("""
                CREATE TABLE otp_tokens (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR NOT NULL,
                    otp VARCHAR(6) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.commit()
            logger.info("Created otp_tokens table")
        # Make campaign_id nullable on campaign_activities (field workers don't always have a campaign)
        if inspector.has_table("campaign_activities"):
            try:
                conn.execute(text("ALTER TABLE campaign_activities ALTER COLUMN campaign_id DROP NOT NULL"))
                conn.commit()
            except Exception:
                pass  # already nullable
        # Field pins table (admin-created 4-digit PINs for field workers)
        if not inspector.has_table("field_pins"):
            conn.execute(text("""
                CREATE TABLE field_pins (
                    id SERIAL PRIMARY KEY,
                    pin VARCHAR(4) NOT NULL,
                    vendor_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                    created_by_admin_email VARCHAR NOT NULL,
                    worker_name VARCHAR,
                    is_active BOOLEAN DEFAULT TRUE,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.commit()
            logger.info("Created field_pins table")
        # Campaign shares table (admin shares a campaign with specific employees)
        if not inspector.has_table("campaign_shares"):
            conn.execute(text("""
                CREATE TABLE campaign_shares (
                    id SERIAL PRIMARY KEY,
                    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
                    shared_by_email VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(campaign_id, user_id)
                )
            """))
            conn.commit()
            logger.info("Created campaign_shares table")
        # Advertiser ownership + sharing
        adv_cols = [c["name"] for c in inspector.get_columns("advertisers")]
        for col, typ in [
            ("created_by_user_id", "INTEGER REFERENCES user_accounts(id) ON DELETE SET NULL"),
            ("vendor_company_id", "INTEGER REFERENCES companies(id) ON DELETE SET NULL"),
        ]:
            if col not in adv_cols:
                conn.execute(text(f"ALTER TABLE advertisers ADD COLUMN {col} {typ}"))
                conn.commit()
        if not inspector.has_table("advertiser_shares"):
            conn.execute(text("""
                CREATE TABLE advertiser_shares (
                    id SERIAL PRIMARY KEY,
                    advertiser_id INTEGER NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
                    shared_by_email VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(advertiser_id, user_id)
                )
            """))
            conn.commit()
            logger.info("Created advertiser_shares table")
        logger.info("Migration complete")
    except Exception as e:
        logger.error(f"Migration error: {e}\n{traceback.format_exc()}")

# --- App Setup ---
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="TraqOOH API", version="2.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware,
                   allow_origins=[
                       "https://app.brandsculpt.com",
                       "https://traqooh.brandsculpt.com",
                       "http://localhost:5173",
                       "http://localhost:3000",
                       "http://127.0.0.1:5173",
                   ],
                   allow_credentials=True,
                   allow_methods=["*"],
                   allow_headers=["*"])

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
from routes.activities import router as activities_router

app.include_router(vendors_router)
app.include_router(advertisers_router)
app.include_router(campaigns_router)
app.include_router(audits_router)
app.include_router(dashboard_router)
app.include_router(admin_router)
app.include_router(activities_router)

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
    ownerCompanyId: Optional[int] = None  # vendor ID
    vendorId: Optional[int] = None        # alias for ownerCompanyId (preferred going forward)
    addedByUserId: Optional[int] = None   # media user who created this site
    areaLocality: Optional[str] = None
    address: Optional[str] = None
    remarks: Optional[str] = None
    state: Optional[str] = None
    lightingType: Optional[str] = None
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

# --- Auth ---
@app.post("/api/auth/login", response_model=LoginResponse)
@app.post("/api/mobile/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
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
    # Fallback: use vendor_id if no company found via GST (covers admin/employee users set up directly)
    if not company_id and user.vendor_id:
        company_id = user.vendor_id
        company = db.query(models.Company).filter(models.Company.id == user.vendor_id).first()
        if company:
            company_name = company.name
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": role,
        "companyId": company_id,
        "advertiserId": user.advertiser_id,
        "displayName": user.display_name,
    })
    log_activity(db, "User logged in", "user", user.id, user.email, user.email)
    return LoginResponse(
        userId=user.id, email=user.email, role=role,
        gstRegistrationId=user.gst_registration_id, companyId=company_id,
        companyName=company_name, advertiserId=user.advertiser_id,
        displayName=user.display_name, token=token, success=True
    )

# --- OTP Auth (Mobile App) ---
import random
import string

def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

def send_otp_email(email: str, otp: str, name: str = None):
    """Send OTP via Resend if API key is configured, else log to console."""
    resend_key = os.environ.get("RESEND_API_KEY", "")
    from_email = os.environ.get("OTP_FROM_EMAIL", "noreply@brandsculpt.com")
    greeting = f"Hi {name}," if name else "Hi,"

    if resend_key:
        try:
            import httpx
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                json={
                    "from": f"TraqOOH <{from_email}>",
                    "to": [email],
                    "subject": f"{otp} — Your TraqOOH login code",
                    "html": f"""
                    <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;background:#070C1A;border-radius:16px;color:#fff;">
                      <div style="font-size:24px;font-weight:900;margin-bottom:8px;">
                        <span style="color:#2563EB;">traq</span><span style="color:#DC143C;">OOH</span>
                      </div>
                      <p style="color:#9CA3AF;font-size:13px;margin-bottom:24px;">by BrandSculpt</p>
                      <p style="color:#E5E7EB;">{greeting}</p>
                      <p style="color:#E5E7EB;">Your login code is:</p>
                      <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#2563EB;margin:24px 0;padding:16px;background:rgba(37,99,235,0.1);border-radius:12px;text-align:center;">
                        {otp}
                      </div>
                      <p style="color:#6B7280;font-size:12px;">Valid for 10 minutes. Do not share this code.</p>
                    </div>
                    """
                },
                timeout=10
            )
            logger.info(f"OTP email sent to {email} via Resend. Status: {resp.status_code}")
        except Exception as e:
            logger.error(f"Failed to send OTP email: {e}")
    else:
        logger.warning(f"[OTP] No RESEND_API_KEY set. OTP for {email}: {otp}")


class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

@app.post("/api/auth/send-otp")
@limiter.limit("5/minute")
def send_otp(request: Request, req: SendOtpRequest, db: Session = Depends(get_db)):
    """Generate and send OTP to the user's email. User must already exist."""
    email = req.email.lower().strip()
    user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email. Please contact your admin.")
    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Your account is deactivated. Contact your admin.")

    # Invalidate any existing OTPs for this email
    db.query(models.OtpToken).filter(models.OtpToken.email == email).update({"used": True})
    db.commit()

    otp = generate_otp()
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    token = models.OtpToken(email=email, otp=otp, expires_at=expires_at)
    db.add(token)
    db.commit()

    send_otp_email(email, otp, user.display_name)
    return {"success": True, "message": f"OTP sent to {email}"}


@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Verify OTP and return user session."""
    email = req.email.lower().strip()
    otp_record = db.query(models.OtpToken).filter(
        models.OtpToken.email == email,
        models.OtpToken.otp == req.otp.strip(),
        models.OtpToken.used == False,
        models.OtpToken.expires_at > datetime.datetime.utcnow()
    ).first()

    if not otp_record:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP. Please request a new one.")

    # Mark OTP as used
    otp_record.used = True
    db.commit()

    user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = user.role
    if role in ("MEDIA_OWNER", "TEAM_MEMBER"):
        role = "EMPLOYEE"

    company_id = user.vendor_id
    company_name = None
    if company_id:
        company = db.query(models.Company).filter(models.Company.id == company_id).first()
        if company:
            company_name = company.name

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": role,
        "companyId": company_id,
        "displayName": user.display_name,
    })
    log_activity(db, "User logged in via OTP", "user", user.id, user.email)
    return {
        "success": True,
        "userId": user.id,
        "email": user.email,
        "role": role,
        "displayName": user.display_name,
        "companyId": company_id,
        "companyName": company_name,
        "token": token,
    }


# --- Field PIN Login (Mobile App) ---
class FieldLoginRequest(BaseModel):
    pin: str

@app.post("/api/auth/field-login")
@limiter.limit("10/minute")
def field_login(request: Request, req: FieldLoginRequest, db: Session = Depends(get_db)):
    """Login with a 4-digit field PIN generated by an admin. Used by field workers (laborers)."""
    pin = req.pin.strip()
    fp = db.query(models.FieldPin).filter(
        models.FieldPin.pin == pin,
        models.FieldPin.is_active == True,
        models.FieldPin.expires_at > datetime.datetime.utcnow()
    ).first()
    if not fp:
        raise HTTPException(status_code=401, detail="Invalid or expired PIN. Contact your admin.")

    company_name = None
    if fp.vendor_id:
        company = db.query(models.Company).filter(models.Company.id == fp.vendor_id).first()
        if company:
            company_name = company.name

    token = create_access_token({
        "sub": f"pin-{fp.id}",
        "role": "FIELD",
        "vendorId": fp.vendor_id,
        "workerName": fp.worker_name or "Field Worker",
    })
    return {
        "success": True,
        "role": "FIELD",
        "pinId": fp.id,
        "workerName": fp.worker_name or "Field Worker",
        "vendorId": fp.vendor_id,
        "companyName": company_name,
        "expiresAt": fp.expires_at.isoformat(),
        "token": token,
    }


# --- Nearby Sites (Mobile App) ---
@app.get("/api/sites/nearby")
def get_nearby_sites(city: str = None, state: str = None, db: Session = Depends(get_db)):
    """Return sites filtered by city (and optionally state). Used by mobile app."""
    from utils import site_to_dict
    q = db.query(models.Site)
    if city:
        q = q.filter(models.Site.city.ilike(f"%{city}%"))
    if state:
        q = q.filter(models.Site.state.ilike(f"%{state}%"))
    sites = q.order_by(models.Site.id.desc()).all()
    return [site_to_dict(s) for s in sites]


@app.get("/api/sites/{site_id}/gallery")
def site_gallery(site_id: int, db: Session = Depends(get_db)):
    """Return all activity photos for a site grouped by activity type.
    Used by the mobile app and web inventory to show the site photo history."""
    import json as _json
    activities = (
        db.query(models.CampaignActivity)
        .filter(
            models.CampaignActivity.site_id == site_id,
            models.CampaignActivity.image_urls.isnot(None),
        )
        .order_by(models.CampaignActivity.created_at.desc())
        .all()
    )
    TYPE_LABEL = {
        "MOUNTING": "Install", "START": "Install",
        "AUDIT": "Monitor", "MAINTENANCE": "Monitor",
        "END": "End", "TAKEDOWN": "End",
        "PRINT": "Print", "REPRINT": "Print",
    }
    grouped = {}
    all_photos = []
    for a in activities:
        try:
            urls = _json.loads(a.image_urls) if a.image_urls else []
        except Exception:
            urls = []
        if not urls:
            continue
        label = TYPE_LABEL.get(a.activity_type, a.activity_type)
        if label not in grouped:
            grouped[label] = []
        for url in urls:
            entry = {
                "url": url,
                "activityType": a.activity_type,
                "label": label,
                "performedBy": a.performed_by,
                "activityDate": str(a.activity_date) if a.activity_date else None,
                "notes": a.notes,
                "latitude": a.latitude,
                "longitude": a.longitude,
                "createdAt": str(a.created_at) if a.created_at else None,
            }
            grouped[label].append(entry)
            all_photos.append(entry)
    return {"siteId": site_id, "grouped": grouped, "all": all_photos, "total": len(all_photos)}


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
              state: Optional[str] = None, siteType: Optional[str] = None,
              db: Session = Depends(get_db)):
    query = db.query(models.Site).options(joinedload(models.Site.owner))
    if ownerId:
        query = query.filter(models.Site.owner_company_id == ownerId)
    if vendorId:
        query = query.filter(models.Site.owner_company_id == vendorId)
    if availabilityStatus:
        query = query.filter(models.Site.availability_status == availabilityStatus)
    if city:
        query = query.filter(models.Site.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(models.Site.state.ilike(f"%{state}%"))
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
def create_site(req: SiteCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    from datetime import date
    vendor_id = req.vendorId or req.ownerCompanyId  # vendorId takes precedence if provided
    site = models.Site(
        name=req.name, city=req.city, type=req.type, status=req.status, size=req.size,
        width=req.width or 0, length=req.length or 0,
        total_area=(req.width or 0) * (req.length or 0),
        facing=req.facing, potential_monthly=float(req.potentialMonthly or 0),
        base_rate=float(req.baseRate or 0), occupancy=req.occupancy or 0,
        image_url=req.imageUrl, owner_company_id=vendor_id,
        added_by_user_id=req.addedByUserId,
        area_locality=req.areaLocality, address=req.address, remarks=req.remarks,
        state=req.state, lighting_type=req.lightingType,
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
def update_site(site_id: int, req: SiteCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    from datetime import date
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    vendor_id = req.vendorId or req.ownerCompanyId
    site.name = req.name; site.city = req.city; site.type = req.type
    site.status = req.status; site.size = req.size
    site.width = req.width or 0; site.length = req.length or 0
    site.total_area = (req.width or 0) * (req.length or 0)
    site.facing = req.facing
    site.potential_monthly = float(req.potentialMonthly or 0)
    site.base_rate = float(req.baseRate or 0)
    site.occupancy = req.occupancy or 0; site.image_url = req.imageUrl
    site.owner_company_id = vendor_id
    site.area_locality = req.areaLocality; site.address = req.address
    site.remarks = req.remarks
    site.state = req.state; site.lighting_type = req.lightingType
    site.availability_status = req.availabilityStatus or site.availability_status
    site.available_from = date.fromisoformat(req.availableFrom) if req.availableFrom else site.available_from
    site.available_till = date.fromisoformat(req.availableTill) if req.availableTill else site.available_till
    site.latitude = req.latitude; site.longitude = req.longitude
    db.commit()
    db.refresh(site)
    log_activity(db, "Updated site", "site", site.id, site.name)
    return site_to_dict(site)

@app.delete("/api/sites/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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

# --- Access token helpers ---
def _validate_access_link(token: str, db: Session):
    """Validate token and return the AdvertiserAccessLink or raise 403."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    link = db.query(models.AdvertiserAccessLink).filter(
        models.AdvertiserAccessLink.token_hash == token_hash,
        models.AdvertiserAccessLink.is_revoked == False
    ).first()
    if not link or link.expires_at < datetime.datetime.utcnow():
        raise HTTPException(403, "Invalid or expired access link")
    return link

def _assignment_to_access_dict(a: models.CampaignSiteAssignment, db: Session) -> dict:
    """Return full site metadata + assignment fields for the advertiser access page."""
    site = db.query(models.Site).options(
        joinedload(models.Site.owner)
    ).filter(models.Site.id == a.site_id).first()
    size_str = None
    if site:
        if site.width and site.length:
            size_str = f"{site.width}×{site.length} ft"
        elif site.size:
            size_str = site.size
    return {
        "assignmentId": a.id,
        "siteId": a.site_id,
        "siteName": site.name if site else None,
        "state": site.state if site else None,
        "city": site.city if site else None,
        "location": site.area_locality or site.address if site else None,
        "address": site.address if site else None,
        "type": site.type if site else None,
        "lightingType": site.lighting_type if site else None,
        "size": size_str,
        "vendorName": site.owner.name if site and site.owner else None,
        "baseRate": float(site.potential_monthly or site.base_rate or 0) if site else 0,
        "imageUrl": site.image_url if site else None,
        "availabilityStatus": site.availability_status if site else None,
        "remarks": site.remarks if site else None,
        # assignment dates
        "bookedFrom": str(a.booked_from) if a.booked_from else None,
        "bookedTill": str(a.booked_till) if a.booked_till else None,
        # advertiser shortlist fields
        "isShortlisted": bool(a.is_shortlisted),
        "finalStartDate": str(a.final_start_date) if a.final_start_date else None,
        "finalEndDate": str(a.final_end_date) if a.final_end_date else None,
        "printingType": a.printing_type,
        "printingCost": float(a.printing_cost or 0),
        "mountingCost": float(a.mounting_cost or 0),
        "otherCost": float(a.other_cost or 0),
        "executionRemarks": a.execution_remarks,
    }

# --- Access token validation (public, no auth) ---
@app.get("/api/access/{token}")
def validate_public_access(token: str, db: Session = Depends(get_db)):
    link = _validate_access_link(token, db)
    link.used_count += 1
    db.commit()
    adv = db.query(models.Advertiser).filter(models.Advertiser.id == link.advertiser_id).first()
    campaigns_q = db.query(models.Campaign).filter(models.Campaign.advertiser_id == link.advertiser_id)
    if link.campaign_id:
        campaigns_q = campaigns_q.filter(models.Campaign.id == link.campaign_id)
    result = []
    for c in campaigns_q.all():
        assigns = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.campaign_id == c.id
        ).all()
        audits = db.query(models.SiteAudit).filter(
            models.SiteAudit.campaign_id == c.id, models.SiteAudit.status == "DONE"
        ).all()
        result.append({
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "campaignType": c.campaign_type,
            "startDate": str(c.start_date) if c.start_date else None,
            "endDate": str(c.end_date) if c.end_date else None,
            "totalCost": float(c.total_cost or 0),
            "notes": c.notes,
            "sites": [_assignment_to_access_dict(a, db) for a in assigns],
            "audits": [{
                "type": au.audit_type,
                "date": str(au.actual_audit_date) if au.actual_audit_date else None,
                "images": au.image_urls,
            } for au in audits],
        })
    return {
        "advertiser": adv.company_name if adv else None,
        "advertiserEmail": adv.email if adv else None,
        "campaigns": result,
    }


class ShortlistAssignment(BaseModel):
    assignmentId: int
    isShortlisted: bool = False
    finalStartDate: Optional[str] = None
    finalEndDate: Optional[str] = None
    printingType: Optional[str] = None
    printingCost: Optional[float] = 0.0
    mountingCost: Optional[float] = 0.0
    otherCost: Optional[float] = 0.0
    executionRemarks: Optional[str] = None

class ShortlistRequest(BaseModel):
    assignments: List[ShortlistAssignment]

@app.post("/api/access/{token}/shortlist")
def save_shortlist(token: str, req: ShortlistRequest, db: Session = Depends(get_db)):
    """Advertiser saves their shortlist + per-site dates/charges."""
    from datetime import date as dateobj
    link = _validate_access_link(token, db)
    for item in req.assignments:
        a = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.id == item.assignmentId
        ).first()
        if not a:
            continue
        # Verify this assignment belongs to this advertiser's campaign
        camp = db.query(models.Campaign).filter(
            models.Campaign.id == a.campaign_id,
            models.Campaign.advertiser_id == link.advertiser_id,
        ).first()
        if not camp:
            continue
        a.is_shortlisted = item.isShortlisted
        a.final_start_date = dateobj.fromisoformat(item.finalStartDate) if item.finalStartDate else None
        a.final_end_date = dateobj.fromisoformat(item.finalEndDate) if item.finalEndDate else None
        a.printing_type = item.printingType
        a.printing_cost = item.printingCost or 0.0
        a.mounting_cost = item.mountingCost or 0.0
        a.other_cost = item.otherCost or 0.0
        a.execution_remarks = item.executionRemarks
    db.commit()
    return {"message": "Shortlist saved"}


class FinalizeRequest(BaseModel):
    campaignId: int

@app.post("/api/access/{token}/finalize")
def finalize_campaign(token: str, req: FinalizeRequest, db: Session = Depends(get_db)):
    """Advertiser finalizes the campaign — moves status to PLANNED (approved)."""
    link = _validate_access_link(token, db)
    c = db.query(models.Campaign).filter(
        models.Campaign.id == req.campaignId,
        models.Campaign.advertiser_id == link.advertiser_id,
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found or access denied")
    # Advance status: DRAFT → PLANNED
    if c.status in ("DRAFT",):
        c.status = "PLANNED"
    db.commit()
    log_activity(db, "Advertiser finalized campaign", "campaign", c.id, c.name)
    return {"message": "Campaign finalized", "newStatus": c.status}
