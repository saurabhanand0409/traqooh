# TraqAdvt — Monetisation

> Status: proposal (2026-10-04). Pricing figures are **hypotheses to test in the pilot**, based on the founder's questionnaire answers. Nothing here is a forecast.

---

## 1. The constraint that shapes everything

TraqAdvt wants to be seen as **buyer-first and media-neutral**. A planner earns trust only if its recommendations can't be bought. So the revenue model must not depend on *which* media a plan recommends, *which* media owner wins, or (ideally) *how much* the advertiser spends.

Today that is undermined in two ways:
- The product is branded and operated as BrandSculpt, an agency that buys media and can earn on it.
- The live site shows plans (₹2,999 / ₹7,999 / ₹19,999 a month, 14-day trial) that contradict the founder's own pricing answers, and a fake checkout. Those must come down regardless of the model chosen.

## 2. Options

| Model | How it earns | Conflict of interest | Fit now | Verdict |
|---|---|---|---|---|
| SaaS subscription | Flat fee per organisation / seat / site band | **None** | Good for agencies | ✅ Core, from Phase 1 |
| Per-verification fee | Fixed fee per site verified per campaign | **None** (same fee whatever the media) | Matches "₹200–300 per audit per site" from the questionnaire | ✅ Core, from Phase 1 |
| % of media spend | Commission on spend booked through the platform | **High** — rewards bigger budgets and higher-margin media | Familiar to the industry | ❌ Avoid |
| Transaction fee per booking | Flat fee per booking, identical across media | Low if flat; high if it varies by owner/channel | Only once a marketplace exists | ⚠️ Phase 8, flat only |
| Media-owner fees | Owners pay for listing, leads or placement | **High** if it affects ranking | Supply-side tool revenue | ⚠️ Operations tools only; never ranking |
| Enterprise licence | Annual contract for planning + measurement | None | When advertisers have data and budgets | ✅ Phase 6 |
| Hybrid | Combinations of the above | Depends on parts | — | ✅ SaaS + verification now, licence later |

## 3. Recommended model by phase

### Phase 1–3 (TraqOOH → regional TraqAdvt)
- **Agency plan:** a flat monthly platform fee per agency, by band of active sites, plus a **per-verified-site fee** for each site proved on a campaign. This is the questionnaire's "flat monthly fee plus ₹200–300 per site audit".
- **Advertiser access: free.** The advertiser portal (proposals, live tracking, PoD report) is part of what the agency buys; it is the product's distribution channel.
- **Media owners: free to list inventory.** Owners already said they'd pay ~₹500–2,000/month for an inventory tool (free up to 25 sites). Keep that as an **operations tool** (availability calendar, proof uploads, invoicing) and **never** let it affect what the planner recommends.
- **No commission on media** in TraqAdvt. If BrandSculpt buys media for its clients, that is BrandSculpt's agency business, as a customer of TraqAdvt like any other, disclosed to its clients.

### Phase 6+ (planning and measurement)
- **Advertiser planning & measurement licence:** annual fee in **flat bands by annual media budget** (e.g. under ₹1 crore, ₹1–5 crore, over ₹5 crore). A banded flat fee avoids rewarding bigger spend at the margin, unlike a percentage.

### Phase 8 (marketplace, if ever)
- A **flat, buyer-paid fee per booking**, identical across media owners and channels, shown on every quote. No rebates, no placement fees, no undisclosed margins.

## 4. Neutrality commitments (to publish)

1. TraqAdvt takes no commission, rebate or placement fee from media owners.
2. Plan ranking depends only on the advertiser's objective, constraints and evidence, never on who pays TraqAdvt.
3. Where a recommended media owner is related to TraqAdvt or its owners, the plan says so.
4. The evidence level and confidence of every recommendation are shown.

Commitment 3 matters while BrandSculpt and TraqAdvt are related. The cleanest fix is the separation the founder already wants: TraqAdvt as its own brand and entity, with BrandSculpt as a customer.

## 5. Pricing hypotheses to test in the pilot

| Item | Hypothesis | How to test |
|---|---|---|
| Agency platform fee | ₹1,000–2,000 / month, free up to 25 active sites (from questionnaire) | Offer to 3 agencies after the pilot; record objections |
| Per-verified-site fee | ₹200–300 per site per campaign (from questionnaire) | Charge on the first paid campaign; check margin vs. the field cost |
| Paid pilot | Discounted first 2–3 months, annual billing after (from questionnaire) | Signed pilot agreement |
| Advertiser willingness to pay directly for verified campaigns | Unknown | Ask each pilot advertiser what the PoD report and lead report were worth |

## 6. Illustrative economics (not a forecast)

An agency running 3 campaigns a month × 20 sites = 60 verified sites × ₹250 = **₹15,000** + platform fee ₹2,000 ≈ **₹17,000/month (~₹2 lakh/year)**.
- 10 such agencies ≈ ₹20 lakh/year. That is a sustainable small business, not yet a venture-scale one.
- Scale comes from (a) many more agencies across states, and (b) the Phase 6 advertiser licence, which only works once the data is credible.

**Direct costs to watch:** field verification cost per site (the agency's crew today, possibly TraqAdvt's network later), call-tracking numbers (pass-through), LLM usage (~₹15–30 per plan generated, estimated), hosting ($7–25/month at pilot scale).

## 7. Billing implementation (when, not now)

- Razorpay for INR payments, GST invoices, annual plans. Build it **after** the first paid pilot is agreed (an invoice and bank transfer are fine for the first customers).
- Remove `Payment.jsx` now. Replace it with a real Razorpay integration only when billing is built.
- One pricing page, matching what is actually offered, after the pilot confirms prices.
