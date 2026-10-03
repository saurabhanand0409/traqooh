"""Real dashboard routes with live data."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from database import get_db
import models
import datetime

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(ownerCompanyId: Optional[int] = None, db: Session = Depends(get_db)):
    # Vendors
    total_vendors = db.query(models.Company).count()

    # Sites
    site_q = db.query(models.Site)
    if ownerCompanyId:
        site_q = site_q.filter(models.Site.owner_company_id == ownerCompanyId)
    total_sites = site_q.count()
    available_sites = site_q.filter(models.Site.availability_status == "AVAILABLE").count()
    booked_sites = site_q.filter(models.Site.availability_status == "BOOKED").count()

    total_sqft = db.query(func.sum(models.Site.total_area)).scalar() or 0
    avg_occupancy = db.query(func.avg(models.Site.occupancy)).scalar() or 0

    # Campaigns
    # RUNNING is the current name; LIVE is the pre-migration alias.
    live_campaigns = db.query(models.Campaign).filter(models.Campaign.status.in_(["RUNNING", "LIVE"])).count()
    upcoming_campaigns = db.query(models.Campaign).filter(models.Campaign.status.in_(["PLANNED", "FINALIZED"])).count()
    today = datetime.date.today()
    ending_soon = db.query(models.Campaign).filter(
        models.Campaign.status.in_(["RUNNING", "LIVE"]),
        models.Campaign.end_date <= today + datetime.timedelta(days=7)
    ).count()

    # Advertisers
    total_advertisers = db.query(models.Advertiser).count()
    active_advertisers = db.query(models.Advertiser).filter(models.Advertiser.status == "ACTIVE").count()

    # Revenue
    total_booked_value = db.query(func.sum(models.CampaignSiteAssignment.agreed_cost)).scalar() or 0

    # Pending audits
    pending_audits = db.query(models.SiteAudit).filter(models.SiteAudit.status == "PENDING").count()

    # Media Users
    total_media_users = db.query(models.UserAccount).filter(
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"])
    ).count()
    unassigned_media_users = db.query(models.UserAccount).filter(
        models.UserAccount.role.in_(["EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER"]),
        models.UserAccount.vendor_id == None
    ).count()

    # Inventory without vendor
    inventory_without_vendor = db.query(models.Site).filter(
        models.Site.owner_company_id == None
    ).count()

    # Vendors with no inventory
    from sqlalchemy import not_, exists
    vendors_with_no_inventory = db.query(models.Company).filter(
        ~exists().where(models.Site.owner_company_id == models.Company.id)
    ).count()

    # Inventory added this month
    first_of_month = datetime.date.today().replace(day=1)
    inventory_this_month = db.query(models.Site).filter(
        models.Site.created_at >= first_of_month
    ).count()

    return {
        "totalVendors": total_vendors,
        "totalSites": total_sites,
        "availableSites": available_sites,
        "bookedSites": booked_sites,
        "totalSqFt": int(total_sqft),
        "averageOccupancy": float(avg_occupancy),
        "liveCampaigns": live_campaigns,
        "upcomingCampaigns": upcoming_campaigns,
        "endingSoon": ending_soon,
        "totalAdvertisers": total_advertisers,
        "activeAdvertisers": active_advertisers,
        "totalBookedValue": float(total_booked_value),
        "pendingAudits": pending_audits,
        "totalMediaUsers": total_media_users,
        "unassignedMediaUsers": unassigned_media_users,
        "inventoryWithoutVendor": inventory_without_vendor,
        "vendorsWithNoInventory": vendors_with_no_inventory,
        "inventoryThisMonth": inventory_this_month,
    }


@router.get("/launch-metrics")
def get_launch_metrics(db: Session = Depends(get_db)):
    """The numbers to watch weekly after launch (questionnaire Q90 / Q13).

    - proposals sent and live links opened, over the last 30 days
    - campaigns running now
    - share of sites whose installation was proved within 48 hours of the start date,
      over campaigns that started in the last 90 days
    - proofs logged per month (last 6 months), for the dashboard chart
    Paying accounts stays null until billing exists.
    """
    import proofs
    now = datetime.datetime.utcnow()
    today = now.date()
    since30 = now - datetime.timedelta(days=30)

    links = db.query(models.AdvertiserAccessLink).filter(models.AdvertiserAccessLink.created_at >= since30).all()
    proposals = [l for l in links if (l.purpose or "proposal") == "proposal"]
    live_links = [l for l in links if l.purpose == "live"]

    campaigns = db.query(models.Campaign).all()

    def is_running(c):
        if c.status in ("RUNNING", "LIVE"):
            return True
        return (c.status == "FINALIZED" and c.start_date is not None and c.start_date <= today
                and (c.end_date is None or c.end_date >= today))

    running = [c for c in campaigns if is_running(c)]

    # Installation proved on time: first accepted START-phase proof within 48 h of the site's start.
    started = [c for c in campaigns
               if c.start_date and today - datetime.timedelta(days=90) <= c.start_date <= today
               and c.status not in ("DRAFT", "PLANNED", "CANCELLED")]
    total_sites = on_time = proved = 0
    if started:
        ids = [c.id for c in started]
        assigns = db.query(models.CampaignSiteAssignment).filter(
            models.CampaignSiteAssignment.campaign_id.in_(ids)).all()
        acts = db.query(models.CampaignActivity).filter(
            models.CampaignActivity.campaign_id.in_(ids),
            models.CampaignActivity.image_urls.isnot(None),
            models.CampaignActivity.status != proofs.REJECTED).all()
        first_install = {}
        for a in acts:
            if proofs.phase_of(a.activity_type) != "START" or not proofs.image_urls(a):
                continue
            key = (a.campaign_id, a.site_id)
            when = proofs.captured_at(a)
            if when and (key not in first_install or when < first_install[key]):
                first_install[key] = when
        by_campaign = {}
        for a in assigns:
            by_campaign.setdefault(a.campaign_id, []).append(a)
        starts = {c.id: c.start_date for c in started}
        for cid, rows in by_campaign.items():
            shortlisted = [a for a in rows if a.is_shortlisted and not a.pending_approval]
            for a in (shortlisted or rows):
                total_sites += 1
                start = a.final_start_date or starts[cid]
                first = first_install.get((cid, a.site_id))
                if first:
                    proved += 1
                    deadline = datetime.datetime.combine(start, datetime.time.min) + datetime.timedelta(hours=48)
                    if first <= deadline:
                        on_time += 1

    # Accepted proofs per month for the last 6 months, split by phase
    first_month = (today.replace(day=1) - datetime.timedelta(days=150)).replace(day=1)
    recent = db.query(models.CampaignActivity).filter(
        models.CampaignActivity.image_urls.isnot(None),
        models.CampaignActivity.status != proofs.REJECTED,
        func.coalesce(models.CampaignActivity.captured_at, models.CampaignActivity.created_at)
            >= datetime.datetime.combine(first_month, datetime.time.min)).all()
    months = []
    cursor = first_month
    for _ in range(6):
        months.append(cursor)
        cursor = (cursor + datetime.timedelta(days=32)).replace(day=1)
    buckets = {m.strftime("%Y-%m"): {"month": m.strftime("%b"), "install": 0, "audit": 0, "takedown": 0}
               for m in months}
    phase_key = {"START": "install", "MID": "audit", "END": "takedown"}
    for a in recent:
        when = proofs.captured_at(a)
        b = buckets.get(when.strftime("%Y-%m")) if when else None
        if b:
            b[phase_key[proofs.phase_of(a.activity_type)]] += len(proofs.image_urls(a))

    return {
        "proposalsSent30d": len(proposals),
        "liveLinksSent30d": len(live_links),
        "liveLinksOpened30d": sum(1 for l in live_links if (l.used_count or 0) > 0),
        "campaignsRunning": len(running),
        "sitesStarted90d": total_sites,
        "sitesProved": proved,
        "sitesProvedOnTime": on_time,
        "provedOnTimePct": round(100 * on_time / total_sites) if total_sites else None,
        "payingAccounts": None,  # billing not built yet
        "proofsByMonth": [buckets[m.strftime("%Y-%m")] for m in months],
    }


@router.get("/recent-activity")
def get_recent_activity(db: Session = Depends(get_db)):
    logs = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc()).limit(20).all()
    if not logs:
        return [{"text": "No activity yet. Start by adding vendors and sites!", "time": "Just now"}]
    return [{"text": f"{l.action}: {l.details or ''}", "time": str(l.created_at), "type": l.entity_type} for l in logs]


@router.get("/advertiser-summary/{advertiser_id}")
def get_advertiser_dashboard(advertiser_id: int, db: Session = Depends(get_db)):
    campaigns = db.query(models.Campaign).filter(models.Campaign.advertiser_id == advertiser_id).all()
    active = [c for c in campaigns if c.status in ("PLANNED", "FINALIZED", "RUNNING", "LIVE")]
    total_cost = sum(c.total_cost or 0 for c in campaigns)
    total_sites = db.query(models.CampaignSiteAssignment).filter(
        models.CampaignSiteAssignment.campaign_id.in_([c.id for c in campaigns])
    ).count() if campaigns else 0
    audits_done = db.query(models.SiteAudit).filter(
        models.SiteAudit.campaign_id.in_([c.id for c in campaigns]),
        models.SiteAudit.status == "DONE"
    ).count() if campaigns else 0

    return {
        "totalCampaigns": len(campaigns),
        "activeCampaigns": len(active),
        "totalSitesBooked": total_sites,
        "totalCost": total_cost,
        "auditsCompleted": audits_done,
        "campaigns": [{
            "id": c.id, "name": c.name, "status": c.status,
            "startDate": str(c.start_date) if c.start_date else None,
            "endDate": str(c.end_date) if c.end_date else None,
            "totalCost": c.total_cost,
        } for c in campaigns]
    }
