# TraqAdvt — Product Roadmap

> Status: proposal (2026-10-04). Phases are gated by **exit criteria**, not dates; dates are estimates at the current capacity (one part-time founder plus AI-assisted development).
> The founder's original 11 phases are kept in spirit but **re-ordered so that data collection precedes optimisation**. §5 maps the original phases to these.

---

## 1. Re-sequencing in one picture

```
Prove delivery ──► Capture outcomes ──► Plan OOH ──► Add regional media ──► Run experiments ──► Fit response curves ──► Optimise the next rupee
   (have it)         (Phase 1)          (Phase 3)       (Phase 4)             (Phase 5)            (Phase 6)                (Phase 6+)
```

You cannot optimise what you have not measured, and you cannot measure what you did not set up to measure when the campaign started.

## 2. Phases

### Phase 0 — Audit ✅ (this document set)
Current-state assessment, strategy, architecture. **Exit:** founder approves the direction.

### Phase 1 — TraqOOH foundation (target: Oct–Dec 2026)
**Goal:** a trustworthy OOH product running real campaigns that record outcomes.
- Trust cleanup: remove the fake payment page, fabricated chatbot and landing claims, the non-existent demo login.
- Field app v2 (stay logged in, Hindi/English, guided 3-photo capture with GPS/time stamp, offline queue, retakes) → pilot via direct APK install.
- **Campaign brief + outcome capture:** objective, KPI, budget, geography on every campaign; response paths (tracking numbers / QR per medium); weekly outcome entry and CSV import.
- Verifiable PoD reports (server-rendered, verification code).
- Engineering: CI, Alembic baseline, Sentry on, Render Starter.
- **Tenancy** (organisations, memberships, scoped queries) before a second agency.

**Exit criteria:** ≥ 3 closed-loop campaigns · ≥ 90% of booked sites verified on time · ≥ 1 paying customer or signed paid-pilot agreement · cross-tenant access test passing.

### Phase 2 — Platform foundation (target: Q1 2027)
**Goal:** the data model can hold any channel; nothing user-visible breaks.
- Media core: `media_asset`, `price_observation`, `availability`, channel extensions for print, radio, cinema (OOH from today's sites).
- Geography with PostGIS; localities for Patna and the next cities.
- CSV/Excel import for any channel's rate cards; evidence labels on every number.
- Structured audit log.

**Exit:** OOH + local print + local radio inventory representable and importable · full regression suite green · price observations backfilled from history.

### Phase 3 — AI OOH planner (target: Q1–Q2 2027)
**Goal:** "₹X, city, objective" → a defensible OOH plan in minutes.
- Planner v0 (coverage optimisation with price-fairness and media-owner reliability weights).
- Brief parsing and explanations via the LLM, what-if diffs, three scenarios.
- Evaluation harness (brief-parse accuracy, number-tracing validator).

**Exit:** used on ≥ 5 real campaigns · brief-parse accuracy ≥ 95% · zero untraceable numbers in explanations · agency confirms it saves planning time.

### Phase 4 — Regional media mix + measurement-lite (target: Q2–Q3 2027)
**Goal:** plan and measure the channels the ICP actually buys.
- Local print, local radio and cinema inventory (rate cards via import, quotes via assisted extraction with human review).
- Connectors: call-tracking provider, Meta Ads, Google Ads (spend and leads by geography).
- Cost-per-lead-by-medium reporting per campaign and per advertiser.
- Planner extended to allocate between OOH, print, radio and geo-targeted Meta/Google using **observed** cost-per-lead ranges (no curves yet).

**Exit:** ≥ 25 closed-loop campaigns using ≥ 2 media each · connectors healthy for 30 days.

### Phase 5 — Experiments (target: Q3–Q4 2027)
**Goal:** causal evidence, not just correlation.
- Geo-holdout design with a power calculator, assignment of localities, analysis, `EXPERIMENTAL` results.
- Experiment results feed the planner as the strongest evidence.

**Exit:** ≥ 5 completed experiments with reported lift ranges.

### Phase 6 — Response curves and the "next ₹10 lakh" (target: 2028)
**Goal:** marginal-return optimisation where the data honestly supports it.
- Per-advertiser Bayesian MMM (Meridian or PyMC-Marketing) on separate compute, with experiments as priors.
- Allocation by marginal return; the "next ₹10 lakh" answered as a probability across plausible scenarios.
- Internal benchmarks (category × city tier × medium); pooled benchmarks only with consent and minimum cell sizes.

**Exit:** calibration — actual results fall inside predicted 80% ranges 70–90% of the time.

### Phase 7 — Media-owner portal (trigger: ~20 active advertisers)
Inventory, rate cards and availability self-managed by media owners; RFP responses; proof upload by owners' own crews. **Free to media owners** for listing; never pay-for-ranking.

### Phase 8 — Marketplace (trigger: demand + a neutrality-preserving model)
RFPs, quotes, negotiation, booking, invoicing, payments. Only with a fee model that does not depend on which media is chosen (see Monetisation).

### Phase 9 — National channels (trigger: ICP moves up-market)
National digital publishers, TV/OTT, via uploaded plans, proposals and post-buy reports first; integrations only if partners offer them.

### Phase 10 — Autonomous planning (long term)
Continuous monitoring, saturation detection and reallocation **recommendations**, with per-action human approval; automatic execution only where platform APIs allow and the customer opts in.

## 3. Feature scoring

Scale 1–10. For *complexity*, *data requirement*, *time to market* and *third-party dependency*, **10 = most favourable** (simple, needs little data, fast, independent).

| Feature | Value | Revenue | Differentiation | Complexity | Data req. | Time | 3rd-party dep. | Scalability | Defensibility | Moat | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Campaign brief + outcome capture** | 8 | 6 | 8 | 8 | 9 | 8 | 8 | 8 | 8 | 10 | **81** |
| Price observations + internal benchmarks | 7 | 6 | 8 | 7 | 6 | 7 | 10 | 8 | 8 | 9 | **76** |
| Field app v2 (verified proof) | 9 | 6 | 7 | 6 | 9 | 7 | 9 | 7 | 6 | 9 | **75** |
| Verifiable PoD reports | 7 | 6 | 8 | 7 | 10 | 8 | 10 | 8 | 6 | 4 | **74** |
| Geo-experiment module | 7 | 6 | 9 | 5 | 5 | 5 | 10 | 6 | 9 | 10 | **72** |
| Call-tracking integration | 8 | 6 | 6 | 7 | 9 | 7 | 4 | 8 | 6 | 9 | **70** |
| Tenancy | 7 | 8 | 2 | 5 | 10 | 6 | 10 | 9 | 3 | 5 | **65** |
| Trust cleanup | 6 | 5 | 3 | 10 | 10 | 10 | 10 | 5 | 3 | 2 | **64** |
| OOH planner v0 | 8 | 7 | 6 | 5 | 6 | 5 | 8 | 7 | 6 | 6 | **64** |
| Print/radio rate-card ingestion | 6 | 5 | 5 | 7 | 7 | 7 | 7 | 6 | 5 | 6 | **61** |
| Per-advertiser MMM | 8 | 7 | 6 | 3 | 2 | 3 | 9 | 6 | 7 | 8 | **59** |
| Meta/Google Ads connectors | 7 | 6 | 4 | 5 | 8 | 5 | 3 | 8 | 4 | 7 | **57** |
| Quote PDF/email extraction | 6 | 4 | 5 | 5 | 7 | 6 | 7 | 7 | 4 | 6 | **57** |
| Media-owner portal | 5 | 5 | 4 | 5 | 8 | 5 | 7 | 7 | 5 | 6 | **57** |
| RoadStar licensing | 7 | 5 | 4 | 7 | 8 | 5 | 2 | 8 | 3 | 5 | **54** |
| Autonomous optimisation | 7 | 7 | 7 | 1 | 1 | 1 | 5 | 6 | 7 | 6 | **48** |
| Marketplace + payments | 5 | 7 | 2 | 3 | 8 | 3 | 4 | 7 | 3 | 4 | **46** |
| National TV / publisher planning | 3 | 4 | 3 | 3 | 3 | 3 | 2 | 5 | 3 | 4 | **33** |

Trust cleanup and tenancy score modestly but are **prerequisites**: they are done first regardless of score.

## 4. Capacity reality

- At 10–20 hours a week plus AI-assisted development, Phases 1–3 take roughly **6–9 months**.
- Phase 4 onwards needs at least **one full-time engineer**; Phase 6 needs someone with **Bayesian modelling experience** (contract is fine). That requires revenue or funding, which Phase 1's paid pilot starts to test.
- If Phase 1's exit criteria aren't met by end of Q1 2027, stop and re-examine the ICP before building further.

## 5. Mapping to the original 11 phases

| Original phase | Where it went | Why |
|---|---|---|
| 0 Audit | Phase 0 | Unchanged |
| 1 TraqOOH foundation | Phase 1 (+ outcome capture) | Outcome capture added: it is the moat's first row |
| 2 Platform foundation | Phase 2 | Kept minimal: only what the next phases need |
| 3 AI OOH planner | Phase 3 | Unchanged, defined as optimiser + LLM explanation |
| 4 Digital integration | Phase 4 (Meta/Google only, as ICP channels) | Regional advertisers use geo-targeted Meta/Google |
| 5 Digital publishers | Phase 9 | National publishers are irrelevant to the ICP |
| 6 TV | Phase 9 | Same; hardest data, agencies' home turf |
| 7 Print / radio / cinema | Phases 2 + 4 (**moved earlier**, regional versions) | The ICP buys local print, radio and cinema |
| 8 Cross-media optimisation | Phase 6 | Needs Phases 4–5 data first |
| 9 Measurement | Phases 1, 4, 5 (**moved earlier**) | Measurement must precede optimisation |
| 10 Marketplace | Phase 8 | Unchanged position, with a neutrality condition |
| 11 Autonomous planning | Phase 10 | Unchanged |
