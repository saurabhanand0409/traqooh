"""ProofLock — automatic checks on every proof photo, run in the background (jobs.py).

Phase 1 checks (each returns PASS / REVIEW / FAIL / INFO with a plain-language detail):
- source     was it taken in the app's own camera? (gallery/undeclared → review; web/legacy → info)
- reupload   exact same file (SHA-256) uploaded before for another visit → fail
- recycled   near-identical image (64-bit difference hash) from an earlier visit of the same site
             → review; from a different site → fail if virtually identical, otherwise review
- location   photo GPS within 250 m of the site, with usable accuracy
- time       capture time not in the future, uploaded within 7 days, inside the booking dates

INFO never affects the status. A visit's status is the worst of its photos; any photo still
waiting keeps the visit PENDING. Borderline cases go to a person (REVIEW), never to an automatic
fail. Thresholds are constants here so they can be tuned on pilot data.
"""
import datetime
import hashlib
import io
import json
import logging

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import and_, or_

import jobs
import models
import proofs
from photo_zip import _fetch as fetch_bytes

logger = logging.getLogger(__name__)

PASS, REVIEW, FAIL, INFO, PENDING = "PASS", "REVIEW", "FAIL", "INFO", "PENDING"
_RANK = {PASS: 0, INFO: 0, REVIEW: 1, FAIL: 2}

# --- tunable thresholds -------------------------------------------------------------------
# Measured on synthetic street scenes (2026-10-04): a re-saved JPEG differs by ~2 of 64 bits,
# a 3% crop by ~6, a half-size copy by 0; a genuinely new shot of the same site by 15–30;
# a different site by 27–34. Re-tune on real pilot photos.
SAME_SITE_MAX_BITS = 8        # ≤ this many bits differ → "same picture as an earlier visit" → review
OTHER_SITE_FAIL_BITS = 2      # ≤ this → virtually the same image used for another site → fail
OTHER_SITE_REVIEW_BITS = 8    # ≤ this → looks like another site's photo (e.g. cropped) → review
GPS_ACCURACY_MAX_M = 100
UPLOAD_DELAY_MAX_DAYS = 7
WINDOW_SLACK_DAYS = 7
FUTURE_TOLERANCE = datetime.timedelta(minutes=10)
UNREADABLE_RETRIES = 3        # attempts to fetch a file before calling it unreadable

CAPTURE_SOURCES = {"CAMERA_INAPP", "GALLERY", "WEB", "LEGACY", "UNDECLARED"}
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".3gp", ".webm", ".avi", ".mkv")
_MASK64 = (1 << 64) - 1


# --- fingerprints ---------------------------------------------------------------------------
def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def hash_upload(upload):
    """SHA-256 of a FastAPI UploadFile, read in chunks; rewinds the file for the next reader."""
    h = hashlib.sha256()
    f = upload.file
    f.seek(0)
    for chunk in iter(lambda: f.read(1024 * 1024), b""):
        h.update(chunk)
    f.seek(0)
    return h.hexdigest()


def dhash64(img):
    """64-bit difference hash: shrink to 9×8 grey, compare each pixel with its right neighbour.
    Survives re-saving, resizing and mild edits; changes when the scene changes."""
    small = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    px = list(small.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            left, right = px[row * 9 + col], px[row * 9 + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def to_db(unsigned):
    """Store an unsigned 64-bit hash in a signed BIGINT column."""
    return unsigned - (1 << 64) if unsigned >= (1 << 63) else unsigned


def from_db(signed):
    return signed + (1 << 64) if signed is not None and signed < 0 else signed


def hamming(a, b):
    return bin((a ^ b) & _MASK64).count("1")


def read_image(data):
    """(PIL image, width, height) with phone rotation applied, or None if not an image."""
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        img.load()
        return img, img.width, img.height
    except (UnidentifiedImageError, OSError, ValueError):
        return None


def is_video_url(url):
    return str(url or "").lower().split("?")[0].endswith(VIDEO_EXT)


# --- the checks (pure functions) -------------------------------------------------------------
def _r(check, result, detail, **extra):
    out = {"check": check, "result": result, "detail": detail}
    out.update(extra)
    return out


def check_source(capture_source):
    src = (capture_source or "UNDECLARED").upper()
    if src == "CAMERA_INAPP":
        return _r("source", PASS, "Taken with the app's own camera")
    if src == "GALLERY":
        return _r("source", REVIEW, "Picked from the phone's gallery, not taken live")
    if src == "WEB":
        return _r("source", INFO, "Uploaded from the web dashboard")
    if src == "LEGACY":
        return _r("source", INFO, "Uploaded before capture checks existed")
    return _r("source", REVIEW, "Capture method not declared (older app version)")


def check_reupload(same_file, compared=True):
    """same_file: photos in *other* visits with the identical SHA-256
    (dicts with photo_id, activity_id, site_id)."""
    if not compared:
        return _r("reupload", INFO, "Not compared (older video, uploaded before fingerprints)")
    if not same_file:
        return _r("reupload", PASS, "File not seen before")
    m = same_file[0]
    return _r("reupload", FAIL, f"Exact same file was already uploaded (visit #{m['activity_id']}, site #{m['site_id']})",
              match_photo_id=m["photo_id"])


def check_recycled(dhash, site_id, activity_id, candidates):
    """candidates: dicts with photo_id, activity_id, site_id, dhash (unsigned) for other photos."""
    if dhash is None:
        return _r("recycled", INFO, "Not compared (video or unreadable image)")
    worst = None
    for c in candidates:
        if c.get("dhash") is None or c.get("activity_id") == activity_id:
            continue
        d = hamming(dhash, c["dhash"])
        if c.get("site_id") != site_id:
            if d <= OTHER_SITE_FAIL_BITS:
                found = _r("recycled", FAIL, f"Same picture as a photo of another site (site #{c['site_id']})",
                           match_photo_id=c["photo_id"], distance=d)
            elif d <= OTHER_SITE_REVIEW_BITS:
                found = _r("recycled", REVIEW, f"Looks very like a photo of another site (site #{c['site_id']})",
                           match_photo_id=c["photo_id"], distance=d)
            else:
                continue
        elif d <= SAME_SITE_MAX_BITS:
            found = _r("recycled", REVIEW, f"Nearly identical to a photo from an earlier visit (visit #{c['activity_id']})",
                       match_photo_id=c["photo_id"], distance=d)
        else:
            continue
        if worst is None or _RANK[found["result"]] > _RANK[worst["result"]] or (
                found["result"] == worst["result"] and d < worst.get("distance", 99)):
            worst = found
    return worst or _r("recycled", PASS, "Not a copy of any earlier photo")


def check_location(lat, lng, accuracy_m, site_lat, site_lng, capture_source=None):
    office_upload = (capture_source or "").upper() in ("WEB", "LEGACY")
    if lat is None or lng is None or (lat == 0 and lng == 0):
        if office_upload:
            return _r("location", INFO, "No photo location (web or older upload)")
        return _r("location", REVIEW, "Photo has no GPS location")
    if not proofs.has_gps(site_lat, site_lng):
        return _r("location", INFO, "Site has no GPS saved, so distance wasn't checked")
    dist = proofs.distance_m(lat, lng, site_lat, site_lng)
    if dist is not None and dist > proofs.OFFSITE_LIMIT_M:
        return _r("location", REVIEW, f"Taken {round(dist)} m from the site", distance_m=round(dist))
    if accuracy_m is not None and accuracy_m > GPS_ACCURACY_MAX_M:
        return _r("location", REVIEW, f"Weak GPS (±{round(accuracy_m)} m)", distance_m=round(dist or 0))
    acc = f" (±{round(accuracy_m)} m)" if accuracy_m is not None else ""
    return _r("location", PASS, f"{round(dist or 0)} m from the site{acc}", distance_m=round(dist or 0))


def check_time(captured_at, uploaded_at, window_start=None, window_end=None, capture_source=None):
    office_upload = (capture_source or "").upper() in ("WEB", "LEGACY")
    if captured_at is None:
        if office_upload:
            return _r("time", INFO, "No capture time (web or older upload)")
        return _r("time", REVIEW, "Photo has no capture time")
    if uploaded_at and captured_at > uploaded_at + FUTURE_TOLERANCE:
        return _r("time", FAIL, "Capture time is later than the upload (phone clock or edited data)")
    if uploaded_at and uploaded_at - captured_at > datetime.timedelta(days=UPLOAD_DELAY_MAX_DAYS):
        days = (uploaded_at - captured_at).days
        return _r("time", REVIEW, f"Uploaded {days} days after it was taken")
    slack = datetime.timedelta(days=WINDOW_SLACK_DAYS)
    day = captured_at.date()
    if window_start and day < window_start - slack:
        return _r("time", REVIEW, "Taken well before the booking started")
    if window_end and day > window_end + slack:
        return _r("time", REVIEW, "Taken well after the booking ended")
    return _r("time", PASS, "Taken within the booking dates")


def overall(results):
    worst = PASS
    for r in results:
        if _RANK.get(r["result"], 0) > _RANK[worst]:
            worst = r["result"]
    return worst


# --- persistence helpers ----------------------------------------------------------------------
def new_photo(activity, url, *, label=None, sha256=None, capture_source=None,
              captured_at=None, latitude=None, longitude=None, gps_accuracy_m=None):
    src = (capture_source or "UNDECLARED").upper()
    return models.ProofPhoto(
        activity_id=activity.id, site_id=activity.site_id, url=url, label=label,
        media_type="VIDEO" if is_video_url(url) else "IMAGE", sha256=sha256,
        capture_source=src if src in CAPTURE_SOURCES else "UNDECLARED",
        captured_at=captured_at, latitude=latitude, longitude=longitude,
        gps_accuracy_m=gps_accuracy_m, status=PENDING,
    )


def enqueue_checks(db, photos):
    for p in photos:
        jobs.enqueue(db, "prooflock.check_photo", {"photo_id": p.id}, dedupe_key=f"prooflock:{p.id}")


def contract_window(db, activity):
    """(start, end) dates the booking runs, best information first."""
    a = db.get(models.CampaignSiteAssignment, activity.assignment_id) if activity.assignment_id else None
    c = db.get(models.Campaign, activity.campaign_id) if activity.campaign_id else None
    start = (a and (a.final_start_date or a.booked_from)) or (c and c.start_date)
    end = (a and (a.final_end_date or a.booked_till)) or (c and c.end_date)
    return start, end


def rollup_activity(db, activity_id):
    """Set the visit's prooflock_status from its photos."""
    act = db.get(models.CampaignActivity, activity_id)
    if not act:
        return None
    statuses = [s for (s,) in db.query(models.ProofPhoto.status).filter(models.ProofPhoto.activity_id == activity_id)]
    if not statuses:
        act.prooflock_status = None
    elif PENDING in statuses:
        act.prooflock_status = PENDING
    else:
        act.prooflock_status = overall([{"result": s} for s in statuses])
    return act.prooflock_status


def photos_by_activity(db, activity_ids):
    """{activity_id: [ProofPhoto, ...]} for building API responses without N+1 queries."""
    out = {}
    ids = [i for i in activity_ids if i is not None]
    if not ids:
        return out
    for p in db.query(models.ProofPhoto).filter(models.ProofPhoto.activity_id.in_(ids)).order_by(models.ProofPhoto.id):
        out.setdefault(p.activity_id, []).append(p)
    return out


def photo_checks_dict(photos):
    """{url: {status, source, checks, and the photo's own capture time and GPS}} for a visit's photos.
    Per-photo time/GPS matter because the app records them per shot, not once per visit."""
    out = {}
    for p in photos or []:
        try:
            checks = json.loads(p.checks) if p.checks else []
        except (TypeError, ValueError):
            checks = []
        out[p.url] = {"status": p.status, "source": p.capture_source, "checks": checks,
                      "label": p.label, "capturedAt": proofs.iso(p.captured_at),
                      "latitude": p.latitude, "longitude": p.longitude, "accuracyM": p.gps_accuracy_m}
    return out


def _earlier_than(photo):
    """SQL condition: proof photos uploaded before this one (ties broken by id)."""
    P = models.ProofPhoto
    if photo.created_at is None:
        return P.id < photo.id
    return or_(P.created_at < photo.created_at,
               and_(P.created_at == photo.created_at, P.id < photo.id),
               and_(P.created_at.is_(None), P.id < photo.id))


# --- background jobs -----------------------------------------------------------------------------
@jobs.handler("prooflock.check_photo")
def check_photo_job(db, payload):
    photo = db.get(models.ProofPhoto, int(payload["photo_id"]))
    if not photo:
        return
    act = db.get(models.CampaignActivity, photo.activity_id)
    if not act:
        return

    unreadable = None
    # Only images are downloaded here. Videos are fingerprinted at upload; older ones are left alone
    # rather than pulling whole video files into memory.
    if photo.media_type == "IMAGE" and (photo.sha256 is None or photo.dhash is None):
        data = fetch_bytes(photo.url)
        if data is None:
            if int(payload.get("_attempt", 1)) < UNREADABLE_RETRIES:
                raise RuntimeError(f"Could not read {photo.url}")  # retried later with backoff
            unreadable = _r("file", REVIEW, "The stored file could not be read")
        else:
            photo.sha256 = photo.sha256 or sha256_bytes(data)
            if photo.media_type == "IMAGE":
                parsed = read_image(data)
                if parsed is None:
                    unreadable = _r("file", REVIEW, "Not a readable image")
                else:
                    img, photo.width, photo.height = parsed
                    photo.dhash = to_db(dhash64(img))

    # Compare only with photos uploaded earlier: the later upload is the copy, never the original
    # (matters when photos are checked after the fact, e.g. the backfill or a re-check).
    earlier = _earlier_than(photo)
    same_file = []
    if photo.sha256:
        same_file = [{"photo_id": i, "activity_id": a, "site_id": s} for i, a, s in
                     db.query(models.ProofPhoto.id, models.ProofPhoto.activity_id, models.ProofPhoto.site_id)
                     .filter(models.ProofPhoto.sha256 == photo.sha256, models.ProofPhoto.id != photo.id,
                             models.ProofPhoto.activity_id != photo.activity_id, earlier)]
    candidates = [{"photo_id": i, "activity_id": a, "site_id": s, "dhash": from_db(h)} for i, a, s, h in
                  db.query(models.ProofPhoto.id, models.ProofPhoto.activity_id, models.ProofPhoto.site_id,
                           models.ProofPhoto.dhash)
                  .filter(models.ProofPhoto.dhash.isnot(None), models.ProofPhoto.id != photo.id, earlier)]
    site = db.get(models.Site, photo.site_id or act.site_id)
    start, end = contract_window(db, act)

    results = [check_source(photo.capture_source), check_reupload(same_file, compared=photo.sha256 is not None)]
    if unreadable:
        results.append(unreadable)
    results += [
        check_recycled(from_db(photo.dhash), photo.site_id, photo.activity_id, candidates),
        check_location(photo.latitude, photo.longitude, photo.gps_accuracy_m,
                       site.latitude if site else None, site.longitude if site else None, photo.capture_source),
        check_time(photo.captured_at, photo.created_at, start, end, photo.capture_source),
    ]
    photo.checks = json.dumps(results)
    photo.status = overall(results)
    photo.checked_at = datetime.datetime.utcnow()
    db.flush()
    rollup_activity(db, photo.activity_id)


@jobs.handler("prooflock.sweep")
def sweep_job(db, payload):
    """Re-queue checks for photos stuck in PENDING (e.g. the enqueue failed after upload)."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=15)
    slot = int(datetime.datetime.utcnow().timestamp() // 3600)
    stuck = db.query(models.ProofPhoto.id).filter(models.ProofPhoto.status == PENDING,
                                                  models.ProofPhoto.created_at < cutoff).limit(200).all()
    for (photo_id,) in stuck:
        jobs.enqueue(db, "prooflock.check_photo", {"photo_id": photo_id},
                     dedupe_key=f"prooflock-sweep:{photo_id}:{slot}", commit=False)
    db.commit()


jobs.schedule_every("prooflock.sweep", 30)
