# TraqOOH — Current State Assessment

> Audit date: 2026-10-04. Read-only audit of the `traqooh` monorepo plus the live services. No production code was changed to write this.
> Facts here were checked against the code and the live system; where something is an opinion it says so.
> Companion: `CLAUDE.md` (full route map and schema), `CHANGELOG.md` (history).

---

## 1. One-paragraph summary

TraqOOH is a working, live, small OOH **operations** tool: an agency plans a campaign from a billboard inventory, sends the advertiser one evolving link to shortlist and approve, field workers capture GPS-stamped proof photos, staff review them, and the advertiser gets a Proof of Display report and a photo zip. It runs on free tiers for about $0/month. It has **no AI, no billing, no outcome data, no tenant isolation, and no paying customers yet**. As a foundation for TraqAdvt it contributes a real execution workflow and the beginnings of a rare dataset (verified OOH delivery with GPS, time and price paid). It contributes nothing yet towards planning intelligence, because nothing it stores says what a campaign achieved.

---

## 2. Architecture (as it actually is)

```
Admins / employees ─┐                         ┌─ Neon Postgres (free, 0.5 GB, us-east-1)
Advertisers (link)  ├─ React/Vite on Cloudflare Pages ─┐   │
                    │   app.brandsculpt.com            ├─ FastAPI on Render (free, Oregon) ─┼─ Cloudflare R2 (photos/videos)
Field workers ──────┴─ Expo/React Native Android APK ──┘   │
                                                           ├─ Resend (email: OTP, advertiser links)
                                                           └─ Expo push API (server side only; app side not built)
```

| Layer | Technology | Size | Notes |
|---|---|---|---|
| Backend | Python, FastAPI, SQLAlchemy, psycopg2 | ~5,000 lines, 106 routes | `main.py` alone is 1,502 lines; routers for campaigns, advertisers, activities, admin, vendors, dashboard, audits |
| Web | React 18, Vite 5, Tailwind 3, Recharts, Leaflet, jsPDF | ~15,000 lines | `Campaigns.jsx` is 2,394 lines; PDFs are generated in the browser |
| Field app | Expo SDK 56, React Native 0.85 | ~1,460 lines | PIN / email-OTP login, photo+video upload; last build 2026-06-23 |
| Database | Postgres (Neon) | 17 tables | Schema changes are hand-written `ALTER TABLE` in `run_migrations()` at startup; no Alembic |
| Storage | Cloudflare R2 | — | Public bucket URL; uploads limited to photo/video/PDF since 2026-10-03 |
| Hosting | Render (backend), Cloudflare Pages (web), EAS (app) | — | Backend auto-deploys from GitHub `main` (root dir `traqooh-backend-python`); web deploys by hand from the founder's machine with `wrangler` |
| Tests | `traqooh-backend-python/tests/smoke_test.py` | 108 checks | SQLite, includes an access matrix; **no CI runs it** |
| Monitoring | Sentry wired (backend + web), UptimeRobot | — | Sentry has no DSN set, so it is effectively off |

---

## 3. Existing features (verified)

**Inventory**
- Site CRUD, multi-photo gallery with cover photo, site types (Billboard, Hoarding, Unipole, LED, Bus Shelter, …).
- GPS (lat/lng, paste-a-Google-Maps-link), multi-row size (qty × width × length, ft/inch), lighting, facing, rate card (`potential_monthly`, `base_rate`), availability dates, booked status.
- List and map views; "No GPS" filter.

**Campaign planning and selling**
- Campaign status flow DRAFT → PLANNED → FINALIZED → RUNNING → COMPLETE (+CANCELLED), with automatic date-based advance.
- Add sites, per-site cost lines (media, printing ₹/sqft, mounting, other), cost sheet PDF.
- One evolving advertiser link (proposal → shortlist → finalize → live tracking), sent by email (Resend) or WhatsApp click-to-chat. Advertiser self-sign-up and login dashboard.
- Re-approval flow for sites added after finalize.

**Execution and proof**
- Field PINs (30-day) and assignment of a worker per site.
- Upload v2: several photos per visit, shot labels (close-up/wide/landmark/video), capture time, GPS ± accuracy, idempotent retries.
- Monitoring board: Installation / Audit / Takedown columns, off-site flag (>250 m from the site), Verify / Needs-retake with reason, push-notification hooks (server side).
- Proof of Display report (browser PDF) and photo zip (staff and advertiser).

**Admin and reporting**
- Master (super admin), Admin and Employee dashboards; launch metrics (proposals sent, links opened, campaigns running, % of sites proved within 48 h); activities log; reports.

---

## 4. Database entities

| Table | What it holds | TraqAdvt relevance |
|---|---|---|
| `companies` | Media-owner / vendor companies **and** the employer of staff users (`user_accounts.vendor_id`) | **Conflated concept** — see weakness W3 |
| `gst_registrations`, `contacts` | Company KYC | Keep |
| `user_accounts` | All logins; one role string | Needs organisation membership + roles per org |
| `sites` (31 columns) | Billboard inventory | Becomes the OOH extension of a common media asset |
| `site_images` | Photo library per site | Keep |
| `advertisers` | Brand/client profile | Keep; needs industry, geography, objectives |
| `advertiser_access_links` | Hashed share-link tokens, purpose, use count | Keep |
| `advertiser_company_links`, `advertiser_shares` | Partial tenancy and sharing | Replace with real tenancy |
| `campaigns` | name, advertiser, type, dates, `total_cost`, status, notes | **No budget, objective, KPI, audience or geography** |
| `campaign_site_assignments` | Line items: site, dates, agreed/printing/mounting cost, shortlist, worker | The most valuable pricing data: real negotiated prices |
| `campaign_activities` | Proof visits: photos, labels, GPS, accuracy, capture time, review status | The most valuable delivery data: verified execution |
| `site_audits` | Older scheduled-audit model | Overlaps `campaign_activities`; consolidate |
| `field_pins`, `push_tokens`, `otp_tokens` | Field auth and push | Keep |
| `activity_log` | Free-text audit trail | Needs structure (who, what, before/after) |

**What is missing for TraqAdvt:** outcomes (leads, calls, walk-ins, sales), objectives and budgets, audience estimates (impressions/reach), any non-OOH channel, organisations/tenants, billing.

---

## 5. Existing workflows

1. Employee builds inventory (or imports it) → creates a campaign → adds sites with costs.
2. Sends the proposal link → advertiser shortlists (auto-saved) → finalizes.
3. Staff assign a field worker per site → worker uploads proof visits from the app.
4. Staff verify or send back for retake → advertiser sees live tracking, downloads the PoD report and zip.
5. Campaign auto-completes after its end date.

Nothing records what happened to the advertiser's business afterwards.

---

## 6. APIs and roles

- 106 REST routes; the full map is in `CLAUDE.md` → Backend Route Map. Since 2026-10-03 every data route checks a role (`require_staff`, `require_admin`, `require_staff_or_field`, `require_field`); an access-matrix test covers ~45 of them.
- Roles: `SUPER_ADMIN`, `ADMIN`, `EMPLOYEE` (legacy `MEDIA_OWNER` / `TEAM_MEMBER` normalised to it), `ADVERTISER`, `FIELD`.
- Auth: JWT (HS256) in browser `localStorage`, 7 days (30 days for field workers), no server-side revocation.

## 7. Screens

Web: login pages (advertiser, employee, admin, master), sign-up pages, dashboards (employee, admin, master, advertiser), Inventory, Campaigns (Linked Sites / Add Sites / Monitoring / Share), Campaign detail, Advertisers, Vendors, Activities, Reports, Account, public advertiser link (`/access/:token`), Pricing, Payment, Contact, Privacy, Terms.
App: Login (PIN / OTP), Home (My Assigned Sites / All Sites), Site detail (capture, gallery, GPS viewer).

## 8. Integrations

Resend (email), Cloudflare R2, Expo push (server side), Sentry (unconfigured), UptimeRobot. **No** ad-platform, analytics, CRM, payment or measurement integrations. No AI/LLM anywhere — the "TraqBot" chatbot is a hard-coded FAQ list (see W6).

---

## 9. Strengths (keep these)

- **S1. A complete, real OOH execution loop.** Planning → approval → proof → report works end to end and is live.
- **S2. Verified delivery data.** Every proof photo carries GPS, accuracy, capture time, shot type and a reviewer verdict. The *capability* is not unique (Oi Media, OOHAudit and Adarth offer geo-tagged proof; see `INDIA_MARKET_STUDY.md`), but the accumulating *dataset*, joined to prices paid and outcomes, is the seed of a data moat.
- **S3. Real negotiated prices.** `campaign_site_assignments` stores what was actually paid per site, not just rate cards.
- **S4. Low-friction advertiser UX.** One link, no login needed, WhatsApp delivery — matches how Indian SMB buyers actually work.
- **S5. Cheap to run.** ~$0/month today; $7/month removes the cold start.
- **S6. Recently hardened.** API lockdown, safe uploads, idempotent field uploads, 108-check regression test.

## 10. Weaknesses

- **W1. No outcome or objective data.** Campaigns have no budget, objective, KPI or results. Without this, no planner or response curve can ever be trained. This is the single biggest gap versus the TraqAdvt vision.
- **W2. No tenant isolation.** Every staff account can read every company's sites, campaigns and advertisers. A second agency cannot be onboarded safely. (Already identified as a Phase 1 decision.)
- **W3. `companies` means two things.** It is both "the media owner whose sites are listed" and "the organisation a staff user works for". Multi-tenancy and a media-owner portal both need these separated.
- **W4. No audience data.** No impressions, reach, traffic or visibility estimates per site. Any "reach/frequency" claim today would be invented.
- **W5. Brand entanglement.** Package `com.brandsculpt.traqooh`, domain `app.brandsculpt.com`, emails from `noreply@brandsculpt.com`. A buyer-neutral TraqAdvt owned visibly by an agency is a credibility problem (see Strategy → neutrality).
- **W6. Fabricated or fake content in the product (trust liabilities):**
  - `Chatbot.jsx`: claims "India's leading", "10,000+ billboards", "20+ cities", a 14-day trial and a 7-day money-back guarantee; quotes plans at ₹2,999 / ₹7,999 / ₹19,999 that contradict the launch pricing answers; advertises a demo login (`media.owner1@example.com`) that does not exist.
  - `Payment.jsx`: a card/UPI form that collects card number and CVV, waits 2 seconds, then reports success at random about 90% of the time. No payment is taken. This looks like a fake checkout to any reviewer (payments partner, Play Store, customer).
  - `Pricing.jsx` and the old landing page in `App.jsx`: invented stats ("10,000+ media sites", "₹100Cr+ transactions") and stock-photo testimonials.
  For a product whose whole promise is trust, these must go before any customer or investor sees them.
- **W7. No CI and hand-written migrations.** Tests only run when someone remembers; schema changes are startup SQL that is Postgres-specific and untracked.
- **W8. Large single files.** `main.py` (1,502 lines) and `Campaigns.jsx` (2,394 lines) are slowing change and raising regression risk.
- **W9. Data residency and latency.** Data sits in US regions (Neon us-east-1, Render Oregon) while all users are in India: ~250 ms per round trip, and a question to settle under India's DPDP Act for field workers' location data.
- **W10. Capacity.** One founder, part-time, plus AI-assisted development. Every roadmap item has to be judged against that.

## 11. Technical debt (ranked)

| # | Debt | Risk | Fix |
|---|---|---|---|
| 1 | No tenant isolation | Data leak between customers | `organization_id` on core tables + scoped queries (Phase 1) |
| 2 | No migrations framework | Failed deploys, untracked schema | Adopt Alembic; baseline current schema |
| 3 | No CI | Regressions reach production | GitHub Actions: run `tests/smoke_test.py` + web build on every push |
| 4 | JWT in localStorage, no revocation | Stolen-token window of 7–30 days | httpOnly cookie + short access token + refresh, later |
| 5 | Two proof models (`site_audits`, `campaign_activities`) | Confusion, double logic | Retire `site_audits` |
| 6 | Monolith files | Slow, risky changes | Split by module as they are touched (no big-bang) |
| 7 | Public source maps on the web app | Source readable by anyone | Upload maps to Sentry only; don't publish |
| 8 | Web deploy from a laptop | Not reproducible | Deploy from CI or Cloudflare's GitHub integration |
| 9 | June APK can't upload since lockdown | Field app unusable until v2 | Field app v2 (in progress) |

## 12. Preserve / refactor / replace

| Preserve as-is | Refactor | Replace eventually |
|---|---|---|
| Proof pipeline (`campaign_activities`, review loop, PoD report, zip) | `companies` → split into Organisation (tenant) and MediaOwner (supplier) | Hand-written migrations → Alembic |
| Advertiser one-link portal | `sites` → OOH extension of a common `media_assets` core | `site_audits` → folded into activities |
| Negotiated-price line items | `campaigns` → add objective, budget, KPI, geography, audience | Fake Payment page → real Razorpay only when billing is built |
| Field app flow (being rebuilt) | Role string → org membership + per-org role | Chatbot FAQ → removed, or replaced by a grounded assistant much later |
| Stack: FastAPI, Postgres, R2, React, Expo | `main.py` → routers per module | Browser-side PDF generation → server-side when reports need to be verifiable |

**Recommendation: no rewrite.** The stack is ordinary and adequate. Everything TraqAdvt needs can be added incrementally around it.
