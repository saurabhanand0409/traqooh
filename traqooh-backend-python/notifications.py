"""Push notifications to field workers' phones via the Expo push service.

Sent from FastAPI BackgroundTasks, so each call opens its own DB session and
never raises. Tokens the service reports as no longer registered are deleted.
Android delivery needs FCM credentials uploaded to the Expo (EAS) project;
until then Expo accepts the message but the phone won't receive it.
"""
import logging
import os

import httpx
from sqlalchemy import func

import models
from database import SessionLocal

logger = logging.getLogger("notifications")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

TEXT = {
    "assigned": {
        "en": ("New site assigned", "{site} · {campaign}. Open the app to see it."),
        "hi": ("नई साइट सौंपी गई", "{site} · {campaign}। देखने के लिए ऐप खोलें।"),
    },
    "retake": {
        "en": ("Retake needed", "{site}: {reason}"),
        "hi": ("फ़ोटो दोबारा लें", "{site}: {reason}"),
    },
}


def _send(messages):
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if os.environ.get("EXPO_ACCESS_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['EXPO_ACCESS_TOKEN']}"
    resp = httpx.post(EXPO_PUSH_URL, json=messages, headers=headers, timeout=15)
    body = resp.json() if resp.content else {}
    return body.get("data") or []


def notify_worker(worker_name, kind, data, **fields):
    """Send a `kind` notification ("assigned" / "retake") to every phone of a worker."""
    worker = (worker_name or "").strip()
    if not worker or kind not in TEXT:
        return
    db = SessionLocal()
    try:
        tokens = db.query(models.PushToken).filter(
            func.lower(func.trim(models.PushToken.worker_name)) == worker.lower()).all()
        if not tokens:
            return
        messages = []
        for t in tokens:
            title, body = TEXT[kind].get(t.language or "en", TEXT[kind]["en"])
            values = {k: (v or "") for k, v in fields.items()}
            messages.append({
                "to": t.token,
                "title": title,
                "body": body.format(**values).strip(),
                "data": {"kind": kind, **data},
                "sound": "default",
                "channelId": "default",
                "priority": "high",
            })
        tickets = []
        for i in range(0, len(messages), 100):  # Expo accepts up to 100 per request
            tickets.extend(_send(messages[i:i + 100]))
        dead = [t for t, ticket in zip(tokens, tickets)
                if ticket.get("status") == "error"
                and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered"]
        for t in dead:
            db.delete(t)
        if dead:
            db.commit()
        logger.info(f"Push '{kind}' to {worker}: {len(messages)} sent, {len(dead)} dead tokens removed")
    except Exception as e:
        logger.error(f"Push '{kind}' to {worker} failed: {e}")
    finally:
        db.close()
