"""Campaign management routes."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
import models
from utils import log_activity
from proofs import (phase_of, distance_m, image_urls, image_labels, iso,
                    OFFSITE_LIMIT_M, captured_at as proof_captured_at)
from jwt_utils import get_current_user, require_roles
import photo_zip
import prooflock
import notifications

STAFF_ROLES = ("SUPER_ADMIN", "ADMIN", "EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER")
FINAL_STATUSES = ("FINALIZED", "RUNNING", "COMPLETE", "LIVE", "COMPLETED")

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


class CampaignCreate(BaseModel):
    name: str
    advertiserId: int
    createdByUserId: Optional[int] = None
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


class BulkAssignRequest(BaseModel):
    siteIds: List[int]
    bookedFrom: Optional[str] = None
    bookedTill: Optional[str] = None
    agreedCost: Optional[float] = 0.0


def auto_advance_status(c, db) -> bool:
    """Hybrid status workflow — forward-only auto transitions based on dates.
    FINALIZED -> RUNNING once the start date arrives.
    FINALIZED/RUNNING -> COMPLETE once the end date has passed.
    Never touches DRAFT, PLANNED, COMPLETE or CANCELLED, so a manual override
    set by an admin is always respected. Returns True if the status changed.
    """
    from datetime import date
    today = date.today()
    new_status = c.status
    if c.status == "FINALIZED" and c.start_date and today >= c.start_date:
        new_status = "RUNNING"
    if c.status in ("FINALIZED", "RUNNING") and c.end_date and today > c.end_date:
        new_status = "COMPLETE"
    if new_status != c.status:
        c.status = new_status
        if db is not None:
            db.commit()
        return True
    return False


def campaign_to_dict(c, site_count: int = None):
    return {
        "id": c.id, "name": c.name, "advertiserId": c.advertiser_id,
        "advertiserName": c.advertiser.company_name if c.advertiser else None,
        "createdByUserId": c.created_by_user_id,
        "internalOwner": c.internal_owner, "campaignType": c.campaign_type,
        "startDate": str(c.start_date) if c.start_date else None,
        "endDate": str(c.end_date) if c.end_date else None,
        "totalCost": c.total_cost, "status": c.status,
        "notes": c.notes, "billingRemarks": c.billing_remarks,
        "createdAt": str(c.created_at) if c.created_at else None,
        "siteCount": site_count if site_count is not None else (len(c.site_assignments) if c.site_assignments else 0),
    }


def assignment_to_dict(a, site):
    size_str = None
    if site:
        if site.width and site.length:
            size_str = f"{site.width}×{site.length} ft"
        elif site.size:
            size_str = site.size
    return {
        "assignmentId": a.id,
        "siteId": a.site_id,
        "siteName": site.name if site else None,
        "siteState": site.state if site else None,
        "siteCity": site.city if site else None,
        "siteType": site.type if site else None,
        "siteSize": size_str,
        "lightingType": site.lighting_type if site else None,
        "imageUrl": site.image_url if site else None,
        "potentialMonthly": float(site.potential_monthly or 0) if site else 0,
        "vendorName": site.owner.name if site and site.owner else None,
        "bookedFrom": str(a.booked_from) if a.booked_from else None,
        "bookedTill": str(a.booked_till) if a.booked_till else None,
        "finalStartDate": str(a.final_start_date) if a.final_start_date else None,
        "finalEndDate": str(a.final_end_date) if a.final_end_date else None,
        "agreedCost": float(a.agreed_cost or 0),
        "unitCost": float(a.unit_cost or 0),
        "printingType": a.printing_type,
        "printingCost": float(a.printing_cost or 0),
        "mountingCost": float(a.mounting_cost or 0),
        "otherCost": float(a.other_cost or 0),
        "executionRemarks": a.execution_remarks,
        "status": a.status,
        "notes": a.notes,
        "isShortlisted": bool(a.is_shortlisted),
        "pendingApproval": bool(getattr(a, "pending_approval", False)),
        "monitorWorkerName": a.monitor_worker_name,
        "monitorFieldPinId": a.monitor_field_pin_id,
    }


@router.get("")
def list_campaigns(status: Optional[str] = None, advertiserId: Optional[int] = None,
                   userId: Optional[int] = None, vendorId: Optional[int] = None,
                   db: Session = Depends(get_db)):
    q = db.query(models.Campaign).options(
        joinedload(models.Campaign.advertiser),
    )
    if status:
        q = q.filter(models.Campaign.status == status)
    if advertiserId:
        q = q.filter(models.Campaign.advertiser_id == advertiserId)
    if userId:
        from sqlalchemy import or_
        shared_ids = db.execute(
            text("SELECT campaign_id FROM campaign_shares WHERE user_id = :uid"), {"uid": userId}
        ).fetchall()
        shared_campaign_ids = [r[0] for r in shared_ids]
        if shared_campaign_ids:
            q = q.filter(or_(
                models.Campaign.created_by_user_id == userId,
                models.Campaign.id.in_(shared_campaign_ids)
            ))
        else:
            q = q.filter(models.Campaign.created_by_user_id == userId)
    elif vendorId:
        # Admin sees all campaigns — campaigns have no company_id field,
        # so we can't cleanly filter by company without risking excluding
        # admin-created or legacy campaigns. Employee access is controlled
        # via userId filter above.
        pass

    campaigns = q.order_by(models.Campaign.created_at.desc()).all()

    # Hybrid status workflow: auto-advance RUNNING/COMPLETE based on dates
    changed = False
    for c in campaigns:
        if auto_advance_status(c, None):
            changed = True
    if changed:
        db.commit()

    # Batch-count site assignments in a single query instead of loading all rows
    campaign_ids = [c.id for c in campaigns]
    site_count_map = {}
    if campaign_ids:
        rows = db.query(
            models.CampaignSiteAssignment.campaign_id,
            func.count(models.CampaignSiteAssignment.id).label("cnt")
        ).filter(models.CampaignSiteAssignment.campaign_id.in_(campaign_ids))\
         .group_by(models.CampaignSiteAssignment.campaign_id).all()
        site_count_map = {r[0]: r[1] for r in rows}

    return [{
        "id": c.id, "name": c.name, "advertiserId": c.advertiser_id,
        "advertiserName": c.advertiser.company_name if c.advertiser else None,
        "createdByUserId": c.created_by_user_id,
        "internalOwner": c.internal_owner, "campaignType": c.campaign_type,
        "startDate": str(c.start_date) if c.start_date else None,
        "endDate": str(c.end_date) if c.end_date else None,
        "totalCost": c.total_cost, "status": c.status,
        "notes": c.notes, "billingRemarks": c.billing_remarks,
        "createdAt": str(c.created_at) if c.created_at else None,
        "siteCount": site_count_map.get(c.id, 0),
    } for c in campaigns]


@router.get("/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Campaign).options(
        joinedload(models.Campaign.advertiser),
        joinedload(models.Campaign.site_assignments)
    ).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    auto_advance_status(c, db)  # hybrid workflow: forward-only date-based transition
    result = campaign_to_dict(c)
    # Load all sites + their owners in a single query instead of N+1 per site
    site_ids = [a.site_id for a in c.site_assignments]
    sites_by_id = {}
    if site_ids:
        site_rows = db.query(models.Site).options(
            joinedload(models.Site.owner)
        ).filter(models.Site.id.in_(site_ids)).all()
        sites_by_id = {s.id: s for s in site_rows}
    assignments = [assignment_to_dict(a, sites_by_id.get(a.site_id)) for a in c.site_assignments]
    result["assignments"] = assignments
    audits = db.query(models.SiteAudit).filter(
        models.SiteAudit.campaign_id == campaign_id
    ).all()
    result["audits"] = [{
        "id": au.id, "siteId": au.site_id, "auditType": au.audit_type,
        "scheduledDate": str(au.scheduled_date) if au.scheduled_date else None,
        "actualDate": str(au.actual_audit_date) if au.actual_audit_date else None,
        "status": au.status, "auditor": au.auditor, "notes": au.notes,
        "imageUrls": au.image_urls,
    } for au in audits]
    # Access links / sent status
    access_links = db.query(models.AdvertiserAccessLink).filter(
        models.AdvertiserAccessLink.campaign_id == campaign_id,
        models.AdvertiserAccessLink.is_revoked == False
    ).order_by(models.AdvertiserAccessLink.created_at.desc()).all()
    result["isSentToAdvertiser"] = len(access_links) > 0
    result["accessLinks"] = [{
        "id": al.id,
        "tokenPlain": al.token_plain,
        "expiresAt": str(al.expires_at),
        "usedCount": al.used_count,
        "createdAt": str(al.created_at),
    } for al in access_links]
    return result


def _monitor_activity_dict(a, photos=None):
    return {
        "id": a.id,
        "activityType": a.activity_type,
        "status": a.status,  # PENDING / DONE / VERIFIED / REJECTED
        "performedBy": a.performed_by,
        "notes": a.notes,
        "imageUrls": image_urls(a),
        "imageLabels": image_labels(a),
        "latitude": a.latitude,
        "longitude": a.longitude,
        "gpsAccuracyM": a.gps_accuracy_m,
        "source": a.source,
        "activityDate": str(a.activity_date) if a.activity_date else None,
        "capturedAt": iso(proof_captured_at(a)),
        "createdAt": str(a.created_at) if a.created_at else None,
        "reviewNote": a.review_note,
        "reviewedBy": a.reviewed_by,
        "reviewedAt": iso(a.reviewed_at),
        # ProofLock: who captured it and what the automatic checks found, per photo
        "verificationTier": a.verification_tier,
        "prooflockStatus": a.prooflock_status,
        "photoChecks": prooflock.photo_checks_dict(photos),
    }


@router.get("/{campaign_id}/photos.zip")
def campaign_photos_zip(campaign_id: int, db: Session = Depends(get_db),
                        current_user: dict = Depends(get_current_user)):
    """Every accepted proof photo/video for the campaign's finalized sites, as a zip."""
    require_roles(current_user, *STAFF_ROLES)
    c = db.query(models.Campaign).options(joinedload(models.Campaign.site_assignments)).filter(
        models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    assignments = photo_zip.select_assignments(list(c.site_assignments), include_pending=True)
    return photo_zip.build_zip_response(db, c, assignments)


@router.get("/{campaign_id}/monitoring")
def campaign_monitoring(campaign_id: int, db: Session = Depends(get_db)):
    """Execution/monitoring board: every site booked on the campaign, finalized or not,
    with its Start / Mid / End photos, booking dates, the assigned field worker, and the
    available field PINs for the assignment dropdown.

    `stage` says where the site is in the advertiser's approval; `inReport` marks the sites
    the Proof of Display report and the photo zip include (the advertiser's selection).
    """
    c = db.query(models.Campaign).options(
        joinedload(models.Campaign.advertiser),
        joinedload(models.Campaign.site_assignments),
    ).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    auto_advance_status(c, db)

    assigns = list(c.site_assignments)
    campaign_final = (c.status or "").upper() in FINAL_STATUSES
    any_selection = any(a.is_shortlisted or a.pending_approval for a in assigns)
    in_report = {a.id for a in photo_zip.select_assignments(assigns, include_pending=False)}

    def stage_of(a):
        if a.pending_approval:
            return "AWAITING_APPROVAL"          # added after finalizing; the advertiser hasn't approved it yet
        if a.is_shortlisted:
            return "FINALIZED" if campaign_final else "SHORTLISTED"
        if campaign_final:
            return "NOT_SELECTED" if any_selection else "FINALIZED"   # older campaigns had no shortlist
        return "BOOKED"                          # booked, waiting for the advertiser to finalize
    stage_order = {"FINALIZED": 0, "SHORTLISTED": 1, "AWAITING_APPROVAL": 2, "BOOKED": 3, "NOT_SELECTED": 4}
    ordered = sorted(assigns, key=lambda a: (stage_order[stage_of(a)], a.id))

    site_ids = [a.site_id for a in ordered]
    sites_by_id = {}
    if site_ids:
        for s in db.query(models.Site).options(joinedload(models.Site.owner)).filter(
            models.Site.id.in_(site_ids)
        ).all():
            sites_by_id[s.id] = s

    # All activities for this campaign, grouped by site
    acts = db.query(models.CampaignActivity).filter(
        models.CampaignActivity.campaign_id == campaign_id
    ).order_by(models.CampaignActivity.created_at.asc()).all()
    acts_by_site = {}
    for a in acts:
        acts_by_site.setdefault(a.site_id, []).append(a)
    photos_by_act = prooflock.photos_by_activity(db, [a.id for a in acts])

    sites_out = []
    for a in ordered:
        site = sites_by_id.get(a.site_id)
        size_str = None
        if site:
            if site.width and site.length:
                size_str = f"{site.width}×{site.length} ft"
            elif site.size:
                size_str = site.size
        phases = {"START": [], "MID": [], "END": []}
        for act in acts_by_site.get(a.site_id, []):
            d = _monitor_activity_dict(act, photos_by_act.get(act.id))
            dist = distance_m(site.latitude, site.longitude, act.latitude, act.longitude) if site else None
            d["distanceM"] = round(dist) if dist is not None else None
            d["offSite"] = dist is not None and dist > OFFSITE_LIMIT_M
            phases[phase_of(act.activity_type)].append(d)
        sites_out.append({
            "assignmentId": a.id,
            "siteId": a.site_id,
            "siteName": site.name if site else None,
            "siteCity": site.city if site else None,
            "siteState": site.state if site else None,
            "siteType": site.type if site else None,
            "siteSize": size_str,
            "latitude": site.latitude if site else None,
            "longitude": site.longitude if site else None,
            "imageUrl": site.image_url if site else None,
            "potentialMonthly": float(site.potential_monthly or 0) if site else 0,
            "agreedCost": float(a.agreed_cost or 0),
            "printingCost": float(a.printing_cost or 0),
            "mountingCost": float(a.mounting_cost or 0),
            "otherCost": float(a.other_cost or 0),
            "monitorWorkerName": a.monitor_worker_name,
            "monitorFieldPinId": a.monitor_field_pin_id,
            "pendingApproval": bool(getattr(a, "pending_approval", False)),
            "stage": stage_of(a),
            "inReport": a.id in in_report,
            "bookedFrom": str(a.booked_from) if a.booked_from else None,
            "bookedTill": str(a.booked_till) if a.booked_till else None,
            "finalStartDate": str(a.final_start_date) if a.final_start_date else None,
            "finalEndDate": str(a.final_end_date) if a.final_end_date else None,
            "phases": phases,
        })

    # Available field workers (active, unexpired PINs) for the assignment dropdown
    now = __import__("datetime").datetime.utcnow()
    pins = db.query(models.FieldPin).filter(
        models.FieldPin.is_active == True,
        models.FieldPin.expires_at > now,
    ).order_by(models.FieldPin.created_at.desc()).all()
    workers = [{
        "pinId": p.id,
        "workerName": p.worker_name or "Field Worker",
        "pin": p.pin,
        "expiresAt": p.expires_at.isoformat() + "Z" if p.expires_at else None,
        "kind": p.kind or "CREW",
    } for p in pins]

    return {
        "campaign": {
            "id": c.id, "name": c.name, "status": c.status,
            "advertiserName": c.advertiser.company_name if c.advertiser else None,
            "startDate": str(c.start_date) if c.start_date else None,
            "endDate": str(c.end_date) if c.end_date else None,
        },
        "sites": sites_out,
        "workers": workers,
    }


@router.post("")
def create_campaign(req: CampaignCreate, db: Session = Depends(get_db)):
    from datetime import date
    adv = db.query(models.Advertiser).filter(models.Advertiser.id == req.advertiserId).first()
    if not adv:
        raise HTTPException(404, "Advertiser not found")
    c = models.Campaign(
        name=req.name, advertiser_id=req.advertiserId,
        created_by_user_id=req.createdByUserId,
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


@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Delete campaign and all linked records using raw SQL to avoid ORM session conflicts."""
    row = db.execute(
        text("SELECT id, name FROM campaigns WHERE id = :cid"), {"cid": campaign_id}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Campaign not found")
    campaign_name = row.name

    site_count = db.execute(
        text("SELECT COUNT(*) FROM campaign_site_assignments WHERE campaign_id = :cid"),
        {"cid": campaign_id}
    ).scalar()

    # Reset availability for sites that had this campaign as current
    db.execute(text("""
        UPDATE sites
        SET availability_status = 'AVAILABLE',
            current_campaign_id  = NULL,
            occupied_from        = NULL,
            occupied_till        = NULL
        WHERE current_campaign_id = :cid
    """), {"cid": campaign_id})

    # Nullify FK on access links (keep the link records themselves)
    db.execute(
        text("UPDATE advertiser_access_links SET campaign_id = NULL WHERE campaign_id = :cid"),
        {"cid": campaign_id}
    )

    # Delete child records in dependency order (proof rows point at the visits)
    visits = "SELECT id FROM campaign_activities WHERE campaign_id = :cid"
    db.execute(text(f"DELETE FROM proof_photo  WHERE activity_id IN ({visits})"), {"cid": campaign_id})
    db.execute(text(f"DELETE FROM proof_review WHERE activity_id IN ({visits})"), {"cid": campaign_id})
    db.execute(text("DELETE FROM campaign_activities       WHERE campaign_id = :cid"), {"cid": campaign_id})
    db.execute(text("DELETE FROM campaign_site_assignments WHERE campaign_id = :cid"), {"cid": campaign_id})
    db.execute(text("DELETE FROM site_audits              WHERE campaign_id = :cid"), {"cid": campaign_id})
    # campaign_shares has ON DELETE CASCADE — handled automatically by Postgres

    db.execute(text("DELETE FROM campaigns WHERE id = :cid"), {"cid": campaign_id})
    db.commit()

    log_activity(db, f"Deleted campaign '{campaign_name}'", "campaign", campaign_id,
                 f"{site_count} sites unlinked")
    return {"message": f"Campaign '{campaign_name}' deleted", "unlinkedSites": site_count}


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
    if bk_from and bk_till:
        overlap = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.site_id == req.siteId,
            models.CampaignSiteAssignment.status.in_(["PLANNED", "ACTIVE"]),
            models.CampaignSiteAssignment.booked_from <= bk_till,
            models.CampaignSiteAssignment.booked_till >= bk_from,
        ).first()
        if overlap:
            raise HTTPException(409,
                f"Site already booked for overlapping dates (campaign #{overlap.campaign_id})")
    # Sites added to an already-finalized/running campaign need advertiser re-approval
    needs_approval = (c.status or "").upper() in ("FINALIZED", "RUNNING", "COMPLETE", "LIVE", "COMPLETED")
    assignment = models.CampaignSiteAssignment(
        campaign_id=campaign_id, site_id=req.siteId,
        booked_from=bk_from, booked_till=bk_till,
        agreed_cost=req.agreedCost or 0.0, unit_cost=req.unitCost or 0.0,
        notes=req.notes, status="PLANNED",
        pending_approval=needs_approval,
    )
    db.add(assignment)
    if bk_from and bk_till:
        site.availability_status = "BOOKED"
        site.current_campaign_id = campaign_id
        site.occupied_from = bk_from
        site.occupied_till = bk_till
    db.commit()
    log_activity(db, "Assigned site to campaign", "campaign", campaign_id, f"Site #{req.siteId}")
    return {"message": "Site assigned", "assignmentId": assignment.id}


@router.post("/{campaign_id}/assign-sites-bulk")
def assign_sites_bulk(campaign_id: int, req: BulkAssignRequest, db: Session = Depends(get_db)):
    """Bulk-assign multiple sites. Silently skips already-linked or non-existent sites."""
    c = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    from datetime import date
    bk_from = date.fromisoformat(req.bookedFrom) if req.bookedFrom else None
    bk_till = date.fromisoformat(req.bookedTill) if req.bookedTill else None
    # Sites added to an already-finalized/running campaign need advertiser re-approval
    needs_approval = (c.status or "").upper() in ("FINALIZED", "RUNNING", "COMPLETE", "LIVE", "COMPLETED")
    added = 0
    skipped = 0
    for site_id in req.siteIds:
        existing = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.campaign_id == campaign_id,
            models.CampaignSiteAssignment.site_id == site_id,
        ).first()
        if existing:
            skipped += 1
            continue
        site = db.query(models.Site).filter(models.Site.id == site_id).first()
        if not site:
            skipped += 1
            continue
        db.add(models.CampaignSiteAssignment(
            campaign_id=campaign_id, site_id=site_id,
            booked_from=bk_from, booked_till=bk_till,
            agreed_cost=req.agreedCost or 0.0, status="PLANNED",
            pending_approval=needs_approval,
        ))
        added += 1
    db.commit()
    log_activity(db, f"Bulk assigned {added} sites to campaign", "campaign", campaign_id)
    return {"message": f"Added {added} sites, skipped {skipped} duplicates",
            "added": added, "skipped": skipped, "needsApproval": needs_approval}


class UpdateAssignmentRequest(BaseModel):
    agreedCost: Optional[float] = None
    printingType: Optional[str] = None
    printingCost: Optional[float] = None
    mountingCost: Optional[float] = None
    otherCost: Optional[float] = None
    executionRemarks: Optional[str] = None
    monitorWorkerName: Optional[str] = None
    monitorFieldPinId: Optional[int] = None
    bookedFrom: Optional[str] = None   # ISO date; "" or null clears it (the site then follows the campaign dates)
    bookedTill: Optional[str] = None


def _parse_day(value, what):
    from datetime import date
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise HTTPException(400, f"{what} is not a valid date")


def _set_booking_dates(db, a, sent, req):
    """Change one site's booking dates, refusing dates that overlap another campaign's booking."""
    bk_from = _parse_day(req.bookedFrom, "Booked from") if "bookedFrom" in sent else a.booked_from
    bk_till = _parse_day(req.bookedTill, "Booked till") if "bookedTill" in sent else a.booked_till
    if bk_from and bk_till and bk_from > bk_till:
        raise HTTPException(400, "The booking can't end before it starts")
    if bk_from and bk_till:
        clash = (db.query(models.CampaignSiteAssignment, models.Campaign)
                 .join(models.Campaign, models.Campaign.id == models.CampaignSiteAssignment.campaign_id)
                 .filter(models.CampaignSiteAssignment.site_id == a.site_id,
                         models.CampaignSiteAssignment.id != a.id,
                         models.CampaignSiteAssignment.campaign_id != a.campaign_id,
                         models.CampaignSiteAssignment.status.in_(["PLANNED", "ACTIVE"]),
                         func.upper(func.coalesce(models.Campaign.status, "")) != "CANCELLED",
                         models.CampaignSiteAssignment.booked_from <= bk_till,
                         models.CampaignSiteAssignment.booked_till >= bk_from)
                 .first())
        if clash:
            other, camp = clash
            day = lambda d: f"{d.day} {d:%b %Y}"
            raise HTTPException(409, f"This site is already booked {day(other.booked_from)} to {day(other.booked_till)} "
                                     f"for campaign \"{camp.name}\". Pick dates that don't overlap.")
    a.booked_from, a.booked_till = bk_from, bk_till
    site = db.query(models.Site).filter(models.Site.id == a.site_id).first()
    if not site:
        return
    if bk_from and bk_till:
        site.availability_status = "BOOKED"
        site.current_campaign_id = a.campaign_id
        site.occupied_from, site.occupied_till = bk_from, bk_till
    elif site.current_campaign_id == a.campaign_id:
        site.availability_status = "AVAILABLE"
        site.current_campaign_id = None
        site.occupied_from = site.occupied_till = None


@router.put("/{campaign_id}/assignment/{assignment_id}")
def update_assignment(campaign_id: int, assignment_id: int, req: UpdateAssignmentRequest,
                      background: BackgroundTasks, db: Session = Depends(get_db)):
    """Update one site's booking: costs, booking dates, and who monitors it."""
    a = db.query(models.CampaignSiteAssignment).filter(
        models.CampaignSiteAssignment.id == assignment_id,
        models.CampaignSiteAssignment.campaign_id == campaign_id,
    ).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    if req.agreedCost is not None: a.agreed_cost = req.agreedCost
    if req.printingType is not None: a.printing_type = req.printingType
    if req.printingCost is not None: a.printing_cost = req.printingCost
    if req.mountingCost is not None: a.mounting_cost = req.mountingCost
    if req.otherCost is not None: a.other_cost = req.otherCost
    if req.executionRemarks is not None: a.execution_remarks = req.executionRemarks
    sent = getattr(req, "model_fields_set", None) or getattr(req, "__fields_set__", set())
    if "bookedFrom" in sent or "bookedTill" in sent:
        _set_booking_dates(db, a, sent, req)
    newly_assigned = None
    if req.monitorWorkerName is not None:
        previous = (a.monitor_worker_name or "").strip().lower()
        a.monitor_worker_name = req.monitorWorkerName.strip() or None
        a.monitor_field_pin_id = req.monitorFieldPinId
        if a.monitor_worker_name and a.monitor_worker_name.lower() != previous:
            newly_assigned = a.monitor_worker_name
    db.commit()
    if newly_assigned:
        site = db.query(models.Site).filter(models.Site.id == a.site_id).first()
        camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        background.add_task(
            notifications.notify_worker, newly_assigned, "assigned",
            {"siteId": a.site_id, "campaignId": campaign_id, "assignmentId": a.id},
            site=site.name if site else f"Site #{a.site_id}", campaign=camp.name if camp else "")
    return {"message": "Updated"}


class ShareRequest(BaseModel):
    userIds: List[int]
    sharedByEmail: Optional[str] = None

@router.post("/{campaign_id}/share")
def share_campaign(campaign_id: int, req: ShareRequest, db: Session = Depends(get_db)):
    """Admin shares a campaign with one or more employees."""
    c = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    added = 0
    for uid in req.userIds:
        exists = db.execute(
            text("SELECT 1 FROM campaign_shares WHERE campaign_id=:cid AND user_id=:uid"),
            {"cid": campaign_id, "uid": uid}
        ).first()
        if not exists:
            db.execute(
                text("INSERT INTO campaign_shares (campaign_id, user_id, shared_by_email) VALUES (:cid, :uid, :email)"),
                {"cid": campaign_id, "uid": uid, "email": req.sharedByEmail}
            )
            added += 1
    db.commit()
    log_activity(db, f"Shared campaign with {added} employees", "campaign", campaign_id)
    return {"message": f"Shared with {added} employee(s)"}

@router.delete("/{campaign_id}/share/{user_id}")
def unshare_campaign(campaign_id: int, user_id: int, db: Session = Depends(get_db)):
    """Remove an employee's access to a shared campaign."""
    db.execute(
        text("DELETE FROM campaign_shares WHERE campaign_id=:cid AND user_id=:uid"),
        {"cid": campaign_id, "uid": user_id}
    )
    db.commit()
    log_activity(db, "Removed campaign share", "campaign", campaign_id, f"user #{user_id}")
    return {"message": "Access removed"}

@router.get("/{campaign_id}/shares")
def get_campaign_shares(campaign_id: int, db: Session = Depends(get_db)):
    """Return list of employees this campaign is shared with."""
    rows = db.execute(
        text("""
            SELECT u.id, u.display_name, u.email, cs.created_at
            FROM campaign_shares cs
            JOIN user_accounts u ON u.id = cs.user_id
            WHERE cs.campaign_id = :cid
        """),
        {"cid": campaign_id}
    ).fetchall()
    return [{"userId": r[0], "displayName": r[1], "email": r[2], "sharedAt": str(r[3])} for r in rows]


@router.delete("/{campaign_id}/remove-site/{assignment_id}")
def remove_site(campaign_id: int, assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.CampaignSiteAssignment).filter(
        models.CampaignSiteAssignment.id == assignment_id,
        models.CampaignSiteAssignment.campaign_id == campaign_id,
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
