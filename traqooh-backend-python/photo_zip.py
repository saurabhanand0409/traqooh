"""Zip download of a campaign's proof photos and videos.

Used by staff (Monitoring tab) and by advertisers (access link). Files are
pulled from R2 and written to a spooled temp file so large campaigns don't sit
in memory on the small Render instance. Layout inside the zip:

    01 Patna Junction Hoarding/Installation/2026-10-03 14-32 close-up.jpg
    index.csv   (one row per file: site, phase, time, GPS, distance, who, status)
"""
import csv
import datetime
import io
import os
import re
import tempfile
import zipfile

import httpx
from fastapi.responses import StreamingResponse

import models
import proofs
from utils import r2_client, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN

IST = datetime.timedelta(hours=5, minutes=30)
_BAD_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]+')


def _safe(name, fallback="untitled", limit=60):
    cleaned = _BAD_CHARS.sub(" ", str(name or "")).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return (cleaned or fallback)[:limit].rstrip()


def _fetch(url):
    """Bytes of a stored proof file, or None if it can't be read."""
    if not url:
        return None
    public = (R2_PUBLIC_DOMAIN or "").rstrip("/")
    if r2_client and public and url.startswith(public + "/"):
        try:
            obj = r2_client.get_object(Bucket=R2_BUCKET_NAME, Key=url[len(public) + 1:])
            return obj["Body"].read()
        except Exception:
            pass  # fall through to a plain HTTP fetch of the public URL
    if url.startswith("/uploads/"):
        path = url.lstrip("/")
        if os.path.isfile(path):
            with open(path, "rb") as f:
                return f.read()
        return None
    if url.startswith("http"):
        try:
            r = httpx.get(url, timeout=30, follow_redirects=True)
            return r.content if r.status_code == 200 else None
        except Exception:
            return None
    return None


def select_assignments(assignments, include_pending=True):
    """Sites that belong in the photo set: the advertiser's shortlist (plus sites
    awaiting re-approval, for staff). Older campaigns without a shortlist use all sites."""
    shortlisted = [a for a in assignments if a.is_shortlisted or (include_pending and a.pending_approval)]
    chosen = shortlisted or list(assignments)
    if not include_pending:
        chosen = [a for a in chosen if not a.pending_approval]
    return chosen


def build_zip_response(db, campaign, assignments):
    """Stream a zip of every non-rejected proof for the given assignments."""
    site_ids = [a.site_id for a in assignments]
    sites = {s.id: s for s in db.query(models.Site).filter(models.Site.id.in_(site_ids)).all()} if site_ids else {}
    acts = []
    if site_ids:
        acts = (db.query(models.CampaignActivity)
                .filter(models.CampaignActivity.campaign_id == campaign.id,
                        models.CampaignActivity.site_id.in_(site_ids),
                        models.CampaignActivity.image_urls.isnot(None),
                        models.CampaignActivity.status != proofs.REJECTED)
                .all())
    acts.sort(key=proofs.captured_at)
    by_site = {}
    for act in acts:
        by_site.setdefault(act.site_id, []).append(act)

    spool = tempfile.SpooledTemporaryFile(max_size=20 * 1024 * 1024)
    index = io.StringIO()
    writer = csv.writer(index)
    writer.writerow(["Site", "City", "Phase", "Shot", "File", "Captured (IST)", "Latitude", "Longitude",
                     "Distance from site (m)", "Taken by", "Status"])
    missing = 0
    used_paths = set()
    with zipfile.ZipFile(spool, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
        for n, asg in enumerate(assignments, start=1):
            site = sites.get(asg.site_id)
            folder = f"{n:02d} {_safe(site.name if site else f'Site {asg.site_id}')}"
            for act in by_site.get(asg.site_id, []):
                phase = proofs.PHASE_LABEL[proofs.phase_of(act.activity_type)]
                when = proofs.captured_at(act)
                local = (when + IST) if when else None
                stamp = local.strftime("%Y-%m-%d %H-%M") if local else "undated"
                labels = proofs.image_labels(act)
                dist = proofs.distance_m(site.latitude, site.longitude, act.latitude, act.longitude) if site else None
                for i, url in enumerate(proofs.image_urls(act), start=1):
                    data = _fetch(url)
                    if data is None:
                        missing += 1
                        continue
                    shot = labels.get(url) or f"photo {i}"
                    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
                    path = f"{folder}/{phase}/{stamp} {_safe(shot, 'photo', 20)}{ext}"
                    k = 2
                    while path in used_paths:  # two shots in the same minute
                        path = f"{folder}/{phase}/{stamp} {_safe(shot, 'photo', 20)} ({k}){ext}"
                        k += 1
                    used_paths.add(path)
                    zf.writestr(path, data)
                    writer.writerow([
                        site.name if site else asg.site_id, site.city if site else "", phase, shot, path,
                        local.strftime("%Y-%m-%d %H:%M") if local else "",
                        act.latitude if act.latitude is not None else "",
                        act.longitude if act.longitude is not None else "",
                        round(dist) if dist is not None else "",
                        act.performed_by or "", act.status or "",
                    ])
        if missing:
            writer.writerow([])
            writer.writerow([f"{missing} file(s) could not be downloaded from storage and are not in this zip."])
        zf.writestr("index.csv", "﻿" + index.getvalue())  # BOM so Excel reads Hindi/₹ correctly

    size = spool.tell()
    spool.seek(0)

    def chunks():
        try:
            while True:
                block = spool.read(1024 * 1024)
                if not block:
                    break
                yield block
        finally:
            spool.close()

    filename = f"{_safe(campaign.name, 'campaign', 80)} - photos.zip"
    ascii_name = filename.encode("ascii", "ignore").decode() or "campaign-photos.zip"
    return StreamingResponse(chunks(), media_type="application/zip", headers={
        "Content-Disposition": f'attachment; filename="{ascii_name}"',
        "Content-Length": str(size),
    })
