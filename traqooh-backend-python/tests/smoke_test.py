"""Regression suite for the backend: access rules, uploads, review loop, zips, push, sign-up.

Run from the traqooh-backend-python folder (needs `pip install -r requirements.txt`):

    python tests/smoke_test.py

It uses a throwaway SQLite file (smoke.db, git-ignored) and never touches Neon or R2.
The "Migration error ... near '('" lines it prints come from Postgres-only SQL in run_migrations()
and are expected on SQLite; tables are created from the models instead.

Section 11 is the access matrix: ~45 endpoints x anonymous/advertiser/field/employee/admin.
Run it after ANY change to routes or auth. All checks must pass before pushing.
"""
import datetime as dt
import io
import json
import os
import sys
import zipfile

os.environ["DATABASE_URL"] = "sqlite:///./smoke.db"
os.environ["JWT_SECRET"] = "test-secret"
for k in ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT_URL", "RESEND_API_KEY", "SENTRY_DSN"]:
    os.environ.pop(k, None)
if os.path.exists("smoke.db"):
    os.remove("smoke.db")

sys.path.insert(0, ".")
from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
import models  # noqa: E402
import notifications  # noqa: E402
import routes.activities as acts_mod  # noqa: E402
from database import SessionLocal  # noqa: E402
from jwt_utils import create_access_token  # noqa: E402

client = TestClient(main.app)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))


# ---------- seed ----------
db = SessionLocal()
today = dt.date.today()
vendor = models.Company(name="Test Media")
db.add(vendor); db.commit()
site = models.Site(name="Patna Junction Hoarding", city="Patna", type="Hoarding", latitude=25.6030, longitude=85.1370,
                   owner_company_id=vendor.id, potential_monthly=18000, base_rate=15000, address="Station Road",
                   area_locality="Fraser Road", remarks="Facing platform 1", availability_status="BOOKED")
adv = models.Advertiser(company_name="Acme Foods", phone="9011096621")
other_adv = models.Advertiser(company_name="Other Brand")
db.add_all([site, adv, other_adv]); db.commit()
live = models.Campaign(name="Acme Diwali", advertiser_id=adv.id, status="FINALIZED",
                       start_date=today - dt.timedelta(days=1), end_date=today + dt.timedelta(days=30))
old = models.Campaign(name="Other Old", advertiser_id=other_adv.id, status="COMPLETE",
                      start_date=today - dt.timedelta(days=90), end_date=today - dt.timedelta(days=60))
db.add_all([live, old]); db.commit()
a_live = models.CampaignSiteAssignment(campaign_id=live.id, site_id=site.id, is_shortlisted=True,
                                       monitor_worker_name="Ramesh")
a_old = models.CampaignSiteAssignment(campaign_id=old.id, site_id=site.id, is_shortlisted=True)
db.add_all([a_live, a_old]); db.commit()
# A proof from the OTHER advertiser's campaign at the same site (must never leak to Acme)
db.add(models.CampaignActivity(campaign_id=old.id, site_id=site.id, activity_type="MOUNTING", status="DONE",
                               image_urls=json.dumps(["/uploads/x/other-brand.jpg"])))
db.commit()
IDS = dict(site=site.id, live=live.id, old=old.id, a_live=a_live.id, adv=adv.id)
db.close()

staff = {"Authorization": "Bearer " + create_access_token({"sub": "1", "role": "ADMIN", "email": "s@x.com",
                                                          "displayName": "Saurabh"})}
field = {"Authorization": "Bearer " + create_access_token({"sub": "pin-7", "role": "FIELD", "workerName": "Ramesh",
                                                          "vendorId": 1}, expire_hours=24 * 30)}
advtok = {"Authorization": "Bearer " + create_access_token({"sub": "9", "role": "ADVERTISER", "advertiserId": IDS["adv"]})}
JPG = b"\xff\xd8\xff\xe0fakejpegdata\xff\xd9"


def files3(prefix):
    return [("files", (f"{prefix}{i}.jpg", io.BytesIO(JPG + bytes([i])), "image/jpeg")) for i in range(3)]


# ---------- 1. site edit keeps GPS ----------
body = {"name": "Patna Junction Hoarding", "city": "Patna", "type": "Hoarding"}
r = client.put(f"/api/sites/{IDS['site']}", json=body, headers=staff)
s = client.get(f"/api/sites/{IDS['site']}", headers=staff).json()
check("Site edit without GPS keeps coordinates", r.status_code == 200 and s.get("latitude") == 25.603,
      f"{r.status_code} {s.get('latitude')}")
check("Site edit keeps address, locality, remarks, base rate and booked status",
      s.get("address") == "Station Road" and s.get("areaLocality") == "Fraser Road" and s.get("remarks") == "Facing platform 1"
      and s.get("baseRate") == 15000 and s.get("availabilityStatus") == "BOOKED", s)
r = client.put(f"/api/sites/{IDS['site']}", json={**body, "latitude": 25.6031, "longitude": 85.1371}, headers=staff)
s = client.get(f"/api/sites/{IDS['site']}", headers=staff).json()
check("Site edit with GPS updates coordinates", s.get("latitude") == 25.6031, s.get("latitude"))
client.put(f"/api/sites/{IDS['site']}", json={**body, "latitude": 25.6030, "longitude": 85.1370}, headers=staff)

# ---------- 2. multi-file upload, discovery, idempotency, token identity ----------
cap = (dt.datetime.utcnow() - dt.timedelta(hours=5)).replace(microsecond=0).isoformat() + "Z"
form = {"siteId": str(IDS["site"]), "activityType": "MOUNTING", "performedBy": "Someone Else",
        "latitude": "25.6031", "longitude": "85.1371", "gpsAccuracyM": "8", "capturedAt": cap,
        "clientVisitId": "visit-001", "labels": json.dumps(["close-up", "wide", "landmark"])}
r1 = client.post("/api/activities/mobile/log", data=form, files=files3("a"), headers=field)
d1 = r1.json()
check("Multi-file upload accepted", r1.status_code == 200 and len(d1.get("imageUrls", [])) == 3, r1.text[:200])
check("Upload lands in the live campaign, not the finished one", d1.get("campaignId") == IDS["live"], d1.get("campaignId"))
check("Worker name comes from the login token", d1.get("performedBy") == "Ramesh", d1.get("performedBy"))
check("Labels stored per photo", sorted(d1.get("imageLabels", {}).values()) == ["close-up", "landmark", "wide"],
      d1.get("imageLabels"))
check("Capture time stored", (d1.get("capturedAt") or "").startswith(cap[:16]), d1.get("capturedAt"))
r2 = client.post("/api/activities/mobile/log", data=form, files=files3("b"), headers=field)
db = SessionLocal()
n_visit = db.query(models.CampaignActivity).filter(models.CampaignActivity.client_visit_id == "visit-001").count()
db.close()
check("Retrying the same visit id doesn't duplicate", r2.json().get("id") == d1.get("id") and n_visit == 1,
      f"{r2.json().get('id')} vs {d1.get('id')}, rows={n_visit}")

# Old app build: single `file`, no token, still works only when the switch is explicitly turned off
acts_mod.REQUIRE_FIELD_AUTH = False
r = client.post("/api/activities/mobile/log",
                data={"siteId": str(IDS["site"]), "activityType": "AUDIT", "campaignId": str(IDS["live"])},
                files={"file": ("old.jpg", io.BytesIO(JPG), "image/jpeg")})
check("Old app single-file upload still works with the switch off", r.status_code == 200 and len(r.json().get("imageUrls", [])) == 1, r.text[:200])
acts_mod.REQUIRE_FIELD_AUTH = True
audit_id = r.json().get("id")

# ---------- 3. push token + notifications ----------
sent = []
notifications._send = lambda messages: (sent.extend(messages), [{"status": "ok"} for _ in messages])[1]
r = client.post("/api/mobile/push-token", json={"token": "ExponentPushToken[abc123]", "platform": "android",
                                                 "language": "hi"}, headers=field)
check("Field app registers push token", r.status_code == 200, r.text)
r = client.post("/api/mobile/push-token", json={"token": "ExponentPushToken[zzz]"}, headers=staff)
check("Staff login can't register a field push token", r.status_code == 403, r.status_code)

# ---------- 4. reject -> retake ----------
r = client.put(f"/api/activities/{d1['id']}", json={"status": "REJECTED", "reviewNote": "Blurry"}, headers=staff)
rj = r.json()
check("Reject records reason and reviewer", rj.get("status") == "REJECTED" and rj.get("reviewNote") == "Blurry"
      and rj.get("reviewedBy") == "Saurabh", rj)
check("Retake push sent in the worker's language", any(m.get("title") == "फ़ोटो दोबारा लें" and "Blurry" in m.get("body", "")
                                                       for m in sent), sent)
ms = client.get("/api/mobile/my-sites", headers=field).json()
mine = [x for x in ms if x.get("campaignId") == IDS["live"]]
check("my-sites works from the token alone", len(mine) == 1, ms)
if mine:
    check("my-sites flags the install retake with its reason",
          any(t["phase"] == "START" and t["reason"] == "Blurry" for t in mine[0]["retakes"]), mine[0]["retakes"])
    check("Rejected photos aren't counted", mine[0]["photoCounts"]["START"] == 0 and mine[0]["photoCounts"]["MID"] == 1,
          mine[0]["photoCounts"])
g = client.get(f"/api/sites/{IDS['site']}/gallery", headers=staff).json()
check("Gallery hides rejected photos", all(p.get("activityId") != d1["id"] for p in g["all"]), g["total"])

# Retake: new visit replaces it
form2 = {**form, "clientVisitId": "visit-002", "capturedAt": dt.datetime.utcnow().isoformat() + "Z"}
r = client.post("/api/activities/mobile/log", data=form2, files=files3("c"), headers=field)
retake_id = r.json().get("id")
ms = client.get("/api/mobile/my-sites", headers=field).json()
mine = [x for x in ms if x.get("campaignId") == IDS["live"]]
check("Retake clears once new photos arrive", mine and mine[0]["retakes"] == [] and mine[0]["photoCounts"]["START"] == 3,
      mine[0] if mine else ms)

# ---------- 5. assignment push ----------
sent.clear()
db = SessionLocal()
db.add(models.PushToken(token="ExponentPushToken[suresh]", worker_name="Suresh", language="en"))
db.commit(); db.close()
r = client.put(f"/api/campaigns/{IDS['live']}/assignment/{IDS['a_live']}", json={"monitorWorkerName": "Suresh"}, headers=staff)
check("Assigning a new worker sends 'New site assigned'",
      r.status_code == 200 and any(m.get("title") == "New site assigned" and "Patna" in m.get("body", "") for m in sent), sent)
sent.clear()
client.put(f"/api/campaigns/{IDS['live']}/assignment/{IDS['a_live']}", json={"monitorWorkerName": "suresh "}, headers=staff)
check("Re-saving the same worker sends nothing", sent == [], sent)
client.put(f"/api/campaigns/{IDS['live']}/assignment/{IDS['a_live']}", json={"monitorWorkerName": "Ramesh"}, headers=staff)

# ---------- 6. advertiser views ----------
link_req = {"advertiserId": IDS["adv"], "campaignId": IDS["live"], "purpose": "proposal"}
check("Send-link refuses anonymous callers", client.post("/api/advertisers/send-access-link", json=link_req).status_code == 401)
check("Send-link refuses advertisers", client.post("/api/advertisers/send-access-link", json=link_req, headers=advtok).status_code == 403)
lower_staff = {"Authorization": "Bearer " + create_access_token({"sub": "2", "role": "employee", "email": "e@x.com"})}
check("Role check ignores case", client.post("/api/advertisers/send-access-link", json=link_req, headers=lower_staff).status_code == 200)
db = SessionLocal(); db.query(models.AdvertiserAccessLink).delete(); db.commit(); db.close()  # keep the metrics count at 1
r = client.post("/api/advertisers/send-access-link", json=link_req, headers=staff)
link = r.json()
client.get("/api/campaigns", headers=staff)  # listing auto-advances FINALIZED -> RUNNING once the start date has passed
summ = client.get("/api/dashboard/summary", headers=staff).json()
check("Dashboard counts a RUNNING campaign as live", summ.get("liveCampaigns") == 1, summ)
token = link["accessUrl"].split("/access/")[1]
check("Send-link returns phone and login state", link.get("advertiserPhone") == "9011096621"
      and link.get("advertiserHasLogin") is False, link)
acc = client.get(f"/api/access/{token}").json()
site_acc = acc["campaigns"][0]["sites"][0]
start_urls = [p["url"] for p in site_acc["proofs"]["START"]]
check("Portal hides the rejected visit", not any(u in d1["imageUrls"] for u in start_urls), start_urls)
check("Portal shows the retake with labels, capture time and distance",
      len(site_acc["proofs"]["START"]) == 3 and site_acc["proofs"]["START"][0].get("shot")
      and site_acc["proofs"]["START"][0].get("capturedAt") and site_acc["proofs"]["START"][0].get("distanceM") is not None,
      site_acc["proofs"]["START"][:1])
check("Portal reports hasLogin", acc.get("hasLogin") is False, acc.get("hasLogin"))
dash = client.get("/api/advertisers/me/dashboard", headers=advtok).json()
urls = [p["url"] for c in dash.get("campaigns", []) for s2 in c.get("sites", []) for p in s2.get("proofs", [])]
check("Advertiser dashboard no longer shows another brand's photos", "/uploads/x/other-brand.jpg" not in urls and urls,
      urls[:4])

# ---------- 7. zips ----------
r = client.get(f"/api/campaigns/{IDS['live']}/photos.zip", headers=staff)
names = zipfile.ZipFile(io.BytesIO(r.content)).namelist() if r.status_code == 200 else []
check("Staff photo zip downloads", r.status_code == 200 and "index.csv" in names and len(names) >= 5, (r.status_code, names))
check("Zip uses site/phase folders and shot names",
      any(n.startswith("01 Patna Junction Hoarding/Installation/") and n.endswith("close-up.jpg") for n in names), names)
check("Zip leaves out rejected photos", len([n for n in names if "/Installation/" in n]) == 3, names)
r = client.get(f"/api/campaigns/{IDS['live']}/photos.zip")
check("Staff zip needs a login", r.status_code in (401, 403), r.status_code)
r = client.get(f"/api/access/{token}/photos.zip")
check("Advertiser zip downloads via access link", r.status_code == 200 and r.headers["content-type"] == "application/zip",
      r.status_code)
r = client.get("/api/access/not-a-real-token/photos.zip")
check("Bad access token can't download", r.status_code == 403, r.status_code)

# ---------- 7b. public sign-up can't pick a privileged role ----------
def reg(role, email):
    return client.post("/api/auth/register", json={"companyName": "Signup Media " + email, "gstNumber": "GST" + email,
        "gstAddress": "Patna", "directorName": "D", "directorPhone": "9", "primaryEmail": email + "@x.com",
        "accountPassword": "pw-123456", "role": role, "contacts": []})
r = reg("admin", "closed1")
check("Company sign-up is invitation-only by default", r.status_code == 403 and "invitation" in r.text, r.text)
main.ALLOW_PUBLIC_SIGNUP = True   # what ALLOW_PUBLIC_SIGNUP=true does on Render
check("Sign-up refuses SUPER_ADMIN", reg("SUPER_ADMIN", "evil").status_code == 400)
check("Sign-up refuses EMPLOYEE and ADVERTISER", reg("EMPLOYEE", "e1").status_code == 400 and reg("ADVERTISER", "a1").status_code == 400)
r = reg("admin", "owner1")
lr = client.post("/api/auth/login", json={"email": "owner1@x.com", "password": "pw-123456"})
check("Sign-up as company admin works when switched on", r.status_code == 200 and lr.json().get("role") == "ADMIN", (r.text, lr.text))
main.ALLOW_PUBLIC_SIGNUP = False

# ---------- 7c. admin-creation endpoints are Super Admin only ----------
body = {"email": "boss@x.com", "password": "pw-123456", "displayName": "B"}
check("create-super-admin refuses anonymous", client.post("/api/admin/create-super-admin", json=body).status_code == 401)
check("create-super-admin refuses an ADMIN", client.post("/api/admin/create-super-admin", json=body, headers=staff).status_code == 403)
master = {"Authorization": "Bearer " + create_access_token({"sub": "1", "role": "SUPER_ADMIN", "email": "m@x.com"})}
check("create-super-admin works for a SUPER_ADMIN", client.post("/api/admin/create-super-admin", json=body, headers=master).status_code == 200)
check("create-admin refuses anonymous", client.post("/api/admin/create-admin", json={**body, "email": "a2@x.com"}).status_code == 401)

# ---------- 8. metrics ----------
m = client.get("/api/dashboard/launch-metrics", headers=staff).json()
check("Launch metrics", m.get("proposalsSent30d") == 1 and m.get("campaignsRunning") == 1
      and m.get("sitesProvedOnTime") == 1 and len(m.get("proofsByMonth", [])) == 6, m)

# ---------- 9. auth switch ----------
r = client.post("/api/activities/mobile/log", data={"siteId": str(IDS["site"]), "activityType": "AUDIT"},
                files={"file": ("n.jpg", io.BytesIO(JPG), "image/jpeg")})
check("By default a tokenless upload is refused", r.status_code == 401, r.status_code)

# ---------- 10. verify clears review ----------
r = client.put(f"/api/activities/{retake_id}", json={"status": "VERIFIED"}, headers=staff).json()
check("Verify records reviewer, no reason", r.get("status") == "VERIFIED" and r.get("reviewedBy") == "Saurabh"
      and r.get("reviewNote") is None, r)
r = client.put(f"/api/activities/{retake_id}", json={"status": "DONE"}, headers=staff).json()
check("Un-verify clears the review trail", r.get("reviewedBy") is None, r)

mon = client.get(f"/api/campaigns/{IDS['live']}/monitoring", headers=staff).json()
acts_start = mon["sites"][0]["phases"]["START"]
check("Monitoring returns review fields and capture time",
      any(a.get("status") == "REJECTED" and a.get("reviewNote") == "Blurry" for a in acts_start)
      and all("capturedAt" in a and "imageLabels" in a for a in acts_start), acts_start[:1])

# ---------- 11. access matrix: who may call what ----------
employee = {"Authorization": "Bearer " + create_access_token({"sub": "5", "role": "EMPLOYEE", "email": "emp@x.com", "companyId": 1})}
admin_h = staff  # role ADMIN
callers = {"anonymous": {}, "advertiser": advtok, "field": field, "employee": employee, "admin": admin_h}


def call(method, path, headers, **kw):
    return client.request(method, path, headers=headers, **kw).status_code


def expect(label, method, path, allowed, **kw):
    """allowed = callers that must get past the login check; everyone else must get 401 (anonymous) or 403."""
    bad = []
    for who, h in callers.items():
        code = call(method, path, h, **kw)
        if who in allowed:
            if code in (401, 403):
                bad.append(f"{who} was refused ({code})")
        else:
            want = 401 if who == "anonymous" else 403
            if code != want:
                bad.append(f"{who} got {code}, wanted {want}")
    check(f"Access: {label}", not bad, "; ".join(bad))


STAFF = {"employee", "admin"}
for label, m, path, kw in [
    ("list campaigns", "GET", "/api/campaigns", {}),
    ("one campaign", "GET", f"/api/campaigns/{IDS['live']}", {}),
    ("create campaign", "POST", "/api/campaigns", {"json": {}}),
    ("delete campaign", "DELETE", "/api/campaigns/99999", {}),
    ("monitoring", "GET", f"/api/campaigns/{IDS['live']}/monitoring", {}),
    ("assign site", "POST", f"/api/campaigns/{IDS['live']}/assign-site", {"json": {}}),
    ("list vendors", "GET", "/api/vendors", {}),
    ("delete vendor", "DELETE", "/api/vendors/99999", {}),
    ("create vendor", "POST", "/api/vendors", {"json": {}}),
    ("list advertisers", "GET", "/api/advertisers", {}),
    ("one advertiser", "GET", f"/api/advertisers/{IDS['adv']}", {}),
    ("create advertiser", "POST", "/api/advertisers", {"json": {}}),
    ("edit advertiser", "PUT", f"/api/advertisers/{IDS['adv']}", {"json": {}}),
    ("delete advertiser", "DELETE", "/api/advertisers/99999", {}),
    ("create advertiser login", "POST", "/api/advertisers/create-login", {"json": {}}),
    ("share advertiser", "POST", f"/api/advertisers/{IDS['adv']}/share", {"json": {}}),
    ("list audits", "GET", "/api/audits", {}),
    ("create audit", "POST", "/api/audits", {"json": {}}),
    ("list activities", "GET", "/api/activities", {}),
    ("create activity", "POST", "/api/activities", {"json": {}}),
    ("edit activity", "PUT", "/api/activities/1", {"json": {}}),
    ("delete activity", "DELETE", "/api/activities/99999", {}),
    ("activity timeline", "GET", f"/api/activities/campaign/{IDS['live']}/timeline", {}),
    ("dashboard summary", "GET", "/api/dashboard/summary", {}),
    ("recent activity", "GET", "/api/dashboard/recent-activity", {}),
    ("launch metrics", "GET", "/api/dashboard/launch-metrics", {}),
    ("list field PINs", "GET", "/api/admin/field-pins", {}),
    ("create field PIN", "POST", "/api/admin/field-pins", {"json": {}}),
    ("delete field PIN", "DELETE", "/api/admin/field-pins/99999", {}),
    ("site bookings", "GET", f"/api/sites/{IDS['site']}/bookings", {}),
    ("create site", "POST", "/api/sites", {"json": {}}),
    ("edit site", "PUT", f"/api/sites/{IDS['site']}", {"json": {}}),
    ("delete site", "DELETE", "/api/sites/99999", {}),
    ("companies", "GET", "/api/companies", {}),
    ("media owners list", "GET", "/api/media-owners/all", {}),
    ("site image upload", "POST", f"/api/sites/{IDS['site']}/images", {}),
    ("site image delete", "DELETE", f"/api/sites/{IDS['site']}/images/99999", {}),
]:
    expect(label, m, path, STAFF, **kw)

for label, m, path, kw in [
    ("list staff users", "GET", "/api/admin/media-users", {}),
    ("list employees", "GET", "/api/admin/employees", {}),
    ("create staff user", "POST", "/api/admin/media-users", {"json": {}}),
    ("make someone vendor admin", "POST", "/api/vendors/1/set-admin", {"json": {}}),
]:
    expect(label + " (admin only)", m, path, {"admin"}, **kw)

for label, m, path, kw in [
    ("site list", "GET", "/api/sites", {}),
    ("mobile site list", "GET", "/api/mobile/sites", {}),
    ("nearby sites", "GET", "/api/sites/nearby", {}),
    ("one site", "GET", f"/api/sites/{IDS['site']}", {}),
    ("site gallery", "GET", f"/api/sites/{IDS['site']}/gallery", {}),
    ("mobile audits", "GET", "/api/audits/mobile/audits", {}),
]:
    expect(label + " (staff or field)", m, path, STAFF | {"field"}, **kw)

expect("remove push token (field only)", "DELETE", "/api/mobile/push-token", {"field"}, json={"token": "ExponentPushToken[x]"})

# public by design
pub = [client.get(f"/api/sites/{IDS['site']}/images").status_code == 200,
       client.get("/health").status_code == 200,
       client.post("/api/auth/login", json={"email": "no@x.com", "password": "x"}).status_code == 401,
       client.get("/api/access/not-a-real-token").status_code in (403, 404)]
check("Public pages still work (site photos, health, login, access link)", all(pub), pub)


# uploads: photos/videos/PDF only, and only when logged in
def up(name, ctype, headers=field):
    return client.post("/api/upload", headers=headers, files={"file": (name, io.BytesIO(JPG), ctype)}).status_code


check("Upload refuses anonymous callers", up("a.jpg", "image/jpeg", {}) == 401)
check("Upload accepts a photo from a field login", up("a.jpg", "image/jpeg") == 200)
check("Upload refuses HTML and SVG", up("x.html", "text/html") == 400 and up("x.svg", "image/svg+xml") == 400)
check("Upload refuses a disguised script", up("x.html", "application/octet-stream") == 400 and up("x.js", "application/javascript") == 400)
check("Upload accepts a phone video sent as a generic type", up("clip.mp4", "application/octet-stream") == 200)
r = client.post("/api/upload", headers=field, params={"folder": "../../etc"}, files={"file": ("a.jpg", io.BytesIO(JPG), "image/jpeg")})
check("Upload folder name can't escape its directory", r.status_code == 200 and ".." not in r.json().get("imageUrl", ""), r.text[:150])

# advertiser self sign-up in one safe step
sr = client.post("/api/auth/register-advertiser", json={"companyName": "New Brand", "contactName": "Asha", "email": "asha@newbrand.com", "password": "longenough1"})
lg = client.post("/api/auth/login", json={"email": "asha@newbrand.com", "password": "longenough1"})
new_h = {"Authorization": "Bearer " + lg.json().get("token", "x")}
check("Advertiser can sign themselves up", sr.status_code == 200 and lg.json().get("role") == "ADVERTISER", (sr.text, lg.text))
check("A new advertiser can't open staff data", call("GET", "/api/campaigns", new_h) == 403 and call("GET", "/api/advertisers", new_h) == 403)
check("A new advertiser can open their own dashboard", call("GET", "/api/advertisers/me/dashboard", new_h) == 200)
check("Advertiser sign-up refuses a taken email and a weak password",
      client.post("/api/auth/register-advertiser", json={"companyName": "x", "contactName": "y", "email": "asha@newbrand.com", "password": "longenough1"}).status_code == 409
      and client.post("/api/auth/register-advertiser", json={"companyName": "x", "contactName": "y", "email": "b@x.com", "password": "short"}).status_code == 400)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
