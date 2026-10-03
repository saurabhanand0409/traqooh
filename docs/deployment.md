# Deployment Guide

## Repositories
- Frontend: https://github.com/saurabhanand0409/traqooh-frontend
- Backend:  https://github.com/saurabhanand0409/traqooh-backend-python

## Deploy Flow
Both repos auto-deploy on push to `main` branch via Render.

```bash
# Push frontend changes
cd frontend
git add .
git commit -m "your message"
git push

# Push backend changes
cd backend-python
git add .
git commit -m "your message"
git push
```

## Environment Variables
### Frontend (Render Static Site)
| Variable | Value |
|----------|-------|
| `VITE_API_BASE` | `https://traqooh-backend-python.onrender.com` |

### Backend (Render Web Service)
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | PostgreSQL connection string |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |

## Render Services
| Service | Type | Plan |
|---------|------|------|
| traqooh-backend-python | Web Service (Python) | Free |
| traqooh-frontend | Static Site | Free |

> **Note**: Free tier spins down after 15 min inactivity. First request after sleep takes ~50s.
> Fix: Use UptimeRobot to ping `/docs` every 14 min.

## Custom Domain
Frontend: `traqooh.brandsculpt.com` (set in Render → Settings → Custom Domains)
