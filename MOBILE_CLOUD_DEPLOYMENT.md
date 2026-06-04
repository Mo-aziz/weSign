# Mobile cloud deployment (Railway)

This guide deploys WeSign for a **mobile app** using HTTPS APIs (no `localhost` in production).

## Architecture

| Service | Platform | Default port | Purpose |
|---------|----------|--------------|---------|
| Node/Express API | Railway | `PORT` (Railway) | Auth, users, calls, conversations |
| MongoDB | Atlas or Railway Mongo | — | Database |
| Sign AI (FastAPI) | Railway (Docker) | `PORT` | MediaPipe + LSTM inference |
| WebSocket signaling | Railway or separate host | `PORT` | Real-time calls (deploy `Frontend/signaling-server.js`) |

Mobile app env (build-time):

- `VITE_PROD_BACKEND_URL` → `https://your-api.up.railway.app`
- `VITE_PROD_AI_SERVICE_URL` → `https://your-sign-ai.up.railway.app`
- `VITE_PROD_WS_URL` → `wss://your-signaling.up.railway.app`

---

## 1. MongoDB (Atlas)

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user and allow access from anywhere (`0.0.0.0/0`) for Railway, or use Atlas–Railway integration.
3. Copy the connection string, e.g.  
   `mongodb+srv://USER:PASS@cluster.mongodb.net/wesign?retryWrites=true&w=majority`

---

## 2. Node backend (Railway)

**Root directory:** `Backend full`

**Start command:**

```bash
npm start
```

(`node server.js` — listens on `process.env.PORT`)

### Railway variables

| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | Set by Railway |
| `MONGODB_URI` | Yes | Atlas connection string |
| `JWT_ACCESS_SECRET` | Yes | Long random string |
| `JWT_REFRESH_SECRET` | Yes | Long random string |
| `CLIENT_ORIGIN` | Yes | `https://your-app.com,capacitor://localhost` |
| `ACCESS_TOKEN_EXPIRES_IN` | No | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `7d` |

### Health check

`GET https://your-api.up.railway.app/health` → `{ "status": "ok" }`

Copy the public URL → `VITE_PROD_BACKEND_URL` in the mobile build.

---

## 3. Python sign AI (Railway)

**Root directory:** `TestingFinal`  
Uses `Dockerfile` + `railway.toml`.

**Start command (Docker):**

```bash
sh -c "uvicorn sign_server:app --host 0.0.0.0 --port ${PORT:-8001}"
```

### Railway variables

| Variable | Required | Example |
|----------|----------|---------|
| `PORT` | Auto | Railway |
| `HOST` | No | `0.0.0.0` |
| `ALLOWED_ORIGINS` | Yes (browser/WebView) | `https://your-app.com,capacitor://localhost` |
| `SESSION_TTL_SECONDS` | No | `900` |
| `RAILWAY_ENVIRONMENT` | Auto | Set by Railway |

### API

- `GET /health`
- `POST /reset` — `{ "sessionId": "uuid" }`
- `POST /frame` — `{ "sessionId": "uuid", "image": "<base64>" }`

Bundled in the image: `best_model.pt`, `mediapipeModels/*`, `lstm_model.py`.

Copy public URL → `VITE_PROD_AI_SERVICE_URL`.

**Note:** First request after deploy may be slow (model load). Use a larger Railway plan if CPU is tight.

---

## 4. WebSocket signaling (video calls)

Deploy the **`signaling-server/`** folder as its own Railway service (Dockerfile included).

| Setting | Value |
|---------|--------|
| Root directory | `signaling-server` |
| Start | `npm start` (Dockerfile default) |
| Health | `GET /health` |

Generate a public domain, then set:

```text
wss://your-signaling.up.railway.app
```

as `VITE_PROD_WS_URL` (Flutter: WebSocket base URL).

Railway terminates TLS; the container uses HTTP + WebSocket internally.

---

## 5. Mobile app build

1. Copy `Frontend/.env.example` → `Frontend/.env.production`
2. Set HTTPS URLs (no localhost):

```env
VITE_PROD_BACKEND_URL=https://your-api.up.railway.app
VITE_PROD_AI_SERVICE_URL=https://your-sign-ai.up.railway.app
VITE_PROD_WS_URL=wss://your-signaling.up.railway.app
```

3. Build the mobile client (React Native / Capacitor / Expo WebView — your pipeline):

```bash
cd Frontend
npm run build
```

Production builds **require** `VITE_PROD_*` URLs and enforce HTTPS.

---

## 6. TestFlight (iOS)

1. Build the iOS app with production `.env` / Xcode build settings pointing at Railway URLs.
2. Archive in Xcode → **Distribute App** → **App Store Connect**.
3. Upload to App Store Connect → **TestFlight** → add internal/external testers.
4. Verify on device:
   - Login hits `VITE_PROD_BACKEND_URL`
   - Sign recognition hits `VITE_PROD_AI_SERVICE_URL` with a unique `sessionId` per session
   - Calls use `VITE_PROD_WS_URL`

---

## Local development (unchanged)

| Service | Command | URL |
|---------|---------|-----|
| Backend | `cd "Backend full" && npm run dev` | `http://localhost:3000` |
| Sign AI | `cd TestingFinal && python sign_server.py` | `http://127.0.0.1:8001` |
| Frontend | `cd Frontend && npm run dev` | Vite proxy `/api` → backend |

Use `Frontend/.env` with `VITE_DEV_*` values from `.env.example`.
