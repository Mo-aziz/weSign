# WeSign System Architecture

This diagram illustrates the data flow and communication protocols between the Frontend, Backend, and the AI Model during an active sign language call.

```mermaid
sequenceDiagram
    autonumber
    
    box LightBlue Frontend App (Caller - Deaf User)
    participant F1 as Frontend (User 1)
    end

    box LightGreen AI & Backend Services
    participant AI as AI Model Service
    participant Backend as Node.js WebSocket Server
    end

    box LightYellow Frontend App (Callee - Hearing User)
    participant F2 as Frontend (User 2)
    end

    %% WebRTC Signaling Phase
    rect rgb(240, 240, 240)
    Note over F1, F2: 1. Call Initialization & WebRTC Signaling
    F1->>Backend: WSS (WebSocket) - Join Call Room
    F2->>Backend: WSS (WebSocket) - Join Call Room
    F1->>Backend: WSS - send `webrtc:offer`
    Backend->>F2: WSS - relay `webrtc:offer`
    F2->>Backend: WSS - send `webrtc:answer`
    Backend->>F1: WSS - relay `webrtc:answer`
    F1-->>F2: WebRTC - Exchange ICE Candidates (via Backend)
    F1<==>F2: WebRTC (P2P) - Direct Video/Audio Stream Established
    end

    %% AI Processing Phase
    rect rgb(230, 240, 255)
    Note over F1, AI: 2. AI Sign Language Recognition Loop
    loop Every 33ms
        F1->>F1: Capture Camera Frame
        F1->>AI: HTTP POST /frame (Base64 Image)
        AI->>AI: Run ML Inference
        AI-->>F1: HTTP Response (state, text, confidence)
        F1->>F1: Update UI Preview Text
    end
    end

    %% Transcript Syncing Phase
    rect rgb(255, 240, 230)
    Note over F1, F2: 3. Transcript Translation & TTS
    F1->>F1: User Confirms Translation
    F1->>Backend: WSS - send `call:transcript` (Text)
    Backend->>F2: WSS - relay `call:transcript` (Text)
    F2->>F2: Display Text on Screen
    F2->>F2: Web Speech API - Text-to-Speech (Audio)
    end
```

### Key Communication Channels

1.  **WebRTC (Peer-to-Peer):** Used strictly for high-bandwidth, low-latency live video and audio streaming directly between the two users. This bypasses the backend to save server resources and ensure privacy.
2.  **WebSockets (WSS):** Maintained by the Node.js backend. It serves two purposes:
    *   **Signaling:** Relaying the technical data (Offers, Answers, ICE candidates) required for the two browsers/Tauri apps to find each other and establish the WebRTC connection.
    *   **Transcript Syncing:** When the AI recognizes a complete word or sentence, that text payload is extremely small, so it is routed through the secure WebSocket room to the other user instantly.
3.  **HTTP (REST):** The frontend constantly fires off lightweight HTTP POST requests containing compressed image frames to the AI service. The AI service responds with JSON. This is decoupled from the main video feed, meaning if the AI service lags, the live video call remains perfectly smooth.
