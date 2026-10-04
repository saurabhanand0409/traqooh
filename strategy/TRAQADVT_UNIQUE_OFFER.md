# TraqAdvt — The Unique Offer and the Plan to Build It

> Status: **proposal** (2026-10-04), based on `INDIA_MARKET_STUDY.md`. Pricing and impact figures are hypotheses to validate in interviews and a concierge pilot before building automation.

---

## 1. The one-line offer

> **Every offline rupee — proved, fairly priced, and counted.**

For a regional real-estate developer or coaching institute, TraqAdvt keeps an **Accountability Ledger** for each campaign. For every site, insertion, spot and screen it answers three questions in one place:

| Question | Today in India | TraqAdvt |
|---|---|---|
| **Proved** — did it run as promised? | Vendor photos, geo-tagged apps, a few independent bureaus | Proof that can't be recycled, edited or substituted; display-days actually delivered; automatic make-good |
| **Fair** — was the price right? | Listed rates; an agency-internal benchmark | Cost per *verified* display-day vs. local ranges from prices actually paid; media-owner reliability |
| **Counted** — what did it produce? | CRMs track sources if someone tags them; missed-call numbers | Cost per real enquiry / site visit / admission **per medium**, offline included, joined to verified delivery |

Plus one small check: each hoarding shows whether it is **registered with the municipality** — a badge, not a compliance service (D-124).

**Why this is new.** Each column exists somewhere (see the market study). **No company found answers the whole row**, for this segment, with defences against the five trust failures the industry itself named in 2026. Marketplaces can't credibly police the media they sell. Media-owner software can't credibly police its own customers. CRMs don't see media delivery or cost. That structural position — **buyer-side, neutral, joined-up** — is the opening.

---

## 2. The building blocks

### 2.1 ProofLock — proof that can't be faked

Built against the five trust failures named by the industry (Aug 2026):

| Trust failure | ProofLock mechanism | What's new vs. India market |
|---|---|---|
| 5. Fake, recycled or AI-edited photos | **In-app capture only** for proof (no gallery); file hash and server timestamp at upload; **network-wide recycled-photo detection** (near-identical images across different visits or different sites are flagged); edit-trace checks; device-integrity attestation (to evaluate) | Others time-stamp; nobody found checks every photo against every previous photo in the network. This gets stronger with every photo stored |
| 4. Worse placement or substituted site | **Site fingerprint**: each site has reference photos (wide + landmark); new visits are matched against them; GPS and accuracy checked; mismatches go to review | New in India (as found) |
| 3. Same board sold to several clients | **Creative match**: the approved artwork is compared with the board in the close-up photo; extra or different creatives are flagged | AI artwork checking exists in the US (OneVision); not found in India |
| 2. Late install, early removal | **Display-Day Ledger**: contracted days vs. days between verified events (install, mid-flight, end, random spot checks); missing days explicit | Not found anywhere as an automatic ledger |
| 1. Inflated traffic | Not solved with photos. Answered by **Counted** (real enquiries) and, where licensed, RoadStar audience. **We never invent traffic numbers** | — |

**Two-tier honesty label on every visit:**
- **Self-reported:** captured by the media owner's or agency's crew, passed ProofLock checks.
- **Independently verified:** captured by a TraqAdvt or partner auditor (gig network such as Awign as a possible partner), typically a random 10–20% sample plus all disputed sites.

Reports show which is which. This is how verification earns trust without pretending a vendor's own crew is independent.

### 2.2 Display-Day Ledger and make-good

- For every booked site: contracted display-days, verified display-days, defects (lights off, torn flex, wrong creative), and **missing days** with evidence.
- **Make-good calculator:** proposes a credit or extension per media owner from the missing days, with the evidence pack attached, ready to send.
- **Media-owner reliability score:** on-time installation, display-days delivered, retake rate, dispute history, built only from verified events.

### 2.3 Fair Price Check

- Headline metric: **cost per verified display-day** = amount paid ÷ verified display-days. It normalises price by what was actually delivered. Nobody publishes this metric.
- Local price ranges (locality × format × size band × season) from **actually-paid** prices, shown with the number of observations; below the minimum, "not enough data".
- Quote check: "this quote sits in the top 20% for comparable unipoles on Bailey Road", plus the media owner's reliability score.
- Data rules: paid prices stay private to the organisation that recorded them; only anonymised ranges with enough contributors are ever shared, and only with consent.

### 2.4 Registered-hoarding badge (kept deliberately small)

- Each site stores its municipal registration status, number and expiry, entered by the agency or media owner.
- Sites show a **Registered / Not registered / Unknown** badge, and advertisers can filter to registered sites only.
- That is all. No RERA/CCPA ad checks, no registration paperwork service, no compliance claims (founder decision, D-124).

### 2.5 Enquiry Ledger — cost per *real* enquiry by medium

- **Response paths in one click per medium:**
  - a missed-call number (via a provider such as Exotel; manual at first);
  - a **WhatsApp click-to-chat link with a medium code** pre-filled (e.g. "Hi, I saw your ad — code BR-HRD-12"), WhatsApp-first for India;
  - a QR code or short link with tracking parameters.
- **Totals from the advertiser's CRM:** site visits, bookings, admissions by source (LeadSquared, Sell.Do, Meritto later; CSV or a front-desk register first).
- **Report:** enquiries → site visits → bookings/admissions **by medium**, with costs and counts, labelled by evidence level, and compared with portals and Meta/Google. This directly addresses "60–70% of portal enquiries aren't buyers".
- **Where no audience measurement exists** (radio in Patna has no RAM), station-specific response paths give the advertiser the only outcome evidence available.

### 2.6 Season Memory → the planner

Every closed campaign becomes a record: what ran, what it really cost, what was delivered, what it produced. Next season's plan starts from the advertiser's own cost per real enquiry by medium, then category benchmarks as they accumulate. This is the bridge to the TraqAdvt planner in the roadmap, without inventing data.

---

## 3. The product the customer sees

**"Verified Campaign"** — bought per campaign by the advertiser (directly or through their agency). It includes:

1. Campaign setup: brief and response paths.
2. Live tracking link (already built) with ProofLock statuses.
3. **Campaign Accountability Report**, one page plus appendix, verifiable by code and link:
   - **Proved:** 94% of contracted display-days verified; 3 sites late; 1 substituted (evidence attached).
   - **Fair:** cost per verified display-day vs. local range; quotes above range flagged.
   - **Registered:** 38 of 40 sites registered with the municipality.
   - **Counted:** cost per site visit — hoardings ₹x, newspaper ₹y, radio ₹z, Meta ₹w (with counts).
   - **Make-good due:** ₹… from media owner A (evidence pack).
   - **Next season:** what the evidence suggests, with confidence.

(Figures above are illustrative placeholders, not data.)

---

## 4. Why it can be defended

| Moat | Why it grows |
|---|---|
| Recycled-photo corpus | Every photo makes the next fraud easier to catch; a newcomer starts with none |
| Paid-price observations by locality | Accumulate with each campaign; consent-based sharing creates the only neutral regional benchmark |
| Media-owner reliability history | Built only from verified events over time |
| Outcome records by medium and category | The closed-loop dataset in the data architecture |
| Neutral, buyer-side position | Marketplaces and media-owner tools are conflicted if they police their own supply |

**Likely competitor responses:** Oi Media or Adarth/Moving Walls add forensic checks (possible, but they serve media owners); The Media Ant adds outcome tracking (possible, but its price checks would mark its own sales); OneVision enters India (artwork checking only); CRMs add media delivery (unlikely, not their domain). The response is speed in the beachhead plus the data above.

---

## 5. What this means for TraqOOH's positioning

- Stop leading with "GPS-verified photos" (not unique).
- Lead with **"the Accountability Report"** for advertisers.
- Keep media-owner and agency operations features, but label verification honestly (self-reported vs. independent).
- Sell to the **advertiser's interest**, even when the agency is the user.

---

## 6. Pricing hypotheses (to test, not decided)

| Item | Hypothesis | Basis |
|---|---|---|
| Verified Campaign (ProofLock + ledger + report) | ₹300–500 per site per campaign | Questionnaire: ₹200–300 per audit; ProofLock adds value |
| Independent spot-check visit | Field cost + margin per visit | Depends on partner/gig cost in Patna |
| Enquiry Ledger | ₹2,000–5,000 per campaign + pass-through for tracking numbers | Cheap relative to campaign size |

**Illustrative value story (assumptions, not data):** a ₹20 lakh OOH campaign on 40 sites for 30 days = 1,200 display-days. If even 5% of those are missing and recovered as make-good, that is ₹1 lakh of value, several times the fee. The real missing-day rate is unknown and must be measured in the pilot.

---

## 7. Validate before building (4 weeks)

**Interviews (18):** 6 developers, 6 coaching institutes, 3 regional agencies, 3 media owners.
Questions: `INDIA_MARKET_STUDY.md` §9.

**Concierge pilot (2–3 campaigns):** run the Accountability Ledger partly by hand, using today's TraqOOH proof plus spreadsheets:
- manual recycled-photo and substitution review;
- hand-counted display-days;
- QR/WhatsApp/missed-call paths set up manually.

**Proceed to build if at least two of these hold:**
1. ≥ 2 of 3 pilots surface a material issue (missing days, substitution, shared boards) **or** a clear cost-per-real-enquiry gap between media.
2. ≥ 1 advertiser agrees to pay a stated price for the next campaign.
3. Response paths capture enquiries in every pilot.

**If none hold:** the pain is weaker than the research suggests. Revisit the ICP before building.

---

## 8. Build plan (phases, with 2–3 pilots running from phase 1, D-125)

| Phase | Build | Status |
|---|---|---|
| **0** | Foundations: database migrations, background job queue, CI, trust cleanup, backfills | ✅ 2026-10-04 |
| **1** | Field app v2 (**in-app-only proof capture**, GPS per shot, offline outbox, Hindi/English, retakes); ProofLock v1 (re-upload, recycled photo, location, time, capture source); review queue; two-tier labels | ✅ built 2026-10-04; next: APK and pilots |
| **2** | Customers: medium spend, response paths (QR, WhatsApp code links; missed-call numbers provisioned manually), `/r` redirect, front-desk register, CRM CSV import, funnel | |
| **3** | Display-Day Ledger, make-good calculator, media-owner reliability score | |
| **4** | Fair Price Check (own data only, ranges shown at n ≥ 5); registered-hoarding badge | |
| **5** | Accountability Report with a public verification code | |
| **6** | ProofLock v2: site match, creative match, independent-checker spot-check sampling | |
| **7** | Missed-call provider API; CRM connectors (LeadSquared, Sell.Do, Meritto); WhatsApp Business webhook, as pilots need them | |

Later still: cross-tenant price ranges with consent; Season Memory → planner.

### Technical notes and honest limits

- **Recycled-photo detection:** perceptual hashes (64-bit) compared by Hamming distance, only against photos uploaded *earlier* (the later upload is the copy). Measured on synthetic scenes: re-compressed copies differ by 0–2 bits, 3% crops by 1–13 (about 85% caught at the current threshold of 8), genuine new shots of the same site by 6–30. A genuine new photo of the same board from the same spot can look similar, so the rule targets **near-identical** images across different visits (tight threshold), plus any match across **different sites** (strong fraud signal). Borderline cases go to a human. Thresholds are tuned on real data.
- **Site fingerprint / creative match:** classical feature matching (keypoints + homography) against reference images, with a vision model as a second opinion and a human for final calls. Lighting and season changes cause false alarms; review queues absorb them.
- **Device-integrity attestation:** Android's Play Integrity in an Expo app needs a native module; evaluate before promising it. Not needed for v1.
- **Missed-call numbers:** a paid third-party dependency; start manually.
- **WhatsApp counts:** manual or via the advertiser's WhatsApp Business inbox at first; the official API later.

---

## 9. What we will not claim

- That we measure audience or traffic (we don't; we count enquiries).
- That self-reported proof is independent.
- Any make-good or ROI figure before the pilot measures it.
- That we are the only company doing proof of display (we are not; we are the only one found doing *this whole row* for this segment).
