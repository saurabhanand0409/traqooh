# TraqOOH — Infrastructure Cost & Scaling Plan

## Overview

This document details exact infrastructure costs at each growth stage, with specific numbers and actions required to scale from launch (~200 photos/month) to mature operations (~2,500 photos/month).

---

## Cost at Current Stage (200 photos/month)

| Service | Plan | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Neon PostgreSQL | Free (0.5 GB, 10 connections) | **$0** | Permanent free tier, never expires |
| Cloudflare R2 | Free (10 GB storage, 10M ops) | **$0** | Photos stay within free tier for 12+ months |
| Cloudflare Pages | Free (unlimited bandwidth) | **$0** | Static frontend, no limits |
| Render Backend | Free (sleeps after 15 min) | **$0** | Cold start delay ~50 seconds |
| EAS Builds | Free (30 builds/month) | **$0** | Enough for active development |
| **TOTAL** | | **$0/month** | |

### What fits in free tier at 200 photos/month
- **Storage**: 200 photos × 2 MB avg = **400 MB/month** added storage
  - After 12 months: 4.8 GB total — still within Cloudflare R2's 10 GB free storage
- **DB rows**: ~200 activity rows/month — trivial for Neon free 0.5 GB
- **Build ops**: 200 writes + reads — well within 10M free R2 ops/month
- **Bandwidth**: Cloudflare Pages has no egress limits; R2 egress to internet is free

---

## Phase 1 → Phase 2: First Paid Upgrade (~600 photos/month)

**When to upgrade:** When the cold-start delay (50s) starts frustrating field workers or advertisers.

| Action | Cost | Reason |
|--------|------|--------|
| Upgrade Render to **Starter ($7/month)** | **$7/month** | Eliminates cold start. Always-on with 512 MB RAM |
| Everything else stays free | $0 | Storage and DB still within free limits |
| **TOTAL** | **$7/month** | |

### Storage math at 600 photos/month
- 600 × 2 MB = 1.2 GB/month added
- After 6 months: ~7 GB total — still free on R2
- After 9 months: ~10.8 GB → just over 10 GB free limit
  - Overage: 0.8 GB × $0.015 = **$0.012/month** — negligible

### When Render Starter is not enough
Render Starter (512 MB RAM) handles ~50 concurrent requests and file uploads up to ~50 MB.
If you start seeing OOM errors or very slow uploads, upgrade to **Standard ($25/month)** — 1 GB RAM.

---

## Phase 2 → Phase 3: Growth Stage (~1,500 photos/month)

| Service | Plan Change | Monthly Cost | Reason |
|---------|------------|-------------|--------|
| Render | Starter → **Standard ($25/month)** | **$25** | More RAM for concurrent uploads, 1 CPU |
| Neon PostgreSQL | Free → **Launch ($19/month)** | **$19** | If hitting 0.5 GB DB limit or 10-connection limit |
| Cloudflare R2 | Free → Pay-as-you-go | ~**$0.45** | Storage overage |
| Cloudflare Pages | Free | **$0** | No change needed |
| EAS Builds | Free | **$0** | Still under 30 builds/month |
| **TOTAL** | | ~**$44/month** | |

### Storage math at 1,500 photos/month
- 1,500 × 2 MB = 3 GB/month added
- After 6 months: ~18 GB total storage
  - R2 overage: (18 - 10) × $0.015 = **$0.12/month**
- Class A operations (writes): 1,500/month → still way under 1M free ops
- Class B operations (reads): ~10,000/month → under 10M free reads

### DB size estimate at 1,500 photos/month
- Each photo row in `campaign_activities`: ~500 bytes
- 1,500/month × 12 months = 18,000 rows = ~9 MB per year
- DB size dominated by JSON `image_urls` fields and campaign data
- Neon free 0.5 GB should last **2-3 years** at this volume
- Watch: if you add site photos and audit forms, DB grows faster

---

## Phase 3 → Phase 4: Scale Stage (~2,500 photos/month)

| Service | Plan | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Render | Standard ($25/month) | **$25** | Handles 100+ concurrent users |
| Neon | Launch ($19/month) | **$19** | 10 GB storage, enough for years |
| Cloudflare R2 | Pay-as-you-go | ~**$0.75** | ~50 GB stored after 1 year |
| Cloudflare Pages | Free | **$0** | No change |
| EAS Builds | Free (or Professional $29/month if > 30 builds) | $0–**$29** | Only needed if frequent mobile releases |
| **TOTAL** | | **~$44–$73/month** | |

### R2 storage math at 2,500 photos/month
- 2,500 × 2 MB avg = **5 GB/month** added
- Month 2 onward: storage grows past 10 GB free limit
- Month 6: ~30 GB total → (30 - 10) × $0.015 = **$0.30/month**
- Month 12: ~60 GB total → (60 - 10) × $0.015 = **$0.75/month**
- R2 Class A writes: 2,500/month — far below 1 million free writes
- **R2 egress is always free** — no charge to serve photos to users

### Bottleneck at 2,500 photos/month
The main bottleneck is **Render's RAM** during concurrent photo uploads:
- Each 2 MB upload holds ~2-4 MB in memory while streaming to R2
- Render Standard (1 GB RAM) handles ~200 concurrent uploads safely
- If field teams upload in bursts (morning sync), add upload retry logic in the app

---

## Photo Size Optimization (Reduces All Costs)

Currently photos are uploaded at full camera resolution. Compressing before upload saves 60-80% storage.

### Option A: Frontend resize before upload (free, no infra change)
```javascript
// Add to upload handler in Inventory.jsx / activities
const compressImage = (file, maxWidthPx = 1280, quality = 0.75) => {
  return new Promise(resolve => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidthPx / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: "image/jpeg" })), "image/jpeg", quality);
    };
    img.src = URL.createObjectURL(file);
  });
};
```
- Reduces average photo from 3-5 MB → 0.4-0.8 MB (5-6× smaller)
- **Impact**: 2,500 photos × 0.6 MB avg = 1.5 GB/month instead of 5 GB
- **R2 cost at 12 months with compression**: (18 - 10) × $0.015 = **$0.12/month** instead of $0.75

### Option B: Cloudflare Images (transforms on-the-fly)
- $5/month base + $1 per 100K transformations
- Adds responsive image resizing, WebP conversion
- Worth it after 50,000+ total stored images

---

## Neon DB: When to Upgrade from Free

| Trigger | Action |
|---------|--------|
| DB approaching 0.4 GB (80% of 0.5 GB free limit) | Upgrade to Launch ($19/month) |
| Seeing "too many connections" errors | Upgrade to Launch (higher connection pooling) |
| Need DB branching for testing migrations safely | Upgrade to Launch |
| DB approaching 9 GB (Launch limit) | Upgrade to Scale ($69/month) |

**Current DB size check** (run in Neon SQL Editor):
```sql
SELECT pg_size_pretty(pg_database_size('neondb')) AS db_size;
```

---

## Render: When to Upgrade

| Current Pain | Fix |
|-------------|-----|
| 50s cold start delays | Upgrade to Starter ($7/month) — eliminates sleep |
| Uploads failing / OOM crashes | Upgrade to Standard ($25/month) — 1 GB RAM |
| API latency > 2s under load | Upgrade to Standard + add `WORKERS=2` env var |
| Need zero-downtime deploys | Upgrade to Standard (enables zero-downtime deploy) |

---

## Monthly Cost Summary by Stage

| Stage | Photos/month | R2 Storage | Render | Neon | Total/month |
|-------|-------------|-----------|--------|------|-------------|
| Launch | 0–200 | FREE | FREE | FREE | **$0** |
| Early growth | 200–600 | FREE | $7 | FREE | **$7** |
| Growth | 600–1,500 | ~$0.12 | $25 | FREE | **~$25** |
| Scale | 1,500–2,500 | ~$0.75 | $25 | $19 | **~$45** |
| Mature | 2,500–5,000 | ~$2 | $25 | $19 | **~$46** |

> **Key insight**: Cloudflare R2 is extremely cheap for this use case — even at 5,000 photos/month, storage costs stay under $2/month. The Render backend upgrade ($25/month) is the largest cost step and is necessary to avoid cold starts in production.

---

## Immediate Action Items

1. **Now (free, immediate)**: Add `JWT_SECRET` env var to Render — run `openssl rand -hex 32` locally, set in Render dashboard under Environment
2. **Now (free)**: Rotate Neon DB password — connection string with password is in CLAUDE.md (rotate in Neon Dashboard → Settings → Reset Password, update `DATABASE_URL` on Render)
3. **When field workers complain about slowness**: Upgrade Render to Starter ($7/month)
4. **Before advertising the app to advertisers**: Add client-side image compression (Option A above, 30 min work)
5. **When DB size > 0.4 GB**: Upgrade Neon to Launch ($19/month)
