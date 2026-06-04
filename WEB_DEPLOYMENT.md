# WeSign — deploy as a website (Railway)

Open a **link** in Chrome/Edge, log in, and call your teammate (no desktop installer, no Rust).

## Architecture

| Service | Railway root folder | URL role |
|---------|---------------------|----------|
| **Website (this)** | `Frontend` | `https://YOUR-WEB.up.railway.app` |
| Backend API | `Backend full` | REST + login |
| Signaling | `signaling-server` | WebRTC (`wss://`) |
| Sign AI | `TestingFinal` | Sign recognition |
| MongoDB | `weSign` | Database |

Production URLs are in `Frontend/.env.production` (baked in at build).

---

## Step 1 — Deploy the website on Railway

1. Railway project → **+ New** → **GitHub Repo** → your repo  
2. New service → **Settings** → **Root directory:** `Frontend`  
3. **Build** → Builder: **Dockerfile**  
4. **Deploy** → wait for success  
5. **Networking** → **Generate domain** → e.g. `wesign-web-production-xxxx.up.railway.app`  
6. Port prompt: use **`8080`** (or whatever `PORT` shows in deploy logs for `serve`)

### Optional: build-time env overrides

If you change Railway URLs later, set these on the **Frontend** service and redeploy:

- `VITE_PROD_BACKEND_URL`
- `VITE_PROD_AI_SERVICE_URL`
- `VITE_PROD_WS_URL`

(Or edit `Frontend/.env.production` and push.)

---

## Step 2 — Backend CORS

On the **backend** service → **Variables** → update `CLIENT_ORIGIN`:

```text
https://YOUR-WEB.up.railway.app
```

Comma-separated if you have several origins. Redeploy backend if needed.

---

## Step 3 — Test locally before sharing

```powershell
cd Frontend
npm install
npm run preview:prod
```

Open: `http://localhost:4173`  
Login and check browser console for Railway URLs.

For camera on localhost over HTTP, some browsers block media — the **deployed HTTPS** site is the real test.

---

## Step 4 — Two-home test (you + teammate)

1. Both open: `https://YOUR-WEB.up.railway.app`  
2. Each creates account (unique username)  
3. **Contacts** → add teammate’s **exact username**  
4. Both stay logged in (tab open)  
5. Caller → **Call** → callee **Accept**  
6. Allow **camera** and **microphone** in the browser  

### Browser console (F12) should show

```text
[WeSign] Service endpoints { production: true, api: 'https://wesign-backend.../api', ... }
✓ WebSocket connected successfully
```

---

## Local dev against Railway (optional)

```powershell
cd Frontend
copy .env.local.example .env.local
```

Set in `.env.local`:

```env
VITE_USE_PRODUCTION_URLS=true
```

```powershell
npm run dev
```

Note: local dev uses HTTPS certs in `Frontend/certs` if present; use deployed site for simplest testing.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails / CORS | Add web URL to backend `CLIENT_ORIGIN` |
| Call doesn’t ring | Callee not logged in; wrong username; check signaling `/health` |
| No camera | Use **HTTPS** site, not `http://`; allow permissions in browser |
| Black video | Home router / WebRTC — try another network or TURN later |
| 404 on refresh | App uses `HashRouter` (`#/contacts`) — OK for static hosting |

---

## Build commands reference

| Command | Purpose |
|---------|---------|
| `npm run build:web` | Production static files → `dist/` |
| `npm run preview:prod` | Test `dist` locally |
| Railway Dockerfile | Builds + serves `dist` on `$PORT` |
