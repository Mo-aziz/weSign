# WeSign Backend & Database Architecture

Detailed block diagram of the **Backend Server**, **real-time services**, and **MongoDB database** — styled like the full system architecture diagram.

**PNG export:** [backend_database_diagram.png](./backend_database_diagram.png)

```mermaid
flowchart TB
    %% ─────────────────────────────────────────────
    %% CLIENT ENTRY POINT
    %% ─────────────────────────────────────────────
    subgraph CLIENT_LAYER["CLIENT LAYER"]
        direction LR
        FE["Frontend App<br/>(React + TypeScript)"]
        FE_FEATURES["REST Client · JWT Auth<br/>Socket.io Client · Signaling WS"]
    end

  FE --> FE_FEATURES

    %% ─────────────────────────────────────────────
    %% BACKEND SERVER
    %% ─────────────────────────────────────────────
    subgraph BACKEND_LAYER["BACKEND SERVER LAYER — Node.js + Express (Port 3000)"]
        direction TB

        subgraph EXPRESS_CORE["Express Core"]
            direction LR
            HELMET["Helmet<br/>(Security Headers)"]
            CORS["CORS<br/>(Cross-Origin)"]
            MORGAN["Morgan<br/>(Logging)"]
            RATE["Rate Limiter<br/>(Auth Routes)"]
            SWAGGER["Swagger UI<br/>(API Docs)"]
            JSON["JSON Body Parser"]
        end

        subgraph MIDDLEWARE["Middleware"]
            direction LR
            AUTH["authenticate<br/>JWT Bearer Token"]
            VALIDATE["authValidation<br/>register · login · update"]
        end

        subgraph API_ROUTER["API Router — /api"]
            direction TB

            subgraph USER_MODULE["/users — User Module"]
                direction TB
                UR["user.routes.js"]
                UC["user.controller.js"]
                CRC["contactRequest.controller.js"]
                UR --> UC
                UR --> CRC
            end

            subgraph CALL_MODULE["/calls — Call Module"]
                direction TB
                CR["call.routes.js"]
                CC["call.controller.js"]
                CR --> CC
            end

            subgraph CONV_MODULE["/conversations — Conversation Module"]
                direction TB
                CVR["conversation.routes.js"]
                CVC["conversation.controller.js"]
                CVR --> CVC
            end
        end

        subgraph SERVICES["Services & Utils"]
            direction LR
            TOKENS["tokens.js<br/>JWT Access / Refresh"]
            NOTIFY["notifications.js<br/>Push Stub (FCM/APNs)"]
            VIEWS["user.view.js<br/>Response Shaping"]
        end
    end

    %% ─────────────────────────────────────────────
    %% REAL-TIME LAYER
    %% ─────────────────────────────────────────────
    subgraph REALTIME_LAYER["REAL-TIME LAYER"]
        direction TB

        subgraph SOCKETIO["Socket.io Server (same HTTP server)"]
            direction LR
            SIO_JOIN["joinCall · joinConversation"]
            SIO_WEBRTC["webrtc:offer · answer · iceCandidate"]
            SIO_STREAM["call:transcript · conversation:message"]
        end

        subgraph SIGNALING["Signaling Server — WebSocket (Port 3001)"]
            direction LR
            SIG_REG["register · user-update · query-user"]
            SIG_CALL["call-invite · accept · reject · end"]
            SIG_RTC["offer · answer · ice-candidate"]
            SIG_MSG["sign-translation · speech-transcript"]
            SIG_CONTACT["contact-request-notify"]
        end
    end

    %% ─────────────────────────────────────────────
    %% DATABASE LAYER
    %% ─────────────────────────────────────────────
    subgraph DATABASE_LAYER["DATABASE LAYER — MongoDB (Mongoose ODM)"]
        direction TB

        MONGO[("MongoDB<br/>wesign database")]

        subgraph COLLECTIONS["Collections"]
            direction LR

            subgraph USER_COL["users"]
                direction TB
                U_FIELDS["firstName · lastName · username<br/>phoneNumber · email · dob<br/>password · isDeafMute<br/>deviceTokens[]<br/>contacts[] → User refs<br/>resetToken · timestamps"]
            end

            subgraph REQ_COL["contactrequests"]
                direction TB
                R_FIELDS["fromUserId → User<br/>toUserId → User<br/>status: pending | accepted<br/>rejected | cancelled<br/>timestamps"]
            end

            subgraph CALL_COL["callsessions"]
                direction TB
                C_FIELDS["callerId → User<br/>deafUserId → User<br/>status: ringing | active | ended<br/>transcript[] · startedAt · endedAt"]
            end

            subgraph CONV_COL["conversations"]
                direction TB
                CV_FIELDS["userId → User<br/>locationType · status<br/>messages[] · startedAt · endedAt"]
            end
        end

        MONGO --> USER_COL
        MONGO --> REQ_COL
        MONGO --> CALL_COL
        MONGO --> CONV_COL
    end

    %% ─────────────────────────────────────────────
    %% DATA FLOW ARROWS
    %% ─────────────────────────────────────────────
    FE_FEATURES -->|"HTTP REST<br/>/api/*"| EXPRESS_CORE
    EXPRESS_CORE --> MIDDLEWARE
    MIDDLEWARE --> API_ROUTER

    UC --> SERVICES
    CRC --> SERVICES
    CC --> SERVICES
    CVC --> SERVICES

    UC --> MONGO
    CRC --> MONGO
    CC --> MONGO
    CVC --> MONGO

    FE_FEATURES <-->|"Socket.io"| SOCKETIO
    FE_FEATURES <-->|"WSS Signaling"| SIGNALING

    CC -.->|"notifyIncomingCall"| NOTIFY
    NOTIFY -.-> USER_COL

    %% ─────────────────────────────────────────────
    %% STYLING (layer colors like system diagram)
    %% ─────────────────────────────────────────────
    classDef clientStyle fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a5f
    classDef backendStyle fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d
    classDef realtimeStyle fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#713f12
    classDef dbStyle fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87
    classDef mongoStyle fill:#ede9fe,stroke:#7c3aed,stroke-width:3px,color:#4c1d95

    class FE,FE_FEATURES clientStyle
    class HELMET,CORS,MORGAN,RATE,SWAGGER,JSON,AUTH,VALIDATE,UR,UC,CRC,CR,CC,CVR,CVC,TOKENS,NOTIFY,VIEWS backendStyle
    class SIO_JOIN,SIO_WEBRTC,SIO_STREAM,SIG_REG,SIG_CALL,SIG_RTC,SIG_MSG,SIG_CONTACT realtimeStyle
    class U_FIELDS,R_FIELDS,C_FIELDS,CV_FIELDS dbStyle
    class MONGO mongoStyle
```

---

## Layer breakdown

### 1. Client layer (entry point)

| Component | Role |
|-----------|------|
| **REST Client** | Calls `/api/users`, `/api/calls`, `/api/conversations` with JWT |
| **Socket.io Client** | Optional real-time rooms (call / conversation) on main backend |
| **Signaling WS Client** | WebRTC call setup, live translation relay, contact-request notifications |

---

### 2. Backend server layer (Express)

| Component | Responsibility |
|-----------|----------------|
| **Express Core** | Security (Helmet), CORS, logging, rate limiting, Swagger, JSON parsing |
| **Middleware** | `authenticate` (JWT), input validation on auth routes |
| **User module** | Registration, login, profile, search, contacts, **contact requests** |
| **Call module** | Create / accept / end call sessions, store transcripts |
| **Conversation module** | Text chat threads and messages |
| **Services** | JWT token helpers, push notification stub |

#### User API endpoints (database-backed)

| Method | Endpoint | Database action |
|--------|----------|-----------------|
| `POST` | `/users/register` | Insert **users** |
| `POST` | `/users/login` | Read **users**, issue JWT |
| `GET` | `/users/me` | Read **users** |
| `GET` | `/users/me/contacts` | Read **users.contacts** (populated) |
| `DELETE` | `/users/me/contacts/:id` | Mutual remove from **users.contacts** |
| `POST` | `/users/me/contact-requests` | Insert **contactrequests** or auto-accept |
| `GET` | `/users/me/contact-requests/incoming` | Read **contactrequests** (pending) |
| `POST` | `/users/me/contact-requests/:id/accept` | Update request + mutual **users.contacts** |
| `POST` | `/calls` | Insert **callsessions** |
| `POST` | `/conversations` | Insert **conversations** |

---

### 3. Real-time layer

Two separate real-time services:

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| **Main backend Socket.io** | 3000 | Socket.io | Room-based WebRTC relay, transcript streaming |
| **Signaling server** | 3001 | WebSocket (`ws`) | Call invites, P2P signaling, contact-request notify |

> The frontend uses the **signaling server** for live calls. The main backend Socket.io is available for call/conversation rooms and future features.

---

### 4. Database layer (MongoDB)

```mermaid
erDiagram
    USER ||--o{ CONTACT_REQUEST_SENT : "fromUserId"
    USER ||--o{ CONTACT_REQUEST_RECEIVED : "toUserId"
    USER }o--o{ USER : "contacts (mutual)"
    USER ||--o{ CALL_SESSION_CALLER : "callerId"
    USER ||--o{ CALL_SESSION_DEAF : "deafUserId"
    USER ||--o{ CONVERSATION : "userId"

    USER {
        ObjectId _id PK
        string username UK
        string phoneNumber UK
        string email UK
        boolean isDeafMute
        ObjectId[] contacts FK
        string[] deviceTokens
        date createdAt
    }

    CONTACT_REQUEST {
        ObjectId _id PK
        ObjectId fromUserId FK
        ObjectId toUserId FK
        string status
        date createdAt
    }

    CALL_SESSION {
        ObjectId _id PK
        ObjectId callerId FK
        ObjectId deafUserId FK
        string status
        object[] transcript
        date startedAt
        date endedAt
    }

    CONVERSATION {
        ObjectId _id PK
        ObjectId userId FK
        string status
        object[] messages
        date startedAt
    }
```

#### Collection summary

| Collection | Model file | Key relationships |
|------------|------------|-------------------|
| **users** | `user.model.js` | `contacts[]` → other users; stores profile & auth |
| **contactrequests** | `contactRequest.model.js` | `fromUserId` / `toUserId` → users; approval workflow |
| **callsessions** | `callSession.model.js` | `callerId` + `deafUserId` → users; call logs & transcript |
| **conversations** | `conversation.model.js` | `userId` → user; offline text threads |

---

## Contact request data flow

How adding a contact touches the backend and database:

```mermaid
sequenceDiagram
    autonumber
    participant A as User A (Frontend)
    participant API as Express API
    participant DB as MongoDB
    participant SIG as Signaling Server
    participant B as User B (Frontend)

    A->>API: POST /users/me/contact-requests { contactId }
    API->>DB: Check users · contactrequests
    alt Reverse pending request exists
        API->>DB: Update request → accepted
        API->>DB: Add mutual contacts on both users
        API-->>A: 200 autoAccepted
    else New request
        API->>DB: Insert contactrequests (pending)
        API-->>A: 201 request sent
    end
    A->>SIG: contact-request-notify → B
    SIG->>B: WebSocket event
    B->>API: GET /contact-requests/incoming
    API->>DB: Read pending requests
    API-->>B: Incoming request list
    B->>API: POST /contact-requests/:id/accept
    API->>DB: status=accepted + mutual contacts
    API-->>B: 200 contact added
    B->>SIG: contact-request-notify → A
```

---

## Deployment & connection

| Environment variable | Used by | Purpose |
|---------------------|---------|---------|
| `MONGODB_URI` / `MONGO_URL` | `config/db.js` | MongoDB connection |
| `JWT_ACCESS_SECRET` | `middleware/auth.js` | Token verification |
| `PORT` | `server.js` | Express + Socket.io (default 3000) |

**Production:** Backend deployed (e.g. Railway) with MongoDB Atlas. Signaling server deployed separately on port 3001.

---

## File map (backend source)

```
WeSign-Backend/src/
├── app.js                    Express app setup
├── server.js                 HTTP server + Socket.io + DB connect
├── config/
│   ├── db.js                 MongoDB connection
│   ├── cors.js               CORS rules
│   ├── env.js                Environment validation
│   └── swagger.js            API documentation
├── middleware/
│   ├── auth.js               JWT authentication
│   └── authValidation.js     Request validation
├── routes/
│   ├── index.js              /users · /calls · /conversations
│   ├── user.routes.js
│   ├── call.routes.js
│   └── conversation.routes.js
├── controllers/
│   ├── user.controller.js
│   ├── contactRequest.controller.js
│   ├── call.controller.js
│   └── conversation.controller.js
├── models/
│   ├── user.model.js
│   ├── contactRequest.model.js
│   ├── callSession.model.js
│   └── conversation.model.js
├── realtime/
│   └── socket.js             Socket.io event handlers
└── services/
    └── notifications.js      Push notification stub
```
