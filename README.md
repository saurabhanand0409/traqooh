# TraqOOH — OOH Media Management Platform

Full-stack platform for managing outdoor advertising inventory, campaigns, and advertiser workflows.

## Structure

```
traqooh/
├── frontend/          React + Vite + Tailwind (deployed on Render)
├── backend-python/    FastAPI + SQLAlchemy + PostgreSQL (deployed on Render)
├── docs/              Architecture notes, API docs, specs
├── assets/            Shared logos, brand assets, mockups
├── scripts/           Utility scripts (DB seed, deploy helpers)
└── .claude/           Claude Code project settings
```

## Quick Start

### Backend
```bash
cd backend-python
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deployment
Both services auto-deploy on push to `main` via Render.

- Frontend: https://traqooh-frontend.onrender.com  
- Backend: https://traqooh-backend-python.onrender.com
- Live site: https://traqooh.brandsculpt.com
