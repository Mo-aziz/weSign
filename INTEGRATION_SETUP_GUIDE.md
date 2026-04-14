# Backend-Frontend Integration - Complete Setup Guide

## Quick Start

### Prerequisites
- MongoDB running: `mongodb://admin:password123@localhost:27017/wesign`
- Node.js and npm installed
- Two terminals ready

### Step 1: Start Backend
```bash
cd "Backend full"
npm install  # First time only
npm run dev
```
Expected output: `Server listening on port 3000`

### Step 2: Start Frontend  
```bash
cd Frontend
npm install  # First time only
npm run dev
```
Expected output: `VITE v4.4.0 ready in ... ms` at `https://0.0.0.0:1420`

### Step 3: Test Integration
1. Open browser: `https://0.0.0.0:1420`
2. Try login with new username: "testuser"
3. Enter password: "password123"
4. Select user type and login
5. Should redirect to `/contacts`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│                      Port: 1420 (HTTPS)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  apiClient.ts: HTTP layer with JWT token handling      │ │
│  │  - Stores tokens in localStorage                        │ │
│  │  - Auto-refresh on 401                                  │ │
│  │  - Base URL: /api (proxied)                             │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────┘
                  │ Vite Proxy
                  │ /api/* → http://localhost:3000/*
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Express + Node.js)                 │
│                     Port: 3000 (HTTP)                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  User Routes → User Controller → User Model            │ │
│  │  - Auth: JWT tokens                                     │ │
│  │  - DB: MongoDB Mongoose models                          │ │
│  │  - Password: bcryptjs hashing                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
        ┌─────────────────┐
        │   MongoDB       │
        │ Port: 27017     │
        │ DB: wesign      │
        └─────────────────┘
```

---

## API Endpoints Reference

### Authentication Flow

#### 1. Login/Register
```
POST /api/users/login-username
{
  "username": "testuser",
  "password": "password123",
  "isDeaf": true
}

Response:
{
  "user": { id, username, firstName, lastName, email, phoneNumber, isDeafMute },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### 2. Refresh Token  
```
POST /api/users/refresh
{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "accessToken": "eyJhbGc..."
}
```

### User Profile

#### 3. Get Current User (Authenticated)
```
GET /api/users/me
Header: Authorization: Bearer <accessToken>

Response: { id, username, firstName, lastName, email, phoneNumber, isDeafMute, createdAt, updatedAt }
```

#### 4. Get User by ID
```
GET /api/users/:userId

Response: { id, username, firstName, lastName, email, phoneNumber, isDeafMute }
```

#### 5. Get User by Username
```
GET /api/users/username/:username

Response: { id, username, firstName, lastName, email, phoneNumber, isDeafMute }
```

#### 6. Update User (Authenticated)
```
PUT /api/users/:userId
Header: Authorization: Bearer <accessToken>

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}

Response: { id, username, firstName, lastName, email, phoneNumber, isDeafMute }
```

### Search & Discovery

#### 7. Search Users
```
GET /api/users/search?q=test

Response: [
  { id, username, firstName, lastName, email, phoneNumber, isDeafMute },
  ...
]
```

#### 8. Check Username Exists
```
GET /api/users/check/username/testuser

Response: { exists: true, user: { ... } }
or 404 Not Found
```

#### 9. Get User Status
```
GET /api/users/:userId/status

Response: { status: "online" | "offline" | "away" }
```

### Device Management

#### 10. Register Device Token (Authenticated)
```
POST /api/users/me/device-token
Header: Authorization: Bearer <accessToken>

{
  "deviceToken": "device_token_string"
}

Response: 204 No Content
```

---

## Implementation Details

### Files Modified/Created

```
Backend full/
├── src/
│   ├── app.js                     ✓ (CORS + middleware configured)
│   ├── server.js                  ✓ (Express + Socket.io server)
│   ├── config/
│   │   └── db.js                  ✓ (MongoDB connection)
│   ├── models/
│   │   └── user.model.js          ✓ (Schema + 12 static methods)
│   ├── controllers/
│   │   └── user.controller.js     ✓ (14 async functions)
│   ├── routes/
│   │   ├── index.js               ✓ (Route mounting)
│   │   └── user.routes.js         ✓ (11 endpoints)
│   ├── middleware/
│   │   ├── auth.js                ✓ (JWT validation)
│   │   └── authValidation.js      ✓ (Request validation)
│   ├── utils/
│   │   └── tokens.js              ✓ (JWT creation/verification)
│   ├── views/
│   │   └── user.view.js           ✓ (Response serialization)
│   └── services/
│       └── notifications.js       (Optional: for push notifications)
├── .env                           ✓ (Configuration)
├── package.json                   ✓ (Dependencies)
└── server.js                      ✓ (Entry point)

Frontend/
├── src/
│   ├── services/
│   │   ├── apiClient.ts           ✓ (HTTP + token handling)
│   │   ├── userService.ts         ✓ (User API calls)
│   │   └── contactService.ts      ✓ (Search/validation)
│   ├── screens/
│   │   └── Login.tsx              ✓ (Login UI + integration)
│   └── context/
│       └── AppContext.tsx         ✓ (Auth state management)
└── vite.config.ts                 ✓ (Proxy configuration)
```

### Key Features Implemented

✅ **Authentication**
- Username-based login with auto-signup
- JWT access + refresh tokens
- Password hashing with bcryptjs
- Token auto-refresh on 401

✅ **User Management**
- Create account on first login
- Update user profile
- Search users by username
- Get user by ID or username

✅ **Data Validation**
- Username: min 3 characters, unique
- Password: min 6 characters
- Email/Phone: unique per user
- Request body validation

✅ **Error Handling**
- Consistent error response format
- Proper HTTP status codes
- User-friendly error messages
- Token expiration handling

✅ **Middleware**
- Authentication middleware (JWT validation)
- CORS enabled for cross-origin requests
- Request validation middleware
- Error handling middleware

---

## Troubleshooting

### Error: "Cannot POST /api/users/login-username"
**Issue**: Backend not running or wrong port
**Fix**: 
- Check backend running on port 3000
- Run `npm run dev` in "Backend full" folder

### Error: "MongoDB connection failed"
**Issue**: MongoDB not running
**Fix**:
- Start MongoDB service: `mongod --version` to verify install
- Connection string in `.env`: `mongodb://admin:password123@localhost:27017/wesign?authSource=admin`

### Error: "Invalid token" at login
**Issue**: JWT secrets not set or expired
**Fix**:
- Check `.env` has `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- Restart backend after .env changes

### Frontend can't reach backend
**Issue**: Proxy not working
**Fix**:
- Verify vite.config.ts has proxy configuration
- Check both servers running (Frontend 1420, Backend 3000)
- Check browser console for CORS errors

### Duplicate username error
**Issue**: Username already exists
**Fix**:
- Try different username
- Check MongoDB: `db.users.find()`

---

## Testing Endpoints with cURL

### Test Login
```bash
curl -X POST https://localhost:1420/api/users/login-username \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123","isDeaf":true}' \
  -k  # Ignore SSL cert warning
```

### Test Search
```bash
curl https://localhost:1420/api/users/search?q=test \
  -H "Authorization: Bearer <accessToken>" \
  -k
```

---

## Database

### MongoDB Connection
```
URI: mongodb://admin:password123@localhost:27017/wesign?authSource=admin
Database: wesign
Collections: users
```

### Check MongoDB Status
```bash
# Connect to MongoDB
mongo "mongodb://admin:password123@localhost:27017/wesign?authSource=admin"

# View users
db.users.find()

# View specific user
db.users.findOne({ username: "testuser" })
```

---

## Environment Configuration

**File**: `Backend full/.env`

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/wesign?authSource=admin

# JWT
JWT_ACCESS_SECRET=change_access_in_production
JWT_REFRESH_SECRET=change_refresh_in_production
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

---

## Performance & Security Notes

1. **Passwords**: Hashed with bcryptjs (10 rounds) before storage
2. **Tokens**: Signed with JWT (RSA recommended for production)
3. **CORS**: Currently allows all origins (restrict in production)
4. **Rate Limiting**: Applied to auth endpoints
5. **Validation**: Server-side validation on all inputs
6. **HTTPS**: Frontend uses self-signed certs (valid for dev)

---

## Next Steps

1. ✅ Authentication working (username/password)
2. ⏳ Contact management (add/remove contacts)
3. ⏳ Real-time calls (Socket.io WebRTC signaling)
4. ⏳ Message translations (Sign ↔ Speech)
5. ⏳ User status tracking (online/offline)

---

## Support

For issues or questions:
1. Check console for errors (browser + terminal)
2. Verify all servers running: `netstat -an | grep 1420` and `netstat -an | grep 3000`
3. Reset by clearing localStorage and restarting both servers
4. Check MongoDB connection in backend console on startup
