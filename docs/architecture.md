# TraqOOH Architecture

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Lucide Icons
- **Backend**: Python 3, FastAPI, SQLAlchemy ORM, Pydantic v2
- **Database**: PostgreSQL (hosted on Render)
- **File Storage**: Cloudflare R2 (images/uploads)
- **Deployment**: Render (auto-deploy from GitHub)

## Key Models
- `UserAccount` — employees, admins, advertisers, media owners
- `Company` (vendor) — media owner companies
- `Site` — individual OOH inventory items
- `Advertiser` — client companies
- `Campaign` — advertising campaigns
- `CampaignSiteAssignment` — site↔campaign links with shortlist/cost data
- `AdvertiserAccessLink` — token-based advertiser portal links
- `SiteAudit` — proof-of-display audit records

## Auth
Token stored in `localStorage` as `tq_user` JSON object.
Roles: `SUPER_ADMIN`, `ADMIN`, `EMPLOYEE`, `ADVERTISER`, `MEDIA_OWNER`

## Advertiser Portal
Public token-based access at `/access/:token` — no login required.
Tokens generated via `POST /api/advertisers/send-access-link`.
