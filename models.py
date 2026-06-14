from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Float, Text, Boolean, Date
from sqlalchemy.orm import relationship
from database import Base
import datetime


class OtpToken(Base):
    """One-time passwords for app login"""
    __tablename__ = "otp_tokens"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    otp = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Company(Base):
    """Vendor / Media Owner company"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    contact_person = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    vendor_status = Column(String, default="ACTIVE")  # ACTIVE / INACTIVE
    roc_attachment_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    gst_registrations = relationship("GstRegistration", back_populates="company")
    sites = relationship("Site", back_populates="owner")


class GstRegistration(Base):
    __tablename__ = "gst_registrations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    gst_number = Column(String, nullable=False)
    gst_certificate_url = Column(String, nullable=True)
    address = Column(String, nullable=True)
    director_name = Column(String, nullable=False)
    director_phone = Column(String, nullable=True)
    primary_email = Column(String, nullable=False)
    primary_phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    company = relationship("Company", back_populates="gst_registrations")
    contacts = relationship("Contact", back_populates="gst_registration")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    gst_registration_id = Column(Integer, ForeignKey("gst_registrations.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (UniqueConstraint('gst_registration_id', 'email', name='uq_contact_email_per_gst'),)

    gst_registration = relationship("GstRegistration", back_populates="contacts")


class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # SUPER_ADMIN, TEAM_MEMBER, MEDIA_OWNER, ADVERTISER, EMPLOYEE, ADMIN
    gst_registration_id = Column(Integer, nullable=True)
    advertiser_id = Column(Integer, ForeignKey("advertisers.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("companies.id"), nullable=True)  # assigned vendor for media users
    display_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    advertiser = relationship("Advertiser", back_populates="user_accounts")
    vendor = relationship("Company", foreign_keys=[vendor_id])


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    city = Column(String, index=True, nullable=False)
    area_locality = Column(String, nullable=True)
    address = Column(String, nullable=True)
    type = Column(String, nullable=False)  # Billboard, LED, Hoarding, Unipole, Digital Screen
    status = Column(String, default="Active")
    size = Column(String, nullable=True)
    width = Column(Integer, default=0)
    length = Column(Integer, default=0)
    total_area = Column(Integer, default=0)
    facing = Column(String, nullable=True)
    potential_monthly = Column(Float, default=0.0)
    base_rate = Column(Float, default=0.0)
    occupancy = Column(Integer, default=0)
    image_url = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)

    # Availability
    availability_status = Column(String, default="AVAILABLE")  # AVAILABLE, BLOCKED, HOLD, BOOKED, MAINTENANCE
    available_from = Column(Date, nullable=True)
    available_till = Column(Date, nullable=True)
    occupied_from = Column(Date, nullable=True)
    occupied_till = Column(Date, nullable=True)
    current_campaign_id = Column(Integer, ForeignKey("campaigns.id", use_alter=True), nullable=True)

    # Additional attributes
    state = Column(String, nullable=True)
    lighting_type = Column(String, nullable=True)  # Lit / Non-Lit

    # GPS
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Owner / vendor linkage
    owner_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    added_by_user_id = Column(Integer, nullable=True)  # media user who created this site
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    owner = relationship("Company", back_populates="sites")
    current_campaign = relationship("Campaign", foreign_keys=[current_campaign_id])
    campaign_assignments = relationship("CampaignSiteAssignment", back_populates="site")
    audits = relationship("SiteAudit", back_populates="site")
    images = relationship("SiteImage", back_populates="site")


class Advertiser(Base):
    __tablename__ = "advertisers"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False, index=True)
    contact_person = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    billing_address = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE")  # ACTIVE / INACTIVE
    created_by_user_id = Column(Integer, nullable=True)   # FK to user_accounts.id (no ORM FK to avoid circular ref)
    vendor_company_id = Column(Integer, nullable=True)    # FK to companies.id
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    campaigns = relationship("Campaign", back_populates="advertiser")
    access_links = relationship("AdvertiserAccessLink", back_populates="advertiser")
    user_accounts = relationship("UserAccount", back_populates="advertiser")


class AdvertiserAccessLink(Base):
    __tablename__ = "advertiser_access_links"

    id = Column(Integer, primary_key=True, index=True)
    advertiser_id = Column(Integer, ForeignKey("advertisers.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    token_plain = Column(String, nullable=True)  # stored temporarily for display; cleared after first view
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    is_single_use = Column(Boolean, default=False)
    used_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    advertiser = relationship("Advertiser", back_populates="access_links")
    campaign = relationship("Campaign")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    advertiser_id = Column(Integer, ForeignKey("advertisers.id"), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("user_accounts.id"), nullable=True)  # employee who created it
    internal_owner = Column(String, nullable=True)  # team member name
    campaign_type = Column(String, nullable=True)  # type/category
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    total_cost = Column(Float, default=0.0)
    status = Column(String, default="DRAFT")  # DRAFT, PLANNED, LIVE, COMPLETED, CANCELLED
    notes = Column(Text, nullable=True)
    billing_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    advertiser = relationship("Advertiser", back_populates="campaigns")
    site_assignments = relationship("CampaignSiteAssignment", back_populates="campaign")
    audits = relationship("SiteAudit", back_populates="campaign")


class CampaignSiteAssignment(Base):
    __tablename__ = "campaign_site_assignments"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    booked_from = Column(Date, nullable=True)
    booked_till = Column(Date, nullable=True)
    agreed_cost = Column(Float, default=0.0)
    unit_cost = Column(Float, default=0.0)
    status = Column(String, default="PLANNED")  # PLANNED, ACTIVE, COMPLETED, CANCELLED
    notes = Column(Text, nullable=True)
    # Advertiser shortlist & per-site execution fields
    is_shortlisted = Column(Boolean, default=False)
    final_start_date = Column(Date, nullable=True)
    final_end_date = Column(Date, nullable=True)
    printing_type = Column(String, nullable=True)     # Flex, Vinyl, Backlit, etc.
    printing_cost = Column(Float, default=0.0)
    mounting_cost = Column(Float, default=0.0)
    other_cost = Column(Float, default=0.0)
    execution_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    campaign = relationship("Campaign", back_populates="site_assignments")
    site = relationship("Site", back_populates="campaign_assignments")


class SiteAudit(Base):
    __tablename__ = "site_audits"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    audit_type = Column(String, nullable=False)  # START, MID, END, EXTRA
    scheduled_date = Column(Date, nullable=True)
    actual_audit_date = Column(Date, nullable=True)
    status = Column(String, default="PENDING")  # PENDING, DONE, MISSED
    auditor = Column(String, nullable=True)  # team member name
    notes = Column(Text, nullable=True)
    image_urls = Column(Text, nullable=True)  # JSON array of URLs
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    campaign = relationship("Campaign", back_populates="audits")
    site = relationship("Site", back_populates="audits")


class SiteImage(Base):
    __tablename__ = "site_images"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    image_url = Column(String, nullable=False)
    caption = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    site = relationship("Site", back_populates="images")


class CampaignActivity(Base):
    """Execution activity per site within a campaign.
    Covers the full on-ground lifecycle: print, reprint, mounting, audit,
    maintenance, take-down, plus campaign start/end. Each entry can carry
    photos (geo-tagged + timestamped) uploaded from web or the TraqOOH mobile app.
    """
    __tablename__ = "campaign_activities"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    assignment_id = Column(Integer, ForeignKey("campaign_site_assignments.id"), nullable=True, index=True)

    activity_type = Column(String, nullable=False)  # PRINT, REPRINT, MOUNTING, AUDIT, MAINTENANCE, TAKEDOWN, START, END
    status = Column(String, default="PENDING")      # PENDING, DONE, VERIFIED
    performed_by = Column(String, nullable=True)    # field staff / team member name
    activity_date = Column(Date, nullable=True)     # when it was actually done
    notes = Column(Text, nullable=True)
    image_urls = Column(Text, nullable=True)        # JSON array of photo URLs
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    source = Column(String, default="web")          # web / mobile
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    campaign = relationship("Campaign")
    site = relationship("Site")


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)  # vendor, site, campaign, audit, advertiser
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FieldPin(Base):
    """Admin-created 4-digit PIN for field workers (laborers) to log into the mobile app."""
    __tablename__ = "field_pins"

    id = Column(Integer, primary_key=True, index=True)
    pin = Column(String(4), nullable=False)
    vendor_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_by_admin_email = Column(String, nullable=False)
    worker_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=False)  # 72 hours from creation
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
