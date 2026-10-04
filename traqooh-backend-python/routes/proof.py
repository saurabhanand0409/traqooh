"""ProofLock endpoints for staff: the review queue and per-visit check results.
The whole router requires a staff login (included with require_staff in main.py)."""
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import jobs
import models
import prooflock
import proofs
from database import get_db
from proofs import image_labels, image_urls, iso

router = APIRouter(prefix="/api/proof", tags=["Proof checks"])

FLAGGED = ["REVIEW", "FAIL"]
DECIDED = ["VERIFIED", "REJECTED"]


def _visit_dict(a, photos, site=None):
    return {
        "activityId": a.id,
        "campaignId": a.campaign_id,
        "siteId": a.site_id,
        "siteName": site.name if site else None,
        "activityType": a.activity_type,
        "phase": proofs.phase_of(a.activity_type),
        "status": a.status,
        "performedBy": a.performed_by,
        "capturedAt": iso(proofs.captured_at(a)),
        "verificationTier": a.verification_tier,
        "prooflockStatus": a.prooflock_status,
        "imageUrls": image_urls(a),
        "imageLabels": image_labels(a),
        "photoChecks": prooflock.photo_checks_dict(photos),
    }


@router.get("/review-queue")
def review_queue(campaignId: Optional[int] = None, limit: int = 100, db: Session = Depends(get_db)):
    """Visits the machine checks flagged that nobody has verified or rejected yet, newest first."""
    q = db.query(models.CampaignActivity).filter(
        models.CampaignActivity.prooflock_status.in_(FLAGGED),
        models.CampaignActivity.status.notin_(DECIDED),
    )
    if campaignId:
        q = q.filter(models.CampaignActivity.campaign_id == campaignId)
    visits = q.order_by(models.CampaignActivity.created_at.desc()).limit(max(1, min(limit, 500))).all()
    photos = prooflock.photos_by_activity(db, [a.id for a in visits])
    site_ids = {a.site_id for a in visits}
    sites = {s.id: s for s in db.query(models.Site).filter(models.Site.id.in_(site_ids))} if site_ids else {}
    return [_visit_dict(a, photos.get(a.id), sites.get(a.site_id)) for a in visits]


@router.get("/activity/{activity_id}")
def visit_checks(activity_id: int, db: Session = Depends(get_db)):
    a = db.get(models.CampaignActivity, activity_id)
    if not a:
        raise HTTPException(404, "Visit not found")
    photos = prooflock.photos_by_activity(db, [a.id]).get(a.id)
    return _visit_dict(a, photos, db.get(models.Site, a.site_id))


@router.post("/activity/{activity_id}/recheck")
def recheck_visit(activity_id: int, db: Session = Depends(get_db)):
    """Run the checks again (e.g. after correcting the site's GPS or booking dates)."""
    a = db.get(models.CampaignActivity, activity_id)
    if not a:
        raise HTTPException(404, "Visit not found")
    photos = db.query(models.ProofPhoto).filter(models.ProofPhoto.activity_id == activity_id).all()
    stamp = int(datetime.datetime.utcnow().timestamp())
    for p in photos:
        p.status = prooflock.PENDING
        jobs.enqueue(db, "prooflock.check_photo", {"photo_id": p.id},
                     dedupe_key=f"prooflock-recheck:{p.id}:{stamp}", commit=False)
    if photos:
        a.prooflock_status = prooflock.PENDING
    db.commit()
    return {"queued": len(photos)}
