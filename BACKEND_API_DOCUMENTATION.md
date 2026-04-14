# Backend API Documentation - Frontend Integration Guide

## Overview
The frontend communicates with the backend through a Vite proxy at `http://localhost:3000` on port 3000. All API calls use the `/api` prefix which is rewritten by the Vite proxy.

## Frontend Configuration
- **Vite Proxy**: `/api` → `http://localhost:3000`
- **Base URL**: `/api` (e.g., `/api/users/login-username`)
- **Port**: 1420 (Vite Dev Server with HTTPS on 0.0.0.0)
- **Backend Port**: 3000

## Required Backend Setup

### Key Technologies
- Express.js (HTTP Server)
- MongoDB (Database)
- Mongoose (ODM)
- JWT (Authentication)
- bcryptjs (Password hashing)
- CORS enabled
- Socket.io (for real-time communication)

### Authentication
- **Access Token**: JWT (15 minutes expiration)
- **Refresh Token**: JWT (7 days expiration)
- **Storage**: localStorage (`auth_token`, `refresh_token`)
- **Header**: `Authorization: Bearer <token>`

---

## Required API Endpoints

### 1. User Authentication Endpoints

#### POST `/api/users/login-username`
**Login/Register with username and password**

Request:
```json
{
  "username": "string (min 3 chars)",
  "password": "string (min 6 chars)",
  "isDeaf": "boolean"
}
```

Response (Success - 200/201):
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phoneNumber": "string",
    "isDeafMute": "boolean"
  },
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)"
}
```

**Behavior**:
- If username exists: Validate password, return 200 with tokens
- If username NOT exists AND password valid: AUTO-CREATE new user, return 201 with tokens
- If wrong password: Return 401 "Invalid username or password"

---

#### POST `/api/users/refresh`
**Refresh access token using refresh token**

Request:
```json
{
  "refreshToken": "string"
}
```

Response (Success - 200):
```json
{
  "accessToken": "string (JWT)"
}
```

---

### 2. User Profile Endpoints

#### GET `/api/users/me`
**Get current authenticated user profile**

Headers:
```
Authorization: Bearer <accessToken>
```

Response (Success - 200):
```json
{
  "id": "string",
  "username": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneNumber": "string",
  "isDeafMute": "boolean",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

---

#### GET `/api/users/:userId`
**Get user profile by ID**

Response (Success - 200):
```json
{
  "id": "string",
  "username": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneNumber": "string",
  "isDeafMute": "boolean",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

---

#### GET `/api/users/username/:username`
**Get user info by username**

Response (Success - 200):
```json
{
  "id": "string",
  "username": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneNumber": "string",
  "isDeafMute": "boolean"
}
```

---

#### PUT `/api/users/:userId`
**Update user profile (requires authentication)**

Headers:
```
Authorization: Bearer <accessToken>
```

Request (Partial update):
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)",
  "phoneNumber": "string (optional)",
  "isDeafMute": "boolean (optional)"
}
```

Response (Success - 200):
```json
{
  "id": "string",
  "username": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneNumber": "string",
  "isDeafMute": "boolean"
}
```

---

### 3. User Search & Validation Endpoints

#### GET `/api/users/search?q=<query>`
**Search for users by username**

Response (Success - 200):
```json
[
  {
    "id": "string",
    "username": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phoneNumber": "string",
    "isDeafMute": "boolean"
  }
]
```

---

#### GET `/api/users/check/username/:username`
**Check if username exists**

Response (Success - 200):
```json
{
  "exists": true,
  "user": { /* user object */ }
}
```

Response (Not found - 404):
```json
{
  "message": "User not found"
}
```

---

#### GET `/api/users/:userId/status`
**Get user online/offline status**

Response (Success - 200):
```json
{
  "status": "online|offline|away"
}
```

---

### 4. Device Notifications Endpoint

#### POST `/api/users/me/device-token`
**Register device token for push notifications**

Headers:
```
Authorization: Bearer <accessToken>
```

Request:
```json
{
  "deviceToken": "string"
}
```

Response (Success - 204):
No content

---

## Database Schema

### User Model
```javascript
{
  _id: ObjectId,
  username: String (unique, required),
  firstName: String (required),
  lastName: String (required),
  email: String (unique, required),
  phoneNumber: String (unique, required),
  password: String (hashed with bcryptjs, required),
  isDeafMute: Boolean (required),
  deviceTokens: [String],
  createdAt: Date,
  updatedAt: Date
}
```

---

## WebSocket Connection (Optional - Currently Not Implemented)

### Connection URL
```
wss://192.168.100.80:3001
```

### Message Types
- `register` - Register user to WebSocket
- `call-invite` - Incoming call notification
- `call-accept` - Call accepted
- `call-reject` - Call rejected
- `call-end` - Call ended
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate
- `sign-translation` - Translation message
- `speech-transcript` - Speech transcript
- `user-status` - User online/offline status
- `user-update` - User data update

---

## Error Handling

All errors should follow this format:
```json
{
  "message": "Error description",
  "status": 400|401|404|409|500
}
```

### Common Status Codes
- **200**: Success (data returned)
- **201**: Created (new resource created)
- **204**: No Content (success, no data)
- **400**: Bad Request (validation error)
- **401**: Unauthorized (invalid token or credentials)
- **404**: Not Found
- **409**: Conflict (duplicate username, email, etc.)
- **500**: Internal Server Error

---

## CORS Configuration

All endpoints should have CORS enabled:
```
Origin: * (allow all origins)
Methods: GET, POST, PUT, DELETE, OPTIONS
```

---

## Middleware Requirements

1. **Authentication Middleware** (`authenticate`)
   - Validates JWT in Authorization header
   - Requires `auth_token` in localStorage
   - Sets `req.user` with decoded token data
   - Returns 401 if invalid/missing

2. **Validation Middleware**
   - Validates request body fields
   - Returns 400 with field-specific errors

3. **Error Handling Middleware**
   - Catches all exceptions
   - Formats error responses
   - Logs errors to console

---

## Starting the Backend

```bash
cd "Backend full"
npm install
npm run dev
```

**Environment Variables** (.env file):
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://admin:password123@localhost:27017/wesign?authSource=admin
JWT_ACCESS_SECRET=change_access_in_production
JWT_REFRESH_SECRET=change_refresh_in_production
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

---

## Testing with Frontend

1. Ensure **MongoDB is running**
2. Start **Backend**: `npm run dev` in Backend folder (port 3000)
3. Start **Frontend**: `npm run dev` in Frontend folder (port 1420)
4. Test endpoints through Vite proxy at `http://localhost:1420`

All API calls will be proxied: `http://localhost:1420/api/...` → `http://localhost:3000/...`
