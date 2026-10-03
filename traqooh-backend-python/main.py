# TraqOOH Backend v2.1
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
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
from jwt_utils import (create_access_token, get_current_user, get_current_user_optional, require_roles,
                       REQUIRE_FIELD_AUTH, require_staff, require_admin, require_staff_or_field, require_field)
import proofs
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
        # NOTE: the original `with engine.connect() as conn:` block ended here.
        # The following migrations were previously OUTSIDE that block and silently
        # failed because `conn` was already closed — that's why advertiser columns
        # never got added and SELECTs against advertisers/campaigns crashed.
        # All these self-heal steps now use a fresh, properly-scoped connection.
        with engine.connect() as conn:
            inspector = inspect(engine)
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
            # Monitoring assignment columns on campaign_site_assignments
            if inspector.has_table("campaign_site_assignments"):
                csa_cols = [c["name"] for c in inspector.get_columns("campaign_site_assignments")]
                for col, typ in [
                    ("monitor_worker_name", "VARCHAR"),
                    ("monitor_field_pin_id", "INTEGER"),
                    ("pending_approval", "BOOLEAN DEFAULT FALSE"),
                ]:
                    if col not in csa_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE campaign_site_assignments ADD COLUMN {col} {typ}"))
                            conn.commit()
                            logger.info(f"Added column campaign_site_assignments.{col}")
                        except Exception as e:
                            conn.rollback()
                            logger.error(f"Failed to add campaign_site_assignments.{col}: {e}")
            # Proof capture + review columns on campaign_activities (2026-09):
            # capture time/accuracy from the phone, offline-retry id, photo labels,
            # and the needs-retake review trail.
            if inspector.has_table("campaign_activities"):
                act_cols = [c["name"] for c in inspector.get_columns("campaign_activities")]
                for col, typ in [
                    ("image_labels", "TEXT"),
                    ("gps_accuracy_m", "FLOAT"),
                    ("captured_at", "TIMESTAMP"),
                    ("client_visit_id", "VARCHAR"),
                    ("review_note", "TEXT"),
                    ("reviewed_by", "VARCHAR"),
                    ("reviewed_at", "TIMESTAMP"),
                ]:
                    if col not in act_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE campaign_activities ADD COLUMN {col} {typ}"))
                            conn.commit()
                            logger.info(f"Added column campaign_activities.{col}")
                        except Exception as e:
                            conn.rollback()
                            logger.error(f"Failed to add campaign_activities.{col}: {e}")
                try:
                    # Unique (NULLs allowed): two retries of one offline visit can't both be saved
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_campaign_activities_client_visit_id "
                                      "ON campaign_activities (client_visit_id)"))
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Failed to index campaign_activities.client_visit_id: {e}")
            # Why an advertiser link was sent (proposal / live / update) — feeds launch metrics
            if inspector.has_table("advertiser_access_links"):
                link_cols = [c["name"] for c in inspector.get_columns("advertiser_access_links")]
                if "purpose" not in link_cols:
                    try:
                        conn.execute(text("ALTER TABLE advertiser_access_links ADD COLUMN purpose VARCHAR"))
                        conn.commit()
                        logger.info("Added column advertiser_access_links.purpose")
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Failed to add advertiser_access_links.purpose: {e}")
            # Rename legacy campaign statuses to the new workflow vocabulary
            try:
                conn.execute(text("UPDATE campaigns SET status='RUNNING'  WHERE status='LIVE'"))
                conn.execute(text("UPDATE campaigns SET status='COMPLETE' WHERE status='COMPLETED'"))
                conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Failed to migrate campaign statuses: {e}")
            # Advertiser ownership + sharing — CRITICAL: each ALTER wrapped so a single
            # failure doesn't poison the connection for subsequent statements
            adv_cols = [c["name"] for c in inspector.get_columns("advertisers")]
            for col, typ in [
                ("created_by_user_id", "INTEGER"),  # plain int, no FK (circular ref)
                ("vendor_company_id", "INTEGER REFERENCES companies(id) ON DELETE SET NULL"),
            ]:
                if col not in adv_cols:
                    try:
                        conn.execute(text(f"ALTER TABLE advertisers ADD COLUMN {col} {typ}"))
                        conn.commit()
                        logger.info(f"Added column advertisers.{col}")
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Failed to add advertisers.{col}: {e}")
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
            # Advertiser ↔ Company many-to-many link table (backfill is idempotent)
            try:
                conn.execute(text("""
                    INSERT INTO advertiser_company_links (advertiser_id, company_id)
                    SELECT id, vendor_company_id FROM advertisers
                    WHERE vendor_company_id IS NOT NULL
                    ON CONFLICT DO NOTHING
                """))
                conn.commit()
                logger.info("Backfilled advertiser_company_links from vendor_company_id")
            except Exception as e:
                conn.rollback()
                logger.warning(f"advertiser_company_links backfill skipped: {e}")
        logger.info("Migration complete")
    except Exception as e:
        logger.error(f"Migration error: {e}\n{traceback.format_exc()}")

# --- App Setup ---
# Error monitoring: active only when SENTRY_DSN is set on Render.
if os.environ.get("SENTRY_DSN"):
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=os.environ["SENTRY_DSN"],
            environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            send_default_pii=False,
        )
        logger.info("Sentry error monitoring enabled")
    except Exception as e:
        logger.error(f"Sentry init failed: {e}")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="TraqOOH API", version="2.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
_CORS_ALLOWED_ORIGINS = [
    "https://app.brandsculpt.com",
    "https://traqooh.brandsculpt.com",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
app.add_middleware(CORSMiddleware,
                   allow_origins=_CORS_ALLOWED_ORIGINS,
                   allow_credentials=True,
                   allow_methods=["*"],
                   allow_headers=["*"])

# Catch-all exception handler that ALWAYS adds CORS headers to error responses.
# Starlette's default ServerErrorMiddleware sits OUTSIDE the CORSMiddleware, so any
# unhandled exception inside a route (or a dependency like get_db / get_current_user)
# returns a 500 with NO Access-Control-Allow-Origin header. That makes the browser
# block the JS from reading the response and show "Failed to fetch" instead of the
# real error. This handler intercepts ALL unhandled exceptions and re-emits the 500
# WITH CORS headers + a real `detail` so the frontend alert can show what failed.
@app.exception_handler(Exception)
async def _all_unhandled_exceptions(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    print(f"[unhandled] {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    # This handler swallows the exception, so hand it to Sentry explicitly.
    if os.environ.get("SENTRY_DSN"):
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in _CORS_ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)[:300]}"},
        headers=headers,
    )

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

app.include_router(vendors_router, dependencies=[Depends(require_staff)])
app.include_router(advertisers_router)
app.include_router(campaigns_router, dependencies=[Depends(require_staff)])
app.include_router(audits_router)
app.include_router(dashboard_router, dependencies=[Depends(require_staff)])
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

# Roles the public /api/auth/register form may create: a media company's admin
# (RegisterAdmin.jsx) or a media owner (MediaOwnerCreate.jsx).
SELF_SIGNUP_ROLES = {"ADMIN", "MEDIA_OWNER"}
# Every staff account can currently read every company's data (separation is a later phase), so a
# stranger must not be able to create one. Company sign-up is invitation-only until that is built;
# set ALLOW_PUBLIC_SIGNUP=true on Render to open it again.
ALLOW_PUBLIC_SIGNUP = os.environ.get("ALLOW_PUBLIC_SIGNUP", "").strip().lower() in ("1", "true", "yes")


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

    # Field workers keep long sessions (30 days) so they aren't re-typing a PIN
    # every week on-site — matches the extended PIN validity window below.
    token = create_access_token({
        "sub": f"pin-{fp.id}",
        "role": "FIELD",
        "vendorId": fp.vendor_id,
        "workerName": fp.worker_name or "Field Worker",
    }, expire_hours=24 * 30)
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
@app.get("/api/sites/nearby", dependencies=[Depends(require_staff_or_field)])
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


@app.get("/api/sites/{site_id}/gallery", dependencies=[Depends(require_staff_or_field)])
def site_gallery(site_id: int, db: Session = Depends(get_db)):
    """Return all activity photos for a site grouped by activity type.
    Used by the mobile app and web inventory to show the site photo history.
    Photos sent back for a retake are left out."""
    activities = (
        db.query(models.CampaignActivity)
        .filter(
            models.CampaignActivity.site_id == site_id,
            models.CampaignActivity.image_urls.isnot(None),
            models.CampaignActivity.status != proofs.REJECTED,
        )
        .all()
    )
    activities.sort(key=proofs.captured_at, reverse=True)
    TYPE_LABEL = {
        "MOUNTING": "Install", "START": "Install",
        "AUDIT": "Monitor", "MAINTENANCE": "Monitor",
        "END": "End", "TAKEDOWN": "End",
        "PRINT": "Print", "REPRINT": "Print",
    }
    grouped = {}
    all_photos = []
    for a in activities:
        urls = proofs.image_urls(a)
        if not urls:
            continue
        labels = proofs.image_labels(a)
        label = TYPE_LABEL.get(a.activity_type, a.activity_type)
        if label not in grouped:
            grouped[label] = []
        for url in urls:
            entry = {
                "url": url,
                "activityId": a.id,
                "activityType": a.activity_type,
                "status": a.status,
                "label": label,
                "shot": labels.get(url),  # close-up / wide / landmark / video
                "performedBy": a.performed_by,
                "activityDate": str(a.activity_date) if a.activity_date else None,
                "notes": a.notes,
                "latitude": a.latitude,
                "longitude": a.longitude,
                "gpsAccuracyM": a.gps_accuracy_m,
                "capturedAt": proofs.iso(proofs.captured_at(a)),
                "createdAt": str(a.created_at) if a.created_at else None,
            }
            grouped[label].append(entry)
            all_photos.append(entry)
    return {"siteId": site_id, "grouped": grouped, "all": all_photos, "total": len(all_photos)}


# ── Site Image Gallery (per-site photo library, with cover selection) ───────
def _site_image_dict(img: "models.SiteImage") -> dict:
    return {
        "id": img.id,
        "siteId": img.site_id,
        "imageUrl": img.image_url,
        "caption": img.caption,
        "isPrimary": bool(img.is_primary),
        "createdAt": str(img.created_at) if img.created_at else None,
    }


@app.get("/api/sites/{site_id}/images")
def list_site_images(site_id: int, db: Session = Depends(get_db)):
    """All photos uploaded to a site's library, primary first.
    If the gallery is empty but the site has a legacy single image_url, that
    image is auto-imported as the primary so it shows up in the gallery."""
    rows = (db.query(models.SiteImage)
              .filter(models.SiteImage.site_id == site_id)
              .order_by(models.SiteImage.is_primary.desc(), models.SiteImage.created_at.desc())
              .all())
    if not rows:
        site = db.query(models.Site).filter(models.Site.id == site_id).first()
        if site and site.image_url:
            seed = models.SiteImage(site_id=site_id, image_url=site.image_url, is_primary=True)
            db.add(seed)
            db.commit()
            db.refresh(seed)
            rows = [seed]
    return [_site_image_dict(r) for r in rows]


@app.post("/api/sites/{site_id}/images", dependencies=[Depends(require_staff)])
async def add_site_image(site_id: int, file: UploadFile = File(...),
                         caption: Optional[str] = Form(None),
                         setAsPrimary: Optional[bool] = Form(False),
                         db: Session = Depends(get_db)):
    """Upload a photo (or LED-site video) to a site's library. The first IMAGE auto-becomes
    the primary. Videos are never auto-promoted to cover — covers are still images."""
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(404, "Site not found")
    url = await upload_to_r2(file, folder="site-images")

    is_video = (file.content_type or "").lower().startswith("video/")

    has_existing = db.query(models.SiteImage).filter(models.SiteImage.site_id == site_id).first() is not None
    make_primary = (bool(setAsPrimary) or (not has_existing)) and not is_video
    if make_primary:
        db.query(models.SiteImage).filter(
            models.SiteImage.site_id == site_id, models.SiteImage.is_primary == True
        ).update({"is_primary": False})

    img = models.SiteImage(site_id=site_id, image_url=url, caption=caption, is_primary=make_primary)
    db.add(img)
    if make_primary:
        site.image_url = url  # keep Site.image_url in sync so existing list views still work
    db.commit()
    db.refresh(img)
    log_activity(db, "Added site photo", "site", site_id, caption or "")
    return _site_image_dict(img)


@app.post("/api/sites/{site_id}/images/{image_id}/set-primary", dependencies=[Depends(require_staff)])
def set_primary_site_image(site_id: int, image_id: int, db: Session = Depends(get_db)):
    """Choose which photo represents this site (the 'face')."""
    img = db.query(models.SiteImage).filter(
        models.SiteImage.id == image_id, models.SiteImage.site_id == site_id
    ).first()
    if not img:
        raise HTTPException(404, "Image not found for this site")
    db.query(models.SiteImage).filter(
        models.SiteImage.site_id == site_id, models.SiteImage.is_primary == True
    ).update({"is_primary": False})
    img.is_primary = True
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if site:
        site.image_url = img.image_url
    db.commit()
    log_activity(db, "Set site cover photo", "site", site_id)
    return _site_image_dict(img)


@app.delete("/api/sites/{site_id}/images/{image_id}", dependencies=[Depends(require_staff)])
def delete_site_image(site_id: int, image_id: int, db: Session = Depends(get_db)):
    """Remove a photo from a site's library. If it was the cover, promote another one."""
    img = db.query(models.SiteImage).filter(
        models.SiteImage.id == image_id, models.SiteImage.site_id == site_id
    ).first()
    if not img:
        raise HTTPException(404, "Image not found")
    was_primary = bool(img.is_primary)
    db.delete(img)
    db.commit()
    if was_primary:
        # Promote the next-newest photo to cover; if none left, clear Site.image_url
        next_img = (db.query(models.SiteImage)
                      .filter(models.SiteImage.site_id == site_id)
                      .order_by(models.SiteImage.created_at.desc()).first())
        site = db.query(models.Site).filter(models.Site.id == site_id).first()
        if next_img:
            next_img.is_primary = True
            if site: site.image_url = next_img.image_url
        elif site:
            site.image_url = None
        db.commit()
    log_activity(db, "Removed site photo", "site", site_id)
    return {"success": True, "deletedId": image_id}


@app.post("/api/auth/register")
@app.post("/api/media-owners")
def create_media_owner(req: CreateMediaOwnerRequest, db: Session = Depends(get_db)):
    if not ALLOW_PUBLIC_SIGNUP:
        raise HTTPException(status_code=403, detail="Company sign-up is by invitation during the pilot. Please contact BrandSculpt to get your account.")
    # Public sign-up: the caller must never pick a privileged role (e.g. SUPER_ADMIN).
    role = (req.role or "MEDIA_OWNER").strip().upper()
    if role not in SELF_SIGNUP_ROLES:
        raise HTTPException(status_code=400, detail="This account type can't be created by sign-up")
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
            role=role, gst_registration_id=gst.id, is_active=True
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

class AdvertiserSelfRegister(BaseModel):
    companyName: str
    contactName: str
    email: str
    password: str


@app.post("/api/auth/register-advertiser")
@limiter.limit("5/minute")
def register_advertiser(request: Request, req: AdvertiserSelfRegister, db: Session = Depends(get_db)):
    """Public: a brand signs itself up. Creates a NEW advertiser and its login in one step, so it can
    never attach a login to somebody else's advertiser record (create-login is staff-only)."""
    email = req.email.strip().lower()
    if not req.companyName.strip() or not req.contactName.strip():
        raise HTTPException(status_code=400, detail="Company name and your name are required")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db.query(models.UserAccount).filter(models.UserAccount.email.ilike(email)).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    adv = models.Advertiser(company_name=req.companyName.strip(), contact_person=req.contactName.strip(),
                            email=email, status="ACTIVE")
    db.add(adv)
    db.flush()
    db.add(models.UserAccount(email=email, password_hash=hash_password(req.password), role="ADVERTISER",
                              advertiser_id=adv.id, display_name=adv.company_name, is_active=True))
    db.commit()
    log_activity(db, "Advertiser self sign-up", "advertiser", adv.id, email)
    return {"message": "Account created"}


# --- Sites ---
@app.get("/api/sites", dependencies=[Depends(require_staff_or_field)])
@app.get("/api/mobile/sites", dependencies=[Depends(require_staff_or_field)])
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

@app.get("/api/mobile/my-sites")
def get_my_assigned_sites(worker: Optional[str] = None, db: Session = Depends(get_db),
                          user: Optional[dict] = Depends(get_current_user_optional)):
    """Sites a specific field worker has been assigned to monitor.
    Matched by worker name (stable across PIN re-issues), taken from the login
    token when the app sends one. Returns the site + its campaign + how many
    Start/Mid/End photos already exist, and any visits sent back for a retake,
    so the app can show what's pending.
    """
    if REQUIRE_FIELD_AUTH and not user:
        raise HTTPException(401, "Your login has expired. Please log in again.")
    token_worker = (user or {}).get("workerName") if (user or {}).get("role") == "FIELD" else None
    worker_name = (token_worker or worker or "").strip()
    if not worker_name:
        return []
    assigns = db.query(models.CampaignSiteAssignment).filter(
        func.lower(func.trim(models.CampaignSiteAssignment.monitor_worker_name)) == worker_name.lower()
    ).all()
    if not assigns:
        return []

    site_ids = list({a.site_id for a in assigns})
    campaign_ids = list({a.campaign_id for a in assigns})
    sites_by_id = {s.id: s for s in db.query(models.Site).options(
        joinedload(models.Site.owner)
    ).filter(models.Site.id.in_(site_ids)).all()}
    camps_by_id = {c.id: c for c in db.query(models.Campaign).filter(
        models.Campaign.id.in_(campaign_ids)
    ).all()}

    # Count accepted proof photos per (campaign, site, phase), and find phases whose
    # most recent visit was sent back for a retake.
    acts = db.query(models.CampaignActivity).filter(
        models.CampaignActivity.campaign_id.in_(campaign_ids)
    ).all()
    acts.sort(key=proofs.captured_at)
    counts = {}
    latest = {}  # (campaign, site, phase) -> most recent activity with media
    for a in acts:
        key = (a.campaign_id, a.site_id)
        c = counts.setdefault(key, {"START": 0, "MID": 0, "END": 0})
        ph = proofs.phase_of(a.activity_type)
        if proofs.is_visible_proof(a):
            c[ph] += len(proofs.image_urls(a))
        if proofs.image_urls(a):
            latest[(a.campaign_id, a.site_id, ph)] = a
    retakes = {}
    for (camp_id, site_id, ph), a in latest.items():
        if a.status == proofs.REJECTED:
            retakes.setdefault((camp_id, site_id), []).append({
                "activityId": a.id,
                "phase": ph,
                "reason": a.review_note,
                "rejectedBy": a.reviewed_by,
                "rejectedAt": proofs.iso(a.reviewed_at),
            })

    out = []
    for a in assigns:
        site = sites_by_id.get(a.site_id)
        camp = camps_by_id.get(a.campaign_id)
        if not site:
            continue
        d = site_to_dict(site)
        d["assignmentId"] = a.id
        d["campaignId"] = a.campaign_id
        d["campaignName"] = camp.name if camp else None
        d["campaignStatus"] = camp.status if camp else None
        d["campaignStart"] = str(camp.start_date) if camp and camp.start_date else None
        d["campaignEnd"] = str(camp.end_date) if camp and camp.end_date else None
        d["bookedFrom"] = str(a.booked_from) if a.booked_from else None
        d["bookedTill"] = str(a.booked_till) if a.booked_till else None
        d["photoCounts"] = counts.get((a.campaign_id, a.site_id), {"START": 0, "MID": 0, "END": 0})
        d["retakes"] = retakes.get((a.campaign_id, a.site_id), [])
        out.append(d)
    return out

class PushTokenRequest(BaseModel):
    token: str
    platform: Optional[str] = None
    language: Optional[str] = None


@app.post("/api/mobile/push-token")
def register_push_token(req: PushTokenRequest, db: Session = Depends(get_db),
                        user: dict = Depends(get_current_user)):
    """The field app registers (or refreshes) this phone's Expo push token after login."""
    if user.get("role") != "FIELD":
        raise HTTPException(403, "Only field-app logins can register for notifications")
    token = (req.token or "").strip()
    if not token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        raise HTTPException(400, "Not an Expo push token")
    sub = str(user.get("sub") or "")
    pin_id = int(sub[4:]) if sub.startswith("pin-") and sub[4:].isdigit() else None
    row = db.query(models.PushToken).filter(models.PushToken.token == token).first()
    if not row:
        row = models.PushToken(token=token)
        db.add(row)
    row.worker_name = user.get("workerName")
    row.field_pin_id = pin_id
    row.vendor_id = user.get("vendorId")
    row.platform = (req.platform or "")[:20] or None
    row.language = (req.language or "en")[:5]
    db.commit()
    return {"registered": True}


@app.delete("/api/mobile/push-token", dependencies=[Depends(require_field)])
def unregister_push_token(req: PushTokenRequest, db: Session = Depends(get_db)):
    """Called on sign-out so a shared phone stops getting the previous worker's alerts."""
    db.query(models.PushToken).filter(models.PushToken.token == (req.token or "").strip()).delete()
    db.commit()
    return {"removed": True}


@app.get("/api/mobile/sites/{site_id}", dependencies=[Depends(require_staff_or_field)])
@app.get("/api/sites/{site_id}", dependencies=[Depends(require_staff_or_field)])
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

@app.post("/api/sites", dependencies=[Depends(require_staff)])
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

@app.put("/api/sites/{site_id}", dependencies=[Depends(require_staff)])
def update_site(site_id: int, req: SiteCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    from datetime import date
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    # Only change fields the client actually sent. The web edit form never sent GPS,
    # locality, address, remarks or base rate, and overwriting them with defaults
    # silently wiped those values on every edit.
    sent = getattr(req, "model_fields_set", None) or getattr(req, "__fields_set__", set())
    vendor_id = req.vendorId or req.ownerCompanyId
    site.name = req.name; site.city = req.city; site.type = req.type
    if "status" in sent: site.status = req.status
    if "size" in sent: site.size = req.size
    if "width" in sent or "length" in sent:
        site.width = req.width or 0; site.length = req.length or 0
        site.total_area = site.width * site.length
    if "facing" in sent: site.facing = req.facing
    if "potentialMonthly" in sent: site.potential_monthly = float(req.potentialMonthly or 0)
    if "baseRate" in sent: site.base_rate = float(req.baseRate or 0)
    if "occupancy" in sent: site.occupancy = req.occupancy or 0
    if "imageUrl" in sent: site.image_url = req.imageUrl
    if "vendorId" in sent or "ownerCompanyId" in sent: site.owner_company_id = vendor_id
    if "areaLocality" in sent: site.area_locality = req.areaLocality
    if "address" in sent: site.address = req.address
    if "remarks" in sent: site.remarks = req.remarks
    if "state" in sent: site.state = req.state
    if "lightingType" in sent: site.lighting_type = req.lightingType
    # availabilityStatus defaults to "AVAILABLE", so an edit that didn't send it used to
    # flip booked sites back to vacant.
    if "availabilityStatus" in sent and req.availabilityStatus:
        site.availability_status = req.availabilityStatus
    site.available_from = date.fromisoformat(req.availableFrom) if req.availableFrom else site.available_from
    site.available_till = date.fromisoformat(req.availableTill) if req.availableTill else site.available_till
    if "latitude" in sent: site.latitude = req.latitude
    if "longitude" in sent: site.longitude = req.longitude
    db.commit()
    db.refresh(site)
    log_activity(db, "Updated site", "site", site.id, site.name)
    return site_to_dict(site)

@app.delete("/api/sites/{site_id}", dependencies=[Depends(require_staff)])
def delete_site(site_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Cascade: clear every row that FKs to this site before deleting the site itself.
    # Tables pointing at sites.id directly: campaign_activities, site_audits,
    # campaign_site_assignments, site_images.
    # campaign_activities ALSO has an FK to campaign_site_assignments.id, so we
    # must wipe activities tied to those assignments first (even if their own
    # site_id is null or mismatched) or the assignment delete will FK-violate.
    # R2 objects are left orphaned — matches existing image-delete behavior.
    site_name = None
    try:
        site = db.query(models.Site).filter(models.Site.id == site_id).first()
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")
        site_name = site.name
        # 1. Find every assignment this site has
        assignment_ids = [
            a.id for a in db.query(models.CampaignSiteAssignment.id)
                .filter(models.CampaignSiteAssignment.site_id == site_id).all()
        ]
        # 2. Kill activities by EITHER site_id OR assignment_id (covers orphans)
        if assignment_ids:
            db.query(models.CampaignActivity).filter(
                (models.CampaignActivity.site_id == site_id) |
                (models.CampaignActivity.assignment_id.in_(assignment_ids))
            ).delete(synchronize_session=False)
        else:
            db.query(models.CampaignActivity).filter(
                models.CampaignActivity.site_id == site_id
            ).delete(synchronize_session=False)
        # 3. Audits
        db.query(models.SiteAudit).filter(models.SiteAudit.site_id == site_id).delete(synchronize_session=False)
        # 4. Assignments
        db.query(models.CampaignSiteAssignment).filter(models.CampaignSiteAssignment.site_id == site_id).delete(synchronize_session=False)
        # 5. Site images
        db.query(models.SiteImage).filter(models.SiteImage.site_id == site_id).delete(synchronize_session=False)
        # 6. Finally, the site
        db.delete(site)
        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        print(f"[delete_site] Failed to delete site {site_id} ({site_name}): {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)[:300]}")
    log_activity(db, "Deleted site (cascade)", "site", site_id, site_name)
    return {"message": "Site deleted successfully"}

@app.get("/api/sites/{site_id}/bookings", dependencies=[Depends(require_staff)])
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
@app.post("/api/upload", dependencies=[Depends(require_staff_or_field)])
@app.post("/api/mobile/upload", dependencies=[Depends(require_staff_or_field)])
async def upload_file(file: UploadFile = File(...), folder: Optional[str] = "sites"):
    try:
        url = await upload_to_r2(file, folder=folder or "sites")
        return {"imageUrl": url, "success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return {"success": False, "error": str(e)}

# --- Legacy endpoints ---
@app.get("/api/media-owners/all", dependencies=[Depends(require_staff)])
def get_all_media_owners(db: Session = Depends(get_db)):
    gsts = db.query(models.GstRegistration).options(joinedload(models.GstRegistration.company)).all()
    return [{"companyId": g.company_id, "companyName": g.company.name if g.company else "Unknown",
             "gstNumber": g.gst_number, "gstId": g.id} for g in gsts]

@app.get("/api/companies", dependencies=[Depends(require_staff)])
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
    # Execution proof photos grouped by phase (Start / Mid / End) for live tracking.
    # Visits sent back for a retake are never shown to the advertiser.
    phase_proofs = {"START": [], "MID": [], "END": []}
    acts = (db.query(models.CampaignActivity)
              .filter(models.CampaignActivity.site_id == a.site_id,
                      models.CampaignActivity.campaign_id == a.campaign_id,
                      models.CampaignActivity.image_urls.isnot(None),
                      models.CampaignActivity.status != proofs.REJECTED)
              .all())
    acts.sort(key=proofs.captured_at, reverse=True)
    for act in acts:
        labels = proofs.image_labels(act)
        when = proofs.captured_at(act)
        dist = proofs.distance_m(site.latitude, site.longitude, act.latitude, act.longitude) if site else None
        for url in proofs.image_urls(act):
            phase_proofs[proofs.phase_of(act.activity_type)].append({
                "url": url,
                "activityType": act.activity_type,
                "status": act.status,
                "shot": labels.get(url),  # close-up / wide / landmark / video
                "performedBy": act.performed_by,
                "date": str(act.activity_date) if act.activity_date else (str(when)[:10] if when else None),
                "capturedAt": proofs.iso(when),
                "createdAt": str(act.created_at) if act.created_at else None,
                "latitude": act.latitude,
                "longitude": act.longitude,
                "distanceM": round(dist) if dist is not None else None,
                "notes": act.notes,
            })
    proof_count = sum(len(v) for v in phase_proofs.values())
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
        "agreedCost": float(a.agreed_cost or 0),
        "latitude": site.latitude if site else None,
        "longitude": site.longitude if site else None,
        "imageUrl": site.image_url if site else None,
        "availabilityStatus": site.availability_status if site else None,
        "remarks": site.remarks if site else None,
        # assignment dates
        "bookedFrom": str(a.booked_from) if a.booked_from else None,
        "bookedTill": str(a.booked_till) if a.booked_till else None,
        # advertiser shortlist fields
        "isShortlisted": bool(a.is_shortlisted),
        "pendingApproval": bool(getattr(a, "pending_approval", False)),
        "finalStartDate": str(a.final_start_date) if a.final_start_date else None,
        "finalEndDate": str(a.final_end_date) if a.final_end_date else None,
        "printingType": a.printing_type,
        "printingCost": float(a.printing_cost or 0),
        "mountingCost": float(a.mounting_cost or 0),
        "otherCost": float(a.other_cost or 0),
        "executionRemarks": a.execution_remarks,
        # execution proof photos grouped by phase
        "proofs": phase_proofs,
        "proofCount": proof_count,
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
    has_login = bool(adv) and db.query(models.UserAccount.id).filter(
        models.UserAccount.advertiser_id == adv.id).first() is not None
    return {
        "advertiser": adv.company_name if adv else None,
        "advertiserEmail": adv.email if adv else None,
        "hasLogin": has_login,  # the portal nudges advertisers with an account to log in
        "campaigns": result,
    }


@app.get("/api/access/{token}/photos.zip")
def access_photos_zip(token: str, db: Session = Depends(get_db)):
    """The advertiser's proof photos for the campaign(s) on this link, as one zip.
    Only approved sites and accepted (non-rejected) proofs are included."""
    import photo_zip
    link = _validate_access_link(token, db)
    q = db.query(models.Campaign).options(joinedload(models.Campaign.site_assignments)).filter(
        models.Campaign.advertiser_id == link.advertiser_id)
    if link.campaign_id:
        q = q.filter(models.Campaign.id == link.campaign_id)
    campaign = q.order_by(models.Campaign.created_at.desc()).first()
    if not campaign:
        raise HTTPException(404, "No campaign on this link")
    assignments = photo_zip.select_assignments(list(campaign.site_assignments), include_pending=False)
    return photo_zip.build_zip_response(db, campaign, assignments)


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
    """Advertiser finalizes the campaign — moves status to FINALIZED (sites approved)."""
    link = _validate_access_link(token, db)
    c = db.query(models.Campaign).filter(
        models.Campaign.id == req.campaignId,
        models.Campaign.advertiser_id == link.advertiser_id,
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found or access denied")
    # Advance status to FINALIZED once the advertiser locks in their shortlisted sites.
    # For an already-running campaign, this is a re-approval of newly added sites —
    # status is left untouched, we only clear the pending flag on approved sites.
    if c.status in ("DRAFT", "PLANNED"):
        c.status = "FINALIZED"
    # Clear pending_approval on every shortlisted site; drop the flag on the rest too
    # (an un-shortlisted pending site is effectively rejected and won't block execution).
    assigns = db.query(models.CampaignSiteAssignment).filter(
        models.CampaignSiteAssignment.campaign_id == c.id,
        models.CampaignSiteAssignment.pending_approval == True,
    ).all()
    approved = 0
    for a in assigns:
        a.pending_approval = False
        if a.is_shortlisted:
            approved += 1
    db.commit()
    log_activity(db, "Advertiser finalized campaign", "campaign", c.id,
                 f"{c.name}" + (f" (+{approved} new sites approved)" if approved else ""))
    return {"message": "Campaign finalized", "newStatus": c.status, "newlyApproved": approved}
