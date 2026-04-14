# WeSign Backend

Backend for **WeSign** – an app that helps deaf and mute people communicate via sign language (sign → text → voice). Built with **Express**, **MongoDB**, and **Socket.IO**.

## Structure

- `server.js` – HTTP server, MongoDB connection, Socket.IO attach
- `src/app.js` – Express app: CORS, Helmet, Morgan, rate limiting, JSON, routes
- `src/config/db.js` – MongoDB connection
- `src/routes/` – Route definitions (users, calls, conversations)
- `src/controllers/` – Request handlers
- `src/models/` – Mongoose models (User, CallSession, Conversation)
- `src/views/` – Response serializers
- `src/middleware/` – Auth (JWT), validation
- `src/realtime/socket.js` – Socket.IO rooms and events (calls, conversations, WebRTC signaling)
- `src/services/notifications.js` – Push notification stub (incoming call)

## Getting started

```bash
npm install
npm run dev
```

Server runs at `http://localhost:3000`. Set environment variables in `.env` (see below).

## Environment variables

| Variable | Description |
|---------|-------------|
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | `development` / `production` |
| `MONGODB_URI` | MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/wesign`) |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `ACCESS_TOKEN_EXPIRES_IN` | e.g. `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | e.g. `7d` |

## Authentication

- **Login/register** return `user`, `accessToken`, and `refreshToken`.
- Send the access token on protected routes: `Authorization: Bearer <accessToken>`.
- Use **refresh**: `POST /api/users/refresh` with body `{ "refreshToken": "..." }` to get a new `accessToken`.

## API endpoints

Base path: `/api`. Auth required = send `Authorization: Bearer <accessToken>`.

### Users (`/api/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Register. Body: `firstName`, `lastName`, `phoneNumber` (11 digits), `email`, `dob`, `password` (min 8), `isDeafMute` (boolean). Returns `user`, `accessToken`, `refreshToken`. |
| POST | `/login` | No | Login. Body: `phoneNumber`, `password`. Returns `user`, `accessToken`, `refreshToken`. |
| POST | `/refresh` | No | Body: `refreshToken`. Returns `accessToken`. |
| POST | `/me/device-token` | Yes | Register FCM/APNs token. Body: `deviceToken`. |
| PUT | `/:id` | Yes | Update user (owner only). Partial body allowed. |
| DELETE | `/:id` | Yes | Delete user (owner only). |
| POST | `/forgot-password` | No | Body: `phoneNumber`. Returns `resetToken`, `expiresAt`. |
| POST | `/reset-password` | No | Body: `phoneNumber`, `resetToken`, `newPassword`. |

### Calls (`/api/calls`)

Call session = caller + deaf user. Only participants can accept, end, get, or add transcript.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Yes | Create call. Body: `deafUserId`. Caller = current user. Triggers incoming-call notification stub. |
| POST | `/:id/accept` | Yes | Set status to `active` (participant only). |
| POST | `/:id/end` | Yes | Set status to `ended`, set `endedAt` (participant only). |
| POST | `/:id/transcript` | Yes | Append transcript. Body: `from` (`deafUser` \| `caller` \| `system`), `text` (participant only). |
| GET | `/:id` | Yes | Get call details and transcript (participant only). |

### Conversations (`/api/conversations`)

Live conversation session (e.g. street). Only owner can add messages or get conversation.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Yes | Start conversation. Body: `locationType` (optional). |
| POST | `/:id/messages` | Yes | Append message. Body: `text`, optional `from` (`user` \| `other` \| `system`), `language` (owner only). |
| GET | `/:id` | Yes | Get full transcript (owner only). |

## Socket.IO (realtime)

Connect to the same origin as the HTTP server (e.g. `http://localhost:3000`).

### Rooms

- **Join call**: emit `joinCall` with `{ callId }` → room `call:<callId>`.
- **Join conversation**: emit `joinConversation` with `{ conversationId }` → room `conversation:<conversationId>`.

### Events (client → server)

| Event | Payload | Effect |
|-------|---------|--------|
| `joinCall` | `{ callId }` | Socket joins room for that call. |
| `joinConversation` | `{ conversationId }` | Socket joins room for that conversation. |
| `call:transcript` | `{ callId, ... }` | Broadcast to room `call:<callId>` (e.g. sign→text chunk). |
| `conversation:message` | `{ conversationId, ... }` | Broadcast to room `conversation:<conversationId>`. |
| `webrtc:offer` | `{ callId, ... }` | Send to other peers in call room (SDP offer). |
| `webrtc:answer` | `{ callId, ... }` | Send to other peers in call room (SDP answer). |
| `webrtc:iceCandidate` | `{ callId, ... }` | Send ICE candidate to other peers in call room. |

### Events (server → client)

Same event names; server echoes/broadcasts within the room (payload may include `fromSocketId`).

## License

MIT
