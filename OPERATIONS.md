# TraqOOH — Operations Runbook

> How to deploy, diagnose, and rotate things in production. For architecture, see `CLAUDE.md`. For chronological history, see `CHANGELOG.md`.

All commands assume CWD = `D:\Programming\eclipse-workspace\traqooh\` unless otherwise noted.

---

## 1. Daily deploy

### Frontend (Cloudflare Pages)
```bash
cd traqooh-frontend
npm run build
npx wrangler pages deploy dist --project-name traqooh-frontend --branch main
```
- Vite builds to `dist/`. Wrangler uploads + serves at https://app.brandsculpt.com.
- Each deploy gets a unique `<hash>.traqooh-frontend.pages.dev` URL too — useful for previews.
- First `wrangler login` opens a browser OAuth; subsequent runs use the saved token.
- Build chunks are ~1.2 MB minified — the chunk-size-warning is benign.

### Backend (Render — auto-deploys on push)
```bash
cd traqooh-backend-python
git add -A
git commit -m "<message>"
git push origin main
```
- Render watches the `main` branch of https://github.com/saurabhanand0409/traqooh-backend-python.
- A new deploy starts automatically on every push (~2-3 min including container build).
- Watch progress at https://dashboard.render.com → traqooh-backend-python → Logs.
- Migrations run at startup via the `run_migrations()` block in `main.py` (idempotent).

### Mobile app (EAS — manual, billed)
```bash
cd traqooh-app
eas build --platform android --profile preview --non-interactive --no-wait
```
- Builds in Expo's cloud (~12 min wall time).
- `--no-wait` returns the build URL immediately; check status at https://expo.dev/accounts/saurabh.anand24/projects/traqooh-app/builds.
- Free plan: 30 builds/month. Each preview build consumes one.
- Install on phones: open the build URL → Install button → QR code → scan from Android camera. APK installs directly (no Play Store required).
- **Important — re-install after each new build:** Android caches the previous APK's data. Either uninstall the old app first OR Settings → Apps → TraqOOH → Storage → Clear storage.
- **App v2 (2.0.0) needs a backend from 2026-10-03 or later** (it sends the login token on every call). It works with an older ProofLock-less backend too; the extra upload fields are simply ignored.
- **Push notifications ("new site assigned", "retake needed") need Firebase.** Until then the app builds and runs without push and never asks for notification permission. To switch push on:
  1. Firebase console → add an Android app with package `com.brandsculpt.traqooh` → download `google-services.json` into `traqooh-app/` (it is not a secret; commit it).
  2. Firebase → Project settings → Service accounts → generate a private key (JSON). Upload it at expo.dev → traqooh-app → Credentials → Android → FCM V1 service account key. **Never commit this key.**
  3. Rebuild the APK. `app.config.js` sees the file and turns push on.

---

## 2. Environment variables (Render)

Set at https://dashboard.render.com → traqooh-backend-python → Environment.

| Key | Notes |
|-----|-------|
| `DATABASE_URL` | Neon connection string. Password chars **must be URL-encoded** — `@` → `%40`, `#` → `%23`, `!` → `%21`. Format: `postgresql://user:URLENCODEDPWD@ep-sweet-resonance-apqfv4vg.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | 64-char hex. Regenerate with `openssl rand -hex 32`. Rotating it invalidates every active session — users will be forced to log in again. |
| `RESEND_API_KEY` | From https://resend.com → API Keys. Value lives only in Render → Environment (never paste it into docs) (rotate via Resend dashboard → API Keys → Rotate). |
| `OTP_FROM_EMAIL` | `noreply@brandsculpt.com` — must match a verified sender in Resend. |
| `R2_ACCESS_KEY` | Cloudflare R2 → Manage R2 API Tokens → use a Read+Write token scoped to the bucket. |
| `R2_SECRET_KEY` | Same. |
| `R2_BUCKET` | The bucket name (current: `traqooh-media` — check R2 dashboard to confirm). |
| `R2_ENDPOINT` | `https://<cloudflare-account-id>.r2.cloudflarestorage.com` |
| `FRONTEND_URL` *(optional)* | Defaults to `https://app.brandsculpt.com`. Used to construct advertiser email links. |
| `JOB_WORKER` *(optional)* | Defaults to on: a background thread runs queued jobs (photo checks). `off` disables it (tests). On the free plan jobs only run while the service is awake. |

**After editing env vars,** Render auto-redeploys (~2 min). If it doesn't, click **Manual Deploy → Deploy latest commit**.

---

## 3. Health checks & verification

```bash
API="https://traqooh-backend-python.onrender.com"

# Is the backend up?
curl -s "$API/health"
#  → {"status":"ok","version":"2.1.0","time":"..."}

# How many sites globally?
curl -s "$API/api/mobile/sites" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).length+' sites'))"

# Dashboard KPI snapshot
curl -s "$API/api/dashboard/summary" | python -m json.tool

# Force-send an OTP to confirm Resend is live (rate-limited 5/min)
curl -s -X POST "$API/api/auth/send-otp" -H "Content-Type: application/json" \
  -d '{"email":"saurabh.anand24@gmail.com"}'
#  → {"success":true,"message":"OTP sent to ..."}
#  Check inbox for the actual delivery.

# What's the deployed frontend bundle hash?
curl -s "https://app.brandsculpt.com" | grep -o "index-[A-Za-z0-9]*\.js" | head -1
```

### Verify a specific bug fix is deployed
```bash
# FileList copy fix should appear twice in the bundle
curl -s "https://app.brandsculpt.com/assets/index-VlGAxHPx.js" | grep -c "Array.from(.\\{1,3\\}\\.target\\.files"
#  → 2 (Campaigns Monitoring + Inventory Site Photos)

# Global select-option styling
curl -s "https://app.brandsculpt.com/assets/index-VlGAxHPx.js" | grep -c "select option"
#  → confirms the CSS rule made it into the build
```

---

### Photo checks (ProofLock) backlog
```sql
SELECT status, count(*) FROM job GROUP BY status;                 -- QUEUED / RUNNING / DONE / FAILED
SELECT status, count(*) FROM proof_photo GROUP BY status;         -- PENDING / PASS / REVIEW / FAIL
SELECT type, last_error, attempts FROM job WHERE status = 'FAILED' ORDER BY id DESC LIMIT 20;
```
- A long `QUEUED` list right after a deploy is normal: the first deploy with migration `0002` queues one check per existing photo (each photo is downloaded from R2 once; videos are skipped).
- `PENDING` photos older than 15 minutes are re-queued every 30 minutes by the `prooflock.sweep` job.
- Re-run the checks for a visit from the Monitoring board (open a photo → **Re-run checks**) or `POST /api/proof/activity/{id}/recheck`.

## 4. Diagnostic recipes

### Pick a finalized campaign and inspect its monitoring board
```bash
API="https://traqooh-backend-python.onrender.com"
# Find a campaign with assignments
CID=$(curl -s "$API/api/campaigns" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const c=j.find(x=>(x.siteCount||0)>0);console.log(c?c.id:'')})")
echo "Campaign: $CID"
curl -s "$API/api/campaigns/$CID/monitoring" | python -m json.tool | head -60
```

### Smoke-test the full upload pipeline (creates + deletes a test activity)
```bash
cd /tmp
API="https://traqooh-backend-python.onrender.com"
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > smoke.png

# Pick a campaign + site
CID=$(curl -s "$API/api/campaigns" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const c=j.find(x=>(x.siteCount||0)>0);console.log(c?c.id:'')})")
read AID SID <<< $(curl -s "$API/api/campaigns/$CID/monitoring" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const s=(j.sites||[])[0]||{};console.log((s.assignmentId||'')+' '+(s.siteId||''))})")

# Create activity → upload image → verify shows → cleanup
ACT=$(curl -s -X POST "$API/api/activities" -H "Content-Type: application/json" \
  -d "{\"campaignId\":$CID,\"siteId\":$SID,\"assignmentId\":$AID,\"activityType\":\"START\",\"status\":\"DONE\",\"source\":\"web\",\"performedBy\":\"SMOKE-TEST\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))")
curl -s -X POST "$API/api/activities/$ACT/upload-image" -F "file=@smoke.png" > /dev/null
curl -s "$API/api/campaigns/$CID/monitoring" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const s=(j.sites||[]).find(x=>x.assignmentId==$AID);console.log('Start photos:',(s.phases.START||[]).reduce((n,a)=>n+(a.imageUrls||[]).length,0))})"
curl -s -X DELETE "$API/api/activities/$ACT"
```

### Check if Render is being kept warm
```bash
# Idle 4 min then probe — should respond in <1s if UptimeRobot is alive
sleep 240; time curl -s -o /dev/null "https://traqooh-backend-python.onrender.com/health"
#  → real time should be ~1s. If 30-50s, the keep-alive monitor stopped.
```

### Inspect Neon connection state
```bash
# Direct SQL via psql (replace with actual password)
psql "postgresql://user:URLENCODEDPWD@ep-sweet-resonance-apqfv4vg.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require" -c "SELECT count(*) FROM pg_stat_activity WHERE datname='neondb';"
#  Free tier max: 10 connections. If you regularly see >8, intermittent 500s are inevitable.
```

---

## 5. Known transient issues + remediation

### `Internal Server Error` on any endpoint, intermittently
- **Cause:** Neon free tier 10-connection limit. When tests / background jobs / parallel requests open many sessions, new ones fail until a slot frees.
- **Symptoms:** repeated curl returns 500 for a few seconds, then succeeds without changing anything.
- **Workaround:** retry with backoff (5 s, then 15 s, then 30 s).
- **Permanent fix:** upgrade Neon Free → Launch ($19/mo, 100 connections). Or migrate to Render Postgres + pgbouncer.

### 50-second response on the first request after idle
- **Cause:** Render Free tier cold start. The instance sleeps after 15 min idle.
- **Mitigation:** UptimeRobot is pinging `/health` every 5 min. Verify alive at https://uptimerobot.com.
- **Permanent fix:** upgrade Render Free → Starter ($7/mo) — instance never sleeps.

### OTP email not arriving
1. Check Render env: `RESEND_API_KEY` and `OTP_FROM_EMAIL` set?
2. Check Resend dashboard at https://resend.com → Logs — was the email accepted by Resend?
3. Check Resend → Domains → `brandsculpt.com` status = **Verified** (DKIM + SPF + return-path all green).
4. Check the user's spam folder. The first email from a new sender often lands there.
5. If `RESEND_API_KEY` is unset, the OTP is logged to Render's stdout instead — visible at Render dashboard → Logs.

### Photo upload "did nothing" (web)
- **Almost certainly the FileList bug** — `e.target.value=""` cleared the FileList before the async upload could read it.
- **Verify the fix is deployed:** see "Verify a specific bug fix is deployed" recipe above. The bundle should contain `Array.from(...target.files` twice.
- **If fix is deployed but still broken:** check browser DevTools → Network tab for the `/api/activities/{id}/upload-image` request. Should be 200. If 403/401, the JWT token expired (re-login).

### New APK won't open on Android — "Clear cache" prompt
- The old TraqOOH app's data conflicts with the new build's signing/version.
- **Fix:** Settings → Apps → TraqOOH → Storage → **Clear storage**, then re-open. Or uninstall the old APK and install the new one fresh.

### Field app uploads fail with "Unsupported FormDataPart implementation"
Expo SDK 56 replaces `fetch` with its own version, which only accepts Blob-like file parts. Attach files as `new File(uri)` from `expo-file-system`, not React Native's `{ uri, name, type }` objects (`traqooh-app/utils/api.js::uploadVisit`). The app shows the technical reason in brackets after "No internet connection" in the upload banner.

### EAS Android build fails at Prebuild
- **Most common cause:** schema validation. SDK 56 doesn't accept top-level `splash` in `app.json`.
- **Fix:** keep the splash config removed (`app.json` should NOT have a `"splash"` key at the top level). If you want a real splash screen, install `expo-splash-screen` and use the plugin syntax.

### Cloudflare Pages deploy fails to update production domain
- **Cause:** sometimes the `--branch main` flag doesn't promote the deploy to production automatically.
- **Fix:** open https://dash.cloudflare.com → Workers & Pages → traqooh-frontend → Deployments → click the latest deploy → "Promote to Production".

---

## 6. Useful SQL queries (Neon console)

### How many active field PINs?
```sql
SELECT count(*) FROM field_pins
WHERE is_active = true AND expires_at > NOW();
```

### Find a campaign by name
```sql
SELECT c.id, c.name, c.status, c.start_date, c.end_date, a.company_name AS advertiser
FROM campaigns c LEFT JOIN advertisers a ON a.id = c.advertiser_id
WHERE c.name ILIKE '%summer%' ORDER BY c.created_at DESC;
```

### Photos per campaign (Start / Mid / End)
```sql
SELECT campaign_id,
  count(*) FILTER (WHERE activity_type IN ('START','MOUNTING','PRINT','REPRINT')) AS start_acts,
  count(*) FILTER (WHERE activity_type IN ('AUDIT','MAINTENANCE'))                  AS mid_acts,
  count(*) FILTER (WHERE activity_type IN ('END','TAKEDOWN'))                       AS end_acts,
  count(*) FILTER (WHERE image_urls IS NOT NULL AND image_urls <> '[]')             AS acts_with_photos
FROM campaign_activities
GROUP BY campaign_id ORDER BY campaign_id DESC;
```

### Recent activity log (the audit trail)
```sql
SELECT user_email, action, entity_type, entity_id, details, created_at
FROM activity_log
ORDER BY created_at DESC LIMIT 50;
```

### Sites without any photos in the gallery
```sql
SELECT s.id, s.name, s.city
FROM sites s LEFT JOIN site_images si ON si.site_id = s.id
WHERE si.id IS NULL AND s.image_url IS NULL;
```

### Pending re-approval sites by campaign
```sql
SELECT c.name AS campaign, c.status,
       count(*) FILTER (WHERE csa.pending_approval) AS pending_count
FROM campaigns c LEFT JOIN campaign_site_assignments csa ON csa.campaign_id = c.id
GROUP BY c.id, c.name, c.status
HAVING count(*) FILTER (WHERE csa.pending_approval) > 0;
```

---

## 7. Render Free → Starter upgrade (the $7/mo upgrade that kills cold starts)

1. https://dashboard.render.com → sign in (saurabh.anand24@gmail.com)
2. Click **traqooh-backend-python**
3. Left sidebar → **Settings**
4. Scroll to **Instance Type** → **Change Instance Type**
5. Pick **Starter** ($7/month) → **Update Instance Type**
6. Auto-redeploys (~2 min). Same code, no sleeps.

**What changes:**
- Backend always-on. The 50-s cold start disappears.
- 0.5 CPU dedicated, 512 MB RAM (no swap thrash under load).
- Intermittent 500s drop significantly because parallel-request handling improves.
- Billing: prorated per-second. ~₹580/mo equivalent at current INR rate.

---

## 8. Rotating secrets

### Rotate `JWT_SECRET`
Forces every active user to log in again. Don't do this casually.
```bash
NEW_SECRET=$(openssl rand -hex 32)
# Render → Environment → JWT_SECRET → paste → Save (triggers redeploy)
```

### Rotate Resend API key
1. https://resend.com → API Keys → next to the existing key → **Rotate** (or **Delete + Create new**).
2. Copy the new `re_…` key.
3. Render → Environment → `RESEND_API_KEY` → paste → Save → wait for redeploy.

### Rotate Neon DB password
1. Neon → Project → Connection Details → **Reset password**.
2. URL-encode special chars (`@` → `%40`, `#` → `%23`, `!` → `%21`).
3. Render → Environment → `DATABASE_URL` → paste full new conn string → Save.

### Rotate R2 tokens
1. Cloudflare → R2 → **Manage R2 API Tokens** → create new token scoped to the bucket (Read+Write).
2. Copy Access Key + Secret Key.
3. Render → Environment → update `R2_ACCESS_KEY` + `R2_SECRET_KEY` → Save.
4. After Render redeploys and works, delete the old token in Cloudflare.

---

## 9. Adding a new env var (when introducing a feature)

1. **Code:** read it via `os.environ.get("MY_VAR", "<default>")`. Always have a default for local dev.
2. **Local:** add to `traqooh-backend-python/.env` (in `.gitignore` — never commit).
3. **Production:** Render → Environment → **Add Environment Variable** → Save.
4. **Document it:** append to this file's section 2 and `CLAUDE.md`'s "Backend Environment Variables" table.

---

## 10. Local development setup (one-time)

### Backend
```bash
cd traqooh-backend-python
python -m venv .venv
.venv\Scripts\activate          # PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # then fill in DATABASE_URL etc
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd traqooh-frontend
npm install
echo VITE_API_BASE=http://localhost:8000 > .env.local
npm run dev
```

### Mobile (Android emulator)
```bash
# Android Studio → AVD Manager → start "Medium Phone API 35"
# If emulator opens off-screen: D:\Programming\fix-emulator.ps1
cd traqooh-app
npx expo start --port 8082
# In another terminal:
adb -s emulator-5554 reverse tcp:8082 tcp:8082
# In emulator → Ctrl+M → Change Bundle Location → localhost:8082 → Apply
```
Notes from testing app v2 (2026-10-04):
- The emulator needs a few GB free on the drive that holds the AVD; with C: nearly full it refuses to start ("not enough disk space"). Keep the AVD on D: (`ANDROID_AVD_HOME`).
- Expo Go works for v2 (no custom native code). Push can't be tested in Expo Go on Android.
- To test against a local backend: `EXPO_PUBLIC_API_BASE=http://localhost:8000 npx expo start --port 8082` and `adb reverse tcp:8000 tcp:8000`. Never point a test build at production with a real PIN.
- `expo start --localhost` listens on IPv6 `::1` only, while `adb reverse` connects over IPv4, so Expo Go reports "Failed to download remote update". Either run without `--localhost` or bridge 127.0.0.1 to `[::1]`.
- Expo Go only opens the project after Metro has finished starting; if it shows "Something went wrong", reload.

### Tests
```bash
cd traqooh-backend-python
python tests/smoke_test.py                       # SQLite, ~2 min, 155 checks
SMOKE_DATABASE_URL=postgresql://postgres@localhost:55432/traq_smoke python tests/smoke_test.py   # an EMPTY throwaway Postgres
```
GitHub Actions (`.github/workflows/ci.yml`) runs the backend tests and the web build on every push to `main`.

---

## 11. Backup & data export

### Manual SQL export (one-off, for migrations / sanity)
```bash
# Via Neon console: https://console.neon.tech → Tables → Export
# Or via psql:
pg_dump "postgresql://user:URLENCODEDPWD@host/neondb?sslmode=require" --no-owner > traqooh-backup-$(date +%Y%m%d).sql
```

### Neon's automated backup (free tier)
- 7-day point-in-time recovery is enabled by default on free tier.
- Check at: https://console.neon.tech → Project → Backups.
- Restore: pick a timestamp → "Restore to this point" → creates a new branch you can switch to.

### Cloudflare R2 — no built-in backup
- R2 holds the actual photo bytes. If a file is deleted, it's gone.
- Mitigation: every photo URL is also stored in `campaign_activities.image_urls` — if R2 disappears, the URLs still point at where they would have been. The DB itself is Neon-backed.
- If you ever need an R2 backup: use `rclone copy r2:traqooh-media local-folder/` (set up `rclone config` with R2 as S3-compatible).

---

## 12. Monitoring & alerting (what you have, what you don't)

### Currently set up
- **UptimeRobot:** pings `/health` every 5 min. If it stops responding, you get an email. Confirmed alive 2026-06-23.
- **Render's built-in logs:** stream stdout/stderr. Filter by severity. No retention beyond 7 days on free.
- **Cloudflare Analytics:** page views, request counts on the FE.

### Not set up (recommended for go-live)
- **Sentry / Rollbar** — captures uncaught exceptions in FE + BE with stack traces. ~$0/mo on free tier; recommended.
- **Database query monitoring** — Neon has a slow-query log; not actively watched.
- **Resend email delivery alerts** — Resend dashboard shows delivery / bounce / open rates but doesn't email you on a bounce spike. Worth wiring up if email volume grows.

---

## 13. Common command cheat sheet

```bash
# Deploy FE
cd traqooh-frontend && npm run build && npx wrangler pages deploy dist --project-name traqooh-frontend --branch main

# Deploy BE (push triggers it)
cd traqooh-backend-python && git add -A && git commit -m "msg" && git push origin main

# Build Android
cd traqooh-app && eas build --platform android --profile preview --non-interactive --no-wait

# Health
curl -s https://traqooh-backend-python.onrender.com/health

# Send test OTP
curl -s -X POST https://traqooh-backend-python.onrender.com/api/auth/send-otp -H "Content-Type: application/json" -d '{"email":"saurabh.anand24@gmail.com"}'

# Current FE bundle hash on production
curl -s https://app.brandsculpt.com | grep -o "index-[A-Za-z0-9]*\.js" | head -1

# Tail Render logs (in browser)
# https://dashboard.render.com → traqooh-backend-python → Logs

# Check EAS build status
cd traqooh-app && eas build:list --limit 1 --non-interactive
```
