# TraqOOH — Engineering Onboarding

> For the incoming architect / senior engineer. Tech detail, code paths, gotchas.
> Read alongside CLAUDE.md and OPERATIONS.md.
> Last updated: 2026-06-27

---

## Quick orientation (1 minute)

- Monorepo at `D:\Programming\eclipse-workspace\traqooh\`.
- 3 apps: `traqooh-frontend` (React+Vite), `traqooh-backend-python` (FastAPI), `traqooh-app` (Expo Android).
- Backend: Render Free → auto-deploys on push to `main`. Cold-start 50s; UptimeRobot pings `/health` to keep warm.
- Frontend: Cloudflare Pages, deployed manually via Wrangler CLI.
- Mobile: EAS Build (cloud) → APK link via email.
- DB: Neon PostgreSQL Free + PgBouncer pooler (in `DATABASE_URL`).
- Media: Cloudflare R2 (10 GB free, egress free).
- Email: Resend, domain `brandsculpt.com` verified.

---

## Tech stack

### Frontend
- **React 18.3** + **Vite 5.4** + **TailwindCSS 3.4**
- **react-router-dom 7.9** (no state lib — `localStorage` + props)
- **Recharts 3.8** for charts, **Leaflet** for maps (no API key)
- **lucide-react** for icons
- Fonts: Syne (headings) + Inter (body) from Google Fonts
- API client: `src/utils/apiFetch.js` — Bearer JWT auto-injected; skips Content-Type when body is FormData
- Image compression: `src/utils/imageCompress.js` (canvas, ~5x smaller)
- Size formatting: `src/utils/sizeFormat.js` — shared parser/renderer for the multi-row JSON in `site.size`

### Backend
- **FastAPI** + **Uvicorn**
- **SQLAlchemy** + **psycopg2-binary**
- **python-jose** for JWT (HS256, 7-day expiry)
- **passlib + bcrypt** for passwords
- **slowapi** rate limiting (10/min login, 5/min OTP)
- **boto3** for R2 uploads (preserves uploaded Content-Type — important for video)
- **httpx** for Resend email API

### Mobile
- **Expo SDK 56** (React Native)
- Android only — package `com.brandsculpt.traqooh`
- expo-location, expo-image-picker (new array API: `mediaTypes: ['images','videos']`)
- Builds via EAS — no local Android SDK needed

---

## Architecture diagram

```
                  END USERS
  Admins/Employees  Advertisers  Field Workers
        |              |             |
        v              v             v
   React Web         Same web       Expo APK
 app.brandsculpt.com (token portal)  (Android)
        \              |             /
         \             |            / HTTPS + JWT
          v            v           v
   ┌──────────────────────────────────┐
   │  FastAPI backend (Render Free)   │
   │  CORSMiddleware + slowapi        │
   │  Global exception handler        │
   └────┬────────────────────┬────────┘
        | SQLAlchemy         | boto3
        v                    v
   ┌──────────────┐  ┌──────────────────┐
   │ Neon Postgres│  │ Cloudflare R2    │
   │ (PgBouncer)  │  │ (public bucket)  │
   └──────────────┘  └──────────────────┘
                     ┌──────────────────┐
                     │ Resend (email)   │
                     └──────────────────┘
```

---

## Auth + JWT flow

1. User logs in (4 paths: email+pwd, OTP, field PIN, mobile login).
2. Backend issues JWT with: `userId, email, role, companyId, vendorId, advertiserId, displayName, workerName`.
3. Frontend stores at `localStorage.tq_user.token`.
4. Every protected call: `Authorization: Bearer <token>` via `apiFetch`.
5. Backend validates via `Depends(get_current_user)` in `jwt_utils.py`.

**Roles:** `SUPER_ADMIN`, `ADMIN`, `EMPLOYEE`, `ADVERTISER`, `FIELD` (mobile only).

**Important:** Employees are now globally-scoped on Inventory + Dashboard (was company-scoped). Campaigns remain owned-or-shared.

---

## Database schema highlights

### Critical FK chains
```
sites <-- site_images, site_audits, campaign_site_assignments, campaign_activities
campaign_site_assignments <-- campaign_activities (assignment_id)
campaigns <-- campaign_site_assignments, campaign_activities, campaign_shares
advertisers <-- campaigns, user_accounts, advertiser_access_links
companies <-- sites, user_accounts (vendor_id)
```

### Site delete cascade (hardened in current session)
The trap: `campaign_activities` has FKs to BOTH `sites.id` AND `campaign_site_assignments.id`. If activity.site_id is null/different but activity.assignment_id points to one of this site's assignments, naive cascade fails. Correct order:
```python
1. CampaignActivity WHERE site_id=X OR assignment_id IN (X's assignments)
2. SiteAudit WHERE site_id=X
3. CampaignSiteAssignment WHERE site_id=X
4. SiteImage WHERE site_id=X
5. Site WHERE id=X
```
R2 objects intentionally orphaned. Wrapped in try/except → returns `HTTPException(500, detail=...)`.

### `sites.size` is now JSON
Was free-text. Now stores an array of size rows:
```json
[
  {"qty":"25","width":"55","length":"","unit":"inch","note":"screens"}
]
```
- Display: `formatSize()` in `utils/sizeFormat.js` — `25× 55"` format
- Cost math: `parseSqft()` in `Campaigns.jsx` sums `qty × w × l` per row, inch→ft is ÷144
- Legacy free-text rows still display via fallback
- Width(ft) / Length(ft) numeric form inputs were REMOVED from Inventory; DB cols still exist for legacy data

### `campaign_site_assignments` — key columns
- `agreed_cost` is the admin-set media cost (always takes precedence over `site.potentialMonthly` rate card)
- `printing_type` includes "Not Applicable" for LED (no print needed)
- `monitor_worker_name` is the stable match key (survives 72-hour PIN re-issue)
- `pending_approval` flags sites added AFTER finalize (need advertiser re-approval)

### `campaign_activities`
- `image_urls` is a JSON array — mixed photos AND videos (`.mp4`, `.mov`, etc.)
- Phase grouping (`_PHASE_MAP` in `routes/campaigns.py`):
  - START phase: START, MOUNTING, PRINT, REPRINT
  - MID phase: AUDIT, MAINTENANCE *(hidden from web UI)*
  - END phase: END, TAKEDOWN

### `field_pins`
- 4-digit PIN, 72h expiry
- `worker_name` is the STABLE identifier — re-issue keeps assignments intact

---

## CRITICAL gotcha #1: Starlette ServerErrorMiddleware bypasses CORS

Starlette's outer `ServerErrorMiddleware` catches unhandled exceptions BEFORE CORSMiddleware adds headers. Result: 500 response has no `Access-Control-Allow-Origin`, browser blocks JS from reading body, shows generic "Failed to fetch".

**Fix** (already in `main.py:266`):
```python
@app.exception_handler(Exception)
async def _all_unhandled_exceptions(request, exc):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in _CORS_ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)[:300]}"},
        headers=headers,
    )
```

Don't remove. Without it, every error is invisible to the frontend.

## CRITICAL gotcha #2: FileList cleared before async iterate

```jsx
// WRONG — files becomes empty when value is cleared
<input onChange={e => { uploadFiles(e.target.files); e.target.value = ""; }} />

// RIGHT — copy first
<input onChange={e => {
  const files = Array.from(e.target.files);
  e.target.value = "";
  uploadFiles(files);
}} />
```
This bit us hard in Inventory.jsx and Campaigns.jsx. Search for `Array.from(.target.files` to verify the fix is in place.

## CRITICAL gotcha #3: video Content-Type preservation

R2 upload via boto3 must preserve the uploaded file's Content-Type (not force `image/jpeg`). Otherwise videos upload but won't play (served as image). The site-image POST endpoint also has an `is_video` guard so videos never auto-promote to cover photo.

## CRITICAL gotcha #4: select option white background

```css
/* In index.css — DON'T REMOVE */
select option { background: #0D1428; color: #F9FAFB; }
```
Windows Chrome renders `<option>` with OS-native white background by default. Without this rule, white-on-white text is invisible.

---

## Deploy commands

### Backend
```bash
cd traqooh-backend-python
git add <files>
git commit -m "..."
git push                       # Render auto-deploys in ~2 min
```

### Frontend
```bash
cd traqooh-frontend
npm run build
npx wrangler pages deploy dist --project-name traqooh-frontend --branch main --commit-dirty=true
```

### Mobile
```bash
cd traqooh-app
eas build --platform android --profile preview --non-interactive --no-wait
```

---

## Render env vars

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon with PgBouncer pooler. URL-encode password: `@`→`%40`, `#`→`%23`, `!`→`%21`. Append `&channel_binding=require`. |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `RESEND_API_KEY` | `re_...` from resend.com |
| `OTP_FROM_EMAIL` | `noreply@brandsculpt.com` |
| `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | Cloudflare R2 |
| `FRONTEND_URL` (opt) | Default `https://app.brandsculpt.com` |

---

## Day-1 reading list

In order:

1. `traqooh-backend-python/main.py` — top to ~line 280 for app setup, CORS, global exception handler, migrations
2. `traqooh-backend-python/routes/campaigns.py` — most complex business logic; `auto_advance_status`, `_PHASE_MAP`, monitoring endpoint
3. `traqooh-backend-python/jwt_utils.py` — short, the auth dependency
4. `traqooh-frontend/src/pages/Campaigns.jsx` — most complex UI; size builder, cost editor, monitoring board, cost sheet PDF
5. `traqooh-frontend/src/pages/AccessView.jsx` — public advertiser portal; shortlist auto-save, Live Tracking
6. `traqooh-frontend/src/utils/sizeFormat.js` — single source of truth for size rendering
7. `traqooh-frontend/src/utils/apiFetch.js` — short, the API wrapper

---

## What's healthy vs what's fragile

### Healthy
- Backend route handlers are small and focused
- DB migrations run idempotently at startup
- Frontend pages are self-contained (no global state lib)
- Auth flow is simple and consistent
- The 4 known gotchas above are all FIXED with comments explaining why

### Fragile
- **Render free tier cold start**: 50s. UptimeRobot helps but isn't 100%. Upgrade to $7/mo Starter before real traffic.
- **Neon 10-conn limit**: PgBouncer pooler helps but still finite. Watch for it on bursty load.
- **No Sentry**: every error today is invisible unless someone reads Render logs. Add Sentry before launch.
- **Single-region**: Render Oregon, Neon us-east-1, R2 global. Latency for Indian users isn't terrible but isn't great either. Consider Indian region later.
- **No tests**: there's no test suite. Don't refactor large surfaces without one.
- **CHANGELOG.md / CLAUDE.md / OPERATIONS.md drift**: keep these updated. They're the only memory across sessions.

---

## Pending / TODO (engineering)

- Add Sentry or Rollbar for backend + frontend error monitoring
- Set up CI (GitHub Actions): lint + build on push
- Add a basic test suite (pytest backend, vitest frontend)
- Implement auto-archive for expired field PINs (cron job)
- Move R2 orphan cleanup to a background job
- Consider read replicas if Neon limits become painful
- Vendor-level direct logins (vendors as users, not just companies)
- Add request-ID logging for traceability
- Document the per-tab data refresh strategy (currently mostly `window.location.reload()` after writes — could be smarter)

---

End of engineering brief.
