# Sign Language Communicator

A modern desktop application that enables seamless communication between deaf and hearing individuals using video calls, real-time translation, and intelligent sign/speech recognition.

---

##  Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Installation & Setup](#installation--setup)
7. [Running the Application](#running-the-application)
8. [Testing the Application](#testing-the-application)
9. [Building for Production](#building-for-production)
10. [Troubleshooting](#troubleshooting)
11. [API Reference](#api-reference)

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

---

## Key Features

### Authentication & Profiles
-  User login with profile creation
-  Customizable user preferences (deaf/hearing designation)
-  Voice settings (choice of voice, pitch, rate) for text-to-speech

### Call Management
- Real-time peer-to-peer video calls via WebRTC
- Contact list with call history
- Incoming call notifications and acceptance/rejection
- Call timer showing elapsed time
- Bidirectional media streams (camera for deaf, microphone for hearing)

### Translation & Recognition
- **Live Sign Recognition**: Detects signs and shows predictions
- **Editable Predictions**: Double-click to correct misrecognized signs
- **Speech-to-Text**: Converts hearing user's speech to captions
- **Text-to-Speech**: Reads translations aloud with customizable voice
- **Translation History**: Stores and displays all messages from both users

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

### Option 1: Desktop App (Recommended)
Runs the full Tauri desktop application with both frontend (Vite) and native window:

```bash
npm run tauri:dev
```

**What happens:**
1. Vite dev server starts on `http://localhost:1420` (internal)
2. Tauri opens a native Windows window displaying the React app
3. Hot module replacement (HMR) enabled for instant code updates
4. Opens DevTools for debugging (F12 in Tauri window)

### Option 2: Web Browser Only
Test the React app in your default browser (without desktop wrapper):

```bash
npm run dev
```

**Access at:** `http://localhost:5173`

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
Signaling server running on port 3001
```

**What it does:**
- Enables peer-to-peer call connections between multiple users
- Exchanges WebRTC offer/answer/ICE candidates
- Relays translation messages between connected users

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

**On User A (Deaf - Camera):**
1. Login as "deaf_user"
2. Select **Deaf** preference
3. Go to **Contacts**
4. Add contact "hearing_user"

**On User B (Hearing - Microphone):**
1. Login as "hearing_user"
2. Select **Hearing** preference
3. Go to **Contacts**
4. Add contact "deaf_user"

**Initiate Call:**
1. User A clicks "Call" next to "hearing_user"
2. User B sees incoming call notification
3. User B accepts call
4. Both see video/audio streams
5. Call timer starts counting
6. User B speaks, gets converted to captions for User A
7. User A signs, gets recognized and sent to User B

**Expected Results:**
- Bidirectional video/audio streams
- Call timer increments
- Translations exchange in real-time
- Both users can end call independently
- No errors in browser console

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

### Test Scenario 4: Error Handling

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

### Issue 1: "Command 'tauri' not found"
**Solution:** Ensure Tauri CLI is installed:
```bash
npm install
npx tauri --version
```

### Issue 2: Rust toolchain not found
**Solution:** Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add x86_64-pc-windows-msvc
```

### Issue 3: Camera/Microphone not working
**Solution:**
- Check Windows Privacy Settings → Camera/Microphone → allow app
- Try restarting app
- Test webcam with another app (e.g., Windows Camera)

### Issue 4: Signaling server connection fails
**Error:** "Connection refused on port 3001"

**Solution:**
1. Ensure server runs: `npm run server`
2. Check server is on `localhost:3001`:
   ```bash
   netstat -ano | findstr :3001
   ```
3. If port 3001 in use, change in `signaling-server.js`:
   ```javascript
   const PORT = process.env.PORT || 3001;  // Change 3001 to another port
   ```
4. Update `useCallService.ts` to match:
   ```typescript
   const WS_URL = 'ws://localhost:3001';  // Update port here too
   ```

### Issue 5: WebRTC connection fails
**Error:** "Failed to establish peer connection"

**Possible Causes:**
- Firewall blocking WebRTC
- Network doesn't support P2P
- STUN server unreachable

**Solution:**
- Check Windows Firewall allows the app
- Verify internet connection
- Try from different network

### Issue 6: TypeScript/ESLint errors
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
npm run tauri:dev                          # Run desktop app

# In another terminal (for multiplayer)
npm run server                             # Start signaling server

# Production build
npm run tauri:build                        # Creates .exe installer

# Debugging
npm run lint                               # Check code quality
npm run build                              # Build frontend only
```

---

**Version:** 0.1.0
