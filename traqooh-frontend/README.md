# TraqOOH — OOH Advertising SaaS Platform

> A full-stack out-of-home (OOH) advertising management platform connecting **Media Owners** (who sell ad inventory) and **Advertisers** (who book ad space). 

---

## 🏗️ Project Structure

```
traqooh/
├── frontend/            # React + Vite web application (deployed on Cloudflare Pages)
├── backend-python/      # FastAPI REST API (deployed on Render)
├── mobile/              # React Native (Expo) mobile app for field teams
└── backend/             # Legacy Spring Boot backend (not in active use)
```

---

## 🌐 Live URLs

| Service | URL |
|---------|-----|
| **Web App** | https://traqooh.brandsculpt.com |
| **Cloudflare Pages** | https://traqooh-frontend.pages.dev |
| **Backend API** | https://traqooh-backend-python.onrender.com |
| **API Health Check** | https://traqooh-backend-python.onrender.com/health |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TailwindCSS |
| **Backend** | FastAPI (Python 3.11), SQLAlchemy, Uvicorn |
| **Database** | PostgreSQL (hosted on Render) |
| **Media Storage** | Cloudflare R2 (S3-compatible object storage) |
| **Mobile** | React Native, Expo |
| **Auth** | JWT Tokens + Bcrypt + SHA-256 password hashing |
| **Frontend Hosting** | Cloudflare Pages |
| **Backend Hosting** | Render Web Service |

---

## 👥 User Types

| Role | Description |
|------|-------------|
| **Media Owner** | Owns billboards, hoardings, LED screens. Manages inventory (sites), uploads proof-of-display via mobile. |
| **Advertiser** | Browses inventory, requests campaign bookings. |

---

## 🔐 Demo Credentials

- **Media Owner:** `media.owner1@example.com` / `Passw0rd!`
- **Advertiser:** `advertiser1@example.com` / `Passw0rd!`

> ℹ️ If logging into the cloud (Render) deployment for the first time, you must register a new account.

---

## 📱 Features

### Web Platform
- ✅ User registration and login (Media Owner / Advertiser)
- ✅ Dashboard with real-time analytics (Total Sites, Active Sites, Total Area sqft, Avg. Occupancy)
- ✅ Inventory management — add, edit, delete sites
- ✅ Site dimensions: **Width × Length (ft)** with auto-calculated **Total Area (sqft)**
- ✅ Site photo upload via Cloudflare R2
- ✅ Site filtering by type and city search
- ✅ Responsive UI

### Mobile App (Media Owners)
- ✅ Login with existing credentials
- ✅ View assigned sites
- ✅ Camera capture with GPS & timestamp watermark
- ✅ Upload proof-of-display media to Cloudflare R2

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+

### 1. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:5173

### 2. Backend (Python/FastAPI)
```bash
cd backend-python
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```
Backend runs at: http://localhost:8000

### 3. Mobile App
```bash
cd mobile
npm install
npx expo start --tunnel
```
Scan the QR code with the Expo Go app on your phone.

---

## ⚙️ Environment Variables

### Backend (`backend-python/.env`)
```env
PORT=8000
DATABASE_URL=postgresql://user:password@host:5432/traqooh
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
R2_BUCKET_NAME=traqooh-media
R2_PUBLIC_DOMAIN=https://pub-xxxxxxxx.r2.dev
```

### Frontend (`frontend/.env.production`)
```env
VITE_API_BASE=https://traqooh-backend-python.onrender.com
```

---

## 📂 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/register` | Register new media owner / advertiser |
| `GET` | `/api/dashboard/summary` | Dashboard stats (inventory, occupancy, total area) |
| `GET` | `/api/dashboard/recent-activity` | Recent activity feed |
| `GET` | `/api/sites` | List all sites |
| `POST` | `/api/sites` | Create a new site |
| `PUT` | `/api/sites/{id}` | Update a site |
| `DELETE` | `/api/sites/{id}` | Delete a site |
| `POST` | `/api/upload` | Upload a site image (stores to R2) |
| `GET` | `/api/mobile/sites` | Mobile: Get sites for a media owner |
| `GET` | `/health` | API health check |

---

## 🗄️ Database Schema (Key Tables)

| Table | Description |
|-------|-------------|
| `companies` | Media owner companies |
| `gst_registrations` | GST details per company |
| `contacts` | Company contacts |
| `user_accounts` | Login credentials and roles |
| `sites` | OOH inventory — includes `width`, `length`, `total_area` (sqft) |

---

## ☁️ Deployment

### Frontend (Cloudflare Pages)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Framework:** Vite

### Backend (Render Web Service)
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment:** Python 3.11

> The backend runs **self-healing database migrations** on every startup, ensuring the schema is always up to date.

---

## 📄 License

Private — All rights reserved. © TraqOOH / BrandSculpt 2026.
