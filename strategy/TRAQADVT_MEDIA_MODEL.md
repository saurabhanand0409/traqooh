# TraqAdvt — Media Model

> Status: proposal (2026-10-04). Defines how every kind of media, price, audience number and outcome is represented, and how today's tables migrate into it **without breaking TraqOOH**.

---

## 1. Principles

1. **Common core, channel extensions.** Every bookable thing is a `media_asset` with the same core fields. Channel-specific detail lives in one extension table per channel. TV is not forced into a billboard's shape, or the other way round.
2. **Every number carries its provenance.** Prices, audience figures and outcomes are stored with `source`, `evidence_level`, `confidence` and `as_of`. A number without provenance is not stored.
3. **Ranges, not points, for anything estimated.** Store `value_low / value_mid / value_high`.
4. **Prices are observations, not attributes.** A site does not "have a price"; there are rate-card, quoted, negotiated and actually-paid prices, each with a date and a source.
5. **Relational first.** Postgres tables with foreign keys *are* the knowledge graph for now. A graph database is only worth it if graph-shaped queries become the bottleneck (see §6).
6. **Additive migration.** New tables and columns are added next to the existing ones; nothing existing is renamed or dropped while TraqOOH code uses it.

## 2. Evidence levels (used everywhere)

| Level | Meaning | Example | Typical confidence cap |
|---|---|---|---|
| `DIRECTLY_MEASURED` | We observed it ourselves, or the platform of record reported it | GPS-verified proof photo; Meta-reported spend | 0.95 |
| `EXPERIMENTAL` | Result of a controlled experiment (e.g. geo holdout) | "OOH in Kankarbagh lifted enquiries 18–31% vs control" | 0.9 |
| `ATTRIBUTED` | Outcome linked to a medium through a unique response path | Calls to the number printed only on the hoardings | 0.8 |
| `MODELED` | Output of a statistical model with an uncertainty interval | MMM posterior contribution of print | from the model's interval |
| `ESTIMATED` | Rule-of-thumb or heuristic estimate | Impressions from a road class and a traffic proxy | 0.5 |
| `BENCHMARKED` | From an external or pooled benchmark, not this advertiser | Category CPL range for real estate in tier-2 cities | 0.4 |

Confidence is a number from 0 to 1, shown as a band: **High** ≥ 0.75, **Medium** 0.5–0.75, **Low** < 0.5. How it is computed is defined in `TRAQADVT_AI_ARCHITECTURE.md` §5. The caps stop a weak kind of evidence from ever being displayed as strong.

## 3. Core entities

### 3.1 Parties

```
organization        id, type (AGENCY | ADVERTISER | MEDIA_OWNER | PLATFORM_ADMIN), name, gst, city, state, created_at
membership          user_id → user_accounts, organization_id, role (OWNER | ADMIN | PLANNER | VIEWER | FIELD)
media_owner         id, name, kyc fields, organization_id NULL (set when the owner has its own account),
                    added_by_org_id (who created the record), visibility (PRIVATE | SHARED)
advertiser          (existing table) + organization_id (tenant that manages it), industry, sub_industry
advertiser_location id, advertiser_id, type (STORE | PROJECT | CAMPUS | HOSPITAL | OFFICE), name, geo point
```

`organization` is the **tenant**. This resolves today's conflation where `companies` means both "the agency whose staff log in" and "the vendor whose hoardings are listed".

### 3.2 Media supply

```
channel             code: OOH | DOOH | PRINT | RADIO | CINEMA | TV | OTT |
                          DIGITAL_SEARCH | DIGITAL_SOCIAL | DIGITAL_VIDEO | DIGITAL_PUBLISHER | PROGRAMMATIC | INFLUENCER
media_property      id, media_owner_id, channel, name, geography_id (coverage), description
                    e.g. "Dainik Jagran — Patna city edition", "Radio Mirchi 98.3 Patna", "Meta (Facebook/Instagram)"
media_asset         id, property_id, channel, format, name, geography_id, geo_point NULL,
                    status (ACTIVE | INACTIVE), creative_spec (json), extension_table, created_by_org_id, visibility
```

A **media_asset** is the plannable unit: one hoarding face, a half-page position in one edition, a 10-second morning-drive radio spot, a cinema screen's pre-show slot, or a Meta campaign line targeted at one geography.

### 3.3 Channel extensions (one row per asset, keyed by `media_asset_id`)

| Extension | Key fields |
|---|---|
| `ooh_asset` | **= today's `sites` table** + `media_asset_id`: lat/lng, dimensions (multi-row size), lighting, facing, road/landmark, visibility notes, photos, traffic notes |
| `print_asset` | publication, edition, language, page/position, size (cm × columns), colour, circulation reference |
| `radio_asset` | station, frequency, daypart, spot length (s), language |
| `cinema_asset` | cinema, screen, seats, show types, slot (pre-show / interval) |
| `tv_asset` | channel, programme or daypart, spot length, region feed |
| `digital_asset` | platform, account/campaign reference (via connector), targeting summary, objective |
| `dooh_asset` | screen id, loop length, slot length, plays per hour, plus OOH location fields |

### 3.4 Prices, availability, audience

```
price_observation   id, media_asset_id, price_type (RATE_CARD | QUOTE | NEGOTIATED | ACTUAL_PAID),
                    unit (PER_MONTH | PER_DAY | PER_INSERTION | PER_SPOT | PER_10_SEC | CPM | CPC | FLAT),
                    amount, currency, tax_included, valid_from, valid_to,
                    source (CSV | PORTAL | QUOTE_PDF | EMAIL | LINE_ITEM | MANUAL), source_ref,
                    evidence_level, observed_by_org_id, visibility, created_at

availability        id, media_asset_id, from_date, to_date, status (AVAILABLE | HOLD | BOOKED | BLOCKED),
                    source, as_of

audience_estimate   id, media_asset_id NULL, media_property_id NULL, metric
                    (IMPRESSIONS | REACH | FREQUENCY | CIRCULATION | READERSHIP | LISTENERSHIP | ADMITS | FOOTFALL),
                    period (DAY | WEEK | MONTH | INSERTION | SPOT), audience_segment_id NULL, geography_id NULL,
                    value_low, value_mid, value_high, unit, method, source (ROADSTAR | IRS | PLATFORM | MODEL | MANUAL),
                    evidence_level, confidence, as_of
```

**Visibility rule:** an `ACTUAL_PAID` or `NEGOTIATED` price is private to the organisation that recorded it. Only aggregated, anonymised statistics (e.g. a city-format price range with n ≥ 5 contributors) may ever be shared, and only with consent (see Data Architecture §6).

### 3.5 Geography and audience

```
geography           id, level (COUNTRY | STATE | DISTRICT | CITY | ZONE | LOCALITY | PIN | CUSTOM),
                    name, parent_id, geom (PostGIS polygon), centroid, population (with source/year)
audience_segment    id, name, definition (json: age, gender, SEC, language, interests), source
```

### 3.6 Planning, execution, outcomes

```
campaign            (existing) + organization_id, objective (AWARENESS | LEADS | FOOTFALL | SALES | LAUNCH),
                    primary_kpi, budget_total, budget_currency, target_geography_ids, audience_segment_ids, brief (text)
plan                id, campaign_id, version, scenario (CONSERVATIVE | BALANCED | AGGRESSIVE | CUSTOM),
                    status (DRAFT | PROPOSED | APPROVED | SUPERSEDED), engine_version, assumptions (json),
                    totals (json: ranges + confidence), created_by_user_id, created_at
plan_line           id, plan_id, media_asset_id NULL, channel, geography_id, budget, quantity,
                    expected (json: metric → low/mid/high), evidence_level, confidence, rationale_key
line_item           = today's campaign_site_assignments (booked asset, dates, actual costs) + plan_line_id NULL
delivery_proof      = today's campaign_activities (GPS-stamped visits; DIRECTLY_MEASURED)
delivery_metric     id, line_item_id, date, metric (SPEND | IMPRESSIONS | CLICKS | VIEWS | PLAYS), value,
                    source (connector), evidence_level
response_path       id, campaign_id, line_item_id NULL, channel, type (PHONE_NUMBER | QR | URL_UTM | PROMO_CODE | FORM),
                    value, active_from, active_to
outcome             id, campaign_id NULL, advertiser_id, metric
                    (LEADS | CALLS | WALK_INS | SITE_VISITS | ADMISSIONS | SALES | REVENUE),
                    period_start, period_end, geography_id NULL, response_path_id NULL, channel NULL,
                    value, evidence_level, source (CRM_CSV | CALL_TRACKING | MANUAL_REGISTER | ECOMMERCE | POS), created_at
experiment          id, campaign_id, design (GEO_HOLDOUT | MATCHED_MARKET | PRE_POST), treatment_geography_ids,
                    control_geography_ids, metric, start, end, status,
                    result (json: lift low/mid/high, p or posterior), evidence_level = EXPERIMENTAL
```

## 4. Knowledge graph view

The entities above already form a graph; there is no need for a separate store yet.

```
Advertiser ─runs→ Campaign ─has→ Plan ─contains→ PlanLine ─targets→ MediaAsset ─belongs to→ MediaProperty ─owned by→ MediaOwner
     │               │                                   │                │
     │               ├─booked as→ LineItem ─proved by→ DeliveryProof     ├─located in→ Geography
     │               ├─measured by→ ResponsePath ─produces→ Outcome      ├─priced by→ PriceObservation
     │               └─tested by→ Experiment                             └─reaches→ AudienceEstimate ─for→ AudienceSegment
     └─located at→ AdvertiserLocation ─in→ Geography
```

The questions the planner will ask are joins over this graph, for example: "for real-estate launches in tier-2 cities, what did OOH cost per attributed lead, by format and season?"

## 5. Migration from today's schema (additive, phased)

| Step | Change | Breaks existing code? |
|---|---|---|
| M1 | Create `organization`, `membership`; backfill one organisation per staff employer (BrandSculpt first); add `organization_id` to campaigns, advertisers, sites, activities, field_pins | No — new columns are nullable, then filled |
| M2 | Create `media_owner`; backfill from `companies` that own sites | No |
| M3 | Create `channel`, `media_property`, `media_asset`; one asset per site (`channel = OOH`); add `sites.media_asset_id` | No — `sites` stays and becomes the `ooh_asset` extension |
| M4 | Create `price_observation`; backfill from `sites.potential_monthly` (RATE_CARD) and `campaign_site_assignments.agreed_cost` (ACTUAL_PAID) | No |
| M5 | Add objective / KPI / budget / geography / brief to `campaigns` | No — all nullable |
| M6 | Create `response_path`, `outcome` | No |
| M7 | Create `geography` (with PostGIS) and link sites/assets to localities | No |
| M8 | Later: `plan`, `plan_line`, `audience_estimate`, `experiment`, other channel extensions | No |

Every step lands as an Alembic migration with a backfill script and a test, and ships only after the full regression test passes.

## 6. When to revisit the graph-database question

Move graph-shaped workloads to a graph store only if **all** of these are true: multi-hop queries (4+ joins over variable paths) dominate the planner; Postgres with proper indexes cannot keep planner latency under ~2 seconds; and there is a team to run a second datastore. None of these is true today.
