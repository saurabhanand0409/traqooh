# TraqAdvt — Decision Log

> For future humans and AI agents: **why** things are the way they are. Add new decisions at the bottom; never delete one. Supersede it with a new entry that points back.
>
> **Status values:** `ACCEPTED` (the founder decided, or it is already built), `PROPOSED` (recommended in the 2026-10-04 strategy, awaiting approval), `OPEN` (the founder has said they will decide), `SUPERSEDED`.

---

## Already decided or built

### D-001 — Tool first, marketplace later · ACCEPTED (2026-09-26, questionnaire Q2)
**Decision:** Phase 1 is a tool for agencies and advertisers, not a marketplace.
**Consequence:** no booking, payments or media-owner self-service in Phase 1.

### D-002 — Data separation before a second agency · ACCEPTED (2026-09-26)
**Decision:** each agency's data must be fully separate before a second agency joins. A demo account also waits for this.
**Consequence:** tenancy is a Phase 1 prerequisite (`TRAQADVT_TECHNICAL_ARCHITECTURE.md` §4.1).

### D-003 — Proof set: 3 photos required, video optional · ACCEPTED (2026-09-26)
**Decision:** close-up, wide and landmark photos on every visit; video suggested for LED sites.

### D-004 — Every data endpoint requires a role · ACCEPTED, built (2026-10-03)
**Context:** an audit found about 40 endpoints with no login check, including Super Admin creation and the field-PIN list.
**Decision:** role gates on all data routes, an access-matrix regression test, uploads limited to photo/video/PDF, company self-sign-up closed until tenancy exists.
**Consequence:** the June APK can no longer upload; field app v2 is required.

### D-005 — One monorepo on GitHub · ACCEPTED, built (2026-10-03)
**Context:** the separate GitHub repos had been deleted, breaking Render's auto-deploy.
**Decision:** one private repo `traqooh` with backend, web, app and docs; Render root directory `traqooh-backend-python`.

### D-006 — Sentry for error monitoring · ACCEPTED (questionnaire)
**Decision:** use Sentry; wired in code, awaiting DSNs.

## Proposed by the 2026-10-04 strategy (awaiting approval)

### D-101 — OOH is the wedge; TraqOOH becomes the OOH module · PROPOSED
**Why:** it is the only part that exists, works and produces proprietary data (verified delivery, real prices).
**Consequence:** no rewrite; TraqAdvt grows around it.

### D-102 — Initial ICP: regional real-estate and education advertisers, via regional agencies · PROPOSED
**Why:** they are the heaviest OOH/print spenders, their outcome (enquiries) is cheap to measure per medium, they are underserved, and they are reachable through BrandSculpt.
**Rejected alternatives:** FMCG and enterprises (agency-locked, outcome needs retail data), D2C (digital-first, crowded tools).
**Revisit when:** the pilot shows advertisers won't capture outcomes, or a different segment converts faster.

### D-103 — North-star metric: closed-loop campaigns · PROPOSED
**Definition:** objective + budget + verified delivery + at least one outcome series.
**Why:** each one is a row of the moat; vanity metrics (sites listed, users) don't compound.

### D-104 — Channels ordered by ICP relevance · PROPOSED
**Order:** OOH → local print, radio, cinema → geo-targeted Meta/Google → national publishers and TV last.
**Why:** a regional ₹30L campaign doesn't buy JioStar; national data is the hardest to get.

### D-105 — Measurement before optimisation · PROPOSED
**Decision:** outcome capture (Phase 1), measurement-lite (Phase 4) and experiments (Phase 5) come before response curves (Phase 6).
**Why:** a response curve without outcome data is fiction.

### D-106 — Evidence labels and confidence on every number · PROPOSED
**Levels:** DIRECTLY_MEASURED, EXPERIMENTAL, ATTRIBUTED, MODELED, ESTIMATED, BENCHMARKED, each with a confidence cap. Confidence is computed by a versioned formula, never set by hand. Below minimum data thresholds the product says "not enough data".
**Why:** trust is the product; fake precision kills it.

### D-107 — The LLM explains; code computes · PROPOSED
**Decision:** every displayed number comes from deterministic or statistical code. An automated validator rejects LLM explanations containing numbers that aren't in the tool outputs.
**Model:** Claude (`claude-opus-5-5`) via the official Python SDK; strict tool schemas; structured outputs.

### D-108 — Use open-source MMM engines rather than building one · PROPOSED
**Decision:** Google Meridian or PyMC-Marketing for response curves, run on separate compute.
**Why:** modelling is commoditised and free; the scarce asset is data.

### D-109 — Partner for OOH audience data; don't build a mobility model · PROPOSED
**Decision:** license RoadStar (IOAA + AAAI) impressions if terms allow; otherwise show proxies labelled `ESTIMATED` with low confidence.

### D-110 — Modular monolith on the existing stack · PROPOSED
**Decision:** keep FastAPI, Postgres (Neon), R2, React and Expo; add Alembic, CI, a Postgres-backed job worker and PostGIS. No microservices, graph database or streaming stack until a measured need.

### D-111 — Common core + channel extensions in the media model · PROPOSED
**Decision:** `media_asset` core with one extension table per channel; `sites` becomes the OOH extension in place. Prices are observations with type, source and date; actual-paid prices are private to the recording organisation.

### D-112 — Separate `organization` (tenant) from `media_owner` (supplier) · PROPOSED
**Why:** today `companies` means both, which blocks tenancy and a media-owner portal.

### D-113 — No commission; flat fees that don't depend on the media chosen · PROPOSED
**Decision:** agency SaaS + per-verified-site fee now; banded advertiser licence later; a flat buyer-paid booking fee only if a marketplace is built. No placement fees from media owners.

### D-114 — Outcome data defaults to counts; lead-level data is opt-in · PROPOSED
**Why:** DPDP Act obligations, and education leads often involve minors (needing verifiable parental consent).

### D-115 — Remove fabricated and fake content before any customer sees it · PROPOSED
**Scope:** the fake payment page, the chatbot's invented claims and non-existent demo login, the invented landing stats and stock testimonials, and the pricing page's contradictory plans.

### D-116 — Verifiable reports · PROPOSED
**Decision:** server-rendered PoD and plan reports with a verification code and public check page.

## Open (the founder will decide)

### D-201 — Brand, legal entity and app package name · OPEN
TraqOOH vs. TraqAdvt vs. a new name; separation from BrandSculpt (recommended for neutrality, see D-113); the Android package name, which is permanent once on Google Play; the D-U-N-S number in the entity's exact legal name.

### D-202 — November scope (billing, two-step approval, data separation, marketplace) · OPEN

### D-203 — Media-owner price · OPEN

### D-204 — Render Starter ($7/month) · OPEN
Strongly recommended before the pilot (cold starts hurt field workers).

### D-205 — Account deletion flow · OPEN

### D-206 — Which marketing site version is correct · OPEN
