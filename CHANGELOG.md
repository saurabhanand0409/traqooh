# TraqOOH — Changelog

> Chronological record of every meaningful change. Newest first. For full architecture and current state, see `CLAUDE.md`. For runbook + diagnostic recipes, see `OPERATIONS.md`.

Dates are in `YYYY-MM-DD`. Each entry lists: **what changed**, **why**, and **where** (file paths / commit / deploy URL).

---

## 2026-10-03 (later) — API lockdown

An audit found ~40 endpoints that changed or exposed data with no login check: anyone could create Super Admin accounts, read the full field-PIN list, delete campaigns/vendors/advertisers, mark photos verified, upload any file type to the public R2 bucket, and download the whole site inventory with rates (`GET /api/sites` returned 85 KB to anonymous callers). An advertiser login could also create/delete sites (endpoints only checked "any valid token").

- **Role gates** (`jwt_utils.py`: `require_staff`, `require_admin`, `require_staff_or_field`, `require_field`) on every data endpoint; campaigns, vendors and dashboard routers are staff-only as a whole. Table of who may call what is in `CLAUDE.md`.
- **Uploads** limited to photo/video/PDF, 100 MB, sanitized folder; require a login.
- **Company sign-up closed** (invitation-only) until data separation exists (`ALLOW_PUBLIC_SIGNUP`). Advertisers sign up through the new one-step `POST /api/auth/register-advertiser` (the old two-step flow let anyone attach a login to any advertiser).
- **`REQUIRE_FIELD_AUTH` now defaults to on.** The June APK does not send its token, so it can no longer browse sites or upload until the next APK. No real workers use it (all PINs expired in June).
- Backend refuses to start on Render without `JWT_SECRET`.
- Web: Dashboard and Inventory now send the login token (two plain `fetch` calls); advertiser sign-up page uses the new endpoint.
- Verified: 108 automated checks (including an access matrix of ~45 endpoints x anonymous/advertiser/field/employee/admin, and a mutation check proving it catches an open endpoint) and a browser walk-through of every staff page, the public advertiser link, advertiser sign-up and login, with no refused requests.

## 2026-10-03 — One GitHub repo; sign-up role fix

### GitHub
- The old `traqooh-backend-python` and `traqooh-frontend` GitHub repos had been deleted, which also broke Render's auto-deploy.
- Recreated as one private monorepo, https://github.com/saurabhanand0409/traqooh: backend, web app, field app and the root docs. All 127 earlier commits kept (`git subtree add`), so `git log -- traqooh-backend-python` still shows the backend's history.
- The per-project `.git` folders were moved to `D:\Programming\eclipse-workspace\traqooh-git-backup-2026-10-03\` (copies plus the moved originals).
- Render must be reconnected to the new repo with **Root Directory = `traqooh-backend-python`**.

### Security
- `POST /api/auth/register` (alias `/api/media-owners`) let the caller choose any role, including `SUPER_ADMIN`. It now creates only `ADMIN` or `MEDIA_OWNER` accounts (400 otherwise). Live once the backend deploys; check `user_accounts` for unexpected SUPER_ADMIN/ADMIN rows.

### Field app
- Committed the June work that was never committed (PIN login, activity logging, assigned sites, Play-safe permissions) as the baseline for the next build.

---

## 2026-09-27 — Phase 1 build: integrity fixes, review loop, portal, metrics, push (server side)

Plan: `C:\Users\lenovo\.claude\plans\jazzy-hopping-flute.md` (milestones 1, 2 and the backend half of 4). Field app (milestone 3) not started yet.

### Data-integrity fixes (backend)
- **Site edits no longer wipe fields.** `PUT /api/sites/{id}` only changes fields present in the request (`model_fields_set`). Before, every web edit reset latitude/longitude, address, locality, remarks, base rate and booked status. `main.py::update_site`.
- **Uploads without a campaign land in the right one.** `mobile/log` picks the live (FINALIZED/RUNNING) campaign for the site whose dates cover today, preferring the worker's assignment; finished campaigns are never chosen. `routes/activities.py::_discover_assignment`.
- **Advertiser dashboard no longer shows other brands' photos** taken at the same site (query now filters by campaign). `routes/advertisers.py`.
- **Access links need a staff login.** `POST /api/advertisers/send-access-link` returned a working token to anyone; it now requires a staff role. `require_roles` compares case-insensitively. `routes/advertisers.py`, `jwt_utils.py`.
- **Dashboard "Live campaigns" counts RUNNING** (was only the old `LIVE` name, so it showed 0); upcoming includes FINALIZED. `routes/dashboard.py`.

### Uploads v2 (backward compatible) — `POST /api/activities/mobile/log`
- Several files per visit (`files[]`, old single `file` still works) with per-photo `labels` (close-up / wide / landmark / video), `capturedAt`, `gpsAccuracyM`.
- `clientVisitId` (unique index) makes offline retries idempotent. Files upload to R2 before the row is created.
- Worker identity comes from the field token when present. `REQUIRE_FIELD_AUTH=true` makes the token mandatory — **only switch on after every worker has the new APK.**
- New `campaign_activities` columns: `image_labels`, `gps_accuracy_m`, `captured_at`, `client_visit_id`, `review_note`, `reviewed_by`, `reviewed_at`. Shared rules in new `proofs.py`.

### Review loop
- New status **REJECTED** ("Needs retake") with reason; reviewer and time recorded on verify/reject. Rejected visits are hidden from the advertiser portal, advertiser dashboard, gallery, counts, reports and zips.
- `GET /api/mobile/my-sites` returns `retakes` per site (latest visit per phase still rejected) and works from the field token alone.
- Web: Verify / Needs-retake with reason chips in the Monitoring lightbox; red "Retake: reason" strip on tiles; capture time, shot label and GPS accuracy in the lightbox. `Campaigns.jsx`.

### Advertiser portal and exports
- **Proof of Display report** builder moved to `src/utils/proofReport.js`; also on the advertiser Live Tracking tab. Uses capture time and shot labels.
- **Download all photos** (zip, `NN Site/Installation|Audit|Takedown/<time IST> <shot>.ext` + `index.csv`): `GET /api/campaigns/{id}/photos.zip` (staff) and `GET /api/access/{token}/photos.zip`. New `photo_zip.py`.
- Access response has `hasLogin`; portal shows a log-in banner; the send-link modal nudges staff to create an advertiser login. Status colours for FINALIZED/RUNNING/COMPLETE fixed in AccessView, AdvertiserDashboard and Reports.

### Dashboard and inventory
- **Launch metrics** panel: `GET /api/dashboard/launch-metrics` (proposals sent, live links opened, campaigns running, % of sites proved within 48 h, paying accounts placeholder, proofs per month by phase). Replaces the placeholder chart. `advertiser_access_links.purpose` column added.
- **Inventory GPS**: latitude/longitude fields, paste-a-Google-Maps-link box (pin `!3d…!4d…` preferred over map centre), "No GPS · n" filter.

### Push notifications (server side)
- `push_tokens` table, `POST/DELETE /api/mobile/push-token` (field login only). Expo push API sent from `BackgroundTasks`: "New site assigned" when the worker on an assignment changes, "Retake needed" when a visit is rejected; English or Hindi per device; dead tokens removed. `notifications.py`. Optional `EXPO_ACCESS_TOKEN`. Needs the app side + Firebase/FCM before it does anything.

### Error monitoring
- Backend Sentry (`sentry-sdk[fastapi]`) initialises only when `SENTRY_DSN` is set. Web already reads `VITE_SENTRY_DSN` at build time.

### Verification
- Backend: 41/41 checks against a throwaway SQLite copy (scratchpad `smoke_test.py`).
- Web: walked through dashboard metrics, Monitoring (retake + off-site badges, lightbox reject round-trip), advertiser portal (rejected photos hidden), photo zip, Inventory GPS paste + No-GPS filter against the local test backend. `npm run build` clean.

### Deploy order
1. Push backend (Render auto-deploys; migrations add the columns/tables at startup).
2. Then deploy the frontend (it calls the new endpoints).
The current APK keeps working against the new backend.

---

## 2026-09-26 — Launch questionnaire follow-up

Phase 1 decisions were collected in a questionnaire (artifact https://claude.ai/artifact/LoBD6fYzQds6zVLd4TrPHw, 87 of 91 answered). Built from those answers:

### Field workers
- **Field PINs last 30 days** (was 72 hours) and field-login issues a 30-day JWT. `routes/admin.py`, `main.py`, `jwt_utils.py` (`create_access_token` takes an optional `expire_hours`).

### Monitoring and advertiser portal
- **Audit phase visible** on the internal Monitoring board and the advertiser Live Tracking view (was hidden). Web uploads to that column are logged as `AUDIT` (previously any non-END upload was logged as `START`). `Campaigns.jsx`, `AccessView.jsx`.
- **Off-site photo flag**: the monitoring endpoint returns `distanceM` and `offSite` (over 250 m from the site) per proof; amber badge on the tile and distance in the lightbox. Sites at (0, 0) are treated as having no GPS. `routes/campaigns.py`, `Campaigns.jsx`.
- **Proof of Display Report** download on the Monitoring tab (install / audit / takedown photos per site with time, GPS, distance, verified state; A4 print).
- **WhatsApp sharing** of proposal, live and update links (click-to-chat with a prefilled message; uses the advertiser's phone when on file). `send-access-link` now returns `advertiserPhone` and `advertiserContact`.

### Mobile (not yet in a build)
- Removed `READ_MEDIA_IMAGES` and legacy storage permissions from `app.json`, added `blockedPermissions` for `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO`, and dropped the media-library permission prompt before the gallery (the system photo picker needs none). Needed for Play Store review.

### Deploy status
- Backend committed as `3c61fda`; push pending (this shell has no GitHub credentials).
- Frontend built; Cloudflare deploy pending (wrangler login expired).
- Marketing site (traqooh.brandsculpt.com) **not changed**: the live deployment (~2026-06-24) differs from the local repo's HEAD (2026-06-09); need to confirm which is correct first.

---

## 2026-06-23 — Go-live readiness session

### Documentation
- **Wrote `CLAUDE.md`** — complete project reference (architecture, schema, routes, design system, common issues). Replaces the older shorter version.
- **Wrote `CHANGELOG.md`** — this file.
- **Wrote `OPERATIONS.md`** — runbook with env-var inventory, deploy commands, diagnostic curl recipes, known transient issues + remediation.

### Mobile (Android APK)
- **EAS build `1cb3a574-083a-4d9e-b3bf-65275b15d730` Finished** — 12 min wall time. Preview profile (internal distribution). Available at https://expo.dev/accounts/saurabh.anand24/projects/traqooh-app/builds/1cb3a574-083a-4d9e-b3bf-65275b15d730. This APK contains: video capture, "My Assigned Sites" toggle, photo GPS detail viewer, multi-media picker (SDK 56 array API), and OTP login that now actually emails (Resend is live).
- **Fixed splash deprecation in `traqooh-app/app.json`** — removed top-level `splash` key. SDK 56 considers it legacy and the previous EAS build (2026-06-10) errored at Prebuild with "Field splash not permitted". Reintroduce only via `expo-splash-screen` plugin (not installed yet).

### Employee permissions (cleaning up "scoped-to-own-company" defaults)
- **`Dashboard.jsx`** — removed `?ownerCompanyId=user.companyId` from the summary fetch. Employees now see global KPIs (116 sites instead of 1, full booked value, etc.). Reason: the user wanted employees to be able to plan campaigns across every vendor's inventory.
- **`Reports.jsx`** — same fix for `/api/dashboard/summary`.
- **`Inventory.jsx`** — initial `currentOwnerId` now defaults to `null` for *every* role (was `user.companyId` for non-admins). Employee sees all 116 sites by default; can still filter via the Vendor dropdown.
- **`Campaigns.jsx` → Share tab** — opened to all roles (was admin-only). Employees can now share campaigns with colleagues.

### Photo upload pipeline — silent-empty-upload bug fix
- **Root cause:** the file-input onChange did `handleUpload(...); e.target.value = ""` synchronously. Setting `value=""` on a file input clears the underlying `FileList`. The async upload handler still held a reference to that (now-empty) FileList and iterated over 0 files, so it created an activity with no photo and "Awaiting photos" appeared on refresh.
- **Fix:** copy the FileList into a real array via `Array.from()` BEFORE clearing the input.
- **Files:** `traqooh-frontend/src/pages/Campaigns.jsx` (Monitoring tab), `traqooh-frontend/src/pages/Inventory.jsx` (Site Photos gallery).
- **Verified in deployed bundle**: `Array.from(.target.files` present twice in `index-VlGAxHPx.js`.

### Monitoring tab — always accessible
- **Was:** gated on `["FINALIZED", "RUNNING", "COMPLETE"].includes(detail.status)`. Hidden for DRAFT/PLANNED campaigns.
- **Now:** appears whenever `detail.assignments?.length > 0`. Employees can upload Start/End execution photos from day 1, not only after the advertiser finalizes.
- **File:** `traqooh-frontend/src/pages/Campaigns.jsx` around line 1026.

### UI polish (carry-overs from earlier in the session)
- **AccessView (customer link) is now fully read-only** — removed "Save Draft" buttons and the bulk-apply form. Shortlist auto-saves on every heart-toggle (new `persistShortlist` helper). Customers see admin-set prices only.
- **Customer banner copy:** "All rates and dates shown are as quoted by our team — they cannot be changed here. Tap the heart on a site to remove it from your shortlist; we save automatically."
- **Admin cost-edit columns relabeled**: "Display Cost" → **"Media Cost"** with explicit `(₹/sqft)` subtitle. Printing and Mounting also got the `(₹/sqft)` subtitle. Makes the per-sqft input mode obvious instead of relying on the placeholder.
- **`parseSqft` made more lenient** — handles `60×25`, `60x25`, `60 × 25`, `60*25`, etc. so the per-sqft mode kicks in for more sites.
- **Global select-option dark styling:** added `select option { background:#0D1428; color:#F9FAFB }` to `src/index.css`. Previously only `select.tq-input option` was styled — third-party / utility selects had OS-native white-on-white menus.

### Verification (live API, not mocked)
- `GET /api/sites` → returns 116 sites with no filter. ✅
- `GET /api/dashboard/summary` (unscoped) → 116 sites, 5 vendors, ₹17.4 lakh booked value. ✅
- `POST /api/auth/send-otp` to saurabh.anand24@gmail.com → 200 OK (3 test emails sent; user inbox confirmation pending). ✅
- Photo upload pipeline: created activity, uploaded image, photo appeared in monitoring, deleted — all 200. ✅
- UptimeRobot is alive: 4-minute idle → 1.0s wake-up (not 50s cold start). ✅

### Deployments today
- Backend `main` branch: no new commits (changes were FE-only today).
- Frontend Cloudflare Pages deploys: `068dbc9f.traqooh-frontend.pages.dev` → `b61717d1` → `0f9927da` → (latest in main domain → app.brandsculpt.com serves index-VlGAxHPx.js).
- EAS Android build: `1cb3a574-083a-4d9e-b3bf-65275b15d730` ✅ Finished.

---

## 2026-06-22 — Multi-photo upload + video + branding types

### Site photo galleries (per-site, with cover selection)
- **New DB table usage:** `site_images` (was already in models, never wired up before).
- **New endpoints:**
  - `GET /api/sites/{id}/images` — list (primary first). Auto-imports legacy `Site.image_url` if gallery is empty so existing inventory shows up.
  - `POST /api/sites/{id}/images` — upload one. `setAsPrimary=true` form field promotes it to cover.
  - `POST /api/sites/{id}/images/{img_id}/set-primary` — swap which photo is the cover.
  - `DELETE /api/sites/{id}/images/{img_id}` — remove. If the deleted one was cover, promotes next-newest.
- **Site.image_url kept in sync** with the cover so existing list views (inventory list, map markers, campaign picker, advertiser proposal) still work without modification.
- **Files:** `traqooh-backend-python/main.py` (helper + 4 endpoints), `traqooh-frontend/src/pages/Inventory.jsx` (`SiteGallery` component in Edit modal).

### Advertiser proposal view — multi-photo browsing
- `SiteDetailModal` in `AccessView.jsx` now fetches `/api/sites/{id}/images` when opened. Shows the cover as the main image with a horizontal **thumbnail strip** below if there's more than one photo. Active thumbnail has a blue ring; the cover has a "Cover" badge. Click any thumbnail to swap it into the main slot; click the main image to open the lightbox.
- **Not added** to `AdvertiserDashboard.jsx` (logged-in dashboard) per user explicit request — that view stays focused on execution proofs, single cover thumbnail in the info bar.

### Video upload support
- **Backend:** zero changes needed — `upload_to_r2` already preserved Content-Type and extension. R2 serves uploaded `.mp4` files with `Content-Type: video/mp4` so browsers play them inline.
- **Web:** `Campaigns.jsx` Monitoring "Add Photo" button now accepts `image/*,video/*` (multi-select). Photos still canvas-compressed; videos upload as-is. Per-file 80 MB cap with friendly skip message.
- **Web rendering:** video thumbnails show a play-button overlay; clicking opens the lightbox with `<video controls autoPlay>`. Added `isVideoUrl()` helper.
- **Advertiser views** (`AccessView.jsx` Live Tracking + Lightbox; `AdvertiserDashboard.jsx` ProofModal): all updated to detect video URLs and render `<video>` instead of `<img>`.
- **Mobile (`SiteDetailScreen.js` + `utils/api.js`):**
  - Picker now uses SDK 56 array API: `mediaTypes: ['images', 'videos']`. `MediaTypeOptions` is deprecated.
  - Asset detected as video when `asset.type === 'video' || asset.duration != null`.
  - Video MIME mapping: `mp4 → video/mp4`, `mov → video/quicktime`, etc.
  - Camera capture capped at 60 s (`videoMaxDuration: 60`).
  - Preview shows a 🎥 placeholder for videos (RN's `<Image>` doesn't render video frames).
  - "Retake photo" → "Choose different media" when a video was picked.

### Branding types expansion
- **Inventory Site Type dropdown** now lists: Billboard, Hoarding, Unipole, LED, Digital Screen, Wall Wrap, Pole Kiosk, Gantry, Transit, Bus Shelter, Mall Media + **"Other (specify)…"** option. Selecting Other reveals a free-text input (e.g. "Tower Wrap", "Mall Atrium", "Foot Overbridge").
- **File:** `traqooh-frontend/src/pages/Inventory.jsx` around the Site Type dropdown.

### Mid-monitoring phase hidden from web UI
- Per user request, the Monitoring board and the advertiser's Live Tracking view show **only Start and End** columns. Mid is still in `_PHASE_MAP` for backend grouping (so existing AUDIT/MAINTENANCE entries don't disappear from queries), just not rendered.
- **Files:** `Campaigns.jsx` `MONITOR_PHASES`, `AccessView.jsx` `TRACK_PHASES`.

### Photos uploadable from any source (mobile + web) shown together
- Both views (admin Monitoring board, advertiser Live Tracking link) read the same `campaign_activities` rows. A photo uploaded from the mobile app and a photo uploaded from the web computer show side-by-side, both clickable into the same lightbox. **No code change required** — verified the data path during the upload-flow audit.

---

## 2026-06-18 — Resend live, advertiser flows, employee permissions (part 1)

### Resend OTP email — actually delivering
- Set `RESEND_API_KEY` in Render env vars. Domain `brandsculpt.com` was already verified in Resend dashboard with the DNS records added to Cloudflare (CNAME + DKIM + return-path).
- Set `OTP_FROM_EMAIL=noreply@brandsculpt.com` on Render.
- The fallback path in `send_otp_email()` still logs to console if `RESEND_API_KEY` is missing — keeps local dev working without secrets.
- **Verified:** `POST /api/auth/send-otp` returns 200 and the email arrives within ~30 s.

### Per-purpose advertiser emails
- **New email purposes:** `proposal` (default), `live`, `update`. Each has distinct subject + heading + CTA + body copy.
- **Endpoint:** `POST /api/advertisers/send-access-link` now takes `purpose` in the body. Backend picks the right copy from `_EMAIL_COPY` dict.
- **Same token used across the whole campaign lifecycle** — advertiser doesn't get a different URL when the campaign goes live. The AccessView page reads `campaign.status` and renders the appropriate view (proposal → live-tracking).
- **Files:** `traqooh-backend-python/routes/advertisers.py` (`_EMAIL_COPY`, `_send_access_link_email`, `SendAccessLinkRequest.purpose`).

### Live-tracking view in the customer link
- When `campaign.status` is FINALIZED/RUNNING/COMPLETE, `AccessView.jsx` defaults the active tab to a new **"Live Tracking"** tab.
- Each finalized site shows phase-grouped proof photos (Start/Mid/End) returned by the access endpoint. Each photo has a date, GPS pin (if available), and a verified-green border if admin ticked it.
- **Endpoint update:** `_assignment_to_access_dict` now returns a `proofs: {START, MID, END}` object built from `campaign_activities` rows scoped to that site + campaign.

### Re-approval flow for post-finalize site additions
- **New column:** `campaign_site_assignments.pending_approval BOOLEAN DEFAULT FALSE`. Migrated at startup.
- **When a site is added to a FINALIZED/RUNNING/COMPLETE campaign**, the assignment is created with `pending_approval=true`. The site appears on the admin monitoring board with an amber "Awaiting approval" tag and is **excluded** from the Finalized Cost Sheet (filter `.filter(s => !s.pendingApproval)`).
- **In the customer link**, pending sites get a `NEW · Approve` badge on their `SiteCard` and a banner above the All Sites tab: "🆕 N new sites added for your approval".
- **Advertiser re-finalize clears the flag:** `POST /api/access/{token}/finalize` now iterates all `pending_approval=true` assignments, clears the flag on shortlisted ones (approved), and drops the flag on un-shortlisted ones (effectively rejected — they no longer block execution).
- **Manual notify button** on Monitoring: "Ask advertiser to approve" → `POST /api/advertisers/send-access-link` with `purpose=update`.

### Employee field-access creation (inline on Monitoring board)
- Each finalized site card has a **"Field access" dropdown** with available active PINs + a **"+ New"** button.
- Clicking "+ New" opens an inline input; submitting calls `POST /api/admin/field-pins` (no role gate — employees can create field PINs for their own vendor) and assigns the new worker to that site in one round-trip.

### Employee sharing campaigns
- **Share tab opened to all roles** (was admin-only). Now any team member can share a campaign with a colleague in the same company.
- Backend `POST /api/campaigns/{id}/share` had no role gate already — only the FE was hiding the tab.

---

## 2026-06-16 — Monitoring board v1

### Hybrid campaign status workflow
- **New statuses:** `DRAFT → PLANNED → FINALIZED → RUNNING → COMPLETE` (+ `CANCELLED` at any time).
- **Auto-advance (forward-only):**
  - `FINALIZED` + `start_date ≤ today` → `RUNNING`
  - `FINALIZED|RUNNING` + `end_date < today` → `COMPLETE`
  - Never touches DRAFT, PLANNED, COMPLETE, CANCELLED — manual overrides preserved.
- **Migration:** pre-existing `LIVE` → `RUNNING`, `COMPLETED` → `COMPLETE` in a startup SQL script. The frontend keeps the old strings in `STATUS_CLS` as aliases for safety.
- **Helper:** `auto_advance_status(c, db)` in `routes/campaigns.py`. Called on list + detail fetches.

### Field worker assignment per site
- **New columns:** `monitor_worker_name VARCHAR`, `monitor_field_pin_id INTEGER` on `campaign_site_assignments`. Migrated at startup.
- **Why two columns:** `monitor_worker_name` is the stable identifier — survives 72-hour PIN expiry/re-issue. `monitor_field_pin_id` is the current PIN reference at assignment time (used to render the dropdown selection).
- **`PUT /api/campaigns/{id}/assignment/{aid}`** extended to accept `monitorWorkerName` and `monitorFieldPinId`.

### New monitoring endpoint
- **`GET /api/campaigns/{campaign_id}/monitoring`** returns:
  - Campaign meta (name, status, advertiser, dates)
  - Per-site cards with: site details, GPS, image, agreedCost / printingCost / mountingCost / otherCost, monitor assignment, **phases: {START: [...], MID: [...], END: [...]}** of activity dicts each containing `imageUrls`, `status`, `performedBy`, `latitude`, `longitude`, `notes`, `activityDate`, `createdAt`.
  - List of available field workers (active, unexpired PINs).
- **Phase grouping:** `_PHASE_MAP` in `routes/campaigns.py`:
  - `START` ← `START, MOUNTING, PRINT, REPRINT`
  - `MID` ← `AUDIT, MAINTENANCE`
  - `END` ← `END, TAKEDOWN`

### Mobile app — assigned-sites view
- **`GET /api/mobile/my-sites?worker=<name>`** returns sites the field worker has been assigned to monitor, with photo counts per phase. Field worker home screen now defaults to this view and exposes a toggle to "All Sites" (their vendor's full inventory).

### Mobile app — photo GPS detail viewer
- Tapping any photo on a site opens a full-screen modal with:
  - Date/day/time (`fmtDateTime` helper handles ISO strings)
  - GPS coordinates (6 decimal places) + "Open location in Google Maps →" deep link
  - Photographer name (`performedBy`)
  - Activity type
  - Notes (if any)

### Monitoring board UI (web)
- Tab "Monitoring" added to Campaigns.jsx panel.
- Per-site card: header (image, name, GPS, type/size), Field-access dropdown (with inline "+ New" PIN creation), 3-column phase grid (later cut to 2 columns when Mid was hidden).
- Each photo thumbnail has a ✓ tick (PENDING/DONE → VERIFIED, with green border feedback).
- "Send live link" button calls `send-access-link` with `purpose=live`.
- "Finalized Cost Sheet" PDF download (separate from the general Cost Sheet — uses only `pendingApproval=false` shortlisted sites).

---

## 2026-06-15 — Pre-session baseline (snapshot)

The state of the system before the 2026-06-16+ work in this session:

- Multi-role JWT auth with email+password (admin/employee/advertiser/super) + OTP (mobile)
- Field PIN system existed but only 4-digit + vendor scope. No site-level assignment yet.
- Sites had a single `image_url` field — no gallery.
- Campaigns had statuses `DRAFT/PLANNED/LIVE/COMPLETED/CANCELLED`. No re-approval flow.
- Advertiser proposal portal at `/access/:token` (read-write — they could edit prices and dates). Save-Draft and bulk-apply forms.
- Activities log existed but no Monitoring board grouping. Photos in CampaignDetail.jsx only.
- Mobile app had OTP login, GPS nearby sites, photo capture only (no video).
- Resend was not wired up — OTPs logged to Render console.
- Employees were scoped to their own company across Inventory + Dashboard + Reports.

---

## Schema migrations applied during this session (chronological)

All migrations run at FastAPI startup via the `run_migrations()` block in `main.py` (idempotent — uses `inspector.has_table()` / `c["name"] not in cols` checks).

1. **Add `created_by_user_id` to `campaigns`** — FK to user_accounts.id, ON DELETE SET NULL. Tracks who created the campaign for the employee scope filter.
2. **Add shortlist + costs to `campaign_site_assignments`** — `is_shortlisted`, `final_start_date`, `final_end_date`, `printing_type`, `printing_cost`, `mounting_cost`, `other_cost`, `execution_remarks`.
3. **Self-heal `campaign_activities`** — add `assignment_id`, `status`, `performed_by`, `activity_date`, `notes`, `image_urls`, `latitude`, `longitude`, `source`, `created_by_user_id` if missing.
4. **Create `otp_tokens` table** if missing (for OTP login).
5. **Create `campaign_shares` table** if missing.
6. **Rename status values:** `LIVE → RUNNING`, `COMPLETED → COMPLETE` in `campaigns.status`.
7. **Add monitor assignment columns:** `monitor_worker_name VARCHAR`, `monitor_field_pin_id INTEGER` on `campaign_site_assignments`.
8. **Add re-approval column:** `pending_approval BOOLEAN DEFAULT FALSE` on `campaign_site_assignments`.

No destructive migrations have been applied; nothing was dropped.

---

## How to read this file

- Newest at the top.
- Each session-day groups its work by area (mobile / backend / frontend / docs / etc).
- Look for **file paths in backticks** to find what to edit.
- For "where did this come from?" questions, search this file before reading code.
- When you add a feature, append an entry under today's date. Update `CLAUDE.md` to reflect the new state. Mention the change in `OPERATIONS.md` if it affects deploy/diagnostic procedures.
