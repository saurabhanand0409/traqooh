"""JWT utilities for TraqOOH authentication."""
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Header

SECRET_KEY = os.environ.get("JWT_SECRET", "traqooh-dev-secret-CHANGE-IN-PRODUCTION-use-openssl-rand-hex-32")
# On Render (it sets RENDER=true) a missing JWT_SECRET would let anyone forge a login with the
# built-in dev secret, so refuse to start. The previous deploy keeps running if this trips.
if os.environ.get("RENDER") and not os.environ.get("JWT_SECRET"):
    raise RuntimeError("JWT_SECRET is not set. Add it in Render -> Environment before deploying.")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Field-app uploads and my-sites need the worker's login token (on by default since 2026-10-03).
# Set REQUIRE_FIELD_AUTH=false on Render only to keep an older app build working that does not send it.
REQUIRE_FIELD_AUTH = os.environ.get("REQUIRE_FIELD_AUTH", "true").strip().lower() in ("1", "true", "yes")


def create_access_token(payload: dict, expire_hours: int = None) -> str:
    data = payload.copy()
    data["exp"] = datetime.utcnow() + timedelta(hours=expire_hours or TOKEN_EXPIRE_HOURS)
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency — requires a valid Bearer JWT. Use Depends(get_current_user)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_access_token(token)
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """FastAPI dependency — returns user dict if valid JWT present, None otherwise.
    Use for endpoints that should work both authenticated and unauthenticated."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        return decode_access_token(token)
    except JWTError:
        return None


def require_roles(user: dict, *roles: str):
    """Raise 403 if the authenticated user's role isn't in the allowed set."""
    # Case-insensitive: older accounts may store the role in lower case.
    if (user.get("role") or "").upper() not in {r.upper() for r in roles}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


# ── Role gates ────────────────────────────────────────────────────────────────
# Use as dependencies=[Depends(require_staff)] on a route, or on a whole router via include_router.
STAFF_ROLES = ("SUPER_ADMIN", "ADMIN", "EMPLOYEE", "TEAM_MEMBER", "MEDIA_OWNER")
ADMIN_ROLES = ("SUPER_ADMIN", "ADMIN")


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """Logged in as someone who works inside TraqOOH (not an advertiser, not a field worker)."""
    require_roles(user, *STAFF_ROLES)
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    require_roles(user, *ADMIN_ROLES)
    return user


async def require_staff_or_field(user: dict = Depends(get_current_user)) -> dict:
    """Staff, or a field worker's PIN login (the Android app)."""
    require_roles(user, *STAFF_ROLES, "FIELD")
    return user


async def require_field(user: dict = Depends(get_current_user)) -> dict:
    require_roles(user, "FIELD")
    return user
