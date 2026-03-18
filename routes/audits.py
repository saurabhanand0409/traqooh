"""Site audit routes."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
import json
from utils import log_activity, upload_to_r2

router = APIRouter(prefix="/api/audits", tags=["Audits"])


class AuditCreate(BaseModel):
    campaignId: int
    siteId: int
    auditType: str  # START, MID, END, EXTRA
    scheduledDate: Optional[str] = None
    auditor: Optional[str] = None
    notes: Optional[str] = None


class AuditUpdate(BaseModel):
    actualAuditDate: Optional[str] = None
    status: Optional[str] = None
    auditor: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def audit_to_dict(a):
    return {
        "id": a.id, "campaignId": a.campaign_id, "siteId": a.site_id,
        "auditType": a.audit_type,
        "scheduledDate": str(a.scheduled_date) if a.scheduled_date else None,
        "actualAuditDate": str(a.actual_audit_date) if a.actual_audit_date else None,
        "status": a.status, "auditor": a.auditor, "notes": a.notes,
        "imageUrls": json.loads(a.image_urls) if a.image_urls else [],
        "latitude": a.latitude, "longitude": a.longitude,
        "createdAt": str(a.created_at) if a.created_at else None,
    }


@router.get("")
def list_audits(campaignId: Optional[int] = None, siteId: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.SiteAudit)
    if campaignId:
        q = q.filter(models.SiteAudit.campaign_id == campaignId)
    if siteId:
        q = q.filter(models.SiteAudit.site_id == siteId)
    return [audit_to_dict(a) for a in q.order_by(models.SiteAudit.created_at.desc()).all()]


@router.get("/{audit_id}")
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    a = db.query(models.SiteAudit).filter(models.SiteAudit.id == audit_id).first()
    if not a:
        raise HTTPException(404, "Audit not found")
    return audit_to_dict(a)


@router.post("")
def create_audit(req: AuditCreate, db: Session = Depends(get_db)):
    from datetime import date
    a = models.SiteAudit(
        campaign_id=req.campaignId, site_id=req.siteId,
        audit_type=req.auditType,
        scheduled_date=date.fromisoformat(req.scheduledDate) if req.scheduledDate else None,
        auditor=req.auditor, notes=req.notes, status="PENDING",
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    log_activity(db, f"Created {req.auditType} audit", "audit", a.id, f"Campaign #{req.campaignId}, Site #{req.siteId}")
    return audit_to_dict(a)


@router.put("/{audit_id}")
def update_audit(audit_id: int, req: AuditUpdate, db: Session = Depends(get_db)):
    from datetime import date
    a = db.query(models.SiteAudit).filter(models.SiteAudit.id == audit_id).first()
    if not a:
        raise HTTPException(404, "Audit not found")
    if req.actualAuditDate:
        a.actual_audit_date = date.fromisoformat(req.actualAuditDate)
    if req.status:
        a.status = req.status
    if req.auditor:
        a.auditor = req.auditor
    if req.notes is not None:
        a.notes = req.notes
    if req.latitude is not None:
        a.latitude = req.latitude
    if req.longitude is not None:
        a.longitude = req.longitude
    db.commit()
    db.refresh(a)
    log_activity(db, "Updated audit", "audit", a.id)
    return audit_to_dict(a)


@router.post("/{audit_id}/upload-image")
async def upload_audit_image(audit_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    a = db.query(models.SiteAudit).filter(models.SiteAudit.id == audit_id).first()
    if not a:
        raise HTTPException(404, "Audit not found")
    url = await upload_to_r2(file, folder="campaign-audits")
    current = json.loads(a.image_urls) if a.image_urls else []
    current.append(url)
    a.image_urls = json.dumps(current)
    db.commit()
    return {"imageUrl": url, "allImages": current}


# Mobile-friendly aliases
@router.get("/mobile/audits")
def mobile_list_audits(campaignId: Optional[int] = None, siteId: Optional[int] = None, db: Session = Depends(get_db)):
    return list_audits(campaignId=campaignId, siteId=siteId, db=db)
