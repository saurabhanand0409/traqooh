from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    roc_attachment_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship to GstRegistration
    gst_registrations = relationship("GstRegistration", back_populates="company")

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

class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False) # MEDIA_OWNER or ADVERTISER
    gst_registration_id = Column(Integer, nullable=True)
