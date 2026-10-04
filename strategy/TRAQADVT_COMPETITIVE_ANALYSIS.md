# TraqAdvt — Competitive Analysis

> Researched 2026-10-04. Each fact is tagged:
> **[S]** = from a source listed at the bottom (checked during this research);
> **[G]** = general industry knowledge, **not verified** in this research — confirm before quoting externally.
> Pricing is rarely public in this market; where unknown it says so.

---

## 1. Market context (India)

- Total Indian ad spend: **₹1,55,105 crore in 2025**, projected **₹1,74,605 crore in 2026** (+12–13%) **[S: PMAR 2026]**.
- Digital: ₹93,156 crore (2025) → ₹1,11,976 crore (2026), share rising from ~60% to ~64% **[S]**. Includes ~₹35,814 crore (2025) of MSME digital spend **[S]**.
- Traditional media overall ~₹61,949 crore, roughly flat (+1%); linear TV ~₹32,855 crore, flat; print +~3%; cinema ₹877 crore **[S]**.
- **OOH is the only traditional medium growing**: USD 568 million in 2024 (+13.4%), +10–12% expected in 2025, ~USD 798 million by 2029 per PwC **[S: exchange4media]**.
- **Top OOH categories: real estate (largest), then mobile/electronics, auto, quick commerce, e-commerce, OTT, jewellery** **[S]**. Real estate's OOH share was ~22% in 2024 (over ₹1,000 crore) **[S]**. Education leads *print* advertising with a 17% share (Jan–Sep 2025, TAM) **[S]**.
- **OOH measurement "is improving, but not yet institutionalised"; a unified industry currency is still missing** **[S]**.

**Implication.** Money is moving to digital, but the regional offline segment (OOH + print) is large, still growing for OOH, opaque, and dominated by exactly the ICP categories (real estate, education).

---

## 2. Competitors by category

### 2.1 Media agency holding groups

| | WPP Media (formerly GroupM) | Publicis Media | Dentsu | Havas Media |
|---|---|---|---|---|
| Product | Agency services + **WPP Open** AI marketing OS; GroupM renamed WPP Media in 2025 **[S]** | Agency services + **CoreAI** across planning, targeting, execution; ~80% of media revenue "AI-powered" in 2025 **[S]** | Agency services + planning tools (added retail eye-tracking data to its planning tool) **[S]** | Agency services; AI tooling **[G — not researched]** |
| Target | Large national/global advertisers | Same | Same | Same |
| Pricing | Fees + media-linked revenue **[G]** | Same **[G]** | Same **[G]** | Same **[G]** |
| AI | £300M/year AI investment, AI partnerships **[S]** | CoreAI, Epsilon data **[S/G]** | Planning tool data integrations **[S]** | **[G]** |
| Channels | All | All | All | All |
| Neutral? | **No** — paid around media spend; transparency of rebates is a long-standing industry concern **[G]** | No **[G]** | No **[G]** | No **[G]** |
| Strengths | CMO relationships, buying scale, proprietary data | Strongest 2025 new-business performance (~$10.1B wins) **[S]** | Research assets | Integrated creative + media |
| Weaknesses vs our ICP | Don't serve ₹20L regional campaigns; opaque | Same | Same | Same |

**Assessment.** Unbeatable at the top of the market; largely absent from the beachhead. Not the threat in Phase 1–3. They become relevant only if TraqAdvt goes national.

### 2.2 Indian multi-media marketplaces

**The Media Ant** — founded 2012, Bangalore, ~210 employees; self-service platform aggregating **350,000+ media options across 12 verticals** (digital, print, TV, outdoor, radio, cinema, influencer, non-traditional); 500+ publication-house partnerships; explicitly aimed at SMEs **[S: directory profiles]**.
- Strengths: supply breadth, SME brand, discovery and buying in one place.
- Likely weaknesses **[G — hypothesis, verify]**: earns on media transactions (so not neutral); little verified delivery or per-medium outcome measurement.
- **Threat: high.** It is the closest existing version of "multi-channel planning and buying for Indian SMEs". TraqAdvt should not try to beat it on breadth. It can beat it on **proof and outcomes**.

### 2.3 OOH software and programmatic DOOH

**Moving Walls (+ Adarth)** — acquired **Adarth, an India-based OOH SaaS company, in January 2026**; offers full-stack OOH planning, measurement and programmatic activation; runs a white-labelled OS across ~1 million screens; claims patented multi-sensor measurement and brand-lift surveys **[S]**.
- **Threat: high** in OOH SaaS. Well funded, global, now with an Indian customer base.
- Gap **[G — hypothesis]**: built around digital screens and large media owners; less focused on static hoardings in tier-2/3 cities and on lead outcomes for regional advertisers.

**Broadsign, VIOOH, Vistar Media, Hivestack (Perion)** — global programmatic DOOH platforms (supply-side and demand-side) **[G]**. Relevant only to digital screens; most regional Indian inventory is static. **Threat: low** in the beachhead.

### 2.4 OOH audience measurement

**RoadStar** — the IOAA + AAAI industry initiative to create "the common currency for Indian OOH" **[S]**. It processes about 15 crore mobile pings a day, cleaned to about 4 crore **[S]**, and is reported to measure 300,000 sites across 2,300 cities **[S]**. Plans include DOOH and points-of-interest data **[S]**. Licensing terms are not public **[S]**.
- **This is a partner, not a competitor.** TraqAdvt should not build its own mobility-based audience model. License RoadStar impressions where possible; otherwise show clearly labelled, low-confidence estimates.

### 2.5 Marketing mix modelling (MMM) and incrementality

| Product | What it is | Pricing | Relevance |
|---|---|---|---|
| **Google Meridian** | Open-source Bayesian MMM; generally available; being added to Google Analytics 360; 20+ certified partners **[S]** | Free (open source) **[S]** | **Use it, don't compete with it.** A strong engine for per-advertiser response curves once data exists |
| Meta Robyn | Open-source MMM **[G]** | Free **[G]** | Alternative engine |
| PyMC-Marketing | Open-source Bayesian MMM library **[G]** | Free **[G]** | Alternative engine; Python-native |
| **Recast** | Bayesian MMM platform: contributions, saturation curves, budget scenarios **[S]** | Custom / enterprise **[S]** | Out of the ICP's budget |
| **Mutinex** | MMM + AI-assisted planning, continuous budget decisions **[S]** | Not public **[S]** | Enterprise |
| **Haus** | Experiment-first: geo-lift testing **[S]** | Not public **[S]** | Shows that geo experiments are a product in their own right |
| **Lifesight** | MMM + incrementality + multi-touch attribution **[S]** | Enterprise from ~$5,000/month; free Shopify tier **[S]** | Closest "measurement suite" with Asia presence **[G]**; digital/e-commerce oriented |

**Assessment.** "Where should the next dollar go" is a solved *methodological* problem for advertisers with clean, long, digital-heavy data. It is unsolved for **offline-heavy regional advertisers with short histories**, and that is a data problem, not a modelling problem. TraqAdvt's job is to create that data and then use open-source engines on it.

### 2.6 Attribution

Google Analytics 4 (free), mobile attribution (AppsFlyer, Branch) and D2C attribution (Northbeam, Triple Whale) **[G]**. All are digital-click-based and cannot attribute a hoarding or a newspaper ad. **Not competitors**; GA4 and ad-platform data become *inputs* through connectors.

### 2.7 AI marketing platforms

Digital ad-automation and creative tools (Smartly.io, Madgicx, Albert and similar) **[G]**. They optimise within digital platforms and do not plan offline media. **Not competitors** in the beachhead.

---

## 3. Whitespace

| Capability | Agencies | The Media Ant | Moving Walls/Adarth | MMM SaaS | RoadStar | **TraqAdvt (target)** |
|---|---|---|---|---|---|---|
| Serves ₹10L–₹5Cr regional advertisers | ✗ | ✓ | ~ | ✗ | n/a | **✓** |
| Regional static OOH + local print/radio | ~ | ✓ | ~ | ✗ | OOH only | **✓** |
| Geo/time-stamped proof per site | ~ | ✓ (vendor-supplied images + certificate) | ✓ (screens) | ✗ | ✗ | ✓ (built, **not unique**: Oi Media, OOHAudit, Adarth also offer it) |
| Proof that can't be recycled/edited/substituted + display-day ledger | ✗ | ✗ | ? | ✗ | ✗ | **target** (see `TRAQADVT_UNIQUE_OFFER.md`) |
| Real transaction prices | ✓ (private) | ✓ (private) | ~ | ✗ | ✗ | **✓ (stored)** |
| Per-medium lead outcomes | ~ | ? | ~ | ✓ (digital) | ✗ | **target** |
| Neutral (no media commission) | ✗ | ✗ | ~ | ✓ | ✓ | **target** |
| Planner with confidence labels | ~ | ? | ~ | ✓ | ✗ | **target** |

(✓ yes, ~ partly, ✗ no, ? unknown.)

**The whitespace is narrow but real:** neutral, proof-backed, outcome-measured planning of **offline media for regional, lead-driven advertisers**. Nobody combines verified delivery, real prices and per-medium leads for this segment.

> **Update (deeper India study, same day):** `INDIA_MARKET_STUDY.md` profiles ~25 Indian players (GoHoardings, releaseMyAd, Oi Media, OOHAudit, Proof of Performance, Awign, UFO Moviez, Lemma, AdOnMo, LeadSquared, Sell.Do, Exotel, Posterscope's rateOOHmeter and more). It found that geo-tagged proof on its own is common, and that the true gap is the **whole row per rupee**: proof that can't be faked, fair price, and real enquiries by medium. That is detailed in `TRAQADVT_UNIQUE_OFFER.md`. (The regulatory-compliance idea was trimmed to a single "registered hoarding" badge by the founder; see D-124.)

## 4. Threat ranking and response

| Rank | Competitor | Why | Response |
|---|---|---|---|
| 1 | Moving Walls + Adarth | Funded OOH SaaS now inside India | Win the regional static-OOH + leads niche fast; don't compete on DOOH/programmatic |
| 2 | The Media Ant | Already multi-channel for SMEs | Differentiate on proof and outcomes and on neutrality; consider them a possible future supply partner |
| 3 | Agencies | Own large clients | Avoid; sell *to* regional agencies as a tool |
| — | RoadStar | Industry currency | Partner/license |
| — | Meridian / PyMC / Robyn | Free engines | Use as the modelling layer |

## Sources

- [India's AdEx set for nearly 13% surge in 2026 — PMAR (exchange4media)](https://www.exchange4media.com/marketing-news/indias-total-adex-poised-to-cross-rs-175-lakh-crore-in-2026-pmar-152312.html)
- [Madison World projects India AdEx at ₹1.74 lakh crore in 2026 (Storyboard18)](https://storyboard18.com/advertising/madison-world-projects-india-adex-at-%E2%82%B91-74-lakh-crore-in-2026-digital-to-command-64-share-90611.htm)
- [2025: The year that rewired India's OOH market (exchange4media)](https://www.exchange4media.com/out-of-home-news/2025-the-year-that-rewired-indias-ooh-market-150589.html)
- [Real Estate, Educational Institutions, Jewellery Brands — key OOH spenders (media4growth)](https://media4growth.com/ooh-news/real-estate-educational-institutions-jewellery-brands-outlets-key-ooh-spenders-654)
- [Education sector leads print advertising with 17% share, Jan–Sep 2025: TAM (Storyboard18)](https://www.storyboard18.com/advertising/education-sector-leads-print-advertising-with-17-percent-share-in-jan-sep-2025-tam-85352.htm)
- [The Media Ant — agency profile (MarketingMonk)](https://www.marketingmonk.so/agency-directory/agency/the-media-ant-media-buying-india)
- [Moving Walls acquires Indian OOH SaaS provider Adarth (invidis)](https://invidis.com/news/2026/01/ma-moving-walls-acquires-indian-ooh-saas-provider-adarth/)
- [Moving Walls Group acquires Adarth (media4growth)](https://www.media4growth.com/ooh-industry/company-news/moving-walls-group-acquires-india-based-ooh-software-provider-adarth-81901)
- [RoadStar — "We should have RoadStar up and running shortly" (media4growth)](https://www.media4growth.com/metrics/audience-data-measurement/we-should-have-roadstar-up-and-running-shortly-61774?amp=1)
- [Google rolls out open-source MMM Meridian for general availability (Marketech APAC)](https://marketech-apac.com/google-rolls-out-open-source-marketing-mix-model-meridian-for-general-availability/)
- [Google adds Meridian to Analytics 360 (IT Brief)](https://itbrief.co.uk/story/google-adds-meridian-to-analytics-360-for-better-ads)
- [Lifesight pricing (Capterra)](https://www.capterra.com/p/10013336/Lifesight/)
- [Recast company overview](https://getrecast.com/recast-llm-information/)
- [LiftLab vs Measured vs Recast vs Haus (LiftLab)](https://backend.liftlab.com/?p=394)
- [WPP unveils AI-powered WPP Media, replacing GroupM (Storyboard18)](https://www.storyboard18.com/agency-news/wpp-unveils-ai-powered-wpp-media-replacing-groupm-in-major-strategic-shift-67746.htm)
- [Publicis' new business wins leave rivals behind in 2025 (eMarketer)](https://www.emarketer.com/content/publicis--new-business-wins-leave-rivals-behind-2025)
