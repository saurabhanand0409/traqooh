"""Background jobs, stored in Postgres (table `job`) so no extra queue service is needed.

- enqueue(db, "type", {...})        add work (optionally de-duplicated by a key)
- @handler("type")                   register the function that does the work: fn(db, payload)
- run_pending(limit)                 run due jobs now (tests, scripts)
- start_worker() / stop_worker()     background thread started with the API (see main.py lifespan)
- schedule_every(...) / schedule_daily(...)   recurring jobs, enqueued by the worker's scheduler

Claiming is a conditional UPDATE (status QUEUED → RUNNING), so two workers can never run the
same job; it works on Postgres and on SQLite (tests). A job left RUNNING for STALE_AFTER (the
worker died mid-job) is picked up again. Failures retry with backoff up to max_attempts.
"""
import datetime
import json
import logging
import os
import threading
import time
import traceback

from sqlalchemy import and_, or_, update
from sqlalchemy.exc import IntegrityError

import models
from database import SessionLocal

logger = logging.getLogger(__name__)

HANDLERS = {}
STALE_AFTER = datetime.timedelta(minutes=10)
IDLE_SLEEP_S = 2.0
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

_EVERY = []   # (job_type, minutes)
_DAILY = []   # (job_type, hour_ist, minute)
_stop = threading.Event()
_thread = None


def utcnow():
    return datetime.datetime.utcnow()


def handler(job_type):
    def register(fn):
        HANDLERS[job_type] = fn
        return fn
    return register


def schedule_every(job_type, minutes):
    """Enqueue job_type once per `minutes`-long slot."""
    _EVERY.append((job_type, minutes))


def schedule_daily(job_type, hour_ist, minute=0):
    """Enqueue job_type once a day at hour:minute India time."""
    _DAILY.append((job_type, hour_ist, minute))


def enqueue(db, job_type, payload=None, *, run_after=None, dedupe_key=None, max_attempts=5, commit=True):
    """Add a job. With a dedupe_key, an existing job with that key is returned instead."""
    if dedupe_key:
        existing = db.query(models.Job).filter(models.Job.dedupe_key == dedupe_key).first()
        if existing:
            return existing
    job = models.Job(
        type=job_type, payload=json.dumps(payload or {}), status="QUEUED", attempts=0,
        max_attempts=max_attempts, run_after=run_after or utcnow(), dedupe_key=dedupe_key,
    )
    db.add(job)
    if commit:
        try:
            db.commit()
        except IntegrityError:  # another process enqueued the same dedupe_key a moment ago
            db.rollback()
            return db.query(models.Job).filter(models.Job.dedupe_key == dedupe_key).first()
        db.refresh(job)
    return job


def _claim(db):
    now = utcnow()
    stale = now - STALE_AFTER
    claimable = or_(
        and_(models.Job.status == "QUEUED", models.Job.run_after <= now),
        and_(models.Job.status == "RUNNING", models.Job.locked_at < stale),
    )
    ids = [r[0] for r in db.query(models.Job.id).filter(claimable).order_by(models.Job.run_after, models.Job.id).limit(5)]
    for job_id in ids:
        result = db.execute(
            update(models.Job)
            .where(models.Job.id == job_id, claimable)
            .values(status="RUNNING", locked_at=now, attempts=models.Job.attempts + 1)
        )
        db.commit()
        if result.rowcount == 1:
            return db.get(models.Job, job_id)
    return None


def run_one():
    """Claim and run one due job. Returns True if a job was run."""
    db = SessionLocal()
    try:
        job = _claim(db)
        if job is None:
            return False
        fn = HANDLERS.get(job.type)
        try:
            if fn is None:
                raise RuntimeError(f"No handler registered for job type '{job.type}'")
            payload = json.loads(job.payload) if job.payload else {}
            payload.setdefault("_attempt", job.attempts)  # lets a handler give up gracefully on the last try
            fn(db, payload)
            db.commit()
            job.status = "DONE"
            job.finished_at = utcnow()
            job.last_error = None
            db.commit()
        except Exception as exc:  # noqa: BLE001 — a failing job must never kill the worker
            db.rollback()
            job = db.get(models.Job, job.id)
            job.last_error = f"{exc}\n{traceback.format_exc()[-1500:]}"
            if job.attempts >= (job.max_attempts or 5):
                job.status = "FAILED"
                job.finished_at = utcnow()
                logger.error("Job %s (%s) failed permanently: %s", job.id, job.type, exc)
            else:
                job.status = "QUEUED"
                job.run_after = utcnow() + datetime.timedelta(minutes=2 ** job.attempts)
                logger.warning("Job %s (%s) failed, retrying: %s", job.id, job.type, exc)
            db.commit()
        return True
    finally:
        db.close()


def run_pending(limit=500):
    """Run due jobs until none are left (or `limit` reached). Returns how many ran."""
    n = 0
    while n < limit and run_one():
        n += 1
    return n


def _tick_scheduler():
    """Enqueue recurring jobs whose current slot has no job yet (dedupe makes this idempotent)."""
    if not (_EVERY or _DAILY):
        return
    db = SessionLocal()
    try:
        now_utc = utcnow()
        for job_type, minutes in _EVERY:
            slot = int(now_utc.timestamp() // (minutes * 60))
            enqueue(db, job_type, {}, dedupe_key=f"every:{job_type}:{slot}")
        now_ist = datetime.datetime.now(IST)
        for job_type, hour, minute in _DAILY:
            due = now_ist.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if now_ist >= due:
                enqueue(db, job_type, {"date": now_ist.date().isoformat()},
                        dedupe_key=f"daily:{job_type}:{now_ist.date().isoformat()}")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Scheduler tick failed: %s", exc)
    finally:
        db.close()


def _loop():
    last_tick = 0.0
    while not _stop.is_set():
        try:
            if time.monotonic() - last_tick >= 60:
                _tick_scheduler()
                last_tick = time.monotonic()
            ran = run_one()
        except Exception as exc:  # noqa: BLE001 — e.g. a dropped DB connection; try again shortly
            logger.warning("Job worker loop error: %s", exc)
            ran = False
        if not ran:
            _stop.wait(IDLE_SLEEP_S)


def worker_enabled():
    return os.environ.get("JOB_WORKER", "on").strip().lower() not in ("0", "off", "false", "no")


def start_worker():
    global _thread
    if not worker_enabled() or (_thread and _thread.is_alive()):
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="job-worker", daemon=True)
    _thread.start()
    logger.info("Job worker started (%d handlers)", len(HANDLERS))


def stop_worker():
    _stop.set()
