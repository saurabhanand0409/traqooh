# TraqAdvt — Product Strategy

> Status: **proposal for the founder's approval** (2026-10-04). Nothing here is decided until approved; decisions are tracked in `TRAQADVT_DECISIONS.md`.
> Inputs: the founder's TraqAdvt brief, the launch questionnaire (`traqooh-launch-answers.md`), the code audit (`TRAQOOH_CURRENT_STATE.md`) and the market research in `TRAQADVT_COMPETITIVE_ANALYSIS.md`.

---

## 1. The honest starting point

The brief describes a cross-channel AI media planner with response curves, measurement, a marketplace and autonomous optimisation. That is the right **destination**. The starting point is:

- a live OOH operations tool with ~116 sites, a handful of campaigns and no paying customers;
- **zero outcome data** (no campaign records an objective, a budget or a result);
- one part-time founder plus AI-assisted development;
- a target of a first pilot in early November 2026.

An AI planner is only as good as the outcome data behind it. Without outcome data it is a chatbot with opinions, and the brief rightly says the product "lives or dies on trust". So the strategy is built around one question: **what is the fastest honest path to owning outcome data that nobody else has?**

## 2. Vision, mission, north star

**Vision (5 years).** TraqAdvt is the planning and proof layer that regional and mid-market Indian advertisers use to decide where their next rupee goes — across OOH, print, radio, cinema and the major digital platforms — backed by India's largest dataset of verified offline media delivery and measured outcomes.

**Mission.** Make every offline advertising rupee accountable: show where it ran, what it cost, what it did, and where the next one should go.

**North-star metric: closed-loop campaigns.** A campaign counts when it has (a) a stated objective and budget, (b) verified delivery, and (c) at least one recorded outcome series (leads, calls, walk-ins, sales). Every one of these is a row in the future moat; nothing else compounds the same way.

## 3. Where I disagree with the brief

| Brief says | My view | Why |
|---|---|---|
| Plan across Google, Meta, YouTube, publishers, TV, print, radio, OOH and cinema | **Sequence channels by what the first customers buy.** Regional OOH, local print, local radio, cinema and geo-targeted Meta/Google come first. National TV (JioStar, Zee, Sony) and national publishers (TOI, HT) come last, or never. | A ₹30L Patna real-estate launch does not buy JioStar. National channels have the hardest data to get and are already the agencies' home turf. |
| The core product is an AI media planner | **The core product is verified, measured campaigns; the planner is what they make possible.** | The planner's quality depends entirely on outcome data. Build the data machine first and put a planner on top of it. |
| Build response curves and marginal-return optimisation | **Yes, per advertiser first (Bayesian MMM with open-source tools), pooled benchmarks much later.** | Per-advertiser MMM needs ~2 years of weekly data or deliberate experiments. Cross-customer curves need hundreds of comparable campaigns *and* contractual consent. Promising them early would be the fake precision the brief warns against. |
| Attribute sales to every channel | **Don't try for offline.** Use unique response paths (call-tracking numbers, QR codes, landing pages per medium) plus geo experiments. | Individual-level attribution of a billboard is impossible. Regional cities make cheap, clean geo experiments possible, which is a real advantage. |
| Be buyer-first and media-neutral | **Agree strongly, but the current structure contradicts it.** | TraqOOH is branded and hosted as BrandSculpt, an agency that buys media. Neutrality needs a separate entity/brand and no media commission (see `TRAQADVT_MONETIZATION.md`). This ties to the pending rebrand decision. |
| Media-owner portal and marketplace | **Agree with doing it last.** Media owners join when there is buyer demand, not before. | Supply-first marketplaces stall. The Media Ant already aggregates 350,000+ media options; supply alone is not a moat. |

## 4. Ideal customer profile (ICP)

### Scoring (1 = poor, 5 = strong)

| Segment | OOH/offline intensity | Outcome measurable cheaply | Underserved by tools | Reachable now (BrandSculpt network) | Budget fit | **Total** |
|---|---|---|---|---|---|---|
| **Real estate developers** | 5 (largest OOH category in India) | 5 (enquiries, site visits) | 4 | 4 | 5 | **23** |
| **Education / coaching institutes** | 4 (heavy OOH + print) | 5 (enquiries, admissions) | 4 | 5 (Patna) | 3 | **21** |
| Hospitals / healthcare chains | 3 | 4 (appointments) | 4 | 3 | 3 | 17 |
| Jewellery / regional retail chains | 4 | 2 (footfall, harder) | 3 | 3 | 3 | 15 |
| Auto dealers | 3 | 4 (test drives) | 3 | 2 | 2 | 14 |
| FMCG | 3 | 1 (needs retail data + MMM) | 1 (agency-locked) | 1 | 5 | 11 |
| D2C brands | 1 | 5 (digital) | 1 (crowded MMM tools) | 1 | 2 | 10 |
| Large enterprises | 3 | 2 | 1 | 1 | 5 | 12 |
| Financial services | 2 | 3 | 2 | 1 | 4 | 12 |
| Restaurants / local SMB | 3 | 2 | 3 | 3 | 1 | 12 |

### Initial ICP (recommended)

**Real-estate developers and education/coaching institutes in Bihar, Jharkhand and UP (then Delhi NCR), spending roughly ₹10 lakh–₹5 crore a year on offline media, buying through a regional agency.**

- **User:** the agency (BrandSculpt first, then other regional agencies) — they plan, execute and report.
- **Economic buyer / beneficiary:** the advertiser — they want proof, fair prices and to know what worked.
- **Why them:** they already spend heavily on OOH and print; their outcome is a *lead*, which is cheap to measure per medium; agencies and global measurement tools ignore them; they are seasonal (launches, admission cycles), which creates natural before/after and geo-comparison windows.
- **Budget range is a hypothesis** to confirm in the pilot.

### Explicitly not first

FMCG and large enterprises (agency-locked, outcome needs retail data and MMM), D2C (digital-first, crowded with attribution/MMM tools), financial services (regulated, digital-heavy).

## 5. Problems, ranked

Scored 1–5 (competition: 5 = little competition; data: 5 = we have or can get it now).

| # | Problem | Pain | Willingness to pay | Feasibility | Competition | Differentiation | Data availability | Time to MVP | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| 7 | **Vendor transparency (proof it ran)** | 5 | 4 | 5 | 4 | 4 | 5 | 5 | **32** |
| 8 | **Media price comparison** | 4 | 3 | 4 | 3 | 4 | 3 | 4 | **25** |
| 2 | **Media planning (OOH first)** | 4 | 3 | 3 | 3 | 3 | 3 | 3 | **22** |
| 6 | **Incrementality (geo tests, response paths)** | 3 | 3 | 3 | 3 | 4 | 3 | 3 | **22** |
| 3 | Media buying | 3 | 3 | 3 | 2 | 2 | 3 | 3 | 19 |
| 1 | Budget allocation | 5 | 4 | 2 | 2 | 3 | 1 | 1 | 18 |
| 9 | OOH audience measurement | 4 | 3 | 2 | 3 | 2 | 2 | 2 | 18 |
| 10 | Marginal budget optimisation | 4 | 4 | 1 | 2 | 4 | 1 | 1 | 17 |
| 4 | Cross-channel measurement | 4 | 3 | 2 | 2 | 3 | 1 | 1 | 16 |
| 5 | Attribution | 3 | 2 | 2 | 1 | 1 | 2 | 2 | 13 |

**Reading:** the problems the brief cares most about (1, 10) score highest on pain but lowest on data and feasibility. The top four are both solvable now **and** produce the data that problems 1 and 10 need. The plan is to solve 7 → 8 → 2 → 6, and earn the right to 1 and 10.

## 6. Positioning

- **Today (TraqOOH):** "Know your hoardings actually ran — every site, every photo, GPS-verified."
- **Next (TraqAdvt, regional):** "Plan offline media with real prices and proof, then see which medium brought the enquiries."
- **Destination:** "Where should your next ₹10 lakh go?" — answered with ranges and confidence, from your own results plus benchmarks from campaigns like yours.

## 7. What makes it defensible

1. **Verified delivery data** (already flowing): GPS-stamped, reviewer-checked proof per site per visit.
2. **Real transaction prices** (already stored): what was actually paid per site, per city, per format, per season.
3. **Outcome series per medium** (next to build): leads/calls/walk-ins tagged by source and geography.
4. **Experiment results** (later): geo holdouts in regional cities, each one a clean data point.
5. **Category-geography benchmarks** (much later, with consent): aggregated, anonymised curves.

AI models, dashboards and marketplaces are not on this list. They can be copied; the data above cannot.

## 8. What we will not do (for now)

- No national TV, OTT or national-publisher planning until the ICP moves up-market.
- No marketplace, payments or commission on media.
- No claims of reach, frequency or ROI without a labelled evidence level and a range.
- No cross-customer modelling until there is scale and written consent.
- No rewrite of the existing product.
- No onboarding of a second agency until tenant isolation exists (already decided by the founder).

## 9. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| No pilot customer by November | High (none named yet) | BrandSculpt's own clients as design partners; offer free verified proof for one campaign |
| Advertisers won't share outcomes | Medium | Make outcome capture the product (call-tracking numbers, QR, a simple lead register), not a request |
| The Media Ant or Moving Walls/Adarth move into verified regional planning | Medium | Speed in the beachhead; depth of verified data; regional relationships |
| Founder capacity | High | Ruthless sequencing; every phase has exit criteria before the next starts |
| Neutrality doubted because of BrandSculpt ownership | Medium | Separate brand/entity; publish the no-commission policy |
| Data protection (worker GPS, advertiser leads) | Medium | DPDP-aligned consent and retention from the start (`TRAQADVT_DATA_ARCHITECTURE.md`) |
