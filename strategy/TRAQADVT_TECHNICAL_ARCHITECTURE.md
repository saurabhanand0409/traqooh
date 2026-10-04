# TraqAdvt — Technical Architecture

> Status: proposal (2026-10-04). Describes the target architecture and the incremental path from today's TraqOOH. **No rewrite.**

---

## 1. Principles

1. **Modular monolith.** One FastAPI service and one Postgres database, split into clear internal modules. No microservices until a module has a team and a scaling reason of its own.
2. **Incremental migration.** Every change is additive and shippable on its own; TraqOOH keeps working at every step.
3. **Numbers are computed by code, explained by AI.** Statistical and optimisation code produces every figure; the LLM only interprets and narrates (see AI architecture).
4. **Tenant isolation before the second customer.**
5. **Every change tested and reversible:** migrations, a regression suite in CI, and one-click rollback.
6. **Boring infrastructure.** Managed Postgres, object storage, one API service, one worker. Add pieces only when a measured need appears.

## 2. Target shape

```
                 ┌─────────────────────────── Clients ───────────────────────────┐
                 │  Web app (React)   Advertiser portal (React)   Field app (Expo)│
                 └───────────────┬───────────────────────┬─────────────────────┘
                                 │ HTTPS, JWT (httpOnly cookie later)
┌────────────────────────────────▼───────────────────────────────────────────────┐
│ API — FastAPI modular monolith                                                  │
│  identity & tenancy │ media (inventory) │ planning │ campaigns & execution      │
│  proof              │ measurement       │ connectors │ reporting │ ai (LLM gateway) │
└──────┬──────────────────────┬──────────────────────┬────────────────────────────┘
       │                      │                      │ enqueue
┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼─────────────────────────────┐
│ Postgres    │        │ R2 object   │        │ Worker (same codebase)             │
│ app schema  │        │ storage     │        │ connector syncs · document extraction │
│ analytics   │        │ photos, PDFs│        │ report rendering · scheduled jobs  │
│ schema      │        │ raw imports │        └──────┬─────────────────────────────┘
└─────────────┘        └─────────────┘               │ heavy, occasional
                                              ┌──────▼─────────────────────────────┐
                                              │ Modelling jobs (separate compute)  │
                                              │ MMM fits (Meridian / PyMC),        │
                                              │ response curves, backtests         │
                                              └────────────────────────────────────┘
External: Anthropic API (LLM) · Meta/Google Ads APIs · GA4 · call tracking · CRM · Resend · RoadStar (if licensed)
```

## 3. Modules (and where today's code goes)

| Module | Responsibility | Today's code |
|---|---|---|
| identity & tenancy | Users, organisations, memberships, roles, sessions, audit log | `jwt_utils.py`, auth routes in `main.py`, `routes/admin.py` |
| media | Media owners, properties, assets, channel extensions, prices, availability, audience estimates, geography | site routes in `main.py`, `routes/vendors.py` |
| planning | Briefs, plans, scenarios, optimiser calls, what-if | *new* |
| campaigns & execution | Campaigns, line items, approvals, advertiser links, field assignments | `routes/campaigns.py`, access routes in `main.py`, `routes/advertisers.py` |
| proof | Proof visits, review loop, PoD reports, zips | `routes/activities.py`, `proofs.py`, `photo_zip.py` |
| measurement | Response paths, outcomes, experiments, model results | *new* |
| connectors | Imports (CSV/Excel/PDF/email) and platform APIs → normalised tables | *new* |
| reporting | Dashboards, launch metrics, exports, verifiable reports | `routes/dashboard.py`, frontend PDF code |
| ai | LLM gateway: prompts, tool schemas, evals, logging, cost control | *new* |

Split `main.py` into these modules **as each area is touched**, not as a separate project.

## 4. Key technical decisions

### 4.1 Tenancy
- Add `organization_id` to every tenant-owned table (campaigns, advertisers, sites/assets, line items, activities, outcomes, prices).
- A FastAPI dependency resolves the caller's organisation from their membership. Every query in a tenant-owned module filters by it, through a small repository helper so it can't be forgotten.
- The access-matrix test gains a **cross-tenant** column: a user of org A must get 404/403 on every org-B object.
- Later, as defence in depth: Postgres row-level security keyed on a session setting.

### 4.2 Migrations, CI, environments
- **Alembic:** baseline the current schema, then every change is a migration. Replace the startup `run_migrations()` SQL.
- **CI (GitHub Actions):** on every push, run backend tests (including the access matrix), lint, and the web build. Block merges to `main` on failure.
- **Staging:** a Neon branch (copy-on-write copy of production) plus a Render preview service. Test migrations against real-shaped data before production.
- **Web deploys from CI**, not from a laptop. Stop publishing source maps; send them to Sentry only.

### 4.3 Background work
- A **worker process** from the same codebase, reading a Postgres `job` table (`SELECT … FOR UPDATE SKIP LOCKED`). No Redis or queue service until volume demands it.
- Scheduled jobs (connector syncs, nightly aggregates) run via Render cron or the worker's scheduler.
- **Heavy modelling** (MMM fits) runs on separate, occasionally-started compute with more memory, because Render's small instances can't fit Bayesian models. Results are written back as `MODELED` rows.

### 4.4 Data and geography
- Postgres stays the system of record. An `analytics` schema with materialised views serves dashboards and planner features.
- **PostGIS** for assets, geographies, coverage and distance queries (Neon supports the PostGIS extension; confirm the version when enabling it).
- Move analytics to a warehouse (BigQuery or DuckDB-based) only when tables pass ~10 million rows or MMM inputs outgrow Postgres.

### 4.5 Connector framework
Each connector implements one interface:

```
authorize()            → store encrypted credentials (OAuth refresh token / API key)
fetch(since)           → raw records, written unchanged to raw storage (R2 + raw table) for replay
normalize(raw)         → rows for delivery_metric / outcome / price_observation / media_asset
upsert(rows)           → idempotent writes keyed by (source, external_id, date)
schedule               → cron expression; backfill window; rate-limit policy
health                 → last success, lag, error count (shown in the UI)
```

Build order, driven by the ICP: **CSV/Excel import → manual entry forms → call-tracking provider → Meta Ads → Google Ads → GA4 → CRM (CSV first, then Zoho/HubSpot/Salesforce APIs) → quote-PDF/email extraction.** Each is optional; nothing in the core depends on any single connector.

### 4.6 Security and compliance
- Secrets only in Render environment variables. Connector tokens encrypted at rest with an app-level key (cloud KMS later).
- Move JWT from `localStorage` to httpOnly cookies, with short-lived access tokens, refresh tokens and server-side revocation.
- Structured audit log: who, what, which object, before/after, from where.
- **DPDP Act (India):** record consent for field workers' location data and for advertisers' lead data. Set retention periods. Minimise personal data (leads stored as counts unless the advertiser opts into lead-level import). Document the cross-border transfer, or move data closer (next point).
- **Region:** evaluate moving database and API to a region nearer India (e.g. Singapore or Mumbai, where the providers offer it) to cut ~250 ms round trips and simplify data-protection conversations.
- Backups: Neon point-in-time restore, plus a quarterly restore drill written into `OPERATIONS.md`.

### 4.7 Verifiable reports (trust feature)
Render Proof of Display and plan reports **on the server**, store the PDF, and print a short verification code and URL on it. Anyone holding the PDF can check it against the original on a public verification page. This turns the trust promise into something checkable and stops edited copies circulating.

### 4.8 Performance
- Upgrade Render to Starter before the pilot: no cold starts.
- Paginate list endpoints (`/api/sites` already returns ~85 KB for ~116 sites; it will not scale to 10,000).
- Code-split the web bundle (currently ~1.3 MB in one file).
- Neon's pooled connection string is already used; keep it.

### 4.9 Observability
Set the Sentry DSNs (backend and web), JSON logs with request and organisation IDs, uptime checks, slow-query logging, and a per-connector health panel.

## 5. Evolution path (first steps in order)

1. **Trust cleanup:** remove the fake payment page, the fabricated chatbot claims, the demo login and the invented stats. (Needs approval: it changes product pages.)
2. **CI + Alembic baseline** (no behaviour change).
3. **Field app v2** (in progress) — makes verified delivery flow again.
4. **Campaign brief + outcome capture** (M5–M6 in the media model): objective, budget, KPI, response paths, outcome entries.
5. **Tenancy (M1–M2)** before any second agency.
6. **Media core (M3–M4):** `media_asset` and `price_observation` backfilled from sites and line items.
7. **Planner v0** (deterministic OOH site selection + LLM explanation).
8. Connectors, geography (PostGIS), experiments, modelling compute — as the roadmap phases require.

## 6. What is deliberately deferred

Microservices, Kubernetes, a separate graph database, a streaming stack (Kafka), a data lake, mobile apps for advertisers, multi-region deployment, real-time bidding/programmatic integration. Each is reconsidered only when a measured need appears.
