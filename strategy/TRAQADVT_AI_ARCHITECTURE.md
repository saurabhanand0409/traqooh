# TraqAdvt — AI Architecture

> Status: proposal (2026-10-04). Defines what the AI does, what it must never do, how plans are computed, how confidence is calculated, and how the LLM is integrated.
> Model facts below are from Anthropic's current API reference (checked 2026-10-04); re-check before implementation, as models change.

---

## 1. The rule

**Code computes every number. The LLM reads, plans the steps, and explains.**

An LLM asked "what reach will ₹50 lakh of OOH in Patna get?" will produce a confident, plausible and unfounded number. That would end the product's credibility. So every figure a user sees comes from a deterministic or statistical component with a recorded evidence level. The LLM's job is to turn a messy brief into structured inputs, call those components, and explain their output in plain language, with every number traceable.

## 2. Layers

| # | Layer | What it does | Technology |
|---|---|---|---|
| 1 | Ingestion | CSV/Excel, forms, connectors, quote-PDF and email extraction into raw storage | Connector framework; the LLM only for *extracting fields from unstructured documents*, always validated by code and reviewed by a human before use |
| 2 | Normalisation | Map to the media model; units, currencies, geographies; evidence labels | Python + SQL |
| 3 | Analytics | Curated views: cost per lead by medium, price ranges, delivery reliability per media owner | SQL / materialised views |
| 4 | Statistical models | Response curves (per-advertiser Bayesian MMM), experiment analysis, audience-estimate models | Open-source engines: Google Meridian or PyMC-Marketing; standard statistics for experiments |
| 5 | Optimisation | Site selection, budget allocation, what-if recalculation | Integer programming (OR-Tools / PuLP) or greedy coverage maximisation; convex allocation over response curves |
| 6 | LLM reasoning | Brief parsing, step orchestration, explanations, scenario wording, media briefs and RFPs, anomaly narration | Claude via the Anthropic API, tools with strict schemas |

## 3. What the LLM does and does not do

| LLM does | LLM never does |
|---|---|
| Turn "₹2 crore, fashion brand, Delhi NCR, 18–35, three months" into a structured brief, asking about anything missing | Produce a reach, impression, ROI or cost figure of its own |
| Choose which tools to call (plan, what-if, compare) | Override an optimiser or model result |
| Explain *why* a plan looks the way it does, citing the engine's numbers and evidence levels | Hide or round away uncertainty |
| Draft media briefs, RFPs and emails to media owners from an approved plan | Send anything to a media owner or advertiser without a human approving it |
| Extract fields from quote PDFs and emails into a review queue | Write extracted prices into the database without human confirmation |
| Spot and describe anomalies (e.g. a sudden drop in leads) | Make a causal claim not backed by an experiment or model |

**Enforced in code, not just in prompts:** a validator checks every number in an LLM explanation against the tool outputs for that request. Any figure that does not appear (allowing for formatting such as ₹48.5L ↔ 4,850,000) blocks the response, and it is regenerated or shown without the explanation.

## 4. The planners

### 4.1 Planner v0 — OOH site selection (Roadmap Phase 3)

**Input (from the structured brief):** budget, city/zones, dates, objective, optional audience, constraints (formats, must-include or exclude sites, maximum per media owner, minimum spacing).

**Data used:**
- available OOH assets with GPS;
- the best available price per asset, preferring recent `ACTUAL_PAID`, then `NEGOTIATED`, then `QUOTE`, then `RATE_CARD`, and labelled by which one was used;
- **media-owner delivery reliability** from verified proof history: the share of booked sites actually proved on time. Only TraqOOH has this;
- audience estimates where they exist (RoadStar if licensed); otherwise transparent proxies (road class, landmark proximity) labelled `ESTIMATED`;
- the advertiser's locations (projects, campuses) for proximity objectives.

**Method:** maximise a coverage score across the target zones, with diminishing returns per zone, subject to budget and constraints. This is a submodular coverage problem: a greedy algorithm is fast and within a known bound of optimal, and an integer program (OR-Tools) handles hard constraints exactly. Price-fairness (price vs. the city-format median) and reliability enter as weights.

**Output:** chosen sites, cost (with which price type was used), a coverage map, three scenarios (conservative / balanced / aggressive budgets), the assumptions, evidence levels and confidence, and the alternatives that nearly made the cut. The LLM writes the narrative.

**Honesty rule:** if fewer than the policy minimum of data points support a number (see Data Architecture §5), the plan shows "not enough data" for that field instead of a number.

### 4.2 What-if simulator

Every plan is a pure function of (inputs, data snapshot, engine version). A what-if ("OOH at least 30%", "₹50 lakh only", "Noida instead of Delhi") changes the inputs and re-runs the same engine. The UI shows a **diff** against the previous plan: what changed, why, and how the ranges moved. The LLM only translates the request into input changes and narrates the diff.

### 4.3 Cross-media allocation and the "next ₹10 lakh" (Roadmap Phase 8)

1. For each channel, a response curve per advertiser (adstock + saturation, as in Meridian), fitted from their history, experiments and benchmarks. The curve's uncertainty is kept as posterior draws, not collapsed to one line.
2. Allocation: maximise total expected outcome subject to budget and min/max constraints. With concave curves, a greedy allocation in ₹1-lakh steps by highest marginal return is near-optimal and easy to explain.
3. **The "next ₹10 lakh" answer is a probability, not a verdict.** Repeat step 2 for each posterior draw and report, for example: "OOH is the best place for the next ₹10 lakh in 68% of plausible scenarios; Meta in 24%; expected extra leads 140–260."
4. Show saturation explicitly: the spend level where each channel's marginal cost per lead crosses the advertiser's target.

## 5. Confidence: how it is calculated (no vibes)

Every displayed figure gets a confidence from 0 to 1:

- **Model outputs (`MODELED`, `EXPERIMENTAL`):** derived from the width of the 80% interval relative to the central value (narrow interval → high confidence), capped by the evidence-level cap in the media model.
- **Attributed / measured figures:** depend on sample size (e.g. 4 leads cannot be "high confidence" whatever the source) and on data freshness.
- **Estimates and benchmarks:** fixed caps (`ESTIMATED` ≤ 0.5, `BENCHMARKED` ≤ 0.4), lowered further for small benchmark cells.
- **A plan's overall confidence** is a spend-weighted combination of its lines, and never higher than its weakest material line (any line above 20% of budget).

Bands: **High** ≥ 0.75, **Medium** 0.5–0.75, **Low** < 0.5. The formula is versioned; a change to it is recorded in `TRAQADVT_DECISIONS.md`.

**Calibration is the trust metric.** Once outcomes come in, check whether actual results land inside the predicted 80% ranges about 80% of the time. Publish that rate internally every quarter. If it drifts, widen the ranges.

## 6. LLM integration (Claude)

| Item | Choice |
|---|---|
| SDK | Official Anthropic Python SDK (`anthropic`), called from the backend's `ai` module only — never from the browser |
| Model | `claude-opus-5-5` (current default Opus; $4 / $20 per million input/output tokens) |
| Thinking | Adaptive thinking is on by default and cannot be disabled on this model; set `output_config.effort` explicitly per job (its default is `medium`) |
| Structured output | `client.messages.parse()` / `output_config.format` for the parsed brief; tools defined with `strict: true` for engine calls |
| Tool choice | `auto`, plus a prompt instruction naming the tool to call; **forced `tool_choice` (`any`/`tool`) is rejected by this model** |
| Caching | Prompt caching on the stable prefix (system prompt, media taxonomy, tool definitions) |
| Bulk work | Message Batches API (asynchronous, 50% cost) for document extraction backlogs |
| Refusals | Check `stop_reason` before reading content; configure the API's server-side fallback option when implementing |
| Logging | Store every request/response with plan ID, token counts and cost, for evaluation and audit |

**Rough cost per generated plan (estimate, to be measured):** a brief parse (~4k tokens in, ~1k out) plus an explanation (~15k in, ~3k out), with thinking tokens billed as output, comes to roughly $0.15–0.35, or about ₹15–30, before caching. Interactive what-if turns cost a fraction of that. This is small next to the value of a plan, but measure it from the first prototype.

Choosing a cheaper model for high-volume extraction is a later, measured decision: run it against the evaluation set and switch only if quality holds.

## 7. Evaluation

| What | How | Gate |
|---|---|---|
| Brief parsing | ~100 real and synthetic briefs (Hindi/English mix) with expected structured output; field-level accuracy | ≥ 95% on required fields before launch |
| Explanation faithfulness | Automated number-tracing validator (§3) on every response; plus human review of a weekly sample | 0 untraceable numbers |
| Document extraction | Labelled set of real quote PDFs; field accuracy | Human confirmation always required regardless |
| Planner quality | Back-tests on closed campaigns: would the plan have chosen the sites that performed? Calibration of ranges | Reviewed each quarter |
| Safety | Prompt-injection tests (malicious text in an uploaded quote PDF must not change behaviour) | Pass before connectors that read external documents |

## 8. What not to build

- A general chatbot as the main interface. The primary UX is the guided brief → plan flow (see Go-to-Market and Product Strategy); chat is for refinements ("make it more aggressive").
- Fine-tuned or self-hosted models. There is no data to justify them and the cost is real.
- Autonomous execution (booking media, moving budgets) without per-action human approval. Revisit only in Phase 11.
