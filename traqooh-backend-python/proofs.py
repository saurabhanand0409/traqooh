"""Shared rules for proof-of-display activities (photos/videos logged per site).

One place for: which activity types belong to which campaign phase, which
activities count as visible proof, when a proof was captured, and how far it
was taken from the site. Used by the monitoring board, the advertiser portal,
the mobile app endpoints and the photo zip download.
"""
import datetime
import json
import math

# Which activity types roll up into each monitoring phase
PHASE_MAP = {
    "START": ["START", "MOUNTING", "PRINT", "REPRINT"],
    "MID":   ["AUDIT", "MAINTENANCE"],
    "END":   ["END", "TAKEDOWN"],
}
PHASE_LABEL = {"START": "Installation", "MID": "Audit", "END": "Takedown"}

# A proof photo taken further than this from the site's coordinates is flagged.
OFFSITE_LIMIT_M = 250

REJECTED = "REJECTED"


def phase_of(activity_type):
    for phase, types in PHASE_MAP.items():
        if activity_type in types:
            return phase
    return "MID"


def image_urls(a):
    try:
        return json.loads(a.image_urls) if a.image_urls else []
    except (TypeError, ValueError):
        return []


def image_labels(a):
    """{url: label}; empty for activities logged before labels existed."""
    try:
        labels = json.loads(a.image_labels) if getattr(a, "image_labels", None) else {}
        return labels if isinstance(labels, dict) else {}
    except (TypeError, ValueError):
        return {}


def is_visible_proof(a):
    """Counts as proof shown to advertisers: has media and hasn't been rejected."""
    return a.status != REJECTED and bool(image_urls(a))


def captured_at(a):
    """When the proof was taken. Offline uploads can arrive much later, so prefer
    the phone's capture time over the row's creation time."""
    return getattr(a, "captured_at", None) or a.created_at


def iso(dt):
    """ISO 8601 for API responses. Naive datetimes in this app are UTC (utcnow / converted on the way in),
    so they get a "Z"; without it browsers read them as local time, 5h30m early in India."""
    if isinstance(dt, datetime.datetime):
        return dt.isoformat() + ("Z" if dt.tzinfo is None else "")
    if isinstance(dt, datetime.date):
        return dt.isoformat()
    return str(dt) if dt else None


def distance_m(lat1, lng1, lat2, lng2):
    """Great-circle distance in metres, or None when either point is unknown.
    (0, 0) is treated as unknown: it's the placeholder for sites with no GPS."""
    if None in (lat1, lng1, lat2, lng2):
        return None
    if (lat1 == 0 and lng1 == 0) or (lat2 == 0 and lng2 == 0):
        return None
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000.0 * math.asin(math.sqrt(h))


def has_gps(lat, lng):
    return lat is not None and lng is not None and not (lat == 0 and lng == 0)


def parse_client_datetime(value):
    """Parse an ISO timestamp sent by a client (e.g. '2026-10-03T09:02:10.123Z')
    into a naive UTC datetime, matching how created_at is stored. None if unusable."""
    if not value:
        return None
    try:
        dt = datetime.datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return dt
