# WeSign signaling server

Relays WebSocket messages for **live video calls** (WebRTC offers, ICE, call invite/accept, live captions).

This is **separate** from the Express REST API (`Backend full`).

## Local dev

```bash
cd signaling-server
npm install
npm start
```

Default port: **3001**

### HTTPS/WSS locally (optional)

Copy certs from the Frontend app:

```powershell
mkdir certs
copy "..\Frontend\certs\key.pem" certs\
copy "..\Frontend\certs\cert.pem" certs\
```

Or generate: `cd Frontend && node scripts/generate-certs.js`

Without certs, the server falls back to **HTTP/WS** on port 3001.

Frontend / Flutter dev:

```env
VITE_DEV_WS_URL=wss://localhost:3001
# or ws://localhost:3001 if using HTTP fallback
```

## Deploy to Railway

1. **New service** in the same Railway project.
2. **Root directory:** `signaling-server`
3. Builder: **Dockerfile** (from `railway.toml`)
4. Variables:
   - `NODE_ENV=production`
   - `SIGNALING_USE_HTTP=true` (default in Dockerfile)
5. **Generate domain** → e.g. `wesign-signaling-production-xxxx.up.railway.app`
6. Client URL:

```text
wss://wesign-signaling-production-xxxx.up.railway.app
```

Railway terminates TLS; the container speaks HTTP + WebSocket.

## Health check

`GET /health` → `{ "status": "ok", ... }`

## Message types relayed

`register`, `user-update`, `query-user`, `call-invite`, `call-accept`, `call-reject`, `call-end`, `offer`, `answer`, `ice-candidate`, `sign-translation`, `speech-transcript`

## Mobile / Flutter

```dart
const signalingUrl = 'wss://YOUR-SIGNALING.up.railway.app';
```

REST API stays on the backend URL (`https://wesign-backend-production-7f55.up.railway.app`).
