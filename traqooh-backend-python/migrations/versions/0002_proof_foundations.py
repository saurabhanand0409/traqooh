"""Proof foundations: job queue, per-photo proof rows, review decisions, verification tiers.

Written to be safe whether or not create_all() has already made the new tables (it runs first
at start-up), and on both Postgres (production) and SQLite (tests).

Backfills:
- one proof_photo row per existing photo/video URL, marked LEGACY, with a check job queued;
- verification_tier on existing visits (mobile → SELF_REPORTED, web → STAFF_UPLOAD).

Revision ID: 0002_proof_foundations
Revises: 0001_baseline
Create Date: 2026-10-04
"""
import datetime
import json

import sqlalchemy as sa
from alembic import op

revision = "0002_proof_foundations"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

VIDEO_EXT = (".mp4", ".mov", ".m4v", ".3gp", ".webm", ".avi", ".mkv")


def _columns(insp, table):
    return {c["name"] for c in insp.get_columns(table)}


def upgrade():
    import models  # imported here so the migration module stays importable on its own

    bind = op.get_bind()
    insp = sa.inspect(bind)

    for model in (models.Job, models.ProofPhoto, models.ProofReview):
        model.__table__.create(bind=bind, checkfirst=True)

    cols = _columns(insp, "campaign_activities")
    if "verification_tier" not in cols:
        op.add_column("campaign_activities", sa.Column("verification_tier", sa.String(), nullable=True))
    if "prooflock_status" not in cols:
        op.add_column("campaign_activities", sa.Column("prooflock_status", sa.String(), nullable=True))
    if "kind" not in _columns(insp, "field_pins"):
        op.add_column("field_pins", sa.Column("kind", sa.String(), nullable=True, server_default="CREW"))

    # Tier for visits logged before tiers existed
    bind.execute(sa.text(
        "UPDATE campaign_activities SET verification_tier = "
        "CASE WHEN source = 'mobile' THEN 'SELF_REPORTED' ELSE 'STAFF_UPLOAD' END "
        "WHERE verification_tier IS NULL"))

    # One proof_photo row per existing URL, plus a check job for each
    rows = bind.execute(sa.text(
        "SELECT id, site_id, image_urls, image_labels, latitude, longitude, gps_accuracy_m, captured_at, created_at "
        "FROM campaign_activities WHERE image_urls IS NOT NULL AND image_urls <> ''")
        .columns(captured_at=sa.DateTime, created_at=sa.DateTime)).fetchall()  # real datetimes on SQLite too
    existing = {(r[0], r[1]) for r in bind.execute(sa.text("SELECT activity_id, url FROM proof_photo")).fetchall()}
    photos = sa.table(
        "proof_photo",
        sa.column("activity_id", sa.Integer), sa.column("site_id", sa.Integer), sa.column("url", sa.String),
        sa.column("label", sa.String), sa.column("media_type", sa.String), sa.column("capture_source", sa.String),
        sa.column("captured_at", sa.DateTime), sa.column("latitude", sa.Float), sa.column("longitude", sa.Float),
        sa.column("gps_accuracy_m", sa.Float), sa.column("status", sa.String), sa.column("created_at", sa.DateTime),
    )
    new_rows = []
    for act_id, site_id, urls_json, labels_json, lat, lng, acc, captured, uploaded in rows:
        try:
            urls = json.loads(urls_json) or []
        except (TypeError, ValueError):
            continue
        try:
            labels = json.loads(labels_json) if labels_json else {}
        except (TypeError, ValueError):
            labels = {}
        if not isinstance(labels, dict):
            labels = {}
        for url in urls if isinstance(urls, list) else []:
            if not isinstance(url, str) or (act_id, url) in existing:
                continue
            is_video = url.lower().split("?")[0].endswith(VIDEO_EXT)
            new_rows.append({
                "activity_id": act_id, "site_id": site_id, "url": url, "label": labels.get(url),
                "media_type": "VIDEO" if is_video else "IMAGE", "capture_source": "LEGACY",
                "captured_at": captured, "latitude": lat, "longitude": lng, "gps_accuracy_m": acc,
                "status": "PENDING",
                "created_at": uploaded,  # keep the original upload time for the time check
            })
    if new_rows:
        op.bulk_insert(photos, new_rows)
        bind.execute(sa.text(
            "INSERT INTO job (type, payload, status, attempts, max_attempts, run_after, created_at) "
            "SELECT 'prooflock.check_photo', '{\"photo_id\": ' || id || '}', 'QUEUED', 0, 5, :now, :now "
            "FROM proof_photo WHERE capture_source = 'LEGACY' AND status = 'PENDING'"),
            {"now": datetime.datetime.utcnow()})  # UTC like the rest of the app, whatever the DB's time zone
        bind.execute(sa.text(
            "UPDATE campaign_activities SET prooflock_status = 'PENDING' "
            "WHERE prooflock_status IS NULL AND id IN (SELECT activity_id FROM proof_photo)"))


def downgrade():
    op.drop_column("field_pins", "kind")
    op.drop_column("campaign_activities", "prooflock_status")
    op.drop_column("campaign_activities", "verification_tier")
    op.drop_table("proof_review")
    op.drop_table("proof_photo")
    op.drop_table("job")
