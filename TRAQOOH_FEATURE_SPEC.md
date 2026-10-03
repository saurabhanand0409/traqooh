# TraqOOH — Complete Software Specification

> **India's premier campaign planning, execution and audit tool for OOH campaigns.**
> A product by Brandsculpt Media Solutions Pvt. Ltd.

**App URL (after migration):** `https://app.brandsculpt.com`
**Marketing site:** `https://traqooh.brandsculpt.com`

---

## 1. THE TWO USER TYPES

TraqOOH serves two distinct kinds of users, each with their own login, dashboard and permissions.

### A. OOH Companies & Agencies (Campaign Owners / Media Owners)
The people who **own and run** the OOH business. They manage inventory, build campaigns, execute them on-ground, and send proposals to clients.

| Role | What they can do |
|------|------------------|
| **SUPER_ADMIN** | Everything — manage all employees, all campaigns, all sites, system settings |
| **ADMIN** | Manage employees, view all campaigns across the company, manage advertisers |
| **EMPLOYEE** | Manage their own sites & campaigns, execute campaigns, send proposals |

### B. Advertisers & Brand Clients
The brands/companies **buying** the ad space. They receive a secure link, review the proposed sites, shortlist, and confirm — **no app knowledge needed**.

| Role | What they can do |
|------|------------------|
| **ADVERTISER** | View proposed campaign sites, shortlist, set dates, view cost sheet, confirm |
| **Link-only access** | Open a secure email/WhatsApp link — no login required |

---

## 2. SYSTEM ARCHITECTURE (Keep Existing Backend)

```
┌─────────────────────────────────────────────────────────────┐
│                     USER-FACING LAYER                         │
│                                                               │
│  app.brandsculpt.com          traqooh.brandsculpt.com        │
│  (Web App - Cloudflare Pages)  (Marketing site - Vercel)     │
│                                                               │
│  TraqOOH Mobile App (React Native / Expo)                    │
│  → for on-ground campaign execution & photo upload           │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (FastAPI - Render)                   │
│        traqooh-backend-python.onrender.com                    │
└───────────────────────────┬───────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  PostgreSQL   │   │ Cloudflare R2 │   │  Activity Log │
│   (Render)    │   │ (site/audit   │   │  (audit trail)│
│   12 tables   │   │   photos)     │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
```

**Decision: Keep everything as-is** — only the login/app frontend moves to `app.brandsculpt.com` (which already points to Cloudflare Pages via the new DNS).

---

## 3. CAMPAIGN OWNER FEATURES (OOH Companies)

### 3.1 — Site / Inventory Management

Add and manage every OOH site in the inventory. Each site stores:

**Key Site Fields:**
| Field | Description |
|-------|-------------|
| Site Name | e.g. "Patna Junction Main Hoarding" |
| Type | Hoarding / Unipole / Billboard / LED / Gantry / Bus Shelter / Wall |
| Dimensions | Width × Height (ft) → auto-calculated sq.ft |
| Lighting | Lit / Non-Lit / Backlit / Front-lit |
| State & City | Bihar / UP / Jharkhand / Delhi-NCR + city |
| Location / Landmark | Exact address or nearest landmark |
| Facing / Direction | Traffic facing direction |
| GPS Coordinates | Lat/Long for map view |
| Monthly Rate | Base rental rate (₹/month) |
| Vendor / Media Owner | Linked vendor company |
| Availability Status | **Vacant / Vacant Soon / Booked** (auto-computed from dates) |
| Site Image(s) | Multiple photos via Cloudflare R2 |
| Remarks | Free notes |

**Operations:**
- Add / Edit / Delete site
- Bulk import (CSV) — *to build*
- Filter by state, city, type, availability, vendor, rate range
- Hover preview popup (image + details)
- Image lightbox on click

---

### 3.2 — Campaign Creation

Create a campaign and pull sites from the inventory database into it.

**Campaign Fields:**
| Field | Description |
|-------|-------------|
| Campaign Name | e.g. "Tata Motors — Bihar Blitz 2026" |
| Advertiser / Client | Linked from advertiser list |
| Start Date / End Date | Overall campaign window |
| Budget | Optional target budget |
| Status | DRAFT → PLANNED → SENT → CONFIRMED → LIVE → COMPLETED → CANCELLED |
| Created By | Employee (for isolation — each sees own) |
| Notes | Internal notes |

**Adding Sites to a Campaign:**
1. Open campaign → "Add Sites" tab
2. Filter inventory by State / City / Type / Vendor / availability
3. Bulk-select available sites
4. Add to campaign → creates `campaign_site_assignments` rows
5. Per-site: set booking dates, printing cost, mounting cost, other cost
6. Overlap detection — warns if a site is already booked in those dates

---

### 3.3 — Site Operations Details

Each site within a campaign tracks operational detail:

| Detail | Description |
|--------|-------------|
| Booking Dates | Start/end per site (can differ from campaign) |
| Printing Type | Flex / Vinyl / Backlit / Star-flex |
| Printing Cost | ₹ per site |
| Mounting Cost | ₹ per site |
| Other Cost | Permits, electricity, etc. |
| Vendor Assigned | Who executes |
| Current State | Pending → In Progress → Mounted → Live → Taken Down |

---

### 3.4 — Campaign Execution (via TraqOOH Mobile App)

On-ground execution is tracked through the **TraqOOH mobile app**:

**Execution Workflow:**
1. **Campaign Start** — mark campaign LIVE, record start photos
2. **Mounting Photos** — field staff upload geo-tagged, timestamped photos via mobile app
3. **Live Monitoring** — periodic photos to prove display is up
4. **Campaign End** — record take-down photos, mark COMPLETED

**Each execution photo carries:**
- GPS watermark (lat/long)
- Timestamp watermark
- Site ID + Campaign ID linkage
- Uploaded by (field staff name)
- Stored in Cloudflare R2

---

### 3.5 — Activity Log per Site (Print / Reprint / Audit)

Every site in a campaign has an **activity timeline**. Each activity entry can have **photos attached for verification**.

**Activity Types:**
| Activity | Description | Photo Required |
|----------|-------------|----------------|
| **Print** | Initial flex/vinyl printed | ✅ proof photo |
| **Reprint** | Damaged/replaced — reprint done | ✅ before + after |
| **Mounting** | Site mounted/installed | ✅ geo-tagged |
| **Audit** | Periodic check — is it still up & clean? | ✅ audit photo |
| **Maintenance** | Repair, re-fix, cleaning | ✅ photo |
| **Take-down** | Campaign ended, removed | ✅ photo |

**Each activity records:**
- Date & time
- Type (from above)
- Done by (staff)
- Photos (multiple, via R2)
- Status: Pending / Done / Verified
- Remarks

> This gives a **complete audit trail** per site — print → reprint → audit → maintenance — all photo-verified.

---

## 4. CAMPAIGN OWNER → ADVERTISER FLOW

### 4.1 — Send Campaign to Advertiser

Once a campaign is built, the media owner shares it with the client:

1. Open campaign → click **"Send to Advertiser"**
2. System generates a **secure token-based access link**
   - e.g. `app.brandsculpt.com/access/{unique-token}`
   - Optional expiry date
3. Share link via:
   - **Email** (built-in send — *to build*)
   - **WhatsApp** (one-click WhatsApp share with pre-filled message)
4. Campaign status → **SENT**, "Sent ✓" badge appears

---

### 4.2 — Advertiser Views the Campaign (No Login)

The advertiser opens the link and sees a clean, branded portal:

**Tab 1 — All Proposed Sites**
- Grid of site cards (image, type, size, location, monthly rate)
- ♥ Shortlist button on each
- Click for full detail + image lightbox

**Tab 2 — Shortlisted Sites**
- Only their favourites
- Per-site date controls (use campaign dates or set custom)
- See printing type & costs

**Tab 3 — Cost Sheet**
- Professional table: each site + rental + printing + mounting + other
- Grand total
- Downloadable / printable

**Actions:**
- **Save Draft** — saves shortlist + dates to DB (resume later)
- **Confirm Campaign** — one-click approval

---

### 4.3 — Advertiser Confirms

1. Advertiser reviews and clicks **"Confirm Campaign"**
2. Campaign status → **CONFIRMED**
3. Media owner gets notified (email/dashboard alert)
4. Confirmed sites lock their booking dates → availability auto-updates to **Booked**
5. Execution phase begins (Section 3.4)

---

## 5. DASHBOARD LAYOUTS

### 5.1 — Campaign Owner Dashboard
```
┌──────────────────────────────────────────────────┐
│ [tq] traqOOH          [Search]  [Profile ▾]       │
├──────────┬───────────────────────────────────────┤
│ SIDEBAR  │  MAIN AREA                             │
│          │                                        │
│ Dashboard│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│ Inventory│  │Sites│ │Camps│ │Live │ │Clnts│  KPIs│
│ Campaigns│  └─────┘ └─────┘ └─────┘ └─────┘      │
│ Advertisr│                                        │
│ Activities  Recent Campaigns table                │
│ Reports  │  Activity feed                          │
│ Settings │  Charts (Recharts)                      │
└──────────┴───────────────────────────────────────┘
```

### 5.2 — Advertiser Portal (link-based)
```
┌──────────────────────────────────────────────────┐
│ [tq] traqOOH    "Tata Motors — Bihar Blitz"       │
├──────────────────────────────────────────────────┤
│ [ All Sites ] [ Shortlisted (3) ] [ Cost Sheet ]  │
│                                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐                │
│  │ Site 1 │ │ Site 2 │ │ Site 3 │  ♥             │
│  └────────┘ └────────┘ └────────┘                │
│                                                    │
│  [Save Draft]              [Confirm Campaign ✓]   │
└──────────────────────────────────────────────────┘
```

---

## 6. DATABASE TABLES (Existing — 12)

| Table | Purpose |
|-------|---------|
| `companies` | Vendor / media owner companies |
| `gst_registrations` | GST details |
| `contacts` | Contact records |
| `user_accounts` | All users (admin/employee/advertiser) |
| `sites` | OOH inventory |
| `advertisers` | Client/brand companies |
| `advertiser_access_links` | Secure token links |
| `campaigns` | Campaigns |
| `campaign_site_assignments` | Sites ↔ campaigns + dates/costs |
| `site_audits` | Audit photos & checks |
| `site_images` | Multiple images per site |
| `activity_logs` | Full audit trail |

**New tables/fields to consider:**
- `campaign_activities` — print/reprint/audit/maintenance log per site-in-campaign (with photo links)
- `execution_photos` — start/mounting/live/end photos with GPS+timestamp

---

## 7. TRAQOOH MOBILE APP (React Native + Expo)

For **on-ground field staff** during execution:

| Screen | Purpose |
|--------|---------|
| Login | Staff login |
| My Campaigns | Assigned campaigns |
| Campaign Sites | List of sites to execute |
| Camera Capture | Photo with auto GPS + timestamp watermark |
| Upload Activity | Tag as Print/Mount/Audit/etc. → upload to R2 |
| Sync Status | Offline queue → syncs when online |

---

## 8. BUILD PRIORITY (Roadmap)

### Phase 1 — Core (mostly built ✅)
- [x] Site/inventory CRUD
- [x] Campaign creation + add sites
- [x] Advertiser access link + portal
- [x] Cost sheet
- [x] Multi-role auth

### Phase 2 — Execution & Audit (to build)
- [ ] `campaign_activities` table — print/reprint/audit log per site
- [ ] Photo attachment per activity (R2)
- [ ] Campaign start/end photo capture
- [ ] Mobile app execution flow

### Phase 3 — Communication
- [ ] Email send of access link
- [ ] WhatsApp share button (pre-filled)
- [ ] Email/dashboard notifications on confirm

### Phase 4 — Polish
- [ ] Map view of sites
- [ ] Invoice / billing
- [ ] Analytics with real data
- [ ] Mobile app → Play Store

---

## 9. MIGRATION NOTE — Move Login to app.brandsculpt.com

The app frontend (React + Vite on Cloudflare Pages) is already reachable at `app.brandsculpt.com` after the DNS change. Action items:

1. ✅ DNS: `app` CNAME → `traqooh-frontend.pages.dev` (done)
2. ✅ Cloudflare Pages custom domain → `app.brandsculpt.com` (done)
3. [ ] Update any hardcoded `traqooh.brandsculpt.com` URLs in the frontend `.env` / config to `app.brandsculpt.com`
4. [ ] Update backend CORS allowed origins to include `app.brandsculpt.com`
5. [ ] Test login, advertiser links, image uploads on new domain

---

*Last updated: 2026-06-04 — Brandsculpt Media Solutions Pvt. Ltd.*
