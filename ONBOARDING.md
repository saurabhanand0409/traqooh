# TraqOOH — Complete Onboarding Brief

> A comprehensive briefing for a new architect or product owner stepping into this project.
> Last updated: 2026-06-27

---

## 1. What the Product Is

**TraqOOH** is a full-stack SaaS platform for **Out-of-Home (OOH) advertising in India**, built and operated by **BrandSculpt** (saurabh.anand24@gmail.com).

It connects:
- **Media Owners / Vendors** — billboard and OOH inventory companies that own physical sites
- **Advertisers** — brands that want to book OOH campaigns
- **Field workers** — people who physically install, mount, audit, and take down OOH ads
- **Internal staff** — admins (full control), employees (planning campaigns globally), super admins (cross-company oversight)

### The job it does
1. Vendors register their inventory (billboards, hoardings, LED displays etc.) with photos, dimensions, rates.
2. Internal staff create OOH campaigns, pick sites from inventory, build cost sheets.
3. Advertisers see a self-serve portal (no login needed — token link) to review, shortlist, and finalize proposals.
4. Once finalized, field workers execute on-ground via an Android app — capture PRINT/MOUNTING/AUDIT/TAKEDOWN photos and videos, geo-tagged.
5. Advertisers watch progress live in the same portal with proof photos and GPS metadata.

**Market:** India, B2B. Branded as **BrandSculpt** at the parent level, **TraqOOH** is the product.

---

## 2. Tech Stack — Every Layer

### Frontend (`traqooh-frontend`)
| Concern | Choice | Why |
|---|---|---|
| Framework | React 18.3 | Standard, mature |
| Bundler | Vite 5.4 | Fast HMR, simple config |
| Styling | TailwindCSS 3.4 + CSS variables in `src/index.css` | Design tokens centralised |
| Routing | react-router-dom 7.9 | |
| Charts | Recharts 3.8 | |
| Maps | Leaflet 1.9 + react-leaflet 5.0 | Free, no API key |
| Icons | lucide-react 0.561 | |
| Fonts | Syne 800 (headings), Inter 400/500/600 (body) — Google Fonts | |
| Auth | JWT in `localStorage` as `tq_user.token` | 7-day expiry |
| API client | `src/utils/apiFetch.js` — auto-injects Bearer token; skips Content-Type when body is FormData | One wrapper, no Axios |
| Image compression | `src/utils/imageCompress.js` — canvas resize 1280 px / JPEG 0.75 | ~5x smaller uploads |
| Size formatting | `src/utils/sizeFormat.js` — shared formatter for `site.size` JSON across all pages | |

### Backend (`traqooh-backend-python`)
| Concern | Choice |
|---|---|
| Framework | FastAPI |
| Server | Uvicorn |
| ORM | SQLAlchemy |
| DB driver | psycopg2-binary |
| Auth | python-jose[cryptography] — JWT HS256, 7-day |
| Password hash | passlib + bcrypt |
| Rate limiting | slowapi (10/min login, 5/min OTP) |
| S3/R2 upload | boto3 (preserves Content-Type — works for images AND videos) |
| HTTP client | httpx |
| Email | Resend HTTP API via httpx |

### Mobile (`traqooh-app`)
| Concern | Choice |
|---|---|
| Framework | Expo SDK 56 (React Native) |
| Platform | Android only, APK via EAS Build |
| Location | expo-location (GPS) |
| Media picker | expo-image-picker 16.1.x — uses array API `mediaTypes: ['images','videos']` |
| Build | EAS Build (cloud, no local Android SDK needed) |
| Package | `com.brandsculpt.traqooh` |
| EAS Project ID | `f41cf806-a1de-4667-8a6c-07f9c68153ea` |

### Infrastructure
| Layer | Provider | Plan | Notes |
|---|---|---|---|
| Frontend hosting | Cloudflare Pages | Free | `app.brandsculpt.com` |
| Backend hosting | Render | Free (sleeps after 15 min idle) | UptimeRobot keeps warm; recommend $7/mo Starter upgrade for production |
| Database | Neon PostgreSQL | Free (0.5 GB, 10 conn) | PgBouncer pooler enabled in DATABASE_URL — multiplexes to ~100 conn |
| Media storage | Cloudflare R2 | Free (10 GB, egress free) | Public bucket at `pub-a80f750f955d44d1b642d35b2534766f.r2.dev` |
| Email | Resend | Free tier | Domain `brandsculpt.com` verified; sends from `noreply@brandsculpt.com` |
| Mobile build | EAS (Expo) | Free (30 builds/mo) | |
| Keep-alive | UptimeRobot | Free | Pings `/health` every 5 min |
| DNS | Cloudflare | `brandsculpt.com` |

---

## 3. Live URLs

| Service | URL |
|---|---|
| Marketing site | https://traqooh.brandsculpt.com (Vercel) |
| Web App | https://app.brandsculpt.com |
| Backend API | https://traqooh-backend-python.onrender.com |
| Health check | https://traqooh-backend-python.onrender.com/health |
| API docs (Swagger) | https://traqooh-backend-python.onrender.com/docs |

All service dashboards use `saurabh.anand24@gmail.com`.

---

## 4. Folder Layout (Monorepo)

```
D:\Programming\eclipse-workspace\traqooh\
├── CLAUDE.md                    ← reference for AI sessions
├── CHANGELOG.md                 ← chronological session-by-session log
├── OPERATIONS.md                ← deploy + diagnostic runbook
├── ONBOARDING.md                ← this file
├── ENGINEERING.md               ← engineering-focused split
├── PRODUCT.md                   ← product-focused split
├── traqooh-frontend\            ← React + Vite web app
├── traqooh-backend-python\      ← FastAPI backend
└── traqooh-app\                 ← Expo React Native Android app
```

GitHub repos: `saurabhanand0409/traqooh-frontend` and `saurabhanand0409/traqooh-backend-python`. Mobile app lives in this monorepo only.

---

## 5. Authentication & Roles

### 4 login methods
| Method | Endpoint | Used by |
|---|---|---|
| Email + password | `POST /api/auth/login` | Admin, Employee, Advertiser, Super Admin |
| OTP (email -> 6-digit) | `POST /api/auth/send-otp` + `verify-otp` | Mobile app users |
| Field PIN (4-digit, 72h expiry) | `POST /api/auth/field-login` | Field workers on mobile |
| Mobile email+pwd | `POST /api/mobile/login` | Alias of /api/auth/login |

### 5 user roles
| Role | Login Page | Dashboard | Access Scope |
|---|---|---|---|
| `SUPER_ADMIN` | `/masterlogin` | `/dashboard/master` | All companies, all data |
| `ADMIN` | `/adminlogin` | `/dashboard/admin` | Own company — full CRUD |
| `EMPLOYEE` | `/employeelogin` | `/dashboard/employee` | All sites globally. Campaigns scoped to own/shared. |
| `ADVERTISER` | `/login` | `/dashboard/advertiser` | Own campaigns + proof photos |
| `FIELD` (mobile only) | App / PIN | App home | Sites assigned to their worker_name OR browse vendor inventory |

### JWT flow
1. User logs in via one of 4 methods.
2. Backend creates JWT via `jwt_utils.py` with `userId, email, role, companyId, vendorId, advertiserId, displayName, workerName`.
3. Stored as `JSON.parse(localStorage.getItem("tq_user")).token`.
4. Every protected call sends `Authorization: Bearer <token>` via `apiFetch`.
5. Backend validates via `Depends(get_current_user)`.
6. JWT expires after 7 days.

### Security
- Rate limiting: 10/min login, 5/min OTP (slowapi)
- CORS allowed: `app.brandsculpt.com`, `traqooh.brandsculpt.com`, `localhost:5173/3000`, `127.0.0.1:5173`
- Passwords: bcrypt-hashed
- Access link tokens: **SHA-256 hashed in DB** — plaintext never persisted
- `JWT_SECRET`: 64-char random hex env var on Render

### Important security gotcha (FIXED)
**Starlette's `ServerErrorMiddleware` sits OUTSIDE the CORSMiddleware.** Unhandled exceptions in route handlers (or in dependencies like `get_db`/`get_current_user`) returned a 500 without CORS headers — the browser blocked JS from reading the body, showing "Failed to fetch" instead of the real error. Solved by adding a global `@app.exception_handler(Exception)` that re-emits the 500 with `Access-Control-Allow-Origin` attached. See `main.py:266`.

---

## 6. Database Schema

### Tables
```
otp_tokens                      ← 6-digit OTPs for mobile login
companies                       ← Media-owner / vendor companies
gst_registrations               ← GST per company
contacts                        ← Contacts per GST
user_accounts                   ← ALL logins (admin/employee/advertiser/super)
sites                           ← Billboard / hoarding inventory
site_images                     ← Per-site photo gallery
advertisers                     ← Advertiser companies
advertiser_access_links         ← Secure 7-day token links (SHA-256 hashed)
advertiser_company_links        ← M:M advertiser <-> company
advertiser_shares               ← Employees an advertiser is shared with
campaigns                       ← OOH campaigns
campaign_site_assignments       ← Which sites are booked for which campaign
campaign_shares                 ← Employees a campaign is shared with
site_audits                     ← Scheduled audits
campaign_activities             ← Execution log (PRINT/MOUNTING/AUDIT/...) with photos/videos
activity_log                    ← System-wide audit trail
field_pins                      ← 4-digit PINs (72-hour expiry)
```

### Campaign workflow
```
DRAFT -> PLANNED -> FINALIZED -> RUNNING -> COMPLETE
                                       \-> CANCELLED (anytime)
```
Hybrid auto-advance in `routes/campaigns.py::auto_advance_status`:
- `FINALIZED` + `start_date <= today` -> `RUNNING`
- `FINALIZED|RUNNING` + `end_date < today` -> `COMPLETE`
- Never touches `DRAFT`, `PLANNED`, `COMPLETE`, `CANCELLED` (manual overrides preserved)
- Forward-only; never downgrades

### Site delete cascade (hardened)
A site has FKs from 4 tables. Delete order matters because `campaign_activities` has FKs to BOTH `sites.id` AND `campaign_site_assignments.id`:
```
1. campaign_activities WHERE site_id = X OR assignment_id IN (assignments of X)
2. site_audits WHERE site_id = X
3. campaign_site_assignments WHERE site_id = X
4. site_images WHERE site_id = X
5. sites WHERE id = X
```
R2 objects are intentionally left orphaned. The whole block runs inside try/except so failures surface as clean HTTPException(500) with `detail` message.

### `sites.size` — multi-row JSON
Was a free-text VARCHAR. Now stores a JSON array for new inventory:
```json
[
  {"qty":"25","width":"55","length":"","unit":"inch","note":"screens"},
  {"qty":"1","width":"15","length":"30","unit":"ft","note":""}
]
```
- Each row: `qty × (width × length) unit + note`
- Reads as: `25× 55" screens + 1× 15'×30'`
- Supports LED video-wall setups (e.g. "20 screens of 42 inch") that don't fit a single Width×Length
- Frontend display uses `formatSize()` in `utils/sizeFormat.js`; standard physical notation: `'` for feet, `"` for inch
- Legacy free-text rows still display correctly via fallback
- Cost-per-sqft (`parseSqft` in `Campaigns.jsx`) auto-converts inches to feet (÷144)

### `site_images` — per-site photo library
- Multiple images per site
- Exactly one `is_primary = true` (the cover)
- Videos uploadable only for LED sites (frontend gate) and never become cover (backend guard)
- Legacy single-image sites auto-import into the gallery on first GET

### `field_pins`
- 4-digit PIN, 72-hour expiry
- `worker_name` is the stable identifier — re-issuing a PIN with the same name keeps site assignments intact

---

## 7. Frontend Page Map

| URL | File | Roles | Notes |
|---|---|---|---|
| `/` | redirect | all | -> traqooh.brandsculpt.com |
| `/login` | AdvertiserLogin.jsx | ADVERTISER | |
| `/employeelogin` | EmployeeLogin.jsx | EMPLOYEE | |
| `/adminlogin` | AdminLogin.jsx | ADMIN | |
| `/masterlogin` | MasterLogin.jsx | SUPER_ADMIN | |
| `/dashboard/employee` | Dashboard.jsx | EMPLOYEE, ADMIN | Global KPIs |
| `/dashboard/admin` | AdminDashboard.jsx | ADMIN | 8 tabs |
| `/dashboard/master` | MasterDashboard.jsx | SUPER_ADMIN | All companies |
| `/dashboard/advertiser` | AdvertiserDashboard.jsx | ADVERTISER | Video-aware proofs |
| `/inventory` | Inventory.jsx | EMPLOYEE, ADMIN | Default "All Vendors"; multi-row Size Builder |
| `/campaigns` | Campaigns.jsx | EMPLOYEE, ADMIN | Lifecycle; Monitoring tab whenever >=1 site linked |
| `/campaigns/:id` | CampaignDetail.jsx | EMPLOYEE, ADMIN | Activity log, photo upload |
| `/advertisers` | Advertisers.jsx | EMPLOYEE, ADMIN | |
| `/vendors` | Vendors.jsx | EMPLOYEE, ADMIN | Edit/delete admin-only |
| `/activities` | Activities.jsx | EMPLOYEE, ADMIN | Global execution log |
| `/reports` | Reports.jsx | EMPLOYEE, ADMIN | Global analytics |
| `/access/:token` | AccessView.jsx | public | Token-based advertiser portal — read-only |
| `/account` | Account.jsx | all | User profile |

---

## 8. Backend Route Map (Key Endpoints)

### Auth
```
POST /api/auth/login           # Email + password -> JWT
POST /api/auth/send-otp        # Send 6-digit OTP (rate: 5/min)
POST /api/auth/verify-otp      # Verify OTP -> JWT
POST /api/auth/field-login     # 4-digit field PIN -> JWT
GET  /health                   # UptimeRobot keep-alive target
```

### Sites
```
GET    /api/sites              # ?ownerId / ?vendorId / ?city / ?state / ?siteType
GET    /api/mobile/sites       # Alias
POST   /api/sites              # Create
PUT    /api/sites/{id}         # Update
DELETE /api/sites/{id}         # Hardened cascade
GET    /api/sites/{id}/images  # Per-site gallery
POST   /api/sites/{id}/images  # Upload (videos never auto-cover)
DELETE /api/sites/{id}/images/{img_id}
POST   /api/upload             # Generic R2 upload
```

### Campaigns
```
GET    /api/campaigns
POST   /api/campaigns/{id}/assign-site
POST   /api/campaigns/{id}/assign-sites-bulk
PUT    /api/campaigns/{id}/assignment/{aid}
GET    /api/campaigns/{id}/monitoring
POST   /api/campaigns/{id}/share
```

### Activities
```
POST   /api/activities/mobile/log               # One-shot: create activity + auto-discover campaign + upload media
POST   /api/activities/{id}/upload-image
DELETE /api/activities/{id}/image               # Per-URL delete for monitoring board
```

### Advertisers
```
POST   /api/advertisers/send-access-link        # purpose=proposal/live/update
GET    /api/access/{token}                      # Hydrate advertiser portal
POST   /api/access/{token}/shortlist            # Auto-saved on heart-click
POST   /api/access/{token}/finalize
```

### Admin
```
POST   /api/admin/field-pins                    # Create 4-digit PIN
DELETE /api/admin/field-pins/{id}
```

---

## 9. Design System — Hard Rules

### CSS variables (`src/index.css`)
```
--bg:       #070C1A
--nav:      #0B1120
--sidebar:  #0D1428
--card:     rgba(255,255,255,0.04)
--border:   rgba(255,255,255,0.08)
--blue:     #2563EB
--red:      #DC143C
--green:    #22C55E
--orange:   #F59E0B
--gray:     #9CA3AF
--gray2:    #6B7280
```

### Brand gradient
```css
background: linear-gradient(135deg, #2563EB, #DC143C);
```

### Critical CSS rule (don't remove)
```css
select option { background: #0D1428; color: #F9FAFB; }
```
Without this, Windows Chrome renders `<option>` with white OS-native background — white text becomes invisible.

### Enforced rules
- All protected pages wrap content in `<AppShell user={user}>`
- **Never** use white/light backgrounds — no `bg-white`, `bg-gray-50`, `bg-gray-100`
- Dark modals: `background: "#0D1428"`, `border: "1px solid var(--border)"`
- Headings: `font-syne font-bold text-xl text-white`
- Table headers + form labels: `text-[10px] font-bold uppercase tracking-wider` in `var(--gray2)`
- Primary buttons: brand gradient
- Cancel buttons: `rgba(255,255,255,0.06)` + `var(--gray)` text
- Error boxes: `rgba(220,20,60,0.12)` bg, `rgba(220,20,60,0.3)` border, `#F87171` text

---

## 10. Local Development

### Backend
```bash
cd traqooh-backend-python
pip install -r requirements.txt
uvicorn main:app --reload      # http://localhost:8000, Swagger at /docs
```

### Frontend
```bash
cd traqooh-frontend
npm install
npm run dev                     # http://localhost:5173
# .env.local: VITE_API_BASE=http://localhost:8000 to hit local backend
```

### Mobile (Android emulator)
```bash
# 1. Android Studio -> Virtual Device Manager -> start Medium Phone API 35
# 2. If emulator off-screen: D:\Programming\fix-emulator.ps1
cd traqooh-app
npx expo start --port 8082
# 3. Other terminal:
adb -s emulator-5554 reverse tcp:8082 tcp:8082
# 4. Emulator: Ctrl+M -> Change Bundle Location -> localhost:8082 -> Apply
```

---

## 11. Deploy Process

### Backend (auto-deploy on push to `main`)
```bash
cd traqooh-backend-python
git add <files>
git commit -m "..."
git push                       # Render auto-deploys in ~2 min
```

### Frontend (manual via Wrangler)
```bash
cd traqooh-frontend
npm run build
npx wrangler pages deploy dist --project-name traqooh-frontend --branch main --commit-dirty=true
```
Wrangler needs `wrangler login` once (browser OAuth).

### Mobile (EAS)
```bash
cd traqooh-app
eas build --platform android --profile preview --non-interactive --no-wait
```
APK link arrives via email when done.

---

## 12. Backend Environment Variables (Render)

| Variable | Source / Notes |
|---|---|
| `DATABASE_URL` | Neon. URL-encode special password chars: `@`->`%40`, `#`->`%23`, `!`->`%21`. PgBouncer pooler hostname with `&channel_binding=require` — bypasses 10-conn limit |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `RESEND_API_KEY` | `re_...` from resend.com |
| `OTP_FROM_EMAIL` | `noreply@brandsculpt.com` |
| `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | Cloudflare R2 |
| `FRONTEND_URL` (optional) | Defaults to `https://app.brandsculpt.com` |

---

## 13. Major Recent Changes (current session)

### Inventory size description rewrite
- Removed Width(ft) / Length(ft) numeric inputs from Add/Edit Site form (legacy data preserved in DB).
- Added structured "Size Description" multi-row builder: Qty + Width + Length + Unit (ft/inch) + Note. Stored as JSON.
- New shared utility `src/utils/sizeFormat.js` renders everywhere.
- Standard physical notation: `'` feet, `"` inches.
- `parseSqft()` sums `qty × width × length` across rows; auto inch->ft (÷144).

### LED-only video upload + delete-on-live
- Inventory gallery: video upload (`<video>` tile + play overlay + VIDEO badge) gated to LED sites.
- Backend: videos never auto-promote to cover (the `make_primary` flag excludes any `video/*`).
- Monitoring board: red trash button on each photo/video tile; deletes via `DELETE /api/activities/{id}/image?imageUrl=…`; if all media gone, deletes the activity.

### Cost UX fixes
- Media Cost ₹/sqft field no longer pre-fills from rate card — blank unless admin enters it.
- Advertiser Cost Sheet Media Cost column now uses `computeSiteBase(site, id)` — matches Total column.
- Cost Sheet download:
  - Defaults to all sites when none ticked
  - Popup-blocker fallback: saves HTML file to Downloads with clear message
  - Button label dynamic: `Download Cost Sheet (all 3)` or `Download (2 sites)`

### Backend hardening
- Site DELETE cascade hardened (handles FK orphans)
- Global exception handler with CORS headers — solves "Failed to fetch instead of real error" problem

### Other
- "Not Applicable" added as first option in PRINTING_TYPES (Campaigns + AccessView) — for LED sites
- Delete inventory: optimistic UI removal + spinner state on button + clearer 🗑 Trash2 icon
- Neon PgBouncer pooler enabled — bypasses free-tier 10-connection limit

---

## 14. Hybrid Auto-Advance Logic (campaign status)

The single piece of business logic that confuses people most. Read `routes/campaigns.py::auto_advance_status`. Rules:

1. **Forward-only.** Never downgrades.
2. **`DRAFT`** stays manual.
3. **`PLANNED`** -> `FINALIZED` is manual (admin clicks "Finalize" or advertiser hits "Finalize" via portal).
4. **`FINALIZED` + start_date <= today** -> `RUNNING`.
5. **`FINALIZED|RUNNING` + end_date < today** -> `COMPLETE`.
6. **`CANCELLED`** is sticky.

Legacy `LIVE`/`COMPLETED` were renamed to `RUNNING`/`COMPLETE` in a startup migration; frontend recognizes the old names as aliases.

---

## 15. Common Problems & Fixes

| Problem | Cause | Fix |
|---|---|---|
| Backend 500 intermittent | Neon free-tier 10-conn limit | PgBouncer pooler enabled; retry with backoff |
| Render 50s response | Free tier cold start | UptimeRobot mitigates; upgrade to Starter for production |
| OTP not delivered | `RESEND_API_KEY` missing OR domain unverified | Check env vars + Resend dashboard |
| Dropdown white-on-white | OS-native `<option>` styling | Already fixed via global CSS — don't remove |
| Photo upload silently does nothing | `e.target.value = ""` cleared FileList | Already fixed — `Array.from()` before clearing |
| "Failed to fetch" on backend error | Starlette ServerErrorMiddleware bypasses CORS | Already fixed via global exception handler |
| EAS build fails: `splash not permitted` | SDK 56 deprecated top-level `splash` | Use `expo-splash-screen` plugin instead |
| New APK won't open | Old app signing conflict | Uninstall old TraqOOH first |
| Emulator off-screen | Windows multi-monitor glitch | `D:\Programming\fix-emulator.ps1` |
| Metro port 8081 blocked | Apache/EDB on that port | `--port 8082` + `adb reverse tcp:8082 tcp:8082` |

---

## 16. Scaling & Cost Reference

| Stage | Photos/mo | Render | Neon | R2 | Total |
|---|---|---|---|---|---|
| Launch (now) | 0–200 | Free | Free | Free | **$0/mo** (cold starts hurt) |
| Recommended go-live | 0–600 | $7 Starter | Free | Free | **$7/mo** |
| Growth | 600–1,500 | $25 Standard | Free | ~$0.12 | **~$25/mo** |
| Scale | 1,500–2,500 | $25 | $19 Launch | ~$0.75 | **~$45/mo** |

---

## 17. Pending / TODO

### Strongly recommended before general launch
- Upgrade Render to Starter ($7/mo) — kills cold starts
- Run one pilot campaign end-to-end (employee + advertiser + field worker)
- Verify Neon free-tier daily backup is enabled
- Privacy policy + terms page (required for Play Store submission)

### Nice-to-have
- Publish Android app to Google Play Store
- Add site photo upload in mobile app (currently web-only)
- Invoice / billing module
- Razorpay payment gateway (preferred for Indian B2B / UPI / GST)
- WhatsApp notifications (Twilio or Meta Cloud API)
- Campaign approval workflow (submit -> approve/reject)
- Sentry / Rollbar for error monitoring
- Auto-archive expired field PINs (cleanup job)

### Future architecture
- Vendor-level direct logins (vendors as users)
- Multi-tenant isolation hardening
- Read replicas if Neon limits become painful

---

## 18. Day-1 Priorities for a New Architect/PO

1. **Read this brief + CLAUDE.md + skim CHANGELOG.md.**
2. **Get your access** — saurabh.anand24@gmail.com is on every service; ask Saurabh to onboard you to Render, Cloudflare, Neon, Resend, Expo, GitHub, UptimeRobot.
3. **Spin up locally** — backend + frontend + emulator. Log in as admin, employee, advertiser.
4. **Trigger a full advertiser flow** — create a campaign, share via access link, accept on portal, finalize. This exposes 80% of the surface area.
5. **Read these key files in order:**
   - `traqooh-backend-python/main.py` (top to ~line 280 for app setup)
   - `traqooh-backend-python/routes/campaigns.py` (most complex business logic)
   - `traqooh-frontend/src/pages/Campaigns.jsx` (most complex UI)
   - `traqooh-frontend/src/pages/AccessView.jsx` (advertiser-facing — public)
6. **Promote Render to Starter** if going to production — first thing.
7. **Add Sentry** before traffic. Without it, every error today is invisible.

---

End of brief.
