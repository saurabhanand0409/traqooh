"""Admin management routes — only accessible to ADMIN role."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import datetime
import random
from database import get_db
import models
from utils import log_activity
from jwt_utils import get_current_user, require_roles, require_admin, require_staff

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class CreateMediaUserRequest(BaseModel):
    email: str
    password: str
    displayName: Optional[str] = None
    vendorId: Optional[int] = None
    isActive: Optional[bool] = True


class UpdateMediaUserRequest(BaseModel):
    displayName: Optional[str] = None
    password: Optional[str] = None
    isActive: Optional[bool] = None
    vendorId: Optional[int] = None  # use -1 to explicitly unassign


def media_user_to_dict(u, db: Session = None):
    vendor_name = None
    if u.vendor_id and db:
        v = db.query(models.Company).filter(models.Company.id == u.vendor_id).first()
        vendor_name = v.name if v else None
    return {
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "displayName": u.display_name,
        "isActive": u.is_active if u.is_active is not None else True,
        "vendorId": u.vendor_id,
        "vendorName": vendor_name,
        "createdAt": str(u.created_at) if u.created_at else None,
    }


# --- Media Users (was "Employees") ---

@router.get("/media-users", dependencies=[Depends(require_admin)])
def list_media_users(db: Session = Depends(get_db)):
    """List all media users (EMPLOYEE + TEAM_MEMBER + MEDIA_OWNER roles)."""
    users = db.query(models.UserAccount).filter(
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).order_by(models.UserAccount.id).all()
    return [media_user_to_dict(u, db) for u in users]


@router.post("/media-users", dependencies=[Depends(require_admin)])
def create_media_user(req: CreateMediaUserRequest, db: Session = Depends(get_db)):
    """Create a new media user account."""
    from main import hash_password

    existing = db.query(models.UserAccount).filter(
        models.UserAccount.email.ilike(req.email.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Validate vendor if provided
    if req.vendorId:
        vendor = db.query(models.Company).filter(models.Company.id == req.vendorId).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

    user = models.UserAccount(
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        role="EMPLOYEE",
        display_name=req.displayName,
        vendor_id=req.vendorId,
        is_active=req.isActive if req.isActive is not None else True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, "Admin created media user", "user", user.id, req.email)
    return media_user_to_dict(user, db)


@router.put("/media-users/{user_id}", dependencies=[Depends(require_admin)])
def update_media_user(user_id: int, req: UpdateMediaUserRequest, db: Session = Depends(get_db)):
    """Update media user display name, password, active status, or vendor assignment."""
    from main import hash_password

    user = db.query(models.UserAccount).filter(
        models.UserAccount.id == user_id,
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Media user not found")

    if req.displayName is not None:
        user.display_name = req.displayName
    if req.password:
        user.password_hash = hash_password(req.password)
    if req.isActive is not None:
        user.is_active = req.isActive
    if req.vendorId is not None:
        user.vendor_id = None if req.vendorId == -1 else req.vendorId

    db.commit()
    db.refresh(user)
    log_activity(db, "Admin updated media user", "user", user.id, user.email)
    return media_user_to_dict(user, db)


@router.delete("/media-users/{user_id}", dependencies=[Depends(require_admin)])
def delete_media_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a media user account."""
    user = db.query(models.UserAccount).filter(
        models.UserAccount.id == user_id,
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Media user not found")
    email = user.email
    db.delete(user)
    db.commit()
    log_activity(db, "Admin deleted media user", "user", user_id, email)
    return {"message": "Media user deleted"}


# --- Legacy aliases (backward compat during transition) ---

@router.get("/employees", dependencies=[Depends(require_admin)])
def list_employees_alias(db: Session = Depends(get_db)):
    return list_media_users(db)


@router.post("/employees", dependencies=[Depends(require_admin)])
def create_employee_alias(req: CreateMediaUserRequest, db: Session = Depends(get_db)):
    return create_media_user(req, db)


@router.put("/employees/{user_id}", dependencies=[Depends(require_admin)])
def update_employee_alias(user_id: int, req: UpdateMediaUserRequest, db: Session = Depends(get_db)):
    return update_media_user(user_id, req, db)


@router.delete("/employees/{user_id}", dependencies=[Depends(require_admin)])
def delete_employee_alias(user_id: int, db: Session = Depends(get_db)):
    return delete_media_user(user_id, db)


# --- Admin account creation ---

@router.post("/create-super-admin")
def create_super_admin(req: CreateMediaUserRequest, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user)):
    """Create a SUPER_ADMIN (master) account. Only an existing SUPER_ADMIN may do this;
    the very first one is created with scripts/seed_admin.py."""
    require_roles(current_user, "SUPER_ADMIN")
    from main import hash_password
    existing = db.query(models.UserAccount).filter(
        models.UserAccount.email.ilike(req.email.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = models.UserAccount(
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        role="SUPER_ADMIN",
        display_name=req.displayName or "Master Admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role, "displayName": user.display_name}


@router.post("/create-admin")
def create_admin(req: CreateMediaUserRequest, db: Session = Depends(get_db),
                 current_user: dict = Depends(get_current_user)):
    """Create an ADMIN account. SUPER_ADMIN only."""
    require_roles(current_user, "SUPER_ADMIN")
    from main import hash_password

    existing = db.query(models.UserAccount).filter(
        models.UserAccount.email.ilike(req.email.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.UserAccount(
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        role="ADMIN",
        display_name=req.displayName or "Admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, "Created admin account", "user", user.id, req.email)
    return media_user_to_dict(user, db)


# --- Field PIN Management ---

class CreateFieldPinRequest(BaseModel):
    workerName: str
    vendorId: Optional[int] = None
    adminEmail: str


def field_pin_to_dict(fp, db: Session = None):
    company_name = None
    if fp.vendor_id and db:
        c = db.query(models.Company).filter(models.Company.id == fp.vendor_id).first()
        company_name = c.name if c else None
    now = datetime.datetime.utcnow()
    hours_left = max(0, round((fp.expires_at - now).total_seconds() / 3600, 1)) if fp.expires_at > now else 0
    return {
        "id": fp.id,
        "pin": fp.pin,
        "workerName": fp.worker_name,
        "vendorId": fp.vendor_id,
        "vendorName": company_name,
        "isActive": fp.is_active,
        "expiresAt": fp.expires_at.isoformat(),
        "hoursLeft": hours_left,
        "createdAt": fp.created_at.isoformat() if fp.created_at else None,
        "createdByAdminEmail": fp.created_by_admin_email,
    }


@router.get("/field-pins", dependencies=[Depends(require_staff)])
def list_field_pins(admin_email: Optional[str] = None, db: Session = Depends(get_db)):
    """List all field PINs, optionally filtered by admin email."""
    q = db.query(models.FieldPin)
    if admin_email:
        q = q.filter(models.FieldPin.created_by_admin_email == admin_email)
    pins = q.order_by(models.FieldPin.created_at.desc()).all()
    return [field_pin_to_dict(p, db) for p in pins]


@router.post("/field-pins", dependencies=[Depends(require_staff)])
def create_field_pin(req: CreateFieldPinRequest, db: Session = Depends(get_db)):
    """Generate a random 4-digit PIN for a field worker. Valid for 30 days
    (extended from the original 72 hours so workers aren't re-issued PINs weekly)."""
    # Generate a PIN unique among currently active PINs for this admin
    for _ in range(100):
        pin = "".join([str(random.randint(0, 9)) for _ in range(4)])
        conflict = db.query(models.FieldPin).filter(
            models.FieldPin.pin == pin,
            models.FieldPin.is_active == True,
            models.FieldPin.expires_at > datetime.datetime.utcnow()
        ).first()
        if not conflict:
            break

    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=30)
    fp = models.FieldPin(
        pin=pin,
        vendor_id=req.vendorId,
        created_by_admin_email=req.adminEmail,
        worker_name=req.workerName,
        is_active=True,
        expires_at=expires_at,
    )
    db.add(fp)
    db.commit()
    db.refresh(fp)
    log_activity(db, f"Admin created field PIN for '{req.workerName}'", "field_pin", fp.id, req.adminEmail)
    return field_pin_to_dict(fp, db)


@router.delete("/field-pins/{pin_id}", dependencies=[Depends(require_staff)])
def revoke_field_pin(pin_id: int, db: Session = Depends(get_db)):
    """Revoke (deactivate) a field PIN immediately."""
    fp = db.query(models.FieldPin).filter(models.FieldPin.id == pin_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="PIN not found")
    fp.is_active = False
    db.commit()
    log_activity(db, f"Field PIN revoked for '{fp.worker_name}'", "field_pin", fp.id, fp.created_by_admin_email)
    return {"success": True, "message": "PIN revoked"}
