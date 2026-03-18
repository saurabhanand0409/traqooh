"""Campaign management routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
import models
from utils import log_activity, site_to_dict

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


class CampaignCreate(BaseModel):
    name: str
    advertiserId: int
    internalOwner: Optional[str] = None
    campaignType: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    totalCost: Optional[float] = 0.0
    status: Optional[str] = "DRAFT"
    notes: Optional[str] = None
    billingRemarks: Optional[str] = None


class AssignSiteRequest(BaseModel):
    siteId: int
    bookedFrom: Optional[str] = None
    bookedTill: Optional[str] = None
    agreedCost: Optional[float] = 0.0
    unitCost: Optional[float] = 0.0
    notes: Optional[str] = None


def campaign_to_dict(c):
    return {
        "id": c.id, "name": c.name, "advertiserId": c.advertiser_id,
        "advertiserName": c.advertiser.company_name if c.advertiser else None,
        "internalOwner": c.internal_owner, "campaignType": c.campaign_type,
        "startDate": str(c.start_date) if c.start_date else None,
        "endDate": str(c.end_date) if c.end_date else None,
        "totalCost": c.total_cost, "status": c.status,
        "notes": c.notes, "billingRemarks": c.billing_remarks,
        "createdAt": str(c.created_at) if c.created_at else None,
        "siteCount": len(c.site_assignments) if c.site_assignments else 0,
    }


@router.get("")
def list_campaigns(status: Optional[str] = None, advertiserId: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.Campaign).options(joinedload(models.Campaign.advertiser))
    if status:
        q = q.filter(models.Campaign.status == status)
    if advertiserId:
        q = q.filter(models.Campaign.advertiser_id == advertiserId)
    return [campaign_to_dict(c) for c in q.order_by(models.Campaign.created_at.desc()).all()]


@router.get("/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Campaign).options(
        joinedload(models.Campaign.advertiser),
        joinedload(models.Campaign.site_assignments)
    ).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    result = campaign_to_dict(c)
    # Include assigned sites
    assignments = []
    for a in c.site_assignments:
        site = db.query(models.Site).options(joinedload(models.Site.owner)).filter(models.Site.id == a.site_id).first()
        assignments.append({
            "assignmentId": a.id, "siteId": a.site_id,
            "siteName": site.name if site else None,
            "siteCity": site.city if site else None,
            "vendorName": site.owner.name if site and site.owner else None,
            "bookedFrom": str(a.booked_from) if a.booked_from else None,
            "bookedTill": str(a.booked_till) if a.booked_till else None,
            "agreedCost": a.agreed_cost, "unitCost": a.unit_cost,
            "status": a.status, "notes": a.notes,
        })
    result["assignments"] = assignments
    # Include audits
    audits = db.query(models.SiteAudit).filter(models.SiteAudit.campaign_id == campaign_id).all()
    result["audits"] = [{
        "id": au.id, "siteId": au.site_id, "auditType": au.audit_type,
        "scheduledDate": str(au.scheduled_date) if au.scheduled_date else None,
        "actualDate": str(au.actual_audit_date) if au.actual_audit_date else None,
        "status": au.status, "auditor": au.auditor, "notes": au.notes,
        "imageUrls": au.image_urls,
    } for au in audits]
    return result


@router.post("")
def create_campaign(req: CampaignCreate, db: Session = Depends(get_db)):
    from datetime import date
    adv = db.query(models.Advertiser).filter(models.Advertiser.id == req.advertiserId).first()
    if not adv:
        raise HTTPException(404, "Advertiser not found")
    c = models.Campaign(
        name=req.name, advertiser_id=req.advertiserId,
        internal_owner=req.internalOwner, campaign_type=req.campaignType,
        start_date=date.fromisoformat(req.startDate) if req.startDate else None,
        end_date=date.fromisoformat(req.endDate) if req.endDate else None,
        total_cost=req.totalCost or 0.0, status=req.status or "DRAFT",
        notes=req.notes, billing_remarks=req.billingRemarks,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    log_activity(db, "Created campaign", "campaign", c.id, c.name)
    return campaign_to_dict(c)


@router.put("/{campaign_id}")
def update_campaign(campaign_id: int, req: CampaignCreate, db: Session = Depends(get_db)):
    from datetime import date
    c = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    c.name = req.name
    c.advertiser_id = req.advertiserId
    c.internal_owner = req.internalOwner
    c.campaign_type = req.campaignType
    c.start_date = date.fromisoformat(req.startDate) if req.startDate else None
    c.end_date = date.fromisoformat(req.endDate) if req.endDate else None
    c.total_cost = req.totalCost or 0.0
    c.status = req.status or c.status
    c.notes = req.notes
    c.billing_remarks = req.billingRemarks
    db.commit()
    db.refresh(c)
    log_activity(db, "Updated campaign", "campaign", c.id, c.name)
    return campaign_to_dict(c)


@router.post("/{campaign_id}/assign-site")
def assign_site(campaign_id: int, req: AssignSiteRequest, db: Session = Depends(get_db)):
    from datetime import date
    c = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    site = db.query(models.Site).filter(models.Site.id == req.siteId).first()
    if not site:
        raise HTTPException(404, "Site not found")
    bk_from = date.fromisoformat(req.bookedFrom) if req.bookedFrom else None
    bk_till = date.fromisoformat(req.bookedTill) if req.bookedTill else None
    # Check for overlapping bookings
    if bk_from and bk_till:
        overlap = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.site_id == req.siteId,
            models.CampaignSiteAssignment.status.in_(["PLANNED", "ACTIVE"]),
            models.CampaignSiteAssignment.booked_from <= bk_till,
            models.CampaignSiteAssignment.booked_till >= bk_from,
        ).first()
        if overlap:
            raise HTTPException(409, f"Site is already booked for overlapping dates (campaign #{overlap.campaign_id})")
    assignment = models.CampaignSiteAssignment(
        campaign_id=campaign_id, site_id=req.siteId,
        booked_from=bk_from, booked_till=bk_till,
        agreed_cost=req.agreedCost or 0.0, unit_cost=req.unitCost or 0.0,
        notes=req.notes, status="PLANNED",
    )
    db.add(assignment)
    # Update site availability
    site.availability_status = "BOOKED"
    site.current_campaign_id = campaign_id
    site.occupied_from = bk_from
    site.occupied_till = bk_till
    db.commit()
    log_activity(db, "Assigned site to campaign", "campaign", campaign_id, f"Site #{req.siteId}")
    return {"message": "Site assigned", "assignmentId": assignment.id}


@router.delete("/{campaign_id}/remove-site/{assignment_id}")
def remove_site(campaign_id: int, assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.CampaignSiteAssignment).filter(
        models.CampaignSiteAssignment.id == assignment_id,
        models.CampaignSiteAssignment.campaign_id == campaign_id
    ).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    site = db.query(models.Site).filter(models.Site.id == a.site_id).first()
    if site and site.current_campaign_id == campaign_id:
        site.availability_status = "AVAILABLE"
        site.current_campaign_id = None
        site.occupied_from = None
        site.occupied_till = None
    db.delete(a)
    db.commit()
    log_activity(db, "Removed site from campaign", "campaign", campaign_id, f"Site #{a.site_id}")
    return {"message": "Site removed from campaign"}
