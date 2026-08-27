# Marketplace OLX — A-level school project

## 🌐 Live Demo

**Frontend:** [https://marketplaceolxui.netlify.app/](https://marketplaceolxui.netlify.app/)

> The backend runs on Render's free tier and may take ~30 seconds to wake up on the first request after a period of inactivity — this is normal.

---

## 🏗️ Architecture

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18, Redux, MUI, React Router v6 | [Netlify](https://netlify.com) |
| Backend | Node.js, Express, GraphQL | [Render](https://render.com) |

---

## 🚀 Running Locally

You need **two terminals** — one for the backend server, one for the frontend.

### 1. Start the backend server

```bash
cd server
npm install
npm run seed     # optional: loads 3 demo users, 12 ads, comments and images
npm start        # http://localhost:4000
```

### 2. Start the frontend

```bash
# in the project root
npm install
npm start        # http://localhost:3000
```

The frontend automatically connects to `http://localhost:4000/` in development (see `src/config.js`).

### Demo credentials (after seeding)

| Login | Password |
|---|---|
| demo1 | 123456 |
| demo2 | 123456 |
| demo3 | 123456 |

---

## ⚙️ Backend (`server/`)

A self-contained Express + GraphQL server that replaces the original course backend.

### API endpoints

| Endpoint | Description |
|---|---|
| `POST /graphql` | All queries and mutations |
| `POST /upload` | Image upload (requires Authorization header) |
| `GET /uploads/<name>` | Serve uploaded images |
| `GET /` | Status and record counts |

### Server scripts

```bash
npm start        # production
npm run dev      # development with --watch (auto-restart on save)
npm run seed     # wipe database and load demo data
```

### Configuration

| Env variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Port the server listens on |
| `JWT_SECRET` | auto-generated | Override to keep tokens valid across restarts |

To point the frontend at a different backend, create `.env.local` in the project root:

```
REACT_APP_BACKEND_URL=https://your-server.onrender.com/
```

> ⚠️ The trailing slash is required.

### Storage

- `server/data/db.json` — JSON database (users, ads, comments, images)
- `server/uploads/` — uploaded image files

Both are gitignored. On Render's free tier the filesystem is ephemeral — demo data is automatically re-seeded on each restart.

---

## 🛠️ Frontend Scripts

In the project root:

```bash
npm start          # dev server at http://localhost:3000
npm run build      # production build → build/
npm test           # run tests
```

---

## 📦 Deployment

- **Frontend** auto-deploys to Netlify on every push to `main`
- **Backend** auto-deploys to Render on every push to `main`
- SPA routing is handled by [`public/_redirects`](public/_redirects) (Netlify)
- Build config is in [`netlify.toml`](netlify.toml)
