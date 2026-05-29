# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the WeSign sign-recognition Tauri sidecar.
# Build: pyinstaller sign_server.spec --noconfirm --clean
# Or run: .\build_sign_sidecar.ps1

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

block_cipher = None
root = Path(SPECPATH)

datas = [
    (str(root / "best_model.pt"), "."),
    (str(root / "mediapipeModels"), "mediapipeModels"),
]

binaries = []
hiddenimports = [
    "sign_inference",
    "sign_paths",
    "lstm_model",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "engineio.async_drivers",
    "multipart",
]

for package in ("mediapipe", "torch", "cv2"):
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(package)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hidden
    except Exception as exc:  # pragma: no cover - build-time only
        print(f"Warning: collect_all({package}) failed: {exc}", file=sys.stderr)

hiddenimports += collect_submodules("mediapipe")

a = Analysis(
    [str(root / "sign_server.py")],
    pathex=[str(root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="sign-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
