"""Campaign Execution Activity routes.

Handles the on-ground campaign lifecycle for campaign owners and field staff:
PRINT, REPRINT, MOUNTING, AUDIT, MAINTENANCE, TAKEDOWN, START, END.

Each activity can carry photos (geo-tagged, timestamped) uploaded from the web
dashboard or the TraqOOH mobile app. Designed to be called by both clients.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import json

from database import get_db
import models
from utils import log_activity, upload_to_r2

router = APIRouter(prefix="/api/activities", tags=["Campaign Activities"])

VALID_TYPES = {"PRINT", "REPRINT", "MOUNTING", "AUDIT", "MAINTENANCE", "TAKEDOWN", "START", "END"}
VALID_STATUS = {"PENDING", "DONE", "VERIFIED"}


# ---------- Schemas ----------
class ActivityCreate(BaseModel):
    campaignId: int
    siteId: int
    assignmentId: Optional[int] = None
    activityType: str
    status: Optional[str] = "PENDING"
    performedBy: Optional[str] = None
    activityDate: Optional[str] = None       # ISO date string
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = "web"
    createdByUserId: Optional[int] = None


class ActivityUpdate(BaseModel):
    status: Optional[str] = None
    performedBy: Optional[str] = None
    activityDate: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ---------- Serializer ----------
def activity_to_dict(a, db: Optional[Session] = None):
    site_name = None
    campaign_name = None
    if db:
        s = db.query(models.Site).filter(models.Site.id == a.site_id).first()
        site_name = s.name if s else None
        c = db.query(models.Campaign).filter(models.Campaign.id == a.campaign_id).first()
        campaign_name = c.name if c else None
    return {
        "id": a.id,
        "campaignId": a.campaign_id,
        "campaignName": campaign_name,
        "siteId": a.site_id,
        "siteName": site_name,
        "assignmentId": a.assignment_id,
        "activityType": a.activity_type,
        "status": a.status,
        "performedBy": a.performed_by,
        "activityDate": str(a.activity_date) if a.activity_date else None,
        "notes": a.notes,
        "imageUrls": json.loads(a.image_urls) if a.image_urls else [],
        "latitude": a.latitude,
        "longitude": a.longitude,
        "source": a.source,
        "createdByUserId": a.created_by_user_id,
        "createdAt": str(a.created_at) if a.created_at else None,
        "updatedAt": str(a.updated_at) if a.updated_at else None,
    }


# ---------- List / Filter ----------
@router.get("")
def list_activities(
    campaignId: Optional[int] = None,
    siteId: Optional[int] = None,
    assignmentId: Optional[int] = None,
    activityType: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.CampaignActivity)
    if campaignId:
        q = q.filter(models.CampaignActivity.campaign_id == campaignId)
    if siteId:
        q = q.filter(models.CampaignActivity.site_id == siteId)
    if assignmentId:
        q = q.filter(models.CampaignActivity.assignment_id == assignmentId)
    if activityType:
        q = q.filter(models.CampaignActivity.activity_type == activityType.upper())
    if status:
        q = q.filter(models.CampaignActivity.status == status.upper())
    rows = q.order_by(models.CampaignActivity.created_at.desc()).all()
    return [activity_to_dict(a, db) for a in rows]


@router.get("/{activity_id}")
def get_activity(activity_id: int, db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    return activity_to_dict(a, db)


# ---------- Create ----------
@router.post("")
def create_activity(req: ActivityCreate, db: Session = Depends(get_db)):
    at = (req.activityType or "").upper()
    if at not in VALID_TYPES:
        raise HTTPException(400, f"Invalid activityType. Must be one of {sorted(VALID_TYPES)}")
    st = (req.status or "PENDING").upper()
    if st not in VALID_STATUS:
        raise HTTPException(400, f"Invalid status. Must be one of {sorted(VALID_STATUS)}")

    # validate campaign + site exist
    if not db.query(models.Campaign).filter(models.Campaign.id == req.campaignId).first():
        raise HTTPException(404, f"Campaign #{req.campaignId} not found")
    if not db.query(models.Site).filter(models.Site.id == req.siteId).first():
        raise HTTPException(404, f"Site #{req.siteId} not found")

    a = models.CampaignActivity(
        campaign_id=req.campaignId,
        site_id=req.siteId,
        assignment_id=req.assignmentId,
        activity_type=at,
        status=st,
        performed_by=req.performedBy,
        activity_date=date.fromisoformat(req.activityDate) if req.activityDate else None,
        notes=req.notes,
        latitude=req.latitude,
        longitude=req.longitude,
        source=req.source or "web",
        created_by_user_id=req.createdByUserId,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    log_activity(db, f"Logged {at} activity", "campaign_activity", a.id,
                 f"Campaign #{req.campaignId}, Site #{req.siteId}")
    return activity_to_dict(a, db)


# ---------- Update ----------
@router.put("/{activity_id}")
def update_activity(activity_id: int, req: ActivityUpdate, db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    if req.status:
        st = req.status.upper()
        if st not in VALID_STATUS:
            raise HTTPException(400, f"Invalid status. Must be one of {sorted(VALID_STATUS)}")
        a.status = st
    if req.performedBy is not None:
        a.performed_by = req.performedBy
    if req.activityDate:
        a.activity_date = date.fromisoformat(req.activityDate)
    if req.notes is not None:
        a.notes = req.notes
    if req.latitude is not None:
        a.latitude = req.latitude
    if req.longitude is not None:
        a.longitude = req.longitude
    db.commit()
    db.refresh(a)
    log_activity(db, "Updated activity", "campaign_activity", a.id)
    return activity_to_dict(a, db)


# ---------- Delete ----------
@router.delete("/{activity_id}")
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    db.delete(a)
    db.commit()
    log_activity(db, "Deleted activity", "campaign_activity", activity_id)
    return {"success": True, "deletedId": activity_id}


# ---------- Photo upload ----------
@router.post("/{activity_id}/upload-image")
async def upload_activity_image(activity_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    url = await upload_to_r2(file, folder="campaign-activities")
    current = json.loads(a.image_urls) if a.image_urls else []
    current.append(url)
    a.image_urls = json.dumps(current)
    db.commit()
    return {"imageUrl": url, "allImages": current}


@router.delete("/{activity_id}/image")
def remove_activity_image(activity_id: int, imageUrl: str, db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    current = json.loads(a.image_urls) if a.image_urls else []
    current = [u for u in current if u != imageUrl]
    a.image_urls = json.dumps(current)
    db.commit()
    return {"allImages": current}


# ---------- Per-campaign timeline summary ----------
@router.get("/campaign/{campaign_id}/timeline")
def campaign_timeline(campaign_id: int, db: Session = Depends(get_db)):
    """Grouped activity timeline for a campaign — useful for the dashboard."""
    rows = (db.query(models.CampaignActivity)
            .filter(models.CampaignActivity.campaign_id == campaign_id)
            .order_by(models.CampaignActivity.activity_date.desc().nullslast(),
                      models.CampaignActivity.created_at.desc())
            .all())
    by_site = {}
    for a in rows:
        by_site.setdefault(a.site_id, []).append(activity_to_dict(a, db))
    return {
        "campaignId": campaign_id,
        "totalActivities": len(rows),
        "bySite": by_site,
        "all": [activity_to_dict(a, db) for a in rows],
    }


# ---------- Mobile combined create + photo (one shot) ----------
@router.post("/mobile/log")
async def mobile_log_activity(
    campaignId: int = Form(...),
    siteId: int = Form(...),
    activityType: str = Form(...),
    assignmentId: Optional[int] = Form(None),
    performedBy: Optional[str] = Form(None),
    activityDate: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    status: Optional[str] = Form("DONE"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """One-shot endpoint for the mobile app: create an activity AND attach a photo
    in a single multipart request (field staff snapping a photo on-site)."""
    at = (activityType or "").upper()
    if at not in VALID_TYPES:
        raise HTTPException(400, f"Invalid activityType. Must be one of {sorted(VALID_TYPES)}")

    a = models.CampaignActivity(
        campaign_id=campaignId,
        site_id=siteId,
        assignment_id=assignmentId,
        activity_type=at,
        status=(status or "DONE").upper(),
        performed_by=performedBy,
        activity_date=date.fromisoformat(activityDate) if activityDate else date.today(),
        notes=notes,
        latitude=latitude,
        longitude=longitude,
        source="mobile",
    )
    db.add(a)
    db.commit()
    db.refresh(a)

    if file is not None:
        url = await upload_to_r2(file, folder="campaign-activities")
        a.image_urls = json.dumps([url])
        db.commit()
        db.refresh(a)

    log_activity(db, f"Mobile logged {at}", "campaign_activity", a.id,
                 f"Campaign #{campaignId}, Site #{siteId}")
    return activity_to_dict(a, db)
