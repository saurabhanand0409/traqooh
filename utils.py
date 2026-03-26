"""Utility functions for TraqOOH backend."""
import os
import datetime
import hashlib
import secrets
import json
import logging
import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)

# --- R2 Upload Helper ---
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_DOMAIN = os.getenv("R2_PUBLIC_DOMAIN")

r2_client = None
if R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_ENDPOINT_URL:
    r2_client = boto3.client(
        service_name='s3',
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )
    logger.info("Cloudflare R2 storage initialized")


async def upload_to_r2(file, folder="general"):
    """Upload a file to R2 with organized folder prefix. Returns public URL."""
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{folder}/{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}{ext}"

    if r2_client and R2_BUCKET_NAME:
        r2_client.upload_fileobj(
            file.file, R2_BUCKET_NAME, unique_name,
            ExtraArgs={'ContentType': file.content_type}
        )
        if R2_PUBLIC_DOMAIN:
            return f"{R2_PUBLIC_DOMAIN.rstrip('/')}/{unique_name}"
        return f"/uploads/{unique_name}"
    else:
        # Local fallback
        os.makedirs(f"uploads/{folder}", exist_ok=True)
        path = f"uploads/{unique_name}"
        with open(path, "wb") as f:
            import shutil
            shutil.copyfileobj(file.file, f)
        return f"/{path}"


# --- Activity Logger ---
def log_activity(db, action, entity_type=None, entity_id=None, details=None, user_email=None):
    """Log an activity to the activity_log table."""
    from models import ActivityLog
    try:
        entry = ActivityLog(
            user_email=user_email,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning(f"Activity log failed: {e}")
        db.rollback()


# --- Token Generator ---
def generate_access_token():
    """Generate a cryptographically secure access token."""
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


def verify_access_token(plain_token, stored_hash):
    """Verify access token against stored hash."""
    return hashlib.sha256(plain_token.encode()).hexdigest() == stored_hash


# --- Site response helper ---
def site_to_dict(s):
    """Convert a Site model to API response dict."""
    return {
        "id": s.id,
        "name": s.name,
        "city": s.city,
        "areaLocality": s.area_locality,
        "address": s.address,
        "type": s.type,
        "status": s.status,
        "size": s.size,
        "width": s.width or 0,
        "length": s.length or 0,
        "total_area": s.total_area or 0,
        "facing": s.facing,
        "potentialMonthly": float(s.potential_monthly or 0),
        "baseRate": float(s.base_rate or 0),
        "occupancy": s.occupancy,
        "imageUrl": s.image_url,
        "remarks": s.remarks,
        "availabilityStatus": s.availability_status,
        "availableFrom": str(s.available_from) if s.available_from else None,
        "availableTill": str(s.available_till) if s.available_till else None,
        "occupiedFrom": str(s.occupied_from) if s.occupied_from else None,
        "occupiedTill": str(s.occupied_till) if s.occupied_till else None,
        "currentCampaignId": s.current_campaign_id,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "owner": {
            "id": s.owner.id,
            "name": s.owner.name
        } if s.owner else None,
        "ownerCompanyId": s.owner_company_id,
        "vendorId": s.owner_company_id,  # alias
        "addedByUserId": s.added_by_user_id,
        "created_at": str(s.created_at) if s.created_at else None,
    }
