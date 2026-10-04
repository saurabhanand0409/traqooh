# TraqAdvt — Data Architecture

> Status: proposal (2026-10-04). How data enters, how it is labelled, how outcomes are captured, how the proprietary dataset accumulates, and what it legally may be used for.
> Entity definitions are in `TRAQADVT_MEDIA_MODEL.md`.

---

## 1. The data moat, stated plainly

The moat is a growing table of **closed-loop campaigns**: objective + budget + what ran (verified) + what it cost (actually paid) + what happened (outcomes by medium and geography). Each campaign adds rows nobody else has. Everything in this document exists to make that table grow quickly, honestly and legally.

## 2. Layers

| Layer | Contents | Storage | Rule |
|---|---|---|---|
| **Raw** | Untouched imports: CSVs, quote PDFs, emails, API responses | R2 + `raw_import` table (source, received_at, hash) | Never edited; can always be replayed |
| **Normalised** | Media assets, prices, availability, delivery metrics, outcomes in the common model | Postgres app schema | Every row has `source`, `evidence_level`, `as_of` |
| **Curated** | Cleaned, de-duplicated, joined views: cost per lead by medium, delivery coverage, price ranges | Postgres `analytics` schema (materialised views) | Recomputable from normalised data |
| **Modelled** | Response curves, MMM contributions, experiment lifts, benchmark ranges | Postgres `analytics` schema | Every row carries model version, interval and confidence |

## 3. Staged data strategy

| Stage | Data | Source | Evidence level | Starts | Unlocks |
|---|---|---|---|---|---|
| **A — Benchmarks** | Public rate cards, industry reports, RoadStar audience (if licensed), circulation figures | Manual entry, CSV, licences | `BENCHMARKED` / `ESTIMATED` | Phase 1 | A first plan with wide ranges and low confidence |
| **B — Customer history** | The advertiser's past campaigns, spend and leads (often a spreadsheet) | CSV import, CRM export | `ATTRIBUTED` / `DIRECTLY_MEASURED` | Phase 1 | Baselines and seasonality per advertiser |
| **C — TraqAdvt campaigns** | Verified delivery, real prices, response-path outcomes | Built-in (field app, line items, response paths) | `DIRECTLY_MEASURED` / `ATTRIBUTED` | **Now** — first pilot | Cost per lead by medium, per advertiser |
| **D — Experiments** | Geo holdouts and pre/post tests | Experiment module | `EXPERIMENTAL` | Phase 5 | Causal lift per medium, not just correlation |
| **E — Aggregated benchmarks** | Category × city-tier × format ranges, pooled across consenting customers | Curated layer | `BENCHMARKED` (internal) | When cell sizes allow (§5) | Better priors for new advertisers |
| **F — Cross-customer response models** | Hierarchical models sharing strength across advertisers | Modelling jobs | `MODELED` | Years out; needs scale and consent | The "next ₹10 lakh" answer for advertisers with little history |

## 4. Outcome capture — the most important product feature after proof

The ICP (real estate, education) produces **enquiries**. Enquiries can be tied to a medium cheaply, if the campaign is set up for it from day one.

| Mechanism | How | Evidence level | Confidence cap |
|---|---|---|---|
| **Unique phone number per medium** | A call-tracking number printed only on hoardings, another only in the newspaper ad; calls counted per number (Indian call-tracking/virtual-number providers exist; pick one in Phase 1) | `ATTRIBUTED` | 0.8 |
| **QR code / short URL per medium** | Medium-specific URL with UTM parameters; scans and form submissions counted | `ATTRIBUTED` | 0.8 |
| **Digital platform conversions** | Meta/Google lead forms via connectors | `DIRECTLY_MEASURED` (platform-reported) | 0.7 (platforms over-claim) |
| **"How did you hear about us?" register** | A one-field form or sheet at the advertiser's front desk | `ATTRIBUTED` (self-reported) | 0.5 |
| **Total enquiries / admissions / bookings** | Weekly totals from the advertiser's CRM or register, by locality | `DIRECTLY_MEASURED` (totals) | 0.9 |
| **Geo experiment** | Run a medium in some localities and not others; compare total enquiries | `EXPERIMENTAL` | from the analysis |

**Product rule:** creating a campaign asks for the objective, KPI and budget, and offers to generate response paths (numbers/QRs) for each medium. If the agency skips this, the campaign is labelled "delivery only" and does not count towards the north-star metric.

## 5. How much data each capability needs (rules of thumb, to be validated)

| Capability | Minimum data | Notes |
|---|---|---|
| Per-advertiser cost per lead by medium | 1 campaign with response paths | Shown as `ATTRIBUTED`, with the lead count, so small numbers look small |
| Internal price ranges (city × format) | ≥ 5 actual-paid observations per cell | Below 5, show "not enough data" |
| Shared (cross-customer) benchmark cell | ≥ 5 contributing organisations **and** ≥ 20 observations | Protects confidentiality (k-anonymity) and stability |
| Geo experiment | Comparable localities and enough weekly enquiries to detect the expected lift | Run a power calculation before every experiment; many small advertisers will only detect large lifts |
| Per-advertiser MMM / response curve | Roughly 1–2 years of weekly data with real spend variation, or fewer weeks plus experiments as priors | Without this, curves come only from benchmarks and are labelled `BENCHMARKED` |
| Pooled response models (Stage F) | Hundreds of closed-loop campaigns across many advertisers in a category | A multi-year, scale-dependent goal |

These thresholds are policy: the system must say "not enough data" rather than show a number below them.

## 6. Privacy, consent and data rights

- **India's DPDP Act 2023 applies.** TraqAdvt processes personal data of field workers (name, location, photos) and potentially of advertisers' enquirers.
- **Field workers:** consent at first login for location capture during visits only; retention of raw GPS tied to proof records; no background tracking.
- **Enquirer data:** store **counts by response path and period by default**, not names or phone numbers. Lead-level import is opt-in, encrypted, with a retention limit.
- **Children's data:** coaching-institute enquiries are often from minors. Lead-level data for minors requires verifiable parental consent under DPDP, so for education clients the default is counts only.
- **Customer data rights (in the contract):** the customer owns its data; TraqAdvt may use it to serve that customer. Use in **aggregated, anonymised** benchmarks needs an explicit clause and an opt-out; no customer's identifiable data or actual-paid prices are ever shown to another customer.
- **Media-owner data:** private prices stay private to the organisation that recorded them (see media model visibility rule).

## 7. Data quality

- Validation on import: required fields, units, plausible ranges (e.g. a hoarding price per month between ₹1,000 and ₹50 lakh), date sanity.
- De-duplication of assets (same GPS within 20 m and same owner → merge candidate for human review).
- Freshness targets per source (connectors daily; price observations flagged when older than 6 months; availability older than 7 days shown as "unconfirmed").
- Anomaly flags: sudden 10× jumps in spend or leads, zero-lead weeks after steady activity.
- Versioned metric definitions (a "lead" for each advertiser is defined once and changes are logged).

## 8. Metric dictionary (core)

| Metric | Definition | Typical evidence |
|---|---|---|
| Spend | Actual paid, tax-inclusive, per line item per period | `DIRECTLY_MEASURED` |
| Verified delivery rate | Line items with a verified proof visit ÷ booked line items | `DIRECTLY_MEASURED` |
| Impressions | Opportunities to see (OOH), plays (DOOH), readership (print), listenership (radio) — never summed across channels without saying so | Varies, mostly `ESTIMATED`/`BENCHMARKED` |
| Leads | Enquiries matching the advertiser's lead definition | `ATTRIBUTED` / `DIRECTLY_MEASURED` |
| Cost per lead (by medium) | Spend on medium ÷ leads attributed to it, with the lead count shown | Inherits the weaker of the two |
| Incremental leads | Leads caused by a medium, from an experiment or a model | `EXPERIMENTAL` / `MODELED` |
| Marginal cost per incremental lead | Cost of the next lead at the current spend level (from a response curve) | `MODELED` |

## 9. Milestones for the moat

| Milestone | Target | What it enables |
|---|---|---|
| 10 closed-loop campaigns (BrandSculpt clients) | Pilot + 3 months | First cost-per-lead-by-medium views; proof that capture works |
| 50 closed-loop campaigns, ≥ 10 advertisers | ~12 months | Internal benchmarks for real estate and education in Bihar/UP |
| First 5 completed geo experiments | ~12–18 months | First `EXPERIMENTAL` lift numbers — a credible sales story |
| 200+ campaigns across several agencies, with consent | ~2–3 years | Pooled benchmarks (Stage E) |
| Per-advertiser response curves for top accounts | When their data allows | The "next ₹10 lakh" answer, honestly |
