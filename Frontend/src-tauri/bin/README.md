# Tauri external binaries

Place the PyInstaller-built sign recognition sidecar here before packaging:

- `sign-server-x86_64-pc-windows-msvc.exe`

Build it from the repo root:

```powershell
cd TestingFinal
.\build_sign_sidecar.ps1
```

This file is gitignored because of its size. Tauri bundles it automatically when present.
