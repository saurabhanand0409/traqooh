"""Admin management routes — only accessible to ADMIN role."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
from utils import log_activity

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class CreateEmployeeRequest(BaseModel):
    email: str
    password: str
    displayName: Optional[str] = None


class UpdateEmployeeRequest(BaseModel):
    displayName: Optional[str] = None
    password: Optional[str] = None
    isActive: Optional[bool] = None


def employee_to_dict(u):
    return {
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "displayName": u.display_name,
        "isActive": u.is_active if u.is_active is not None else True,
        "createdAt": str(u.created_at) if u.created_at else None,
    }


@router.get("/employees")
def list_employees(db: Session = Depends(get_db)):
    """List all employees (EMPLOYEE + TEAM_MEMBER + MEDIA_OWNER roles)."""
    employees = db.query(models.UserAccount).filter(
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).order_by(models.UserAccount.id).all()
    return [employee_to_dict(e) for e in employees]


@router.post("/employees")
def create_employee(req: CreateEmployeeRequest, db: Session = Depends(get_db)):
    """Create a new EMPLOYEE account. Only admin should call this."""
    from main import hash_password

    existing = db.query(models.UserAccount).filter(
        models.UserAccount.email.ilike(req.email.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.UserAccount(
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        role="EMPLOYEE",
        display_name=req.displayName,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, "Admin created employee", "user", user.id, req.email)
    return employee_to_dict(user)


@router.put("/employees/{employee_id}")
def update_employee(employee_id: int, req: UpdateEmployeeRequest, db: Session = Depends(get_db)):
    """Update employee display name, password, or active status."""
    from main import hash_password

    user = db.query(models.UserAccount).filter(
        models.UserAccount.id == employee_id,
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    if req.displayName is not None:
        user.display_name = req.displayName
    if req.password:
        user.password_hash = hash_password(req.password)
    if req.isActive is not None:
        user.is_active = req.isActive

    db.commit()
    db.refresh(user)
    log_activity(db, "Admin updated employee", "user", user.id, user.email)
    return employee_to_dict(user)


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    """Delete an employee account."""
    user = db.query(models.UserAccount).filter(
        models.UserAccount.id == employee_id,
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    email = user.email
    db.delete(user)
    db.commit()
    log_activity(db, "Admin deleted employee", "user", employee_id, email)
    return {"message": "Employee deleted"}


@router.post("/create-admin")
def create_admin(req: CreateEmployeeRequest, db: Session = Depends(get_db)):
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
    return employee_to_dict(user)
