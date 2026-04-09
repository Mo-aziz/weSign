# Sign Language Communicator

A modern desktop application that enables seamless communication between deaf and hearing individuals using video calls, real-time translation, and intelligent sign/speech recognition.

---

##  Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [What's New](#whats-new)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Installation & Setup](#installation--setup)
8. [Running the Application](#running-the-application)
9. [Testing the Application](#testing-the-application)
10. [Building for Production](#building-for-production)
11. [Troubleshooting](#troubleshooting)
12. [API Reference](#api-reference)

---

## What's New

### Latest Updates (V2)

 **Enhanced Voice Intelligence**
- Gender-aware voice selection: Female speakers hear female voices, male speakers hear male voices
- Language-intelligent fallback: System automatically selects the closest available voice matching sender's language preferences
- 8-priority matching chain ensures optimal voice selection across different operating systems

 **HTTPS & Security**
- Full HTTPS encryption on both desktop and web connections
- Self-signed mkcert certificates for secure development
- WSS (WebSocket Secure) for encrypted signaling
- All peer-to-peer data transmitted through encrypted channels

 **Deaf-to-Deaf Communication**
- Support for deaf users to call other deaf users
- Live sign language recognition and transmission
- Camera-based communication for sign language

 **Microphone Auto-Control**
- Automatic pause/resume of microphone during text-to-speech
- 3-second safety fallback ensures microphone always resumes
- Prevents audio feedback loops while maintaining seamless experience

---

## Project Overview

**Sign Language Communicator** is a Windows desktop application built with modern web technologies and packaged as a native app. It facilitates real-time video conversations between:

- **Deaf Users**: Use camera for sign language; app recognizes signs and sends as text
- **Hearing Users**: Use microphone for speech; app converts speech to text/visual representation

The app uses **WebRTC** for peer-to-peer video/audio streaming and a **WebSocket signaling server** for call coordination and translation exchange.

### Use Cases

- 🎓 **Educational**: Training sign language recognition
- 🏥 **Healthcare**: Remote consultations with real-time translation
- 💼 **Business**: Accessible team meetings and calls
- 👥 **Social**: Easy communication across language barriers
- 🧑‍🤝‍🧑 **Deaf Community**: Secure video calls between deaf users with sign recognition

---

## Key Features

### Authentication & Profiles
-  User login with profile creation
-  Customizable user preferences (deaf/hearing designation)
-  Voice settings (choice of voice, pitch, rate) for text-to-speech

### Communication Modes
-  **Deaf-to-Deaf Calls**: Two deaf users communicate via sign language with live recognition
-  **Hearing-to-Hearing Calls**: Two hearing users communicate via speech with TTS playback
-  **Cross-Communication Ready**: Framework supports future mixed-mode calls

### Call Management
- Real-time peer-to-peer video calls via WebRTC (Deaf-to-Deaf & Hearing-to-Hearing)
- Contact list with call history
- Incoming call notifications and acceptance/rejection
- Call timer showing elapsed time
- Bidirectional media streams (camera for deaf, microphone for hearing)
- **Call Eligibility Validation**: Intelligent call blocking system that validates both caller and callee user types at call time:
  - ✅ **Allowed**: Deaf → Deaf, Deaf → Hearing, Hearing → Deaf
  - ❌ **Blocked**: Hearing → Hearing (prevents inappropriate calls)
  - Real-time server validation ensures accurate user type detection
  - User type changes in Settings immediately sync to server

### Translation & Recognition
- **Live Sign Recognition**: Detects signs and shows predictions
- **Editable Predictions**: Double-click to correct misrecognized signs
- **Speech-to-Text**: Converts hearing user's speech to captions
- **Intelligent Text-to-Speech**: Reads translations aloud with smart voice selection
- **Gender-Aware**: Automatically selects female/male voices matching sender's preference
- **Language-Smart**: Chooses closest available voice when preferred language unavailable
- **Priority Matching**: Same language + gender → Same language → English + gender → Default
- **Auto-Microphone Control**: Automatically pauses/resumes to prevent feedback loops
- **Translation History**: Stores and displays all messages from both users

### HTTPS & Security
- **HTTPS Enabled**: All desktop and web connections use secure HTTPS
- **Self-Signed Certificates**: Auto-generated mkcert certificates for development
- **WebSocket Secure (WSS)**: Signaling server uses encrypted WebSocket connections
- **Peer Data Encryption**: All peer-to-peer data transmitted via encrypted channels

### Call Validation System
- **Real-Time Eligibility Checks**: Every call attempt is validated against both users' current types (directly queried from server)
- **Parallel Server Queries**: Both caller and callee user types are fetched simultaneously for accuracy
- **User Type Synchronization**: When users change their type in Settings, changes are immediately sent to server and reflected in all call validations
- **Intelligent Blocking Rules**:
  - ✅ Deaf → Deaf: Uses video/sign recognition channel
  - ✅ Deaf → Hearing: Deaf user signs, hearing user hears captions + TTS
  - ✅ Hearing → Deaf: Hearing user speaks, deaf user sees captions + sign simulation
  - ❌ Hearing → Hearing: **Blocked** - system prevents inappropriate same-mode calls
- **Error Messaging**: Clear user feedback when calls are blocked with reason explanation

### User Interface
- Dark/Light theme toggle with system preference detection
- Responsive design (works in browser and desktop)
- Real-time status indicators
- Smooth animations and transitions

---

## Technology Stack

### Frontend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **React** | UI component framework | 18.2.0 |
| **TypeScript** | Type-safe JavaScript | ~5.0.0 |
| **Vite** | Build tool & dev server | 4.4.0 |
| **React Router** | Client-side routing | 6.22.0 |
| **TailwindCSS** | Utility-first CSS framework | 3.3.5 |
| **React Icons** | Icon library | 5.5.0 |

### Desktop & Backend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Tauri** | Windows desktop app wrapper | 1.5.0 |
| **Node.js** | Runtime for signaling server | 18+ |
| **WebSocket (ws)** | Real-time signaling | 8.16.0 |

### Core Libraries
| Technology | Purpose |
|-----------|---------|
| **WebRTC** | Peer-to-peer video/audio/data channels |
| **Web Speech API** | Browser's native speech recognition & synthesis |
| **MediaDevices API** | Camera & microphone access |

### Development Tools
- **ESLint**: Code quality & style checking
- **PostCSS**: CSS processing & autoprefixing
- **Rust Toolchain**: Required for Tauri compilation

---

## Project Structure

```
sign-language-react-v2/
├── src/                                  # React frontend source
│   ├── context/
│   │   └── AppContext.tsx                # Global state management (user, calls, theme)
│   ├── screens/
│   │   ├── Login.tsx                     # User authentication
│   │   ├── Contacts.tsx                  # Contact list & call initiation
│   │   ├── Translation.tsx               # Sign/speech practice & preview
│   │   └── Settings.tsx                  # User profile & preferences
│   ├── components/
│   │   ├── CallModal.tsx                 # In-call UI & communication
│   │   ├── IncomingCallModal.tsx         # Incoming call notification
│   │   ├── AuthenticatedLayout.tsx       # Navigation layout
│   │   └── VoiceSettings.tsx             # Voice configuration UI
│   ├── services/
│   │   ├── useCallService.ts             # WebRTC peer connection & signaling
│   │   ├── useSignRecognitionService.ts  # Sign recognition (simulated)
│   │   ├── localSpeechRecognition.ts     # Web Speech API wrapper
│   │   └── localTTS.ts                   # Text-to-speech (Web Speech API)
│   ├── theme/
│   │   └── materialTheme.ts              # Theme configuration
│   ├── App.tsx                           # Root component & routing
│   ├── main.tsx                          # React app entry point
│   └── index.css                         # Global styles
│
├── src-tauri/                            # Tauri desktop app backend
│   ├── tauri.conf.json                   # Tauri configuration
│   ├── Cargo.toml                        # Rust dependencies
│   ├── src/main.rs                       # Tauri app initialization
│   └── tts_service/                      # Python TTS service (optional)
│
├── signaling-server.js                   # WebSocket signaling server
├── package.json                          # Npm dependencies & scripts
├── tauri.conf.json                       # Desktop app config
├── vite.config.ts                        # Vite build configuration
├── tailwind.config.js                    # TailwindCSS config
└── tsconfig.json                         # TypeScript configuration
```

---

## Prerequisites

Before you begin, ensure you have installed:

### Required
- **Node.js** 18+ ([Download](https://nodejs.org))
- **Rust toolchain** (required for Tauri on Windows)

### Windows-Specific Requirements
For Tauri to compile on Windows, you need:

1. **Microsoft Visual C++ Build Tools** ([Download](https://visualstudio.microsoft.com/downloads/))
   - When installing, select "Desktop development with C++" workload

2. **x86_64-pc-windows-msvc** Rust target (install with):
   ```bash
   rustup target add x86_64-pc-windows-msvc
   ```

### Verify Installation
```bash
node --version      # Should be v18+
npm --version       # Should be 9+
rustc --version     # Should be installed
cargo --version     # Should be installed
```

---

## Installation & Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/Mo-aziz/weSign.git
cd "sign language react V2"
```

### Step 2: Install Dependencies
```bash
npm install
```
This installs all Node.js and React packages listed in `package.json`.

### Step 3: Verify Setup
```bash
npm run lint
```
Should complete without errors. If you see errors, check TypeScript types and imports.

---

## Running the Application

### ⚠️ Important: HTTPS & Certificates

The app uses **HTTPS with self-signed certificates** (via mkcert) for security:
- Dev server: `https://localhost:1420`
- Signaling server: `wss://localhost:3001`

On first launch, your browser may show a security warning. This is **normal and expected**. Simply click "Advanced" and proceed - the certificate is safe for development.

**Note:** Camera/Microphone access requires HTTPS in modern browsers.

### Option 1: Desktop App (Recommended)
Runs the full Tauri desktop application with both frontend (Vite) and native window:

```bash
npm run tauri:dev
```

**App URL:** `https://localhost:1420/`

**What happens:**
1. Vite dev server starts on `https://localhost:1420/` (HTTPS with self-signed cert)
2. Tauri opens a native Windows window automatically displaying the React app
3. Hot module replacement (HMR) enabled for instant code updates
4. Opens DevTools for debugging (F12 in Tauri window)

### Option 2: Web Browser Only
Test the React app in your default browser (without desktop wrapper):

```bash
npm run dev
```

**Access at:** `https://localhost:1420`

**Note:** Self-signed certificate warning is expected - proceed anyway.

**Limitations:**
- Tauri APIs won't work
- No native window integrations
- Good for UI development

### Option 3: Run Signaling Server (For Multiplayer Testing)
In a **separate terminal**, start the WebSocket signaling server:

```bash
npm run server
```

**Output:** 
```
Signaling server running on wss://localhost:3001
```

**What it does:**
- Enables peer-to-peer call connections between multiple users (Deaf-to-Deaf & Hearing-to-Hearing)
- Exchanges WebRTC offer/answer/ICE candidates
- Relays translation messages between connected users
- Uses WSS (WebSocket Secure) for encrypted signaling

---

## Testing the Application

### Test Scenario 1: Single User - Sign Language Recognition

**Steps:**
1. Launch app: `npm run tauri:dev`
2. Login with any credentials (auth mocked)
3. Select **"Deaf"** in user preferences
4. Go to **Translation** page
5. Click **"Start" button** to begin sign recognition
6. Use your webcam - app shows predicted signs
7. Click on prediction text to edit if needed
8. History shows all predictions

**Expected Results:**
- Webcam shows live video
- Signs appear in recognition box every 2-3 seconds
- History panel updates with new entries
- Dark/light theme works properly

### Test Scenario 2: Calling Another User (Requires 2 Instances)

**Setup:**
1. Start signaling server: `npm run server` (separate terminal)
2. Launch app twice (two windows): `npm run tauri:dev`

**Test Case A: Deaf-to-Deaf Calling (Camera/Sign Language)**

**On User A (Deaf):**
1. Login as "deaf_user_1"
2. Select **Deaf** preference
3. Go to **Contacts**
4. Add contact "deaf_user_2"

**On User B (Deaf):**
1. Login as "deaf_user_2"
2. Select **Deaf** preference
3. Go to **Contacts**
4. Add contact "deaf_user_1"

**Initiate Call:**
1. User A clicks "Call" next to "deaf_user_2"
2. User B sees incoming call notification
3. User B accepts call
4. Both see video streams of each other signing
5. Call timer starts counting
6. Both users sign, signs are recognized and sent in real-time
7. Each user sees sign predictions from the other
8. Either user can end call independently

**Expected Results:**
- Bidirectional video streams active
- Sign recognition working both ways
- Call timer increments
- Translation history updated with recognized signs
- Both users can end call independently
- No errors in browser console

**Test Case B: Hearing-to-Hearing Calling (Microphone/Speech)**

**On User C (Hearing):**
1. Login as "hearing_user_1"
2. Select **Hearing** preference
3. Go to **Contacts**
4. Add contact "hearing_user_2"

**On User D (Hearing):**
1. Login as "hearing_user_2"
2. Select **Hearing** preference
3. Go to **Contacts**
4. Add contact "hearing_user_1"

**Initiate Call:**
1. User C clicks "Call" next to "hearing_user_2"
2. User D sees incoming call notification
3. User D accepts call
4. Both users have audio streams active
5. User C speaks → speech converted to captions for both
6. User D speaks → speech converted to captions for both
7. Both hear text-to-speech reading the captions
   

**Expected Results:**
- Bidirectional audio streams active
- Speech recognitions converted to captions
- Text-to-speech playing with properly matched voices
- Gender preference respected (female voice hears female, male hears male)
- Language preference honored (Spanish user hears Spanish if available)
- Call timer increments
- No console errors

### Test Scenario 3: UI & Navigation

**Dark Theme:**
1. Go to **Settings** page
2. Click "Toggle Theme" button
3. Entire UI should switch to dark mode
4. All text remains readable
5. Switch back - UI returns to light mode

**Voice Settings (Hearing Users):**
1. Go to **Settings**
2. Select different voice from dropdown
3. Adjust "Pitch" slider (0.5 - 2.0)
4. Adjust "Rate" slider (0.5 - 2.0)
5. Click "Test Voice" - should hear testing audio in new voice
6. Click "Save Changes"

**Contact Management:**
1. Go to **Contacts**
2. Add a contact by typing username + clicking "Add"
3. Contact appears in list
4. Click "Remove" to delete
5. List updates

**Expected Results:**
- All buttons respond immediately
- Input fields validate properly
- No console errors
- Smooth transitions between screens

### Test Scenario 4: Voice Matching & TTS

**Gender-Aware Voice Selection:**
1. Go to **Settings**
2. Select a **female voice** from dropdown (e.g., "Microsoft Zira", "Google US English Female")
3. Click "Test Voice" - should hear female voice
4. Save changes
5. Start a call with another user
6. That user speaks → TTS response uses female voice (if available on their system)

**Language-Intelligent Voice Fallback:**
1. Go to **Settings**
2. Select a voice in a **non-English language** if available (e.g., "Google French", "Microsoft Marie French")
3. Save changes
4. Start a call
5. When receiving audio from caller:
   - If caller's voice is in the same language → System uses that language if available
   - If caller's voice is different language → System falls back to English with same gender
   - If no gender match available → System uses system default
6. Check browser console for logs like:
   - `[Auto-TTS] Found [voice] (same language + same gender)`
   - `[Auto-TTS] Found [voice] (same language)`
   - `[Auto-TTS] Found [voice] (English with matching gender)`

**Microphone Auto-Resume:**
1. During a call, let the other user send a message
2. Your microphone should pause to prevent feedback loop during TTS
3. After TTS finishes (within 3 seconds), microphone should automatically resume
4. Verify in browser console: `[Auto-TTS]  TTS completed - resuming microphone`

**Expected Results:**
- Voice selection respects gender preference
- TTS language matches original speaker when available
- Fallback chain works correctly when voices unavailable
- Microphone resumes automatically after TTS
- Console shows appropriate debug messages

### Test Scenario 5: Error Handling

**HTTPS Security Warning:**
1. Open `https://localhost:1420` in browser
2. Browser shows "Not secure" warning (expected for self-signed cert)
3. Click "Advanced" → "Proceed to localhost"
4. App loads normally
5. No security impact in development environment

**Deny Camera Permission:**
1. Launch app
2. Deny camera permission when prompted
3. App should gracefully handle and show error message
4. Try to join call - appropriate error message

**No Microphone:**
1. Unplug/disable microphone
2. Login as hearing user
3. Try to make call
4. App should detect and show error

**Network Failure:**
1. Disable internet while on call
2. App should detect disconnect
3. Call should end gracefully
4. Error message appears

**WSS Connection Failed (Signaling Server Down):**
1. Stop signaling server: `Ctrl+C` in server terminal
2. Try to make a call from one user
3. App should show connection error
4. Restart server: `npm run server`
5. Call should work again after reconnection

---

## Building for Production

### Build Desktop App (Windows EXE)
```bash
npm run tauri:build
```

**Output Location:**
```
src-tauri/target/release/bundle/nsis/Sign Language Communicator_0.1.0_x64_en-US.exe
```

**Note:** Requires full Rust & Visual Studio toolchain. First build may take 5-10 minutes.

### Build Frontend Only (No Desktop)
```bash
npm run build
```

**Output Location:**
```
dist/                          # Static files ready for deployment
├── index.html
├── assets/
│   ├── index-*.js            # Minified JS bundle
│   └── index-*.css           # Minified CSS bundle
└── favicon.ico
```

---

## Troubleshooting

### Issue 1: "Your connection is not private" - HTTPS Certificate Warning
**Solution:** This is **normal and expected** with self-signed certificates in development.
- Click "Advanced"
- Click "Proceed to localhost" (or equivalent)
- This is safe for development - the app uses secure mkcert certificates
- Your browser will remember this and not show the warning again

### Issue 2: "Command 'tauri' not found"
**Solution:** Ensure Tauri CLI is installed:
```bash
npm install
npx tauri --version
```

### Issue 3: Rust toolchain not found
**Solution:** Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add x86_64-pc-windows-msvc
```

### Issue 4: Camera/Microphone not working
**Solution:**
- Check Windows Privacy Settings → Camera/Microphone → allow app
- Requires HTTPS (which app uses) for modern browser access
- Try restarting app
- Test webcam with another app (e.g., Windows Camera)

### Issue 5: Signaling server connection fails
**Error:** "Connection refused on port 3001" or "Failed to connect to wss://localhost:3001"

**Solution:**
1. Ensure server runs: `npm run server`
2. Check server is listening on `localhost:3001`:
   ```bash
   netstat -ano | findstr :3001
   ```
3. If port 3001 in use, change in `signaling-server.js`:
   ```javascript
   const PORT = process.env.PORT || 3001;  // Change 3001 to another port
   ```
4. Update `useCallService.ts` to match the new port:
   ```typescript
   const WS_URL = 'wss://localhost:3001';  // Update port here too
   ```

### Issue 6: WebRTC connection fails
**Error:** "Failed to establish peer connection"

**Possible Causes:**
- Firewall blocking WebRTC
- Network doesn't support P2P
- STUN server unreachable

**Solution:**
- Check Windows Firewall allows the app
- Verify internet connection
- Try from different network

### Issue 7: TTS Voice Not Working or Wrong Language
**Error:** Text-to-speech plays but in wrong voice/language

**Solution:**
1. Go to **Settings** → **Voice Settings**
2. Select a different voice from available options
3. Click "Test Voice" to verify
4. Check browser console for voice selection logs:
   ```
   [Auto-TTS] ✓ Found [voice] (same language + same gender)
   ```
5. If your preferred voice not available:
   - Check Windows → Settings → Time & Language → Speech
   - Install additional voices/languages
   - App will automatically select closest match

### Issue 8: Microphone Not Resuming After TTS
**Error:** Microphone stays silent after text-to-speech plays

**Solution:**
1. Check browser console for messages like:
   ```
   [Auto-TTS] TTS completed - resuming microphone
   [Auto-TTS] SAFETY TIMEOUT: Forcing microphone open after 3 seconds
   ```
2. If SAFETY TIMEOUT appears, there may be an issue with audio context
3. Try refreshing the page
4. Check that microphone permission is granted

### Issue 9: TypeScript/ESLint errors
**Solution:**
```bash
npm run lint -- --fix          # Auto-fix linting issues
tsc --noEmit                   # Check TypeScript types
npm install                    # Reinstall dependencies
```

---

## API Reference

### Global State (AppContext)

```typescript
interface AppContextType {
  // User Management
  user: User | null;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  toggleDarkMode: () => void;
  
  // Call State
  callState: 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';
  currentCall: Call | null;
  initiateCall: (username: string) => Promise<void>;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  
  // Media Streams
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCameraEnabled: boolean;
  toggleCamera: () => void;
  
  // Messages
  translationMessages: Message[];   // Text translations
  transcriptMessages: Message[];    // Speech-to-text captions
  sendTranslation: (text: string, shouldSpeak: boolean) => void;
  sendTranscript: (text: string) => void;
  
  // UI State
  darkMode: boolean;
}
```

### WebRTC Signaling Events

```typescript
// Client sends to server
{
  type: 'register',
  userId: string,
  username: string
}

{
  type: 'call',
  targetUserId: string,
  offer: RTCSessionDescription
}

{
  type: 'answer',
  offer: RTCSessionDescription,
  answer: RTCSessionDescription
}

{
  type: 'ice-candidate',
  candidate: RTCIceCandidate
}

{
  type: 'end-call',
  targetUserId: string
}

// Server broadcasts
{
  type: 'incoming-call',
  from: { userId: string, username: string }
}

{
  type: 'call-accepted',
  answer: RTCSessionDescription
}
```

---

## Support & Contact

- **Bug Reports**: Create an issue on [GitHub Issues](https://github.com/Mo-aziz/weSign/issues)
- **Documentation**: See [Tauri Docs](https://tauri.app/v1/guides/) and [React Docs](https://react.dev)

---

## License

This project is part of the weSign initiative for accessible communication. See LICENSE file for details.

---

##  Quick Start Cheat Sheet

```bash
# First time setup
git clone https://github.com/Mo-aziz/weSign.git
cd "sign language react V2"
npm install

# Daily development
npm run tauri:dev                          # Run desktop app (opens at http://localhost:1420/)

# In another terminal (for multiplayer)
npm run server                             # Start signaling server (port 3001)

# Production build
npm run tauri:build                        # Creates .exe installer

# Debugging
npm run lint                               # Check code quality
npm run build                              # Build frontend only
```

---

**Version:** 0.1.0
