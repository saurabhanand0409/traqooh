"""
Utility: Quick database health check — counts records in each table.

Usage:
  cd backend-python
  python ../scripts/check_db.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend-python'))

from database import SessionLocal
import models

db = SessionLocal()
tables = [
    ("Users",       models.UserAccount),
    ("Companies",   models.Company),
    ("Sites",       models.Site),
    ("Advertisers", models.Advertiser),
    ("Campaigns",   models.Campaign),
    ("Assignments", models.CampaignSiteAssignment),
    ("AccessLinks", models.AdvertiserAccessLink),
    ("Audits",      models.SiteAudit),
]
print("\n📊 Database Record Counts")
print("─" * 30)
for name, model in tables:
    count = db.query(model).count()
    print(f"  {name:<16} {count:>6}")
print("─" * 30)
db.close()
