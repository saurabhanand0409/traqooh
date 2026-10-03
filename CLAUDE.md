# TraqOOH — Complete Project Reference

> **For future Claude sessions:** this file is the single source of truth on what TraqOOH does and how it's built today. Companion files: `CHANGELOG.md` (chronological history of every change) and `OPERATIONS.md` (deploy commands, env vars, diagnostic recipes). Read all three before making changes.

---

## What is TraqOOH
A full-stack SaaS platform for **Out-of-Home (OOH) Advertising** in India, connecting **Media Owners** (billboard companies) and **Advertisers** (brands). Built and operated by **BrandSculpt**.

Field teams log execution activities (print, mount, audit, takedown) via Android app. Advertisers get a self-serve portal (token-based link or login) to view campaign progress and proof photos. Admins/employees manage everything from the web dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         END USERS                                    │
│  Admins / Employees        Advertisers          Field Workers        │
│  (web browser)             (web browser)        (Android phone)      │
└────────────┬───────────────────┬──────────────────────┬─────────────┘
             │                   │                      │
             ▼                   ▼                      ▼
┌─────────────────────┐  ┌──────────────┐   ┌──────────────────────┐
│  React Web App      │  │ Advertiser   │   │  Expo React Native   │
│  app.brandsculpt.com│  │  Portal      │   │  Android App (.apk)  │
│  (Cloudflare Pages) │  │  /dashboard  │   │  (EAS Build)         │
│                     │  │  /advertiser │   │                      │
│  Vite + TailwindCSS │  │  /access/:tk │   │  OTP login           │
│  react-router-dom   │  └──────────────┘   │  Field PIN login     │
│  Recharts + Leaflet │                     │  GPS site discovery  │
└──────────┬──────────┘                     │  Photo + Video capture│
           │  HTTPS + JWT Bearer            └──────────┬───────────┘
           ▼                                           │  HTTPS + JWT
┌─────────────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Python)                                │
│              https://traqooh-backend-python.onrender.com            │
│              Render Free Tier (sleeps after 15 min idle)            │
│                                                                      │
│  main.py + routes/  │  jwt_utils.py  │  models.py  │  database.py  │
│  Rate limiting: slowapi (10/min login, 5/min OTP)                   │
│  CORS: app.brandsculpt.com + traqooh.brandsculpt.com + localhost    │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │  SQLAlchemy ORM                  │  boto3 (S3-compatible)
           ▼                                  ▼
┌──────────────────────┐          ┌───────────────────────────────────┐
│  Neon PostgreSQL     │          │  Cloudflare R2 (Object Storage)  │
│  Free tier, 0.5 GB  │          │  Site photos, audit images,       │
│  10 connections max  │          │  campaign assets, videos          │
│  Never expires       │          │  10 GB free, egress always free   │
│  us-east-1 region    │          └───────────────────────────────────┘
└──────────────────────┘
                                  ┌───────────────────────────────────┐
                                  │  Resend (Email)                   │
                                  │  OTP delivery + advertiser links  │
                                  │  noreply@brandsculpt.com          │
                                  │  ✅ ACTIVE since 2026-06-18       │
                                  └───────────────────────────────────┘
```

---

## Live Service URLs

| Service | URL | Host |
|---------|-----|------|
| **Marketing site** | https://traqooh.brandsculpt.com | Vercel |
| **Web App** | https://app.brandsculpt.com | Cloudflare Pages |
| **Backend API** | https://traqooh-backend-python.onrender.com | Render (free) |
| **Health check** | https://traqooh-backend-python.onrender.com/health | Render |
| **API root** | https://traqooh-backend-python.onrender.com/ | Render |
| **API docs (Swagger)** | https://traqooh-backend-python.onrender.com/docs | FastAPI |

---

## Service Dashboards & Logins

All services use **saurabh.anand24@gmail.com** as login email.

| Service | Dashboard URL |
|---------|--------------|
| Render (backend hosting) | https://dashboard.render.com |
| Cloudflare (pages + R2 + DNS) | https://dash.cloudflare.com |
| Neon (PostgreSQL) | https://console.neon.tech |
| Resend (email OTP) | https://resend.com |
| Expo / EAS Builds | https://expo.dev/accounts/saurabh.anand24 |
| GitHub (monorepo, private) | https://github.com/saurabhanand0409/traqooh — backend, web app, field app and these docs |
| UptimeRobot (keep-alive) | https://uptimerobot.com |

---

## Keeping Render Alive (anti-sleep ping)

Render free tier **sleeps after 15 minutes of inactivity**. Cold start = ~50 seconds, very visible to field workers.

**Current setup:** UptimeRobot hits `/health` every 5 min. **Verified active** (2026-06-23: 4-min idle test → 1s wake = warm). The health endpoint always replies with version + timestamp.

```python
@app.get("/health")
def health_check():
    return {"status": "ok", "version": "2.1.0", "time": str(datetime.datetime.now())}
```

**Recommended next step (not yet done):** upgrade Render to **Starter ($7/mo)** for always-on (no sleeps). Walkthrough is in `OPERATIONS.md`.

---

## Third-Party Services

### 1. Neon PostgreSQL — Database
- **Project name:** frosty-wave-19683383
- **Region:** us-east-1 (AWS)
- **Host:** `ep-sweet-resonance-apqfv4vg.c-7.us-east-1.aws.neon.tech`
- **Database:** `neondb`
- **Free tier:** 0.5 GB storage, **10 concurrent connections** (this limit is real — under rapid parallel API calls we've hit `Internal Server Error` from exhaustion; intermittent and self-heals)
- **Env var on Render:** `DATABASE_URL` (URL-encoded password — see notes below)

**Password URL-encoding** (only matters when rotating):
- `@` → `%40`, `#` → `%23`, `!` → `%21`
- Update at: Render → traqooh-backend-python → Environment → `DATABASE_URL` → redeploy

**Useful SQL queries:** see `OPERATIONS.md`.

### 2. Render — Backend Hosting
- **Service name:** traqooh-backend-python
- **Plan:** Free (sleeps after 15 min)
- **Region:** Oregon (US West)
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Auto-deploy:** Yes — pushes to `main` branch redeploy automatically
- **Root directory:** `traqooh-backend-python` (the repo is the `traqooh` monorepo since 2026-10-03)

### 3. Cloudflare Pages — Frontend Hosting
- **Project:** traqooh-frontend
- **Custom domain:** app.brandsculpt.com
- **Deploy command:**
  ```bash
  cd traqooh-frontend
  npm run build
  npx wrangler pages deploy dist --project-name traqooh-frontend --branch main
  ```
- Wrangler auths via `wrangler login` (browser OAuth)

### 4. Cloudflare R2 — Photo, Video & Media Storage
- Used for: site cover photos, site library photos, execution proof photos, execution videos
- Compression on web: `src/utils/imageCompress.js` → max 1280 px wide, JPEG 0.75
- Videos upload **as-is** to preserve playable format
- Public domain: `https://pub-a80f750f955d44d1b642d35b2534766f.r2.dev`
- Env vars on Render: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`, `R2_PUBLIC_DOMAIN` (names as read in `utils.py`)

### 5. Resend — Email
**Status: ✅ ACTIVE** (configured 2026-06-18)
- API Key set on Render as `RESEND_API_KEY`
- From address: `noreply@brandsculpt.com` (set as `OTP_FROM_EMAIL`)
- DNS verified in Cloudflare → brandsculpt.com → DNS
- Domain status confirmed "Verified" in Resend dashboard
- **What it sends:**
  1. **6-digit OTP** to mobile app users (subject: `<code> — Your TraqOOH login code`)
  2. **Advertiser proposal link** (purpose=`proposal`)
  3. **Advertiser live-tracking link** (purpose=`live`) — "Your campaign is now live 🎉"
  4. **Advertiser update link** (purpose=`update`) — "New sites need your approval"

If `RESEND_API_KEY` is unset, the OTP/link is logged to Render console instead (fallback for local dev).

### 6. Expo / EAS — Android App Build
- **Expo account:** saurabh.anand24
- **Project:** https://expo.dev/accounts/saurabh.anand24/projects/traqooh-app
- **EAS Project ID:** f41cf806-a1de-4667-8a6c-07f9c68153ea
- **App package:** `com.brandsculpt.traqooh`
- **SDK Version:** 56.0.0
- **Build command (preview APK):**
  ```bash
  cd traqooh-app
  eas build --platform android --profile preview --non-interactive --no-wait
  ```
- **Latest successful build (2026-06-23):** `1cb3a574-083a-4d9e-b3bf-65275b15d730`
- **Quirk:** SDK 56 deprecated top-level `splash` in app.json. If you re-introduce it, the prebuild fails with "Field … splash … not permitted". Use the `expo-splash-screen` plugin instead, or omit.

---

## Backend Environment Variables (Render)

| Variable | Value / Source |
|----------|----------------|
| `DATABASE_URL` | Neon connection string with URL-encoded password |
| `JWT_SECRET` | Random 64-char hex — `openssl rand -hex 32` |
| `RESEND_API_KEY` | ✅ Set — `re_…` from resend.com → API Keys |
| `OTP_FROM_EMAIL` | `noreply@brandsculpt.com` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | Same as above |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_DOMAIN` | Public bucket URL; also used to turn a photo URL back into an R2 key for zips |
| `FRONTEND_URL` *(optional)* | Defaults to `https://app.brandsculpt.com` — used in advertiser email links |
| `SENTRY_DSN` *(optional)* | Backend error reporting; off when unset. Web uses `VITE_SENTRY_DSN` at build time |
| `REQUIRE_FIELD_AUTH` *(optional)* | `true` = uploads and my-sites need a field login. **Leave off until every worker has the new APK** |
| `EXPO_ACCESS_TOKEN` *(optional)* | Only if Expo push security is enabled on the project |

---

## Local Development

### Folder Structure
One git repo at the root (`traqooh`, pushed to GitHub). The three project folders no longer have their own `.git`; their earlier history is inside this repo, with a copy in `D:\Programming\eclipse-workspace\traqooh-git-backup-2026-10-03`. `Login details and url.jpg` and `backup/` are git-ignored on purpose.
```
D:\Programming\eclipse-workspace\traqooh\
├── CLAUDE.md                    ← this file
├── CHANGELOG.md                 ← session-by-session change log
├── OPERATIONS.md                ← runbook for deploys + diagnostics
├── traqooh-frontend\            ← React + Vite web app
├── traqooh-backend-python\      ← FastAPI backend
└── traqooh-app\                 ← Expo React Native Android app
```

### Start backend locally
```bash
cd traqooh-backend-python
pip install -r requirements.txt
uvicorn main:app --reload      # http://localhost:8000, Swagger at /docs
```

### Start frontend locally
```bash
cd traqooh-frontend
npm install
npm run dev                     # http://localhost:5173
# .env.local: VITE_API_BASE=http://localhost:8000 to hit local backend
```

### Start mobile app (Android emulator)
```bash
# 1. Android Studio → Virtual Device Manager → start Medium Phone API 35
# 2. If emulator off-screen: D:\Programming\fix-emulator.ps1
cd traqooh-app
npx expo start --port 8082
# 3. In another terminal:
adb -s emulator-5554 reverse tcp:8082 tcp:8082
# 4. In emulator: Ctrl+M → Change Bundle Location → localhost:8082 → Apply
```

---

## Tech Stack

### Frontend (`traqooh-frontend`)
| Layer | Technology |
|-------|-----------|
| Framework | React 18.3 |
| Build tool | Vite 5.4 |
| Styling | TailwindCSS 3.4 + design tokens in `src/index.css` |
| Routing | react-router-dom 7.9 |
| Charts | Recharts 3.8 |
| Maps | Leaflet 1.9 + react-leaflet 5.0 |
| Icons | lucide-react 0.561 |
| Fonts | Syne 800 (headings), Inter 400/500/600 (body) — Google Fonts |
| Auth | JWT in `localStorage` as `tq_user.token` |
| API client | `src/utils/apiFetch.js` — auto-injects Bearer token; *skips* Content-Type when body is FormData |
| Image compression | `src/utils/imageCompress.js` — canvas resize 1280 px / JPEG 0.75 |

### Backend (`traqooh-backend-python`)
| Layer | Technology |
|-------|-----------|
| Framework | FastAPI |
| Server | Uvicorn |
| ORM | SQLAlchemy |
| DB driver | psycopg2-binary |
| Auth | python-jose[cryptography] — JWT HS256, 7-day expiry |
| Password hash | passlib + bcrypt |
| Rate limiting | slowapi (10/min login, 5/min OTP) |
| S3/R2 upload | boto3 (preserves uploaded Content-Type — works for both images and videos) |
| HTTP client | httpx |
| Email | Resend HTTP API via httpx |

### Mobile (`traqooh-app`)
| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 56 (React Native) |
| Platform | Android (APK via EAS) |
| Location | expo-location (GPS) |
| Media picker | expo-image-picker 16.1.x — **uses array API `mediaTypes: ['images','videos']`** (MediaTypeOptions is deprecated in this version) |
| Build | EAS Build (cloud, no local Android SDK needed) |

### Infrastructure
| Layer | Technology |
|-------|-----------|
| Frontend hosting | Cloudflare Pages (free) |
| Backend hosting | Render free tier (sleeps; UptimeRobot keeps warm) |
| Database | Neon PostgreSQL free tier (0.5 GB) |
| Media storage | Cloudflare R2 (10 GB free, egress free) |
| Mobile build | EAS, 30 builds/month free |
| Keep-alive | UptimeRobot — pings /health every 5 min |
| DNS | Cloudflare (brandsculpt.com) |

---

## Authentication & Security

### JWT Flow
1. User logs in via one of 4 methods (email+pwd / OTP / field PIN / advertiser login)
2. Backend creates JWT via `jwt_utils.py` containing: `userId`, `email`, `role`, `companyId`, `vendorId`, `advertiserId`, `displayName`, `workerName`
3. JWT stored as `JSON.parse(localStorage.getItem("tq_user")).token`
4. Every protected call sends `Authorization: Bearer <token>` via `apiFetch`
5. Backend validates token on protected routes via `Depends(get_current_user)`
6. JWT expires after **7 days**

### Login Methods
| Method | Endpoint | Who uses it |
|--------|---------|-------------|
| Email + password | `POST /api/auth/login` | Admin, Employee, Advertiser, Super Admin |
| OTP (email → 6-digit) | `POST /api/auth/send-otp` + `POST /api/auth/verify-otp` | Mobile app users |
| Field PIN (4-digit) | `POST /api/auth/field-login` | Field workers on mobile |
| Mobile email+pwd | `POST /api/mobile/login` | Alias of /api/auth/login |

### Security Measures
- Rate limiting: 10 req/min on login, 5 req/min on OTP (slowapi)
- CORS allowed origins: `app.brandsculpt.com`, `traqooh.brandsculpt.com`, `localhost:5173/3000`, `127.0.0.1:5173`
- Passwords: bcrypt-hashed
- Access link tokens: SHA-256 hashed in DB; plaintext never persisted
- `JWT_SECRET`: 64-char random hex env var

---

## User Roles

| Role | Login Page | Dashboard | Access Level |
|------|-----------|-----------|--------------|
| `SUPER_ADMIN` | `/masterlogin` | `/dashboard/master` | All companies, all data |
| `ADMIN` | `/adminlogin` | `/dashboard/admin` | Own company — full CRUD |
| `EMPLOYEE` | `/employeelogin` | `/dashboard/employee` | **Now sees all sites globally** (changed 2026-06-23). Campaigns scoped to own/shared. |
| `ADVERTISER` | `/login` | `/dashboard/advertiser` | Own campaigns + proof photos |
| `FIELD` (mobile only) | App / PIN | App home | Sites assigned to their worker_name, or browse all of their vendor's |

### What changed about EMPLOYEE access in this session
- **Inventory:** default to "All Vendors" (not own company). Vendor dropdown still lets them filter.
- **Dashboard summary:** unscoped — sees global site/vendor/booked-value counts.
- **Reports:** unscoped.
- **Campaigns picker:** already global; no change.
- **Campaign list:** still scoped to campaigns they created or are shared with (correct).

The intent is: **employees can plan campaigns across every vendor's inventory** but only see *their own* campaigns in the campaigns list (until shared with them).

---

## Database Schema

### Tables Overview
```
otp_tokens                      ← 6-digit OTPs for mobile login
companies                       ← Media-owner / vendor companies
gst_registrations               ← GST details per company
contacts                        ← Contacts per GST registration
user_accounts                   ← All logins (admin / employee / advertiser / super)
sites                           ← Billboard / hoarding inventory
site_images                     ← Per-site photo gallery (multiple, one primary)
advertisers                     ← Advertiser company profiles
advertiser_access_links         ← Secure 7-day token links
advertiser_company_links        ← M:M advertiser ↔ company
advertiser_shares               ← Employees an advertiser has been shared with
campaigns                       ← OOH ad campaigns
campaign_site_assignments       ← Which sites are booked for which campaign
campaign_shares                 ← Employees a campaign has been shared with
site_audits                     ← Scheduled audits (START/MID/END/EXTRA)
campaign_activities             ← Execution log (PRINT/MOUNTING/AUDIT/...) with photos/videos
activity_log                    ← System-wide audit trail
field_pins                      ← 4-digit PINs for field workers (30-day expiry)
```

### Key relationships
```
companies (1) ──→ (many) sites              via sites.owner_company_id
companies (1) ──→ (many) user_accounts      via user_accounts.vendor_id
advertisers (1) → (many) campaigns          via campaigns.advertiser_id
advertisers (1) → (many) user_accounts      via user_accounts.advertiser_id
campaigns (1) ──→ (many) campaign_site_assignments
campaigns (1) ──→ (many) campaign_activities
sites (1) ──────→ (many) campaign_site_assignments
sites (1) ──────→ (many) campaign_activities
sites (1) ──────→ (many) site_images
```

### `campaign_site_assignments` — important columns
```sql
id, campaign_id, site_id
booked_from, booked_till, agreed_cost, unit_cost
status                  -- PLANNED | ACTIVE | COMPLETED | CANCELLED
notes

-- Advertiser shortlist (filled when advertiser opens proposal link)
is_shortlisted          BOOLEAN
final_start_date        DATE
final_end_date          DATE
printing_type           VARCHAR
printing_cost           FLOAT  -- total ₹ (per-row); admin enters as ₹/sqft and we compute
mounting_cost           FLOAT  -- same
other_cost              FLOAT
execution_remarks       TEXT

-- Field-worker monitoring assignment (added 2026-06-16)
monitor_worker_name     VARCHAR  -- stable match key; survives PIN re-issue
monitor_field_pin_id    INTEGER  -- the PIN chosen at assignment time

-- Re-approval flow (added 2026-06-18)
pending_approval        BOOLEAN  -- true for sites added AFTER finalize; cleared by advertiser re-finalize
```

### `campaigns.status` — workflow values
```
DRAFT → PLANNED → FINALIZED → RUNNING → COMPLETE
                                    └→ CANCELLED (any time)
```
**Hybrid auto-advance** (see `routes/campaigns.py::auto_advance_status`):
- `FINALIZED` + `start_date ≤ today` → `RUNNING`
- `FINALIZED|RUNNING` + `end_date < today` → `COMPLETE`
- Never touches `DRAFT`, `PLANNED`, `COMPLETE`, `CANCELLED` (manual admin overrides are preserved)
- Forward-only; never downgrades

Pre-migration legacy values `LIVE` / `COMPLETED` were renamed to `RUNNING` / `COMPLETE` in a startup migration; the frontend still recognizes the old names as aliases for safety.

### `campaign_activities` — important columns
```sql
activity_type     -- PRINT | REPRINT | MOUNTING | AUDIT | MAINTENANCE | TAKEDOWN | START | END
status            -- PENDING | DONE | VERIFIED | REJECTED ("needs retake"; hidden from advertisers, counts, zips)
image_urls        -- JSON array of R2 URLs (mixed: .jpg / .png / .mp4 / .mov etc)
image_labels      -- JSON {url: "close-up" | "wide" | "landmark" | "video"}
latitude, longitude   -- GPS where photo was taken (null for web uploads)
gps_accuracy_m    -- phone-reported accuracy
captured_at       -- when the phone took it (UTC); prefer over created_at everywhere
client_visit_id   -- unique; makes offline retries idempotent
review_note, reviewed_by, reviewed_at  -- set on VERIFIED / REJECTED
source            -- web | mobile
```

**Phase grouping for the Monitoring board** (`_PHASE_MAP` in routes/campaigns.py):
```
START phase  ← START, MOUNTING, PRINT, REPRINT
MID phase    ← AUDIT, MAINTENANCE         (shown as the "Audit" column since 2026-09-26)
END phase    ← END, TAKEDOWN
```
Mid is hidden in the web UI but the data model still groups into it (so existing AUDIT entries don't disappear from queries).

### `site_images` — per-site photo library
```sql
id, site_id, image_url, caption, is_primary, created_at
```
- Multiple per site
- Exactly one `is_primary = true` (the "cover" / face shown in lists & on inventory cards)
- `Site.image_url` is kept in sync with the primary (legacy field; many list views still read it)
- Legacy single-image sites auto-import into the gallery on first GET (no migration script needed)

### `field_pins`
```sql
id, pin (4-digit), vendor_id, created_by_admin_email, worker_name, is_active, expires_at, created_at
```
- 30-day expiry (was 72 hours until 2026-09-26); field-login issues a matching 30-day JWT (other roles stay 7 days)
- The **worker_name** is the stable identifier for site assignment (re-issuing a PIN with the same name keeps assignments intact)

---

## Frontend Page Map

| URL | File | Roles | Notes |
|-----|------|-------|-------|
| `/` | redirect | all | → https://traqooh.brandsculpt.com |
| `/login` | AdvertiserLogin.jsx | ADVERTISER | Email + password |
| `/employeelogin` | EmployeeLogin.jsx | EMPLOYEE | Email + password |
| `/adminlogin` | AdminLogin.jsx | ADMIN | Email + password |
| `/masterlogin` | MasterLogin.jsx | SUPER_ADMIN | Email + password |
| `/dashboard/employee` | Dashboard.jsx | EMPLOYEE, ADMIN | **Now shows global KPIs** (was scoped). |
| `/dashboard/admin` | AdminDashboard.jsx | ADMIN | Tabs: overview, employees, vendors, inventory, campaigns, advertisers, field PINs |
| `/dashboard/master` | MasterDashboard.jsx | SUPER_ADMIN | All companies |
| `/dashboard/advertiser` | AdvertiserDashboard.jsx | ADVERTISER | Campaigns + proofs (video-aware) |
| `/inventory` | Inventory.jsx | EMPLOYEE, ADMIN | Default "All Vendors"; **per-site photo gallery with cover selection** in Edit modal |
| `/campaigns` | Campaigns.jsx | EMPLOYEE, ADMIN | Lifecycle mgmt; Monitoring tab shows whenever any site is linked |
| `/campaigns/:id` | CampaignDetail.jsx | EMPLOYEE, ADMIN | Activity log, photo upload |
| `/advertisers` | Advertisers.jsx | EMPLOYEE, ADMIN | hasLogin badge; Account vs Link-only modes |
| `/vendors` | Vendors.jsx | EMPLOYEE, ADMIN | Edit/delete admin-only |
| `/activities` | Activities.jsx | EMPLOYEE, ADMIN | Global execution log; filter + photo lightbox |
| `/reports` | Reports.jsx | EMPLOYEE, ADMIN | Global analytics (now unscoped for employees) |
| `/access/:token` | AccessView.jsx | public | Token-based advertiser portal — **read-only**; auto-saves shortlist on heart-toggle; evolves into Live Tracking view when campaign is FINALIZED+ |
| `/account` | Account.jsx | all | User profile |

---

## Campaign Panel — Tabs (Campaigns.jsx)

Opens as a modal-panel from `/campaigns`. Tab order:
1. **Linked Sites** — current assignments + inline cost editing (per-sqft for Media / Printing / Mounting)
2. **Add Sites** — picker with vendor/state/city/type filters
3. **Monitoring** — shown whenever the campaign has ≥1 assignment (NOT gated on status anymore)
   - Per-site card with header, GPS map link, "Field access" dropdown + inline "+ New" PIN creation
   - **Start / Install**, **Audit** and **End / Takedown** columns; web uploads to Audit are logged as `AUDIT`
   - Photos captured more than 250 m from the site's GPS get an amber "off-site" badge (`distanceM` / `offSite` from the monitoring endpoint)
   - "Proof of Display Report" download: every approved site with its photos, capture time, GPS, distance and verified state
   - Photos + videos clickable into lightbox with GPS / date-time / metadata
   - Verify ✓ tick per photo (toggles DONE ↔ VERIFIED)
   - "Send live link" button → emails advertiser a `purpose=live` link
   - Pending-approval banner with "Ask advertiser to approve" → emails `purpose=update` link
   - "Finalized Cost Sheet" download (PDF with finalized rows only)
4. **Share** — open to **all roles** (was admin-only); share with colleagues

---

## Advertiser-side flows

### Three email purposes (Resend)
Endpoint: `POST /api/advertisers/send-access-link` with `purpose` body field.

| purpose | Subject | When triggered |
|--------|---------|----------------|
| `proposal` (default) | "Your Campaign Proposal — {name}" | When admin/employee shares the campaign for shortlisting |
| `live` | "Your Campaign is Now Live — {name}" | Manually after the campaign is FINALIZED — by "Send live link" button on Monitoring |
| `update` | "New Sites Added — Please Review — {name}" | When sites added post-finalize and admin clicks "Ask advertiser to approve" |

### The "one evolving link" model
The same token works for the whole campaign lifecycle. The AccessView page reads `campaign.status`:
- Before FINALIZED → shows **Proposal** view (browse + shortlist + finalize)
- FINALIZED/RUNNING/COMPLETE → defaults to **Live Tracking** tab (Start/End photo gallery per site)
- Pending-approval sites get a **NEW · Approve** badge and a top banner

### What the advertiser CAN'T do (per user requirement)
- Edit dates
- Edit costs (printing/mounting/other)
- Bulk-apply rates
- Save/Save-Draft buttons (removed — shortlist auto-saves on heart toggle)

### What they CAN do
- Toggle heart to shortlist
- Click photos for full-screen view
- Download cost sheet PDF (read-only)
- Finalize (which doubles as "approve new sites")

---

## Mobile App Flows

### Field worker login (PIN)
1. Admin creates 4-digit PIN with `workerName` in `/dashboard/admin → Field PINs` (or inline `+ New` on the Monitoring board)
2. Worker opens app → enters PIN → JWT issued with `role=FIELD`, `vendorId`, `workerName`

### Field worker home — two modes (toggle at top)
- **📋 My Assigned Sites** *(default for field workers)* — `GET /api/mobile/my-sites?worker=<name>` — sites where `monitor_worker_name = worker_name`, with photo counts per phase
- **🗺️ All Sites** — falls back to `GET /api/sites?owner_id=<vendorId>` (their company's full inventory)

### Site detail — photo / video capture
- Single picker handles both images and videos
- Camera capture: 60-second cap on video
- Uses SDK 56 array API: `mediaTypes: ['images', 'videos']`
- Asset detected as video when `asset.type === 'video' || asset.duration != null`
- Upload posts to `/api/activities/mobile/log` which auto-discovers the active campaign for the site (or accepts explicit campaignId/assignmentId from "My Assigned Sites")

### Photo viewer — GPS detail popup
Tap any photo → full-screen modal with:
- Date/day/time of capture
- GPS coordinates (lat/lng with 6 decimal precision)
- "Open location in Google Maps →" button
- Photographer name (`performedBy`)
- Activity type
- Notes

---

## Backend Route Map

### Auth (`main.py`)
| Method + Path | Description |
|---------------|-------------|
| `POST /api/auth/login` | Email + password → JWT |
| `POST /api/mobile/login` | Alias |
| `POST /api/auth/send-otp` | Send 6-digit OTP via Resend (rate: 5/min) |
| `POST /api/auth/verify-otp` | Verify OTP → JWT |
| `POST /api/auth/field-login` | 4-digit field PIN → JWT |
| `GET /health` | UptimeRobot's keep-alive target |

### Sites (`main.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/sites` | List sites; `?ownerId=`, `?vendorId=`, `?city=`, `?state=`, `?siteType=` |
| `GET /api/mobile/sites` | Same handler (alias) |
| `GET /api/sites/{id}` | Single site |
| `POST /api/sites` | Create |
| `PUT /api/sites/{id}` | Update |
| `DELETE /api/sites/{id}` | Delete |
| `GET /api/sites/nearby` | GPS-based |
| `GET /api/sites/{id}/gallery` | Activity-photos for the site (grouped by Install/Monitor/End) — *legacy* |
| `GET /api/sites/{id}/images` | **New** — per-site photo library (primary first); auto-imports legacy `Site.image_url` |
| `POST /api/sites/{id}/images` | **New** — upload to library; first photo or `setAsPrimary=true` becomes cover |
| `POST /api/sites/{id}/images/{img_id}/set-primary` | **New** — swap the cover (syncs `Site.image_url`) |
| `DELETE /api/sites/{id}/images/{img_id}` | **New** — remove; promotes next-newest if cover deleted |
| `GET /api/sites/{id}/bookings` | Booking history |
| `POST /api/upload`, `POST /api/mobile/upload` | Generic R2 upload, returns URL |

### Campaigns (`routes/campaigns.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/campaigns` | List; filtered for EMPLOYEE by created-by + shares |
| `GET /api/campaigns/{id}` | Detail with assignments |
| `POST /api/campaigns` | Create |
| `PUT /api/campaigns/{id}` | Update |
| `DELETE /api/campaigns/{id}` | Delete (cascade campaign_shares) |
| `POST /api/campaigns/{id}/assign-site` | Single site — flags `pending_approval` if campaign is FINALIZED+ |
| `POST /api/campaigns/{id}/assign-sites-bulk` | Bulk — same pending logic |
| `DELETE /api/campaigns/{id}/remove-site/{aid}` | Unlink |
| `PUT /api/campaigns/{id}/assignment/{aid}` | Update assignment (costs, dates, monitor worker, **monitor_field_pin_id**) |
| `GET /api/campaigns/{id}/monitoring` | **New** — finalized sites + Start/Mid/End photos + available workers |
| `POST /api/campaigns/{id}/share` | Now open to **all roles** |
| `DELETE /api/campaigns/{id}/share/{user_id}` | Remove share |
| `GET /api/campaigns/{id}/shares` | List shares |

### Activities (`routes/activities.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/activities` | List; filter `?campaignId=`, `?siteId=`, `?activityType=`, `?status=` |
| `GET /api/activities/{id}` | Single |
| `POST /api/activities` | Create (no auth required) |
| `PUT /api/activities/{id}` | Update (used to flip status to VERIFIED) |
| `DELETE /api/activities/{id}` | Delete |
| `POST /api/activities/{id}/upload-image` | Attach photo/video to R2 (preserves Content-Type) |
| `DELETE /api/activities/{id}/image` | Remove |
| `GET /api/activities/campaign/{id}/timeline` | Chronological |
| `POST /api/activities/mobile/log` | One-shot: create activity + auto-discover campaign + upload photo/video |

### Advertisers (`routes/advertisers.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/advertisers` | Includes `hasLogin` per row |
| `GET /api/advertisers/me/dashboard` | Logged-in advertiser's dashboard |
| `GET /api/advertisers/{id}` | Single |
| `POST /api/advertisers` | Create |
| `PUT /api/advertisers/{id}` | Update |
| `DELETE /api/advertisers/{id}` | Delete |
| `POST /api/advertisers/create-login` | Provision login |
| `POST /api/advertisers/send-access-link` | Generate token + **email link** with `purpose` (`proposal`/`live`/`update`) |
| `POST /api/advertisers/validate-token` | Validate access link |
| `POST /api/advertisers/revoke-link/{id}` | Revoke |
| `POST /api/advertisers/{id}/share` | Share with employees |
| `DELETE /api/advertisers/{id}/share/{uid}` | Unshare |
| `GET /api/advertisers/{id}/shares` | List shares |

### Access (`main.py`) — public token-gated for advertiser portal
| Method + Path | Description |
|---------------|-------------|
| `GET /api/access/{token}` | Hydrate advertiser proposal/live view — includes **phase-grouped proof photos** per site |
| `POST /api/access/{token}/shortlist` | Save shortlist toggles (auto-called on every heart click) |
| `POST /api/access/{token}/finalize` | Finalize → advance status + clear `pending_approval` on newly-shortlisted sites |

### Admin (`routes/admin.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/admin/media-users` | Employees in a company |
| `POST /api/admin/media-users` | Create employee |
| `PUT /api/admin/media-users/{id}` | Update |
| `DELETE /api/admin/media-users/{id}` | Delete |
| `POST /api/admin/create-super-admin` | Bootstrap |
| `POST /api/admin/create-admin` | Create company admin |
| `GET /api/admin/field-pins` | List PINs |
| `POST /api/admin/field-pins` | Create 4-digit PIN (30-day expiry) |
| `DELETE /api/admin/field-pins/{id}` | Revoke |

### Mobile-specific (`main.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/mobile/my-sites?worker=<name>` | Sites assigned to a field worker with per-phase photo counts and `retakes`; the field token's workerName wins over `?worker=` |
| `POST /api/mobile/push-token` / `DELETE` | Register / remove an Expo push token (field login only; stores language) |
| `GET /api/campaigns/{id}/photos.zip` | Staff: all accepted proof photos, folders per site and phase, plus `index.csv` |
| `GET /api/access/{token}/photos.zip` | Same, for the advertiser access link |
| `GET /api/dashboard/launch-metrics` | Launch KPIs + proofs per month by phase |

### Dashboard (`routes/dashboard.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/dashboard/summary` | KPIs; `?ownerCompanyId=` for scoped view (frontend now sends **without** this for employees) |
| `GET /api/dashboard/recent-activity` | Last 20 entries |
| `GET /api/dashboard/advertiser-summary/{id}` | Advertiser KPIs |

### Vendors (`routes/vendors.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/vendors`, `/api/vendors/{id}` | List / detail |
| `POST/PUT/DELETE /api/vendors[/{id}]` | CRUD |
| `POST /api/vendors/{id}/set-admin` | Assign admin |
| `GET /api/vendors/{id}/employees` | Employees |
| `GET /api/vendors/{id}/sites` | Sites |

### Audits (`routes/audits.py`)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/audits`, `/api/audits/{id}` | List / detail |
| `POST/PUT /api/audits[/{id}]` | CRUD |
| `POST /api/audits/{id}/upload-image` | Photo |

---

## Design System

### CSS variables (`src/index.css`)
```
--bg:       #070C1A   ← page background
--nav:      #0B1120   ← sidebar / nav background
--sidebar:  #0D1428   ← card / modal background
--card:     rgba(255,255,255,0.04) ← glass card background
--border:   rgba(255,255,255,0.08) ← all borders
--blue:     #2563EB   ← primary blue
--blue2:    #3B82F6
--red:      #DC143C   ← accent red
--green:    #22C55E   ← success / vacant
--orange:   #F59E0B   ← warning / upcoming
--gray:     #9CA3AF   ← secondary text
--gray2:    #6B7280   ← muted / labels
```

### Brand Gradient
```css
background: linear-gradient(135deg, #2563EB, #DC143C);
```
Used on logo, primary buttons, progress bars.

### Critical CSS rule for dropdowns
```css
select option,
select.tq-input option { background: #0D1428; color: #F9FAFB; }
```
Without this, Windows Chrome renders `<option>` elements with white background (OS-native), making white text invisible.

### Utility classes
- `.glass` — dark glass card
- `.tq-input` — dark form input
- `.font-syne` — Syne (headings)
- `.brand-gradient-text` — blue→red gradient text
- Status badges: `.badge-live`, `.badge-draft`, `.badge-planned`, `.badge-sent`, `.badge-confirmed`, `.badge-completed`, `.badge-vacant`, `.badge-booked`, `.badge-pending`, `.badge-done`, `.badge-verified`

### Design rules (enforce)
- All protected pages wrap content in `<AppShell user={user}>`
- **Never use white/light backgrounds** — no `bg-white`, `bg-gray-50`, `bg-gray-100`
- Dark modals: `background: "#0D1428"`, `border: "1px solid var(--border)"`
- Table headers: `text-[10px] font-bold uppercase tracking-wider` in `var(--gray2)`
- Primary buttons: brand gradient
- Cancel buttons: `rgba(255,255,255,0.06)` + `var(--gray)` text
- Headings: `font-syne font-bold text-xl text-white`
- Form labels: `text-[10px] font-bold uppercase tracking-wider` in `var(--gray2)`
- Error boxes: `rgba(220,20,60,0.12)` bg, `rgba(220,20,60,0.3)` border, `#F87171` text

---

## Sidebar Navigation (AppShell.jsx)
```
Main
  Dashboard   → /dashboard   (resolves by role)
  Inventory   → /inventory
  Campaigns   → /campaigns

Connections
  Advertisers → /advertisers
  Vendors     → /vendors

Execution
  Activities  → /activities
  Reports     → /reports
```

---

## Features Built (current state)

### Web App — Internal (Admin/Employee)
- Multi-role JWT auth
- **Master Dashboard, Admin Dashboard (8 tabs), Employee Dashboard (now global)**
- **Inventory** with site CRUD, **per-site photo gallery with cover selection**, multi-image upload; expanded **branding types** (Billboard, Hoarding, Unipole, LED, Digital Screen, Wall Wrap, Pole Kiosk, Gantry, Transit, Bus Shelter, Mall Media + "Other (specify)…")
- List + Leaflet Map view with color-coded pins
- **Campaigns** with hybrid status workflow (DRAFT→PLANNED→FINALIZED→RUNNING→COMPLETE, +CANCELLED)
- **Monitoring board** (per-site Start/End photo columns, field-worker assignment + inline PIN creation, photo+video upload, verify-tick, lightbox with GPS detail)
- **Finalized Cost Sheet** PDF download
- **Per-sqft cost editing** for Media / Printing / Mounting (explicit column labels)
- **Re-approval flow** for sites added after finalize (with optional advertiser email)
- **Share campaigns / advertisers** with colleagues (open to all roles)
- **Activities** — global filterable execution log with photo + video lightbox
- **Reports** — global KPIs (now unscoped)
- Image compression on uploads (canvas resize, ~5× smaller)
- Video upload as-is (preserves playable Content-Type)

### Web App — Advertiser Portal
- Standalone `/dashboard/advertiser` (logged-in)
- KPI row: campaigns, live count, sites booked, total spend
- Campaign cards with status badge + date progress bar
- Site-level proof photo + **video** gallery, lightbox-zoomable
- GPS map links per proof
- **Public access link** `/access/:token` — read-only — multi-photo site gallery in the detail modal, video-aware lightbox, shortlist auto-saves on heart toggle, evolves into Live Tracking view when finalized

### Mobile App (Android)
- OTP login (Resend email delivery active)
- Field PIN login (4-digit, 30-day expiry, worker-name-based assignment persistence)
- GPS-based nearby sites discovery
- **My Assigned Sites / All Sites toggle** (default to assigned for field workers)
- Site detail: rate, size, lighting, map link
- **Photo + Video capture** (camera or gallery), 60s video cap
- **Photo viewer with full GPS metadata** (lat/lng/Maps link/date/time/photographer/notes)
- One-shot activity logging: `POST /api/activities/mobile/log` (auto-discovers active campaign)
- Sign out

---

## Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Backend returns `Internal Server Error` intermittently | Neon free tier 10-connection limit exhausted under rapid parallel calls | Retry with backoff; consider Neon Launch ($19/mo); upgrade Render to Starter ($7/mo) which reduces connection thrash |
| Render takes 50s to respond | Free tier cold start | Already mitigated by UptimeRobot; eliminate by upgrading to Starter |
| OTP not delivered | `RESEND_API_KEY` missing or domain unverified | Check Render env vars; check Resend dashboard domain status (should be Verified for brandsculpt.com) |
| Dropdown shows white-on-white text | OS-native `<option>` styling | Already fixed via global CSS rule (`select option { background:#0D1428; color:#F9FAFB }`) — don't remove |
| **Photo upload "did nothing"** | `e.target.value = ""` cleared the FileList before async upload could iterate | Already fixed in Campaigns.jsx + Inventory.jsx — copy via `Array.from(e.target.files)` BEFORE clearing |
| Display Cost shows ₹0 on cost sheet | `agreedCost` not set on assignments | Already handled — falls back to `site.potentialMonthly` (rate card) |
| Monitoring tab missing | Used to be gated on FINALIZED+ | Already fixed — shows whenever campaign has ≥1 linked site |
| Employee sees only their own 1 site | Inventory + Dashboard scoped to `user.companyId` | Already fixed — defaults to "All Vendors" / global summary |
| `DATABASE_URL` broken after Neon password rotation | Special chars `@#!` not URL-encoded | Encode: `@`→`%40`, `#`→`%23`, `!`→`%21`; update Render env var |
| EAS Android build fails at Prebuild with `splash not permitted` | SDK 56 deprecated top-level `splash` key | Already removed from app.json. If re-adding splash, use `expo-splash-screen` plugin |
| EAS Android build fails with `adaptive-icon.png not found` | File missing from `assets/` | All icons currently committed; verify with `ls assets/` |
| New APK won't open ("clear cache" prompt) | Old app's data conflicts with new build's signing/version | Uninstall old TraqOOH first, then install fresh; or Settings → Apps → TraqOOH → Clear storage |
| Emulator off-screen on multi-monitor Windows | Windows display glitch | Run `D:\Programming\fix-emulator.ps1` |
| Metro port 8081 blocked | Apache/EDB on that port | Use `--port 8082` + `adb reverse tcp:8082 tcp:8082` |
| Photo doesn't show after upload but no error | Was the FileList bug — verify the Inventory/Campaigns fix is in the deployed bundle by searching for `Array.from(.target.files` |

---

## Scaling & Cost Reference

| Stage | Photos/mo | Render | Neon | R2 | Total |
|-------|-----------|--------|------|----|-------|
| Launch (now) | 0–200 | Free | Free | Free | **$0/mo** (cold starts hurt) |
| Recommended go-live | 0–600 | $7 (Starter) | Free | Free | **$7/mo** ← do this before pilot |
| Growth | 600–1,500 | $25 (Standard) | Free | ~$0.12 | **~$25/mo** |
| Scale | 1,500–2,500 | $25 | $19 (Launch) | ~$0.75 | **~$45/mo** |

---

## Status of must-do items (2026-06-23)

| # | Item | Status |
|---|------|--------|
| 1 | OTP delivery via Resend | ✅ Endpoint returns 200; 3 test OTPs sent to saurabh.anand24@gmail.com (user inbox verification pending) |
| 2 | Employees see all 116 sites | ✅ Backend + frontend deployed & verified |
| 3 | Photo upload pipeline | ✅ FileList fix verified in live bundle, end-to-end test passed |
| 4 | Android EAS build | ✅ Build `1cb3a574-083a-4d9e-b3bf-65275b15d730` Finished — APK ready |
| 5 | Render Starter upgrade | 📋 Walkthrough provided; user action pending |
| 6 | UptimeRobot keep-alive | ✅ Verified active (4-min idle → 1.0s wake, no cold start) |

---

## Pending / TODO

### Strongly recommended before general launch
- [ ] Upgrade Render to Starter ($7/mo) — kills cold starts
- [ ] One pilot campaign end-to-end (employee + advertiser + field worker)
- [ ] Verify Neon free tier daily backup is enabled (7-day PITR)
- [ ] Privacy policy + terms page (needed for Play Store submission)

### Nice-to-have
- [ ] Publish Android app to Google Play Store
- [ ] Add site photo upload in mobile app (currently web-only)
- [ ] Invoice / billing module
- [ ] **Razorpay** payment gateway integration (preferred over Dodo for Indian B2B / UPI / GST)
- [ ] WhatsApp notification integration (Twilio or Meta Cloud API)
- [ ] Campaign approval workflow (submit → approve/reject)
- [x] Error monitoring — Sentry wired (backend + web); needs `SENTRY_DSN` / `VITE_SENTRY_DSN`
- [ ] Auto-archive expired field PINs (cleanup job)

### Future architectural considerations
- Vendor-level direct logins (vendors as users, not just companies)
- Multi-tenant isolation hardening as user count grows
- Read replicas / connection pooler if Neon limits become painful
