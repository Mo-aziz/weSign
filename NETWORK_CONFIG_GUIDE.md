# Network Configuration Guide

When moving to a **different network**, you need to change these 3 key files to make other devices on the same network access your app.

---

## Prerequisites

**On the Machine Running the Servers:**
1. Get your machine's IP address:
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.1.10`, `10.0.0.50`, etc.)

2. **Make sure it's a static IP** (doesn't change frequently) - ask your network admin or set it in WiFi settings

---

## Changes Required

### 📝 File 1: `Backend full\.env`
**Current:**
```
MONGODB_URI=mongodb://admin:password123@localhost:27017/wesign?authSource=admin
```

**Change to:**
```
MONGODB_URI=mongodb://admin:password123@YOUR_MACHINE_IP:27017/wesign?authSource=admin
```

**Example:**
```
MONGODB_URI=mongodb://admin:password123@192.168.1.10:27017/wesign?authSource=admin
```

**Why?** MongoDB needs to listen on all network interfaces, not just localhost. Update the Docker MongoDB container to expose the port properly.

---

### ⚙️ File 2: `Frontend\vite.config.ts`

**Find this section (around line 25):**
```typescript
hmr: {
  host: 'ZUKSH-LAP',  // ← CHANGE THIS
  port: 1420,
  protocol: 'https',
},
proxy: {
  '/api': {
    target: 'http://localhost:3000',  // ← CHANGE THIS
    changeOrigin: true,
  },
},
```

**Change to:**
```typescript
hmr: {
  host: 'YOUR_MACHINE_IP',  // ← Use your actual IP
  port: 1420,
  protocol: 'https',
},
proxy: {
  '/api': {
    target: 'http://YOUR_MACHINE_IP:3000',  // ← Use your actual IP
    changeOrigin: true,
  },
},
```

**Example:**
```typescript
hmr: {
  host: '192.168.1.10',
  port: 1420,
  protocol: 'https',
},
proxy: {
  '/api': {
    target: 'http://192.168.1.10:3000',
    changeOrigin: true,
  },
},
```

**Why?** 
- `hmr` (Hot Module Replacement): Tells Vite where to find hot reload updates
- `proxy`: Tells frontend where to send API requests

---

### 📡 File 3: `Frontend\src\services\useCallService.ts`

**Find this line (around line 81):**
```typescript
const WS_URL = `wss://192.168.100.80:3001`;
```

**Change to:**
```typescript
const WS_URL = `wss://YOUR_MACHINE_IP:3001`;
```

**Example:**
```typescript
const WS_URL = `wss://192.168.1.10:3001`;
```

**Why?** This tells the frontend where the WebSocket signaling server is running.

---

## Docker Configuration (Important!)

Your MongoDB runs in Docker. You need to ensure it listens on all network interfaces:

1. **Check if MongoDB is exposed to the network:**
   ```powershell
   docker port mongodb
   ```
   Should show: `27017/tcp -> 0.0.0.0:27017`

2. **If NOT exposed, restart MongoDB with:**
   ```powershell
   docker rm mongodb
   docker run -d --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:latest
   ```

---

## Complete Example Setup

**Scenario:** Your machine's IP is `192.168.1.100`

### Step 1: Update `.env`
```
MONGODB_URI=mongodb://admin:password123@192.168.1.100:27017/wesign?authSource=admin
```

### Step 2: Update `vite.config.ts`
```typescript
hmr: {
  host: '192.168.1.100',
  port: 1420,
  protocol: 'https',
},
proxy: {
  '/api': {
    target: 'http://192.168.1.100:3000',
    changeOrigin: true,
  },
},
```

### Step 3: Update `useCallService.ts`
```typescript
const WS_URL = `wss://192.168.1.100:3001`;
```

### Step 4: Start All Servers

**Terminal 1 - Backend:**
```powershell
cd "Backend full"
npm start
# Should see: "Server listening on port 3000"
```

**Terminal 2 - Signaling Server:**
```powershell
cd Frontend
npm run server
# Should see: "Listening on port 3001"
```

**Terminal 3 - Frontend Dev Server:**
```powershell
cd Frontend
npm run dev
# Should see: "Port 1420 https://0.0.0.0:1420"
```

---

## Accessing from Other Devices

**From any device on the same network:**
```
https://192.168.1.100:1420/login
```

Replace `192.168.1.100` with your actual machine IP.

**Browser Warning:** 
- You'll see "Connection not private" warning
- Click "Advanced" → "Proceed to [your IP] (unsafe)"
- This is expected with self-signed certificates for development

---

## Troubleshooting

### "Connection Refused"
- Backend/Frontend not running
- Wrong IP address in config
- Firewall blocking ports 1420, 3000, 3001

### "Cannot connect to signaling server"
- WebSocket server not started (`npm run server`)
- Wrong IP in `useCallService.ts`

### "Vite HMR not working" (Hot reload broken)
- Wrong HMR host in `vite.config.ts`
- Firewall blocking that port
- Update the browser and hard refresh (Ctrl+Shift+R)

### "MongoDB connection failed"
- Docker container not running
- Mongo not exposed to network (see Docker Configuration)
- Wrong IP or port in `.env`

---

## How to Find Your IP

**Windows PowerShell:**
```powershell
ipconfig
```
Find the line: `IPv4 Address . . . . . . . . . . . . : 192.168.X.X`

**Or use this command:**
```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' }).IPAddress
```

---

## Pro Tip: Use Environment Variables

Instead of hardcoding IP, you can use environment variables:

### Update `vite.config.ts`:
```typescript
const serverIp = process.env.VITE_SERVER_IP || 'localhost';

hmr: {
  host: serverIp,
  port: 1420,
  protocol: 'https',
},
proxy: {
  '/api': {
    target: `http://${serverIp}:3000`,
    changeOrigin: true,
  },
},
```

### Then start frontend with:
```powershell
$env:VITE_SERVER_IP="192.168.1.100"
npm run dev
```

---

## Summary Table

| Config | Local Dev | Network Dev |
|--------|-----------|-------------|
| **Backend** | `localhost:3000` | `YOUR_IP:3000` |
| **Frontend** | `https://localhost:1420` | `https://YOUR_IP:1420` |
| **Signaling** | `wss://localhost:3001` | `wss://YOUR_IP:3001` |
| **MongoDB** | `localhost:27017` | `YOUR_IP:27017` |

---

## Next Steps

1. Get your machine's IP address
2. Update the 3 files listed above
3. Start all 3 servers in 3 terminals
4. Test from another device on the network
5. Share the URL with others: `https://YOUR_IP:1420/login`
