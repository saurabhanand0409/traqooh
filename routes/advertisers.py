"""Advertiser management routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
import models
import datetime
import hashlib
import json as _json
import os
import httpx
from utils import log_activity, generate_access_token
from jwt_utils import get_current_user, require_roles

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
OTP_FROM_EMAIL = os.environ.get("OTP_FROM_EMAIL", "noreply@brandsculpt.com")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://app.brandsculpt.com")


# Email copy per purpose: proposal (review & finalize), live (track execution photos),
# update (new sites added — review & approve)
_EMAIL_COPY = {
    "proposal": {
        "subject": "Your Campaign Proposal — {name}",
        "heading": "Your Campaign Proposal is Ready",
        "body": "Hello {name}, your campaign proposal has been shared with you. Click below to view your sites and cost sheet, shortlist what you want, and finalize.",
        "cta": "View Campaign Proposal",
    },
    "live": {
        "subject": "Your Campaign is Now Live — {name}",
        "heading": "Your Campaign is Now Live 🎉",
        "body": "Hello {name}, your campaign is now live. Use the link below to track on-ground execution — start, mid and end photos for every site, with GPS and timestamps as our team completes the work.",
        "cta": "Track Your Campaign",
    },
    "update": {
        "subject": "New Sites Added — Please Review — {name}",
        "heading": "New Sites Need Your Approval",
        "body": "Hello {name}, new sites have been added to your campaign. Please open the link below to review and approve them so we can begin execution.",
        "cta": "Review New Sites",
    },
}


def _send_access_link_email(to_email: str, advertiser_name: str, access_url: str,
                            expires_at: datetime.datetime, purpose: str = "proposal"):
    """Send access link email via Resend. Logs to console if RESEND_API_KEY not set."""
    full_url = f"{FRONTEND_URL}{access_url}" if access_url.startswith("/") else access_url
    expiry_str = expires_at.strftime("%d %B %Y")
    copy = _EMAIL_COPY.get(purpose, _EMAIL_COPY["proposal"])
    subject = copy["subject"].format(name=advertiser_name)
    heading = copy["heading"]
    body = copy["body"].format(name=advertiser_name)
    cta = copy["cta"]
    if not RESEND_API_KEY:
        print(f"[ACCESS LINK] No RESEND_API_KEY. ({purpose}) Link for {to_email}: {full_url}")
        return
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#070C1A;color:#fff;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#2563EB,#DC143C);padding:32px 32px 24px;">
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;">traqOOH</div>
        <div style="font-size:14px;opacity:0.8;margin-top:4px;">by BrandSculpt</div>
      </div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;">{heading}</h2>
        <p style="color:#9CA3AF;margin:0 0 24px;">{body}</p>
        <a href="{full_url}" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#DC143C);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;">{cta}</a>
        <p style="color:#6B7280;font-size:12px;margin-top:24px;">This link expires on <strong style="color:#9CA3AF;">{expiry_str}</strong>. If you didn't expect this email, you can safely ignore it.</p>
        <p style="color:#6B7280;font-size:12px;margin-top:4px;">Or copy this link: <span style="color:#60A5FA;word-break:break-all;">{full_url}</span></p>
      </div>
    </div>
    """
    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": OTP_FROM_EMAIL, "to": [to_email], "subject": subject, "html": html},
            timeout=10,
        )
    except Exception as e:
        print(f"[ACCESS LINK] Email send failed: {e}")

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
    createdByUserId: Optional[int] = None
    vendorCompanyId: Optional[int] = None


class AdvertiserShareRequest(BaseModel):
    userIds: List[int]
    sharedByEmail: Optional[str] = None


class AdvertiserLoginCreate(BaseModel):
    advertiserId: int
    email: str
    password: str
    displayName: Optional[str] = None


class SendAccessLinkRequest(BaseModel):
    advertiserId: int
    campaignId: Optional[int] = None
    expiryDays: Optional[int] = 7
    purpose: Optional[str] = "proposal"  # proposal | live | update


def adv_to_dict(a):
    return {
        "id": a.id, "companyName": a.company_name, "contactPerson": a.contact_person,
        "email": a.email, "phone": a.phone, "billingAddress": a.billing_address,
        "gstNumber": a.gst_number, "notes": a.notes, "status": a.status,
        "createdAt": str(a.created_at) if a.created_at else None,
    }


@router.get("")
def list_advertisers(
    role: Optional[str] = None,
    userId: Optional[int] = None,
    vendorId: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Advertiser).order_by(models.Advertiser.company_name)
    r = (role or "").upper()

    if r == "EMPLOYEE" and userId:
        # Employee sees only advertisers they created + ones explicitly shared with them
        shared_rows = db.execute(
            text("SELECT advertiser_id FROM advertiser_shares WHERE user_id = :uid"), {"uid": userId}
        ).fetchall()
        shared_ids = [row[0] for row in shared_rows]
        if shared_ids:
            q = q.filter(or_(
                models.Advertiser.created_by_user_id == userId,
                models.Advertiser.id.in_(shared_ids)
            ))
        else:
            q = q.filter(models.Advertiser.created_by_user_id == userId)
    elif r == "ADMIN":
        pass  # Admin sees all advertisers (company scoping via link table is future work)
    # SUPER_ADMIN (no params): sees all advertisers

    advs = q.all()
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
        gst_number=req.gstNumber, notes=req.notes, status=req.status or "ACTIVE",
        created_by_user_id=req.createdByUserId,
        vendor_company_id=req.vendorCompanyId,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    # Link advertiser to the creator's company so admin can see it
    if req.vendorCompanyId:
        db.execute(
            text("INSERT INTO advertiser_company_links (advertiser_id, company_id) VALUES (:aid, :cid) ON CONFLICT DO NOTHING"),
            {"aid": a.id, "cid": req.vendorCompanyId}
        )
        db.commit()
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
    purpose = (req.purpose or "proposal").lower()
    log_activity(db, f"Sent access link ({purpose})", "advertiser", adv.id, f"Token expires in {req.expiryDays}d")
    # Email the link if advertiser has an email on file
    emailed = False
    if adv.email:
        _send_access_link_email(adv.email, adv.company_name, access_url, link.expires_at, purpose)
        emailed = True
    return {"message": "Access link generated", "accessUrl": access_url, "token": token,
            "expiresAt": str(link.expires_at), "emailed": emailed, "advertiserEmail": adv.email}


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


class CompanyLinkRequest(BaseModel):
    companyId: int

@router.get("/{adv_id}/company-links")
def get_company_links(adv_id: int, db: Session = Depends(get_db)):
    """List all companies this advertiser is linked to."""
    rows = db.execute(
        text("""
            SELECT c.id, c.name, acl.created_at
            FROM advertiser_company_links acl
            JOIN companies c ON c.id = acl.company_id
            WHERE acl.advertiser_id = :aid
            ORDER BY c.name
        """),
        {"aid": adv_id}
    ).fetchall()
    return [{"companyId": r[0], "companyName": r[1], "linkedAt": str(r[2])} for r in rows]

@router.post("/{adv_id}/link-company")
def link_company(adv_id: int, req: CompanyLinkRequest, db: Session = Depends(get_db)):
    """Link an advertiser to an additional company (so that company's admin can see it)."""
    a = db.query(models.Advertiser).filter(models.Advertiser.id == adv_id).first()
    if not a:
        raise HTTPException(404, "Advertiser not found")
    db.execute(
        text("INSERT INTO advertiser_company_links (advertiser_id, company_id) VALUES (:aid, :cid) ON CONFLICT DO NOTHING"),
        {"aid": adv_id, "cid": req.companyId}
    )
    db.commit()
    log_activity(db, "Linked advertiser to company", "advertiser", adv_id, f"company #{req.companyId}")
    return {"message": "Advertiser linked to company"}

@router.delete("/{adv_id}/link-company/{company_id}")
def unlink_company(adv_id: int, company_id: int, db: Session = Depends(get_db)):
    """Remove a company link from an advertiser."""
    db.execute(
        text("DELETE FROM advertiser_company_links WHERE advertiser_id=:aid AND company_id=:cid"),
        {"aid": adv_id, "cid": company_id}
    )
    db.commit()
    log_activity(db, "Unlinked advertiser from company", "advertiser", adv_id, f"company #{company_id}")
    return {"message": "Company link removed"}

@router.post("/{adv_id}/share")
def share_advertiser(adv_id: int, req: AdvertiserShareRequest, db: Session = Depends(get_db)):
    """Admin shares an advertiser with one or more employees."""
    a = db.query(models.Advertiser).filter(models.Advertiser.id == adv_id).first()
    if not a:
        raise HTTPException(404, "Advertiser not found")
    added = 0
    for uid in req.userIds:
        exists = db.execute(
            text("SELECT 1 FROM advertiser_shares WHERE advertiser_id=:aid AND user_id=:uid"),
            {"aid": adv_id, "uid": uid}
        ).first()
        if not exists:
            db.execute(
                text("INSERT INTO advertiser_shares (advertiser_id, user_id, shared_by_email) VALUES (:aid, :uid, :email)"),
                {"aid": adv_id, "uid": uid, "email": req.sharedByEmail}
            )
            added += 1
    db.commit()
    log_activity(db, f"Shared advertiser with {added} employees", "advertiser", adv_id)
    return {"message": f"Shared with {added} employee(s)"}


@router.delete("/{adv_id}/share/{user_id}")
def unshare_advertiser(adv_id: int, user_id: int, db: Session = Depends(get_db)):
    """Remove an employee's access to a shared advertiser."""
    db.execute(
        text("DELETE FROM advertiser_shares WHERE advertiser_id=:aid AND user_id=:uid"),
        {"aid": adv_id, "uid": user_id}
    )
    db.commit()
    return {"message": "Access removed"}


@router.get("/{adv_id}/shares")
def get_advertiser_shares(adv_id: int, db: Session = Depends(get_db)):
    """Return employees this advertiser is shared with."""
    rows = db.execute(
        text("""
            SELECT u.id, u.display_name, u.email, s.created_at
            FROM advertiser_shares s
            JOIN user_accounts u ON u.id = s.user_id
            WHERE s.advertiser_id = :aid
        """),
        {"aid": adv_id}
    ).fetchall()
    return [{"userId": r[0], "displayName": r[1], "email": r[2], "sharedAt": str(r[3])} for r in rows]
