"""JWT utilities for TraqOOH authentication."""
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, Header

SECRET_KEY = os.environ.get("JWT_SECRET", "traqooh-dev-secret-CHANGE-IN-PRODUCTION-use-openssl-rand-hex-32")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Field-app endpoints accept requests without a login token while older app builds
# are still in use. Once every field worker has the build that sends its token,
# set REQUIRE_FIELD_AUTH=true on Render so tokenless uploads are refused.
REQUIRE_FIELD_AUTH = os.environ.get("REQUIRE_FIELD_AUTH", "").strip().lower() in ("1", "true", "yes")


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
