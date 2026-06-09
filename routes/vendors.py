"""Vendor (Media Owner) management routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
from utils import log_activity

router = APIRouter(prefix="/api/vendors", tags=["Vendors"])


class VendorCreate(BaseModel):
    name: str
    contactPerson: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstNumber: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "ACTIVE"


def vendor_to_dict(v, db: Session = None):
    media_user_count = 0
    admin_user = None
    employee_count = 0
    if db:
        users = db.query(models.UserAccount).filter(
            models.UserAccount.vendor_id == v.id
        ).all()
        media_user_count = len(users)
        for u in users:
            if u.role == "ADMIN":
                admin_user = {"id": u.id, "email": u.email, "displayName": u.display_name, "isActive": u.is_active}
            elif u.role in ("EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"):
                employee_count += 1
    return {
        "id": v.id, "name": v.name, "contactPerson": v.contact_person,
        "phone": v.phone, "email": v.email, "gstNumber": v.gst_number,
        "address": v.address, "city": v.city, "state": v.state,
        "notes": v.notes, "status": v.vendor_status,
        "createdAt": str(v.created_at) if v.created_at else None,
        "siteCount": len(v.sites) if v.sites else 0,
        "mediaUserCount": media_user_count,
        "adminUser": admin_user,
        "employeeCount": employee_count,
    }


@router.get("")
def list_vendors(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Company)
    if status:
        q = q.filter(models.Company.vendor_status == status)
    return [vendor_to_dict(v, db) for v in q.order_by(models.Company.name).all()]


@router.get("/{vendor_id}")
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    v = db.query(models.Company).filter(models.Company.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    result = vendor_to_dict(v, db)
    # Include linked media users
    media_users = db.query(models.UserAccount).filter(
        models.UserAccount.vendor_id == vendor_id
    ).all()
    result["mediaUsers"] = [
        {"id": u.id, "email": u.email, "displayName": u.display_name, "isActive": u.is_active}
        for u in media_users
    ]
    return result


@router.post("")
def create_vendor(req: VendorCreate, db: Session = Depends(get_db)):
    v = models.Company(
        name=req.name, contact_person=req.contactPerson, phone=req.phone,
        email=req.email, gst_number=req.gstNumber, address=req.address,
        city=req.city, state=req.state, notes=req.notes, vendor_status=req.status or "ACTIVE"
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    log_activity(db, "Created vendor", "vendor", v.id, v.name)
    return vendor_to_dict(v, db)


@router.put("/{vendor_id}")
def update_vendor(vendor_id: int, req: VendorCreate, db: Session = Depends(get_db)):
    v = db.query(models.Company).filter(models.Company.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    v.name = req.name
    v.contact_person = req.contactPerson
    v.phone = req.phone
    v.email = req.email
    v.gst_number = req.gstNumber
    v.address = req.address
    v.city = req.city
    v.state = req.state
    v.notes = req.notes
    v.vendor_status = req.status or v.vendor_status
    db.commit()
    db.refresh(v)
    log_activity(db, "Updated vendor", "vendor", v.id, v.name)
    return vendor_to_dict(v, db)


@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    """Delete a vendor. Unlinks media users and inventory, removes GST registrations, then deletes."""
    v = db.query(models.Company).filter(models.Company.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")

    vendor_name = v.name

    # Unlink media users
    db.query(models.UserAccount).filter(
        models.UserAccount.vendor_id == vendor_id
    ).update({"vendor_id": None}, synchronize_session=False)

    # Unlink inventory sites
    db.query(models.Site).filter(
        models.Site.owner_company_id == vendor_id
    ).update({"owner_company_id": None}, synchronize_session=False)

    # Remove GST registrations (and their contacts) linked to this company
    gst_records = db.query(models.GstRegistration).filter(
        models.GstRegistration.company_id == vendor_id
    ).all()
    for gst in gst_records:
        db.query(models.Contact).filter(
            models.Contact.gst_registration_id == gst.id
        ).delete(synchronize_session=False)
        db.delete(gst)

    db.flush()
    db.delete(v)
    db.commit()
    log_activity(db, f"Deleted vendor '{vendor_name}'", "vendor", vendor_id)
    return {"message": f"Vendor '{vendor_name}' deleted successfully"}


class SetAdminRequest(BaseModel):
    email: str
    password: str
    displayName: Optional[str] = None


class CreateEmployeeRequest(BaseModel):
    email: str
    password: str
    displayName: Optional[str] = None


@router.post("/{vendor_id}/set-admin")
def set_vendor_admin(vendor_id: int, req: SetAdminRequest, db: Session = Depends(get_db)):
    """Create or replace the admin login for a company."""
    from main import hash_password

    v = db.query(models.Company).filter(models.Company.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Company not found")

    # Check if email is already used by someone else
    existing = db.query(models.UserAccount).filter(
        models.UserAccount.email.ilike(req.email.strip()),
        models.UserAccount.vendor_id != vendor_id
    ).first()
    if existing:
        raise HTTPException(409, "Email already in use by another account")

    # If admin already exists for this company, update it
    current_admin = db.query(models.UserAccount).filter(
        models.UserAccount.vendor_id == vendor_id,
        models.UserAccount.role == "ADMIN"
    ).first()

    if current_admin:
        current_admin.email = req.email.lower().strip()
        current_admin.password_hash = hash_password(req.password)
        if req.displayName:
            current_admin.display_name = req.displayName
        db.commit()
        db.refresh(current_admin)
        log_activity(db, "Updated admin login", "vendor", vendor_id, v.name)
        return {"id": current_admin.id, "email": current_admin.email, "role": "ADMIN", "updated": True}
    else:
        new_admin = models.UserAccount(
            email=req.email.lower().strip(),
            password_hash=hash_password(req.password),
            role="ADMIN",
            display_name=req.displayName or req.email.split("@")[0],
            vendor_id=vendor_id,
            is_active=True,
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        log_activity(db, "Created admin login", "vendor", vendor_id, v.name)
        return {"id": new_admin.id, "email": new_admin.email, "role": "ADMIN", "updated": False}


@router.get("/{vendor_id}/employees")
def get_vendor_employees(vendor_id: int, db: Session = Depends(get_db)):
    """List all employees for a company."""
    employees = db.query(models.UserAccount).filter(
        models.UserAccount.vendor_id == vendor_id,
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).order_by(models.UserAccount.id).all()
    return [{"id": u.id, "email": u.email, "displayName": u.display_name, "isActive": u.is_active, "role": u.role} for u in employees]


@router.post("/{vendor_id}/employees")
def add_vendor_employee(vendor_id: int, req: CreateEmployeeRequest, db: Session = Depends(get_db)):
    """Add an employee to a company."""
    from main import hash_password

    v = db.query(models.Company).filter(models.Company.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Company not found")

    existing = db.query(models.UserAccount).filter(
        models.UserAccount.email.ilike(req.email.strip())
    ).first()
    if existing:
        raise HTTPException(409, "Email already registered")

    emp = models.UserAccount(
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        role="EMPLOYEE",
        display_name=req.displayName or req.email.split("@")[0],
        vendor_id=vendor_id,
        is_active=True,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    log_activity(db, "Added employee", "vendor", vendor_id, req.email)
    return {"id": emp.id, "email": emp.email, "displayName": emp.display_name, "role": "EMPLOYEE"}


@router.get("/{vendor_id}/sites")
def get_vendor_sites(vendor_id: int, db: Session = Depends(get_db)):
    from utils import site_to_dict
    sites = db.query(models.Site).filter(models.Site.owner_company_id == vendor_id).all()
    return [site_to_dict(s) for s in sites]
