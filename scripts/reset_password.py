"""
Utility: Reset a user's password directly in the database.

Usage:
  cd backend-python
  python ../scripts/reset_password.py user@email.com NewPassword123
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend-python'))

from database import SessionLocal
import models, hashlib, bcrypt

if len(sys.argv) < 3:
    print("Usage: python reset_password.py <email> <new_password>")
    sys.exit(1)

EMAIL    = sys.argv[1]
PASSWORD = sys.argv[2]

def hash_password(password: str) -> str:
    digest = hashlib.sha256(password.encode()).hexdigest()
    return bcrypt.hashpw(digest.encode(), bcrypt.gensalt()).decode()

db = SessionLocal()
user = db.query(models.UserAccount).filter(models.UserAccount.email.ilike(EMAIL)).first()
if not user:
    print(f"❌ User not found: {EMAIL}")
else:
    user.password_hash = hash_password(PASSWORD)
    db.commit()
    print(f"✅ Password reset for: {EMAIL}")
db.close()
