# Remote testing (Skype-style — two homes)

Both teammates run the **same production build** connected to Railway. No localhost.

## Railway services

| Service | URL |
|---------|-----|
| Backend | `https://wesign-backend-production-7f55.up.railway.app` |
| Signaling | `wss://signaling-server-production-6bfc.up.railway.app` |
| Sign AI | `https://testingfinal-production.up.railway.app` |

## Build the desktop app (each person)

```powershell
cd Frontend
npm install
npm run tauri:build
```

Installer output: `Frontend/src-tauri/target/release/bundle/`

Uses `Frontend/.env.production` automatically.

## Test flow (you + teammate)

### 1. Each person: create account

- Open the app → Login  
- Pick a **unique username** + password (saved on Railway MongoDB)  
- One person: **Deaf**, one: **Hearing** (or both Deaf)

### 2. Add each other as contacts

- Contacts → Add contact → type teammate’s **exact username**  
- Must exist on server (they logged in once first)

### 3. Both apps open at the same time

- Signaling only delivers calls if the callee app is **running and logged in**  
- WebSocket registers `userId` from the backend on login

### 4. Start call

- Caller: Contacts → Call  
- Callee: Accept incoming call  
- Allow camera/microphone when prompted  

### 5. Verify in DevTools (F12)

Console should show:

```text
[WeSign] Service endpoints { production: true, api: 'https://wesign-backend.../api', signaling: 'wss://signaling-server...', signAi: 'https://testingfinal...' }
✓ WebSocket connected successfully
```

## Backend CORS (if API fails from app)

Railway backend → Variables → `CLIENT_ORIGIN`:

```text
tauri://localhost,https://tauri.localhost
```

## If video connects but no picture

Home routers may block WebRTC. Try another network or add a TURN server later.

## If call never rings

- Callee not logged in / app closed  
- Wrong contact username  
- Signaling URL not in production build (rebuild with `.env.production`)  
- Check `https://signaling-server-production-6bfc.up.railway.app/health`
