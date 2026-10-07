# TraqOOH — Complete Project Reference

> **For future Claude sessions:** this file is the single source of truth on what TraqOOH does and how it's built today. Companion files: `CHANGELOG.md` (chronological history of every change) and `OPERATIONS.md` (deploy commands, env vars, diagnostic recipes). Read all three before making changes.
>
> **Long-term direction (TraqOOH → TraqAdvt):** see `strategy/README.md`. Before any product or architecture change, check `strategy/TRAQADVT_DECISIONS.md`; most entries there are still *proposed* until the founder approves them.

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
  npm run deploy        # = vite build + npx wrangler pages deploy dist --project-name traqooh-frontend --branch main
  ```
  Run it from `traqooh-frontend` (wrangler looks for `dist` in the current folder).
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
- **Latest successful build (2026-06-23):** `1cb3a574-083a-4d9e-b3bf-65275b15d730` (v1; it sends no login token, so it stopped working with the 2026-10-03 API lockdown)
- **App v2 (2.0.0, 2026-10-04):** code done and tested in Expo Go on an emulator; APK not built yet. Push stays off until `google-services.json` is added (see `OPERATIONS.md` §1).
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
| `REQUIRE_FIELD_AUTH` *(optional)* | Defaults to **on**: field uploads and my-sites need the worker's login token. Set `false` only to keep a pre-October APK working (it doesn't send the token) |
| `ALLOW_PUBLIC_SIGNUP` *(optional)* | Defaults to off. `true` lets anyone self-register a company Admin/Media Owner account |
| `EXPO_ACCESS_TOKEN` *(optional)* | Only if Expo push security is enabled on the project |
| `JOB_WORKER` *(optional)* | Defaults to on: background thread that runs queued jobs (ProofLock photo checks). `off` disables it |

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
| Image compression | `src/utils/imageCompress.js` — canvas resize 1280 px / JPEG 0.75 (site photos); proof photos: `src/utils/photoUpload.js` `shrinkPhoto` — 2048 px long side / JPEG 0.82 |
| Proof uploader | `src/components/ProofUploader.jsx` — drag & drop / paste / browse, EXIF time + GPS (`exifr`), HEIC → JPEG (`heic2any`), both loaded on demand; 3 uploads at a time with progress (XHR) and per-file retry |
| npm | `.npmrc` sets `legacy-peer-deps=true` (react-leaflet 5 declares React 19; the app runs 18). Without it `npm ci` fails with ERESOLVE |

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
| Camera | expo-image-picker 56.0.x — proof photos only via `launchCameraAsync` (`mediaTypes: ['images']` / `['videos']`); no gallery picker |
| Files | expo-file-system 56 (`File` / `Directory` / `Paths` API) — photos are copied into app storage until uploaded. **SDK 56's `fetch` only takes Blob-like files: append `new File(uri)` to FormData, never `{ uri, name, type }`** |
| Config | expo-constants; `app.config.js` extends `app.json` and turns push on only when `google-services.json` exists |
| Push | expo-notifications (loaded only when push is on; not available in Expo Go on Android) |
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
- `JWT_SECRET`: 64-char random hex env var. On Render (`RENDER=true`) the backend refuses to start without it, so a missing secret can never fall back to the built-in dev secret.

### Who may call what (since 2026-10-03)
Every endpoint that reads or changes data needs a login with the right role (`jwt_utils.py` gates: `require_staff`, `require_admin`, `require_staff_or_field`, `require_field`). Before this, ~40 endpoints had no check at all.

| Caller | Allowed |
|--------|---------|
| Anonymous | `/health`, `/api/auth/*` (login, OTP, field PIN), `POST /api/auth/register-advertiser`, token-link portal `/api/access/{token}/*`, `/api/advertisers/validate-token`, `GET /api/sites/{id}/images` (hoarding photos shown on the portal) |
| ADVERTISER (logged in) | `/api/advertisers/me/dashboard` only |
| FIELD (PIN login) | site reads (`/api/sites*`, `/api/mobile/sites`), `/api/mobile/my-sites`, `/api/activities/mobile/log`, `/api/upload`, push-token |
| Staff (EMPLOYEE, TEAM_MEMBER, MEDIA_OWNER) | campaigns, advertisers, vendors, activities, audits, dashboard, sites, field PINs, uploads |
| ADMIN / SUPER_ADMIN | all of the above + `/api/admin/media-users`, `/api/admin/employees`, vendor `set-admin` |
| SUPER_ADMIN only | `/api/admin/create-super-admin`, `/api/admin/create-admin` |

- Uploads accept photos, videos and PDFs only (no HTML/SVG), 100 MB max, folder names sanitized (`utils._check_upload`).
- `/api/proof/*` (photo-check review queue, results, re-check) is staff-only. Field PINs of kind `CHECKER` can only be created by an ADMIN / SUPER_ADMIN.
- **Company sign-up (`POST /api/auth/register`) is invitation-only** (returns 403) until data separation exists; set `ALLOW_PUBLIC_SIGNUP=true` on Render to reopen. Even then it can only create `ADMIN` or `MEDIA_OWNER`.
- Advertisers sign themselves up through `POST /api/auth/register-advertiser`, which creates the advertiser and its login in one step; `create-login` itself is staff-only.
- **Still open (data separation, Phase 2):** every staff account can read every company's data. Role gates stop outsiders, not one agency seeing another's.
- Regression test: `traqooh-backend-python/tests/smoke_test.py` (run `python tests/smoke_test.py` from that folder; 173 checks). Section 11 is an access matrix of about 45 endpoints x 5 caller types; section 12 covers ProofLock, the job queue and the migrations; section 13 office uploads with photo GPS, per-site booking dates and board stages. Run it after any change to routes or auth, before pushing. `SMOKE_DATABASE_URL=<empty throwaway Postgres>` runs it on Postgres. GitHub Actions runs it and the web build on every push (`.github/workflows/ci.yml`).

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
field_pins                      ← 4-digit PINs for field workers (30-day expiry); kind CREW | CHECKER
job                             ← background job queue (ProofLock checks, scheduled sweeps)
proof_photo                     ← one row per proof photo/video: hashes, per-shot GPS/time, check results
proof_review                    ← staff verify / needs-retake decisions next to the machine verdict
alembic_version                 ← migration state (Alembic)
```

**Schema changes since 2026-10-04 go through Alembic** (`traqooh-backend-python/migrations/versions/`), run automatically at start-up after the legacy `run_migrations()` (`db_migrate.upgrade_to_head`). Write migrations so they work on Postgres and SQLite (check before create/add). API times are UTC and carry a `Z` (`proofs.iso`); older `str(datetime)` fields have no `T` and the web/app formatters treat them as UTC too.

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
verification_tier -- SELF_REPORTED (crew PIN) | INDEPENDENT (checker PIN) | STAFF_UPLOAD (web)
prooflock_status  -- PENDING | PASS | REVIEW | FAIL: worst result of the visit's photos
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

## ProofLock — automatic photo checks (phase 1 of the Accountability Ledger, D-119)

Every proof photo gets a `proof_photo` row at upload (SHA-256 of the file, capture source, the shot's own GPS and time). A background job (`prooflock.check_photo`, `jobs.py` worker thread) then runs:

| Check | Rule | Result |
|---|---|---|
| Capture method | app camera → pass; gallery or undeclared (old app) → review; web/legacy → note only | PASS / REVIEW / INFO |
| Same file before | identical SHA-256 in an earlier visit | FAIL |
| Copy of earlier photo | 64-bit dHash vs photos uploaded **earlier**: another site ≤ 2 bits → fail, ≤ 8 → review; same site, earlier visit ≤ 8 → review | FAIL / REVIEW |
| Location | per-shot GPS > 250 m from the site, accuracy > 100 m, or missing (app photos). Office uploads: GPS read from the photo file by the browser is checked the same way; none → note only | REVIEW |
| Capture time | in the future → fail; > 7 days before upload or outside the booking ±7 days → review | FAIL / REVIEW |

- A visit's `prooflock_status` is its worst photo. Checks only flag; staff decide (Verify / Needs retake), recorded in `proof_review`.
- Only images are downloaded for checks; videos are fingerprinted at upload only.
- `prooflock.sweep` re-queues photos stuck in PENDING (every 30 min). Thresholds live at the top of `prooflock.py`.
- Phase 6 adds site match and creative match. Plan: `strategy/TRAQADVT_UNIQUE_OFFER.md` §8 and decision D-125.

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
| `/pricing`, `/payment` | redirect | all | → `/contact` (the fake pricing/payment pages and the chatbot were removed on 2026-10-04, D-115) |

---

## Campaign Panel — Tabs (Campaigns.jsx)

Opens as a modal-panel from `/campaigns`. Tab order:
1. **Linked Sites** — current assignments + inline cost editing (per-sqft for Media / Printing / Mounting)
   - **Booked dates** per site, editable (saved on blur; empty = campaign dates; advertiser's chosen dates shown when different); overlap with another campaign's booking shows the API's message. The bulk bar can set dates for the selected rows too
   - **Tracking** column: stage badge, photos per stage, flags, field worker, **Photos** (opens the uploader) and **Track** (switches to Monitoring, scrolls to and highlights that site)
2. **Add Sites** — picker with vendor/state/city/type filters
3. **Monitoring** — shown whenever the campaign has ≥1 assignment (NOT gated on status anymore)
   - **Every booked site**, finalized or not (since 2026-10-07). Stage badge per card (`stage` from the API: FINALIZED / SHORTLISTED / BOOKED / AWAITING_APPROVAL / NOT_SELECTED), progress chips (Booked → Field worker → Installed → Audited → Taken down), editable booking dates. Filter chips: All / Finalized / Booked not finalized / No install photos / Flagged / Not selected; summary of installed / audited / taken down
   - Per-site card with header, GPS map link, "Field access" dropdown + inline "+ New" PIN creation
   - **Start / Install**, **Audit** and **End / Takedown** columns; web uploads to Audit are logged as `AUDIT`. **Add photos** opens the uploader (`components/ProofUploader.jsx`); files can be dropped straight onto a column
   - Photos captured more than 250 m from the site's GPS get an amber "off-site" badge (`distanceM` / `offSite` from the monitoring endpoint)
   - "Proof of Display Report" download: the `inReport` sites (advertiser's selection) with their photos, each photo's own capture time, GPS (marked "from the photo file" for office uploads), distance and verified state
   - Photos + videos clickable into lightbox with GPS / date-time / metadata
   - Verify ✓ tick per photo (toggles DONE ↔ VERIFIED)
   - ProofLock: "Check this" / "Check failed" badges on flagged photos, a "N visits flagged" banner with a "Show only flagged" filter; the photo viewer lists each check, who captured it (field crew / independent checker / office upload), the photo's own GPS and time, and **Re-run checks**
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

## Mobile App Flows (field app v2, 2.0.0)

### Login
1. Admin creates a 4-digit PIN with `workerName` (Admin Dashboard → Field Access, or `+ New` on the Monitoring board). Type CREW (default) or CHECKER (admin only; visits count as independently verified).
2. Worker enters the PIN → JWT with `role=FIELD`, `vendorId`, `workerName`, `fieldKind`. **Every API call sends it** (`utils/api.js`); a 401 sends the worker back to the PIN screen.
3. The worker stays logged in until the PIN expires (30 days). English / Hindi switch on the login and home screens (`utils/i18n.js`).

### Home
- **My Sites** (default): `GET /api/mobile/my-sites` (worker from the token) — campaign, photo counts per phase, and a red **retake** line with the office's reason.
- **All Sites**: the worker's vendor's sites (`/api/sites?vendorId=`; v1 sent `owner_id`, which the API ignores).
- Banners: visits waiting to upload (with Retry and the last error), visits from another worker on a shared phone, unfinished visits (Continue / Discard).
- Sign-out warns when visits haven't uploaded, then deletes them (a shared phone must not upload one worker's visits as another's).

### Logging a visit (`screens/CaptureScreen.js`)
- Install / Audit / End: three guided photos, **close-up → wide → landmark**; Print: one photo. Optional video up to 30 s. **In-app camera only**, no gallery.
- GPS is watched while the screen is open; each photo takes the latest reading (refreshed if older than 60 s) and its own capture time.
- Every photo is copied into app storage at once and the visit is kept as a *draft*, so closing the app or Android killing it mid-photo loses nothing (`ImagePicker.getPendingResultAsync` recovers the last photo).
- **Save** puts the visit in the offline *outbox* (`utils/outbox.js`): it uploads now, or on app start / return to the app / every minute / pull-to-refresh. `clientVisitId` makes retries safe.
- Upload: `POST /api/activities/mobile/log` with `files`, `shots` (label, capturedAt, latitude, longitude, accuracy per photo), `captureSource=CAMERA_INAPP`, `appVersion`.

### Site screen
- Retake box with the reason and **Retake now** (opens the capture for that phase), "N visits waiting to upload", the site's photo gallery (videos open externally) with a photo viewer showing time, GPS and photographer.

### Push (dormant)
- `utils/push.js` registers an Expo push token (with the language) after login **only when Firebase is configured** (`google-services.json` + FCM key in EAS). Backend side: `notifications.py`, `POST/DELETE /api/mobile/push-token`.

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
| `PUT /api/campaigns/{id}/assignment/{aid}` | Update assignment (costs, monitor worker, **monitor_field_pin_id**, `bookedFrom` / `bookedTill` — null clears; 409 when another non-cancelled campaign has the site booked on overlapping dates; updates the site's availability) |
| `GET /api/campaigns/{id}/monitoring` | Every assigned site with `stage`, `inReport`, booking dates, Start/Mid/End photos + available workers |
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
| `POST /api/activities/{id}/upload-image` | Attach photo/video to R2 (preserves Content-Type). Optional form fields `label`, `capturedAt`, `latitude`, `longitude` (read from the file's EXIF by the web uploader) go on the proof photo; the visit takes the first location and earliest time |
| `DELETE /api/activities/{id}/image` | Remove |
| `GET /api/activities/campaign/{id}/timeline` | Chronological |
| `POST /api/activities/mobile/log` | One-shot: create activity + auto-discover campaign + upload photo/video |

### Proof checks (`routes/proof.py`, staff only)
| Method + Path | Description |
|---------------|-------------|
| `GET /api/proof/review-queue?campaignId=` | Visits the checks flagged (REVIEW / FAIL) that nobody has verified or sent back |
| `GET /api/proof/activity/{id}` | One visit with per-photo check results (`photoChecks`) |
| `POST /api/proof/activity/{id}/recheck` | Queue the checks again (e.g. after fixing the site's GPS or dates) |

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
- **Monitoring board** (every booked site with stage + progress, per-site Start/Audit/End photo columns, field-worker assignment + inline PIN creation, booking dates, verify-tick, lightbox with GPS detail)
- **Proof uploader** (drag & drop / paste, previews, shot labels, photo's own time + distance from site from EXIF, HEIC conversion, parallel uploads with progress and retry)
- **Finalized Cost Sheet** PDF download
- **Per-sqft cost editing** for Media / Printing / Mounting (explicit column labels)
- **Re-approval flow** for sites added after finalize (with optional advertiser email)
- **Share campaigns / advertisers** with colleagues (open to all roles)
- **Activities** — global filterable execution log with photo + video lightbox
- **Reports** — global KPIs (now unscoped)
- Image compression on uploads (canvas resize, ~5× smaller)
- Video upload as-is (preserves playable Content-Type)

### Proof checks (ProofLock v1, 2026-10-04)
- Per-photo hashes and checks in a background job; Monitoring board badges, flagged filter, check details and re-run; two-tier labels (crew / independent checker / office)

### Web App — Advertiser Portal
- Standalone `/dashboard/advertiser` (logged-in)
- KPI row: campaigns, live count, sites booked, total spend
- Campaign cards with status badge + date progress bar
- Site-level proof photo + **video** gallery, lightbox-zoomable
- GPS map links per proof
- **Public access link** `/access/:token` — read-only — multi-photo site gallery in the detail modal, video-aware lightbox, shortlist auto-saves on heart toggle, evolves into Live Tracking view when finalized

### Mobile App (Android) — v2 in code, v1 APK in the field
- v2: token on every call, stays logged in, Hindi/English, guided in-app 3-photo capture with per-shot GPS, drafts + offline outbox, retakes, push when Firebase is set up
- OTP login (Resend email delivery active; not reachable from the v2 UI, which is PIN-only)
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
| Field app upload fails: "Unsupported FormDataPart implementation" | Expo SDK 56's `fetch` rejects React Native `{ uri, name, type }` file parts | Fixed in v2: append `new File(uri)` (expo-file-system). Probably also why v1 phone uploads failed on SDK 56 |
| Emulator won't start: "not enough disk space" | C: is nearly full; the AVD lives on C: | Put a test AVD on D: (`ANDROID_AVD_HOME`), see `OPERATIONS.md` §10 |
| `npm ci` / `npm install` fails with ERESOLVE (react-leaflet wants React 19) | Peer-dependency mismatch; the app works on React 18 | `traqooh-frontend/.npmrc` has `legacy-peer-deps=true`; keep it |
| Office photos show "No location in the photo file" | WhatsApp (and some editors) strip EXIF | Ask the crew to send photos as a WhatsApp **Document**, or use the field app |
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
