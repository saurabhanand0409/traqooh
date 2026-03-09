# TraqOOH Frontend

React + Vite web application for the TraqOOH OOH advertising platform.

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## 📁 Project Structure

```
src/
├── App.jsx              # Landing page + routes
├── index.css            # Global styles (Tailwind)
├── pages/
│   ├── GetStarted.jsx   # Role selection page
│   ├── Dashboard.jsx    # User dashboard
│   ├── Inventory.jsx    # Site management
│   ├── Login.jsx        # Login form
│   └── Register.jsx     # Registration form
└── main.jsx             # React entry point
```

## 🔧 Environment Variables

Create `.env` file:
```
VITE_API_BASE=http://localhost:8080
```

## 🎨 Styling

- **Framework:** TailwindCSS
- **Font:** Inter (Google Fonts)
- **Theme:** Dark blue (#1f3c8f) + Green accent (#14b86e)

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## 🔐 Authentication

User data stored in `localStorage` as `tq_user`:
```json
{
  "email": "user@example.com",
  "role": "media-owner",
  "companyId": 1
}
```

## 📄 Key Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | App.jsx | Landing page |
| `/get-started` | GetStarted.jsx | Choose role |
| `/login/:type` | Login.jsx | Login form |
| `/register/:type` | Register.jsx | Registration |
| `/dashboard` | Dashboard.jsx | User dashboard |
| `/inventory` | Inventory.jsx | Manage sites |
