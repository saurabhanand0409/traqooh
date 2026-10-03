"""
Utility: Create a SUPER_ADMIN user directly in the database.
Run once to bootstrap the first admin account.

Usage:
  cd backend-python
  python ../scripts/seed_admin.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend-python'))

from database import SessionLocal
import models, hashlib, bcrypt

EMAIL    = "admin@brandsculpt.com"   # ← change this
PASSWORD = "ChangeMe123!"            # ← change this
NAME     = "Super Admin"

def hash_password(password: str) -> str:
    digest = hashlib.sha256(password.encode()).hexdigest()
    return bcrypt.hashpw(digest.encode(), bcrypt.gensalt()).decode()

db = SessionLocal()
existing = db.query(models.UserAccount).filter(models.UserAccount.email == EMAIL).first()
if existing:
    print(f"User {EMAIL} already exists (role={existing.role})")
else:
    user = models.UserAccount(
        email=EMAIL,
        password_hash=hash_password(PASSWORD),
        role="SUPER_ADMIN",
        display_name=NAME,
        is_active=True,
    )
    db.add(user)
    db.commit()
    print(f"✅ Created SUPER_ADMIN: {EMAIL}")
db.close()
