# Quick Reference - Backend Integration

## Start Both Servers (Quick Start)

**Terminal 1 - Backend:**
```bash
cd "Backend full"
npm run dev
# Expected: "Server listening on port 3000"
```

**Terminal 2 - Frontend:**
```bash
cd Frontend
npm run dev
# Expected: "Port 1420" and "https://0.0.0.0:1420"
```

**Test URL:** https://0.0.0.0:1420/login

---

## All API Endpoints

### Auth (No Token Required)
- `POST /api/users/login-username` - Login/Register
- `POST /api/users/refresh` - Refresh access token

### Profile (Token Required)
- `GET /api/users/me` - Current user
- `PUT /api/users/:id` - Update user

### Public Profile
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/username/:username` - Get user by username
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/check/username/:username` - Check if exists
- `GET /api/users/:id/status` - Online status

### Device (Token Required)
- `POST /api/users/me/device-token` - Register device token

---

## Request/Response Examples

### Login
```
POST /api/users/login-username
{
  "username": "john",
  "password": "password123",
  "isDeaf": true
}

→ {
  "user": { ... },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### Search
```
GET /api/users/search?q=john

→ [{ id, username, firstName, ... }]
```

---

## How It Works

```
Frontend (Port 1420)
    ↓ calls: /api/users/login-username
    ↓
Vite Proxy (rewrites /api/* → http://localhost:3000/*)
    ↓
Backend (Port 3000)
    ↓ validates/creates user
    ↓ returns tokens + user data
    ↓
Frontend stores tokens
    ↓ sends with Authorization header for auth endpoints
```

---

## Key Files

**Backend Setup:**
- `.env` - Database URI & JWT secrets
- `src/app.js` - Express middleware
- `src/models/user.model.js` - Database schema + queries
- `src/controllers/user.controller.js` - Business logic
- `src/routes/user.routes.js` - All endpoints

**Frontend Setup:**
- `vite.config.ts` - Proxy configuration
- `src/services/apiClient.ts` - HTTP layer

---

## Current Status

✅ Authentication (username/password)
✅ User profiles (get/update)
✅ Search functionality
✅ Token management
✅ Vite proxy setup
⏳ Real-time calls (Socket.io)
⏳ Message history

---

## Common Issues

| Issue | Solution |
|---|---|
| "Cannot POST /api/users/login-username" | Start backend: `npm run dev` in "Backend full" |
| "MongoDB connection error" | Check .env MONGODB_URI or MongoDB service |
| Token errors | Restart backend after .env changes |
| Proxy not working | Verify vite.config.ts has proxy config |
| Username already exists | Try different username or check MongoDB |

---

## Database

MongoDB URI: `mongodb://admin:password123@localhost:27017/wesign`

Check users:
```bash
mongo "mongodb://admin:password123@localhost:27017/wesign?authSource=admin"
db.users.find()
```

---

## Frontend Code Examples

### Login
```typescript
import { apiPost, storeTokens } from '../services/apiClient';

const response = await apiPost('/users/login-username', {
  username: 'john',
  password: 'pass123',
  isDeaf: true
});

storeTokens({
  accessToken: response.accessToken,
  refreshToken: response.refreshToken
});
```

### Get Current User
```typescript
import { apiGet } from '../services/apiClient';

const user = await apiGet('/users/me');
// Token automatically added from Authorization header
```

### Search Users
```typescript
import { apiGet } from '../services/apiClient';

const results = await apiGet('/users/search?q=john');
```

---

## Deployment Pre-Check

- [ ] MongoDB running
- [ ] Backend running on 3000
- [ ] Frontend running on 1420
- [ ] Able to login with new username
- [ ] Able to login with existing username + correct password
- [ ] Wrong password rejected
- [ ] Search works
- [ ] Can view user profiles

All checks ✓ = Ready!
