"""Advertiser management routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
import datetime
import hashlib
import json as _json
from utils import log_activity, generate_access_token
from jwt_utils import get_current_user, require_roles

router = APIRouter(prefix="/api/advertisers", tags=["Advertisers"])


class AdvertiserCreate(BaseModel):
    companyName: str
    contactPerson: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    billingAddress: Optional[str] = None
    gstNumber: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "ACTIVE"


class AdvertiserLoginCreate(BaseModel):
    advertiserId: int
    email: str
    password: str
    displayName: Optional[str] = None


class SendAccessLinkRequest(BaseModel):
    advertiserId: int
    campaignId: Optional[int] = None
    expiryDays: Optional[int] = 7


def adv_to_dict(a):
    return {
        "id": a.id, "companyName": a.company_name, "contactPerson": a.contact_person,
        "email": a.email, "phone": a.phone, "billingAddress": a.billing_address,
        "gstNumber": a.gst_number, "notes": a.notes, "status": a.status,
        "createdAt": str(a.created_at) if a.created_at else None,
    }


@router.get("")
def list_advertisers(db: Session = Depends(get_db)):
    advs = db.query(models.Advertiser).order_by(models.Advertiser.company_name).all()
    login_ids = {
        row[0] for row in db.query(models.UserAccount.advertiser_id)
        .filter(models.UserAccount.advertiser_id.isnot(None)).all()
    }
    result = []
    for a in advs:
        d = adv_to_dict(a)
        d["hasLogin"] = a.id in login_ids
        result.append(d)
    return result


# Must be before /{adv_id} to avoid FastAPI routing "me" as an int parameter
@router.get("/me/dashboard")
def advertiser_dashboard(current_user: dict = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    """Full campaign dashboard for a logged-in advertiser."""
    require_roles(current_user, "ADVERTISER")
    advertiser_id = current_user.get("advertiserId")
    if not advertiser_id:
        raise HTTPException(404, "Advertiser profile not found")

    adv = db.query(models.Advertiser).filter(models.Advertiser.id == advertiser_id).first()
    campaigns = (db.query(models.Campaign)
                   .filter(models.Campaign.advertiser_id == advertiser_id)
                   .order_by(models.Campaign.created_at.desc())
                   .all())

    TYPE_LABEL = {
        "MOUNTING": "Install", "START": "Install",
        "AUDIT": "Monitor", "MAINTENANCE": "Monitor",
        "END": "End", "TAKEDOWN": "End",
        "PRINT": "Print", "REPRINT": "Print",
    }

    campaign_data = []
    for c in campaigns:
        assignments = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.campaign_id == c.id).all()

        sites = []
        for a in assignments:
            site = db.query(models.Site).filter(models.Site.id == a.site_id).first()
            activities = (db.query(models.CampaignActivity)
                            .filter(models.CampaignActivity.site_id == a.site_id,
                                    models.CampaignActivity.image_urls.isnot(None))
                            .order_by(models.CampaignActivity.created_at.desc())
                            .limit(20).all())
            proofs = []
            for act in activities:
                try:
                    urls = _json.loads(act.image_urls) if act.image_urls else []
                except Exception:
                    urls = []
                for url in urls:
                    proofs.append({
                        "url": url,
                        "type": TYPE_LABEL.get(act.activity_type, act.activity_type),
                        "date": str(act.activity_date) if act.activity_date else str(act.created_at)[:10],
                        "notes": act.notes,
                        "lat": act.latitude,
                        "lng": act.longitude,
                    })

            sites.append({
                "siteId": a.site_id,
                "name": site.name if site else "Unknown",
                "city": site.city if site else "",
                "state": site.state if site else "",
                "size": site.size if site else "",
                "type": site.type if site else "",
                "imageUrl": site.image_url if site else None,
                "latitude": site.latitude if site else None,
                "longitude": site.longitude if site else None,
                "bookedFrom": str(a.booked_from) if a.booked_from else None,
                "bookedTill": str(a.booked_till) if a.booked_till else None,
                "agreedCost": float(a.agreed_cost) if a.agreed_cost else 0,
                "proofs": proofs,
            })

        start = c.start_date
        end = c.end_date
        today = datetime.date.today()
        if start and end:
            total_days = (end - start).days or 1
            elapsed = max(0, (today - start).days)
            progress = min(100, round(elapsed / total_days * 100))
        else:
            progress = 0

        campaign_data.append({
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "startDate": str(start) if start else None,
            "endDate": str(end) if end else None,
            "totalCost": float(c.total_cost) if c.total_cost else 0,
            "progress": progress,
            "sites": sites,
            "siteCount": len(sites),
            "proofCount": sum(len(s["proofs"]) for s in sites),
        })

    total_spend = sum(c["totalCost"] for c in campaign_data)
    live_count = sum(1 for c in campaign_data if c["status"] == "LIVE")
    total_sites = sum(c["siteCount"] for c in campaign_data)
    total_proofs = sum(c["proofCount"] for c in campaign_data)

    return {
        "advertiser": adv_to_dict(adv) if adv else {},
        "campaigns": campaign_data,
        "summary": {
            "totalCampaigns": len(campaign_data),
            "liveCampaigns": live_count,
            "totalSites": total_sites,
            "totalSpend": total_spend,
            "totalProofs": total_proofs,
        },
    }


@router.get("/{adv_id}")
def get_advertiser(adv_id: int, db: Session = Depends(get_db)):
    a = db.query(models.Advertiser).filter(models.Advertiser.id == adv_id).first()
    if not a:
        raise HTTPException(404, "Advertiser not found")
    return adv_to_dict(a)


@router.post("")
def create_advertiser(req: AdvertiserCreate, db: Session = Depends(get_db)):
    a = models.Advertiser(
        company_name=req.companyName, contact_person=req.contactPerson,
        email=req.email, phone=req.phone, billing_address=req.billingAddress,
        gst_number=req.gstNumber, notes=req.notes, status=req.status or "ACTIVE"
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    log_activity(db, "Created advertiser", "advertiser", a.id, a.company_name)
    return adv_to_dict(a)


@router.put("/{adv_id}")
def update_advertiser(adv_id: int, req: AdvertiserCreate, db: Session = Depends(get_db)):
    a = db.query(models.Advertiser).filter(models.Advertiser.id == adv_id).first()
    if not a:
        raise HTTPException(404, "Advertiser not found")
    a.company_name = req.companyName
    a.contact_person = req.contactPerson
    a.email = req.email
    a.phone = req.phone
    a.billing_address = req.billingAddress
    a.gst_number = req.gstNumber
    a.notes = req.notes
    a.status = req.status or a.status
    db.commit()
    db.refresh(a)
    log_activity(db, "Updated advertiser", "advertiser", a.id, a.company_name)
    return adv_to_dict(a)


@router.delete("/{adv_id}")
def delete_advertiser(adv_id: int, db: Session = Depends(get_db)):
    a = db.query(models.Advertiser).filter(models.Advertiser.id == adv_id).first()
    if not a:
        raise HTTPException(404, "Advertiser not found")
    name = a.company_name
    db.delete(a)
    db.commit()
    log_activity(db, f"Deleted advertiser '{name}'", "advertiser", adv_id)
    return {"message": f"Advertiser '{name}' deleted"}


@router.post("/create-login")
def create_advertiser_login(req: AdvertiserLoginCreate, db: Session = Depends(get_db)):
    """Create a login account for an advertiser."""
    from main import hash_password
    existing = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(req.email.strip())).first()
    if existing:
        raise HTTPException(409, "Email already registered")
    adv = db.query(models.Advertiser).filter(models.Advertiser.id == req.advertiserId).first()
    if not adv:
        raise HTTPException(404, "Advertiser not found")
    user = models.UserAccount(
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        role="ADVERTISER",
        advertiser_id=req.advertiserId,
        display_name=req.displayName or adv.company_name,
        is_active=True
    )
    db.add(user)
    db.commit()
    log_activity(db, "Created advertiser login", "advertiser", adv.id, req.email)
    return {"message": "Advertiser login created", "email": req.email}


@router.post("/send-access-link")
def send_access_link(req: SendAccessLinkRequest, db: Session = Depends(get_db)):
    """Generate a secure access link for an advertiser."""
    adv = db.query(models.Advertiser).filter(models.Advertiser.id == req.advertiserId).first()
    if not adv:
        raise HTTPException(404, "Advertiser not found")
    token, token_hash = generate_access_token()
    link = models.AdvertiserAccessLink(
        advertiser_id=req.advertiserId,
        campaign_id=req.campaignId,
        token_hash=token_hash,
        # token_plain intentionally omitted — never store plaintext tokens in DB
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=req.expiryDays or 7),
    )
    db.add(link)
    db.commit()
    access_url = f"/access/{token}"
    log_activity(db, "Sent access link", "advertiser", adv.id, f"Token expires in {req.expiryDays}d")
    return {"message": "Access link generated", "accessUrl": access_url, "token": token, "expiresAt": str(link.expires_at)}


@router.post("/validate-token")
def validate_access_token(token: str, db: Session = Depends(get_db)):
    """Validate an advertiser access token and return campaign data."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    link = db.query(models.AdvertiserAccessLink).filter(
        models.AdvertiserAccessLink.token_hash == token_hash,
        models.AdvertiserAccessLink.is_revoked == False
    ).first()
    if not link:
        raise HTTPException(403, "Invalid or expired access link")
    if link.expires_at < datetime.datetime.utcnow():
        raise HTTPException(403, "Access link has expired")
    link.used_count += 1
    db.commit()
    adv = db.query(models.Advertiser).filter(models.Advertiser.id == link.advertiser_id).first()
    campaigns = db.query(models.Campaign).filter(models.Campaign.advertiser_id == link.advertiser_id)
    if link.campaign_id:
        campaigns = campaigns.filter(models.Campaign.id == link.campaign_id)
    result = []
    for c in campaigns.all():
        assignments = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.campaign_id == c.id).all()
        result.append({
            "id": c.id, "name": c.name, "status": c.status,
            "startDate": str(c.start_date) if c.start_date else None,
            "endDate": str(c.end_date) if c.end_date else None,
            "totalCost": c.total_cost,
            "sites": [{"siteId": a.site_id, "bookedFrom": str(a.booked_from) if a.booked_from else None,
                        "bookedTill": str(a.booked_till) if a.booked_till else None,
                        "agreedCost": a.agreed_cost} for a in assignments]
        })
    return {"advertiser": adv_to_dict(adv), "campaigns": result}


@router.post("/revoke-link/{link_id}")
def revoke_access_link(link_id: int, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user)):
    link = db.query(models.AdvertiserAccessLink).filter(models.AdvertiserAccessLink.id == link_id).first()
    if not link:
        raise HTTPException(404, "Link not found")
    link.is_revoked = True
    db.commit()
    return {"message": "Access link revoked"}
