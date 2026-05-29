# WeSign local sign recognition service

Runs the trained LSTM model (`best_model.pt`) with MediaPipe landmark extraction as a local HTTP API on **port 8001** (TTS uses **8000**).

## Development mode (Python)

Use this when running the React web app or when the Tauri sidecar binary has not been built yet.

```powershell
cd TestingFinal
pip install -r requirements.txt
python sign_server.py
```

Service URL: `http://127.0.0.1:8001`

- `GET /health`
- `POST /reset`
- `POST /reset` — `{ "sessionId": "<uuid>" }`
- `POST /frame` — `{ "sessionId": "<uuid>", "image": "<base64 JPEG/PNG>" }`

Each mobile client must send a stable `sessionId` per recognition session (the app generates a UUID).

### Tauri dev (`npm run tauri:dev`)

The desktop app **starts the sign server automatically**:

1. Packaged sidecar `Frontend/src-tauri/bin/sign-server-x86_64-pc-windows-msvc.exe` if present
2. Otherwise falls back to `python TestingFinal/sign_server.py` when Python + dependencies are installed

You do **not** need a separate terminal for sign recognition during normal Tauri development if Python is set up.

## Packaged desktop app (PyInstaller sidecar)

End users should **not** install Python. Build the sidecar once before `tauri build`:

```powershell
cd TestingFinal
.\build_sign_sidecar.ps1
```

This runs PyInstaller and copies:

`dist/sign-server.exe` → `Frontend/src-tauri/bin/sign-server-x86_64-pc-windows-msvc.exe`

Bundled assets include:

- `best_model.pt`
- `lstm_model.py` / `sign_inference.py` / `sign_paths.py` (as Python modules)
- `mediapipeModels/*`

Then build the installer:

```powershell
cd Frontend
npm run tauri:build
```

On launch, Tauri spawns the sidecar on port **8001** and stops it when the app exits.

### Build requirements

- Windows x64
- Python 3.10–3.12 with `pip install -r requirements-build.txt`
- Several GB disk space (PyTorch + MediaPipe bundle is large)
- First PyInstaller run may take 10+ minutes

### Manual PyInstaller

```powershell
cd TestingFinal
pip install -r requirements-build.txt
pyinstaller sign_server.spec --noconfirm --clean
```

Copy `dist/sign-server.exe` to `Frontend/src-tauri/bin/sign-server-x86_64-pc-windows-msvc.exe`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tauri build: external binary not found | Run `build_sign_sidecar.ps1` first |
| Port 8001 in use | Close other `sign_server` / sidecar processes |
| Slow first prediction | Model + MediaPipe load on first frame; CPU inference takes time |
| Paths with spaces | All paths use `Path(__file__)` / PyInstaller `_MEIPASS` — avoid moving `best_model.pt` |
