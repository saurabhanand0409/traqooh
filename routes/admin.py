"""Admin management routes — only accessible to ADMIN role."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
from utils import log_activity

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

@router.get("/media-users")
def list_media_users(db: Session = Depends(get_db)):
    """List all media users (EMPLOYEE + TEAM_MEMBER + MEDIA_OWNER roles)."""
    users = db.query(models.UserAccount).filter(
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).order_by(models.UserAccount.id).all()
    return [media_user_to_dict(u, db) for u in users]


@router.post("/media-users")
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


@router.put("/media-users/{user_id}")
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


@router.delete("/media-users/{user_id}")
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

@router.get("/employees")
def list_employees_alias(db: Session = Depends(get_db)):
    return list_media_users(db)


@router.post("/employees")
def create_employee_alias(req: CreateMediaUserRequest, db: Session = Depends(get_db)):
    return create_media_user(req, db)


@router.put("/employees/{user_id}")
def update_employee_alias(user_id: int, req: UpdateMediaUserRequest, db: Session = Depends(get_db)):
    return update_media_user(user_id, req, db)


@router.delete("/employees/{user_id}")
def delete_employee_alias(user_id: int, db: Session = Depends(get_db)):
    return delete_media_user(user_id, db)


# --- Admin account creation ---

@router.post("/create-super-admin")
def create_super_admin(req: CreateMediaUserRequest, db: Session = Depends(get_db)):
    """Create a SUPER_ADMIN (master) account."""
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
def create_admin(req: CreateMediaUserRequest, db: Session = Depends(get_db)):
    """Create an ADMIN account (for initial setup)."""
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
