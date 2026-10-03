"""Campaign Execution Activity routes.

Handles the on-ground campaign lifecycle for campaign owners and field staff:
PRINT, REPRINT, MOUNTING, AUDIT, MAINTENANCE, TAKEDOWN, START, END.

Each activity can carry photos (geo-tagged, timestamped) uploaded from the web
dashboard or the TraqOOH mobile app. Designed to be called by both clients.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
import json

from database import get_db
import models
from utils import log_activity, upload_to_r2
from jwt_utils import get_current_user_optional, REQUIRE_FIELD_AUTH, require_staff
from proofs import image_urls, image_labels, parse_client_datetime, iso
import notifications

router = APIRouter(prefix="/api/activities", tags=["Campaign Activities"])

VALID_TYPES = {"PRINT", "REPRINT", "MOUNTING", "AUDIT", "MAINTENANCE", "TAKEDOWN", "START", "END"}
VALID_STATUS = {"PENDING", "DONE", "VERIFIED", "REJECTED"}
REVIEW_STATUSES = {"VERIFIED", "REJECTED"}
LIVE_CAMPAIGN_STATUSES = ["FINALIZED", "RUNNING", "LIVE"]


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
    reviewNote: Optional[str] = None   # reason when status is REJECTED (needs retake)


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
        "imageUrls": image_urls(a),
        "imageLabels": image_labels(a),
        "latitude": a.latitude,
        "longitude": a.longitude,
        "gpsAccuracyM": a.gps_accuracy_m,
        "capturedAt": iso(a.captured_at),
        "clientVisitId": a.client_visit_id,
        "source": a.source,
        "createdByUserId": a.created_by_user_id,
        "reviewNote": a.review_note,
        "reviewedBy": a.reviewed_by,
        "reviewedAt": iso(a.reviewed_at),
        "createdAt": str(a.created_at) if a.created_at else None,
        "updatedAt": str(a.updated_at) if a.updated_at else None,
    }


# ---------- List / Filter ----------
@router.get("", dependencies=[Depends(require_staff)])
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


@router.get("/{activity_id}", dependencies=[Depends(require_staff)])
def get_activity(activity_id: int, db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    return activity_to_dict(a, db)


# ---------- Create ----------
@router.post("", dependencies=[Depends(require_staff)])
def create_activity(req: ActivityCreate, db: Session = Depends(get_db)):
    at = (req.activityType or "").upper()
    if at not in VALID_TYPES:
        raise HTTPException(400, f"Invalid activityType. Must be one of {sorted(VALID_TYPES)}")
    st = (req.status or "PENDING").upper()
    if st not in VALID_STATUS:
        raise HTTPException(400, f"Invalid status. Must be one of {sorted(VALID_STATUS)}")

    # validate campaign + site exist
    if req.campaignId and not db.query(models.Campaign).filter(models.Campaign.id == req.campaignId).first():
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
@router.put("/{activity_id}", dependencies=[Depends(require_staff)])
def update_activity(activity_id: int, req: ActivityUpdate, background: BackgroundTasks,
                    db: Session = Depends(get_db),
                    user: Optional[dict] = Depends(get_current_user_optional)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    newly_rejected = False
    if req.status:
        st = req.status.upper()
        if st not in VALID_STATUS:
            raise HTTPException(400, f"Invalid status. Must be one of {sorted(VALID_STATUS)}")
        newly_rejected = st == "REJECTED" and a.status != "REJECTED"
        a.status = st
        if st in REVIEW_STATUSES:
            # Verified or sent back for a retake: record who decided, when, and why.
            a.reviewed_by = (user or {}).get("displayName") or (user or {}).get("email")
            a.reviewed_at = datetime.utcnow()
            a.review_note = ((req.reviewNote or "").strip() or None) if st == "REJECTED" else None
        else:
            a.review_note = None
            a.reviewed_by = None
            a.reviewed_at = None
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
    if newly_rejected:
        _notify_retake(db, a, background)
    return activity_to_dict(a, db)


def _notify_retake(db: Session, a, background: BackgroundTasks):
    """Tell the worker now responsible for the site that this visit needs a retake."""
    assignment = (db.query(models.CampaignSiteAssignment)
                  .filter(models.CampaignSiteAssignment.id == a.assignment_id).first()
                  if a.assignment_id else None)
    worker = (assignment.monitor_worker_name if assignment else None) or a.performed_by
    if not worker:
        return
    site = db.query(models.Site).filter(models.Site.id == a.site_id).first()
    background.add_task(
        notifications.notify_worker, worker, "retake",
        {"siteId": a.site_id, "campaignId": a.campaign_id, "assignmentId": a.assignment_id, "activityId": a.id},
        site=site.name if site else f"Site #{a.site_id}",
        reason=a.review_note or "Please take the photos again")


# ---------- Delete ----------
@router.delete("/{activity_id}", dependencies=[Depends(require_staff)])
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    db.delete(a)
    db.commit()
    log_activity(db, "Deleted activity", "campaign_activity", activity_id)
    return {"success": True, "deletedId": activity_id}


# ---------- Photo upload ----------
@router.post("/{activity_id}/upload-image", dependencies=[Depends(require_staff)])
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


@router.delete("/{activity_id}/image", dependencies=[Depends(require_staff)])
def remove_activity_image(activity_id: int, imageUrl: str, db: Session = Depends(get_db)):
    a = db.query(models.CampaignActivity).filter(models.CampaignActivity.id == activity_id).first()
    if not a:
        raise HTTPException(404, "Activity not found")
    current = json.loads(a.image_urls) if a.image_urls else []
    current = [u for u in current if u != imageUrl]
    a.image_urls = json.dumps(current)
    labels = image_labels(a)
    if imageUrl in labels:
        labels.pop(imageUrl)
        a.image_labels = json.dumps(labels) if labels else None
    db.commit()
    return {"allImages": current}


# ---------- Per-campaign timeline summary ----------
@router.get("/campaign/{campaign_id}/timeline", dependencies=[Depends(require_staff)])
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


# ---------- Mobile combined create + photos (one shot) ----------
def _discover_assignment(db: Session, site_id: int, worker_name: Optional[str] = None):
    """Pick the campaign a field upload belongs to when the app didn't say.

    Only live campaigns (finalized / running) qualify, so proofs never attach to a
    finished or unapproved campaign. Among those, prefer the one this worker is
    assigned to, then one whose dates cover today (with a week's slack either side:
    installs happen before the start, takedowns after the end), then the latest start.
    """
    today = date.today()
    slack = timedelta(days=7)
    rows = (db.query(models.CampaignSiteAssignment, models.Campaign)
            .join(models.Campaign, models.Campaign.id == models.CampaignSiteAssignment.campaign_id)
            .filter(models.CampaignSiteAssignment.site_id == site_id,
                    models.Campaign.status.in_(LIVE_CAMPAIGN_STATUSES))
            .all())
    if not rows:
        return None
    worker = (worker_name or "").strip().lower()

    def score(row):
        a, c = row
        start = a.final_start_date or a.booked_from or c.start_date
        end = a.final_end_date or a.booked_till or c.end_date
        in_window = (start is None or start - slack <= today) and (end is None or today <= end + slack)
        mine = bool(worker) and (a.monitor_worker_name or "").strip().lower() == worker
        return (mine, in_window, start or date.min)

    return max(rows, key=score)[0]


def _find_visit(db: Session, visit_id: Optional[str]):
    if not visit_id:
        return None
    return db.query(models.CampaignActivity).filter(models.CampaignActivity.client_visit_id == visit_id).first()


@router.post("/mobile/log")
async def mobile_log_activity(
    siteId: int = Form(...),
    activityType: str = Form(...),
    campaignId: Optional[int] = Form(None),
    assignmentId: Optional[int] = Form(None),
    performedBy: Optional[str] = Form(None),
    activityDate: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    status: Optional[str] = Form("DONE"),        # accepted for old app builds; mobile proofs are always DONE
    capturedAt: Optional[str] = Form(None),      # ISO timestamp from the phone when the photos were taken
    gpsAccuracyM: Optional[float] = Form(None),
    clientVisitId: Optional[str] = Form(None),   # app-generated id; a repeat returns the existing visit
    labels: Optional[str] = Form(None),          # JSON list aligned with `files`, e.g. ["close-up","wide","landmark"]
    file: Optional[UploadFile] = File(None),     # single file (older app builds)
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """One-shot endpoint for the mobile app: record a site visit with its photos/video.

    Safe to retry: when the app sends clientVisitId, the same visit is never stored
    twice. campaignId is optional; if omitted the live campaign for the site is found
    automatically, or the visit is logged without a campaign.
    """
    if REQUIRE_FIELD_AUTH and not user:
        raise HTTPException(401, "Your login has expired. Please log in again to upload.")
    at = (activityType or "").upper()
    if at not in VALID_TYPES:
        raise HTTPException(400, f"Invalid activityType. Must be one of {sorted(VALID_TYPES)}")
    if not db.query(models.Site.id).filter(models.Site.id == siteId).first():
        raise HTTPException(404, f"Site #{siteId} not found")

    # The logged-in worker's name wins over whatever name the app typed in.
    token_worker = (user or {}).get("workerName") if (user or {}).get("role") == "FIELD" else None
    performed_by = token_worker or performedBy

    visit_id = (clientVisitId or "").strip()[:100] or None
    existing = _find_visit(db, visit_id)
    if existing:
        return activity_to_dict(existing, db)

    if campaignId is None:
        assignment = _discover_assignment(db, siteId, performed_by)
        if assignment:
            campaignId = assignment.campaign_id
            assignmentId = assignmentId or assignment.id

    # Upload media before creating the row, so a failed upload leaves no empty visit behind.
    uploads = ([file] if file is not None else []) + [f for f in (files or []) if f is not None]
    try:
        label_list = json.loads(labels) if labels else []
    except ValueError:
        label_list = []
    if not isinstance(label_list, list):
        label_list = []
    urls, label_map = [], {}
    for i, f in enumerate(uploads):
        url = await upload_to_r2(f, folder="campaign-activities")
        urls.append(url)
        label = label_list[i] if i < len(label_list) else None
        if isinstance(label, str) and label.strip():
            label_map[url] = label.strip()[:30]

    captured = parse_client_datetime(capturedAt)
    try:
        act_date = date.fromisoformat(activityDate) if activityDate else None
    except ValueError:
        act_date = None
    act_date = act_date or (captured.date() if captured else date.today())

    a = models.CampaignActivity(
        campaign_id=campaignId,
        site_id=siteId,
        assignment_id=assignmentId,
        activity_type=at,
        status="DONE",
        performed_by=performed_by,
        activity_date=act_date,
        notes=notes,
        image_urls=json.dumps(urls) if urls else None,
        image_labels=json.dumps(label_map) if label_map else None,
        latitude=latitude,
        longitude=longitude,
        gps_accuracy_m=gpsAccuracyM,
        captured_at=captured,
        client_visit_id=visit_id,
        source="mobile",
    )
    db.add(a)
    try:
        db.commit()
    except IntegrityError:
        # Another retry of this visit was saved a moment ago: return that one.
        db.rollback()
        existing = _find_visit(db, visit_id)
        if existing:
            return activity_to_dict(existing, db)
        raise
    db.refresh(a)

    log_activity(db, f"Mobile logged {at} ({len(urls)} file{'s' if len(urls) != 1 else ''})",
                 "campaign_activity", a.id, f"Campaign #{campaignId}, Site #{siteId}")
    return activity_to_dict(a, db)
