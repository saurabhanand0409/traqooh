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
    live_campaigns = db.query(models.Campaign).filter(models.Campaign.status == "LIVE").count()
    upcoming_campaigns = db.query(models.Campaign).filter(models.Campaign.status == "PLANNED").count()
    today = datetime.date.today()
    ending_soon = db.query(models.Campaign).filter(
        models.Campaign.status == "LIVE",
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


@router.get("/recent-activity")
def get_recent_activity(db: Session = Depends(get_db)):
    logs = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc()).limit(20).all()
    if not logs:
        return [{"text": "No activity yet. Start by adding vendors and sites!", "time": "Just now"}]
    return [{"text": f"{l.action}: {l.details or ''}", "time": str(l.created_at), "type": l.entity_type} for l in logs]


@router.get("/advertiser-summary/{advertiser_id}")
def get_advertiser_dashboard(advertiser_id: int, db: Session = Depends(get_db)):
    campaigns = db.query(models.Campaign).filter(models.Campaign.advertiser_id == advertiser_id).all()
    active = [c for c in campaigns if c.status in ("LIVE", "PLANNED")]
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
