# TraqOOH — Product Onboarding

> For the incoming product owner / business lead. No code — what it does, who it's for, what works today, what's next.
> Last updated: 2026-06-27

---

## What is TraqOOH

A B2B SaaS platform for the **Out-of-Home (OOH) advertising industry in India**, built by **BrandSculpt**.

It digitizes the workflow between three groups:

1. **Media owners / vendors** — companies that own billboards, hoardings, LED displays. They list inventory.
2. **Advertisers** — brands like Tata, P&G etc. They book campaigns.
3. **Field workers** — the people who physically print, install, monitor, and take down ads. They report progress via Android app.

It also serves **BrandSculpt's internal team** — admins (full control) and employees (campaign planners).

### Value proposition
- **For vendors:** showcase inventory with photos, dates, rates. Track which sites are booked vs vacant.
- **For advertisers:** see a self-serve portal showing all your campaigns, costs, and (after launch) live geo-tagged proof photos of every site.
- **For field workers:** simple Android app that knows which sites you're assigned to, captures geo-tagged photos/videos.
- **For BrandSculpt:** central control plane — see every campaign across every advertiser, every vendor.

---

## Who uses it

| User type | Login method | What they see |
|---|---|---|
| **Super Admin** | Email + password (`/masterlogin`) | All companies, all campaigns, all data |
| **Admin** (vendor/company admin) | Email + password (`/adminlogin`) | Their own company — full CRUD across employees, inventory, campaigns, advertisers |
| **Employee** (BrandSculpt staff) | Email + password (`/employeelogin`) | All sites across all vendors (so they can plan campaigns globally). Only their own + shared campaigns. |
| **Advertiser** | Email + password (`/login`) OR token link emailed to them | Their campaigns, proof photos, cost sheets |
| **Field worker** | 4-digit PIN on Android app | Sites they're assigned to OR browse their vendor's full inventory |

---

## The main flow (advertiser perspective)

1. **Proposal:** BrandSculpt employee creates a campaign, picks sites from inventory, sets dates. Sends advertiser a **token link via email**.
2. **Review:** Advertiser opens the link in browser — no login required. Sees every shortlisted site with photos, location, cost.
3. **Shortlist:** Advertiser hearts the sites they want. Auto-saved.
4. **Finalize:** Advertiser clicks "Finalize." Campaign status → FINALIZED.
5. **Execution:** Field workers receive PINs, start the work. Capture geo-tagged photos at each phase: PRINT, MOUNTING, AUDIT, TAKEDOWN.
6. **Live tracking:** The same token link evolves — now shows "Live Tracking" view with all proof photos and GPS metadata, grouped by Start / End phase.
7. **Completion:** When end_date passes, status → COMPLETE.

---

## Campaign lifecycle

```
DRAFT → PLANNED → FINALIZED → RUNNING → COMPLETE
                                   ↘ CANCELLED (any time)
```

- **DRAFT, PLANNED**: Internal planning. Advertiser can't see anything yet.
- **FINALIZED**: Advertiser signed off. Field workers can start.
- **RUNNING**: Campaign is live (auto-advances when start_date ≤ today).
- **COMPLETE**: Done (auto-advances when end_date < today).
- **CANCELLED**: Anytime; sticky.

---

## What's built today

### Web app (admin + employee)
- Multi-role login (4 dashboards)
- **Inventory management:** add/edit/delete sites with multi-row size description (works for any setup including LED video walls with N×42" screens), per-site photo gallery (cover photo + extras), LED-only video upload
- **Campaign planning:** lifecycle workflow, link sites from inventory, set agreed costs (per-sqft for Media / Printing / Mounting / Other), share with colleagues
- **Monitoring board:** per-site Start/End photo columns, field-worker assignment + inline PIN creation, photo+video upload, verify ✓ per photo, lightbox with GPS / date-time / photographer / Maps link
- **Finalized cost sheet:** PDF download (A3 landscape, branded, with finalized rows only)
- **Re-approval flow:** sites added after FINALIZE flagged as "pending approval"; one click emails advertiser to re-finalize
- **Activities feed:** global execution log with filter + photo/video lightbox
- **Reports:** global KPIs (sites total/booked, advertisers active, revenue this month, etc.)

### Web app (advertiser-facing)
- **Standalone dashboard** at `/dashboard/advertiser` (login required) with KPI row, campaign cards, proof photo + video gallery, GPS map links
- **Public access link** at `/access/:token` (no login) — read-only proposal view that evolves into Live Tracking after FINALIZE
- Advertiser can: toggle heart to shortlist, click photos for full-screen, download Cost Sheet PDF, finalize
- Advertiser **cannot** edit dates, costs, or rates (per current product spec)

### Android mobile app
- OTP login via email (Resend)
- Field PIN login (4-digit, 72h expiry)
- GPS-based nearby sites discovery
- "My Assigned Sites" / "All Sites" toggle (defaults to assigned for field workers)
- Photo + Video capture (camera or gallery), 60-second video cap
- Photo viewer with GPS metadata: lat/lng, Google Maps link, date/time, photographer name, notes
- One-shot activity logging that auto-discovers the active campaign for the site

---

## Live URLs

| What | URL |
|---|---|
| Marketing site | https://traqooh.brandsculpt.com |
| Web App | https://app.brandsculpt.com |
| Backend API | https://traqooh-backend-python.onrender.com |

---

## Current stage and what it costs to run

| Stage | Photos/month | Monthly cost | Notes |
|---|---|---|---|
| **Today (free tier)** | 0–200 | $0 | Cold-start delays of 50s every 15 min idle |
| **Recommended for go-live** | 0–600 | $7 | Just upgrade Render to Starter |
| **Growth** | 600–1,500 | ~$25 | Upgrade Render to Standard |
| **Scale** | 1,500–2,500 | ~$45 | + upgrade Neon DB |

Everything is built on free tiers right now. The biggest risk is **Render Free's 50-second cold start** — field workers will hit this. **First infrastructure spend should be $7/mo Render Starter.**

---

## Major recent changes (current session)

| What | Why it matters |
|---|---|
| **Multi-row Size Description** in Inventory | Inventory now supports complex setups: "20 screens of 42 inch" for LED video walls, multi-face hoardings, etc. Previously only fit a single W×L. |
| **LED video upload** | LED sites can now have proof videos (not just photos) in the inventory gallery and on the monitoring board. |
| **Delete photos/videos on live campaigns** | Admins/employees can remove erroneous uploads (e.g. blurry photo) from the monitoring board. |
| **Cost sheet UX fixes** | Media Cost no longer pre-fills from rate card (was confusing). Advertiser cost sheet "Media Cost" column now matches the "Total" column (was showing different numbers — fixed). Download Cost Sheet now works without needing to manually check checkboxes — defaults to all sites. |
| **"Not Applicable" printing type** | Added to dropdown for LED sites that don't need printing. |
| **Delete inventory works reliably** | Was failing silently before. Now shows clear error messages if anything goes wrong, with bulletproof DB cascade. |
| **Database connection pooling** | Switched to Neon's PgBouncer pooler — multiplexes 10 connection limit to ~100. Less risk of "Internal Server Error" under load. |

---

## What's pending (priority order)

### Before general launch
1. **Upgrade Render to Starter ($7/mo)** — eliminates cold starts. Single biggest UX risk today.
2. **Run one pilot campaign end-to-end** — one real advertiser, one real vendor, real field workers. Surfaces issues no dev testing can.
3. **Privacy policy + Terms of Service pages** — required for Google Play Store submission.
4. **Verify Neon free-tier backups** — should be 7-day point-in-time recovery.

### Nice to have (next 3 months)
- Publish Android app to Google Play Store
- Add site photo upload directly from mobile app (currently web only)
- Invoice / billing module
- **Razorpay payment gateway** (preferred for Indian B2B because of UPI + GST handling — better than Stripe for this market)
- WhatsApp notifications (Twilio or Meta Cloud API) — Indian advertisers expect WhatsApp updates more than email
- Campaign approval workflow with submit/reject/comment flow
- Sentry for error monitoring

### Longer term
- Vendor-level direct logins (currently vendors don't log in directly — admins act on their behalf)
- Multi-tenant isolation hardening
- Multi-region deployment (Indian region for lower latency)
- iOS app

---

## Operations & dependencies

| Service | Cost today | Owner | What happens if it goes down |
|---|---|---|---|
| Render (backend) | Free | Saurabh | Whole app is offline. Status: https://status.render.com |
| Cloudflare Pages | Free | Saurabh | Web app unreachable but backend still up |
| Neon Postgres | Free | Saurabh | App returns 500 for any data call |
| Cloudflare R2 | Free | Saurabh | New uploads fail; existing photos still load |
| Resend (email) | Free | Saurabh | OTPs and advertiser links don't deliver |
| UptimeRobot | Free | Saurabh | Backend cold-starts more (50s wait) |
| EAS (mobile builds) | Free | Saurabh | New APK builds queue |
| DNS (Cloudflare) | Free | Saurabh | Public URLs become unreachable |

**Single owner risk**: every account is on `saurabh.anand24@gmail.com`. A new PO should:
1. Get added as a team member / collaborator on every service ASAP
2. Get the GitHub repos forked or org-owned, not personal-account-owned
3. Get a copy of all env vars (write to a password manager — these include DB password, JWT secret, R2 keys)

---

## Day-1 priorities for a new PO

1. **Read this doc + ONBOARDING.md.** Skim CHANGELOG.md to see what's been worked on in the last 90 days.
2. **Get logins.** Saurabh needs to add you to: Render, Cloudflare, Neon, Resend, Expo, GitHub, UptimeRobot.
3. **Walk through the live app.** Log in as admin, then as employee, then open an advertiser access link. See what the user sees.
4. **Trigger a full campaign flow yourself.** Create campaign → share with test advertiser email → open the link → finalize → mark RUNNING → upload a test photo on Monitoring tab. This is 80% of the surface area.
5. **Talk to the dev (Saurabh).** Confirm: pilot vendor + pilot advertiser are lined up, dates of pilot, what success looks like.
6. **Decide on launch infrastructure.** Recommendation: pay $7/mo for Render Starter the day before pilot starts. Eliminates the cold-start risk.
7. **Decide on the 30-day roadmap.** From the Pending list above, what are the 3 things shipping next?

---

End of product brief.
