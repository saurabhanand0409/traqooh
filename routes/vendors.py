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


def vendor_to_dict(v):
    return {
        "id": v.id, "name": v.name, "contactPerson": v.contact_person,
        "phone": v.phone, "email": v.email, "gstNumber": v.gst_number,
        "address": v.address, "city": v.city, "state": v.state,
        "notes": v.notes, "status": v.vendor_status,
        "createdAt": str(v.created_at) if v.created_at else None,
        "siteCount": len(v.sites) if v.sites else 0,
    }


@router.get("")
def list_vendors(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Company)
    if status:
        q = q.filter(models.Company.vendor_status == status)
    return [vendor_to_dict(v) for v in q.order_by(models.Company.name).all()]


@router.get("/{vendor_id}")
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    v = db.query(models.Company).filter(models.Company.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    return vendor_to_dict(v)


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
    return vendor_to_dict(v)


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
    return vendor_to_dict(v)


@router.get("/{vendor_id}/sites")
def get_vendor_sites(vendor_id: int, db: Session = Depends(get_db)):
    from utils import site_to_dict
    sites = db.query(models.Site).filter(models.Site.owner_company_id == vendor_id).all()
    return [site_to_dict(s) for s in sites]
