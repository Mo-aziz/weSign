# Build the sign-recognition sidecar for Tauri (Windows x64).
# Output: Frontend/src-tauri/bin/sign-server-x86_64-pc-windows-msvc.exe

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$BinDir = Join-Path $Root "..\Frontend\src-tauri\bin"
$DistExe = Join-Path $Root "dist\sign-server.exe"
$TargetName = "sign-server-x86_64-pc-windows-msvc.exe"
$TargetPath = Join-Path $BinDir $TargetName

if (-not (Test-Path (Join-Path $Root "best_model.pt"))) {
    throw "Missing best_model.pt in TestingFinal."
}

Write-Host "Installing build dependencies (PyInstaller + runtime requirements)..."
Set-Location $Root
python -m pip install -r requirements-build.txt

Write-Host "Running PyInstaller (this may take several minutes)..."
python -m PyInstaller sign_server.spec --noconfirm --clean

if (-not (Test-Path $DistExe)) {
    throw "PyInstaller did not produce $DistExe"
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
Copy-Item -Path $DistExe -Destination $TargetPath -Force

Write-Host ""
Write-Host "Sidecar ready:"
Write-Host "  $TargetPath"
Write-Host ""
Write-Host "Next: cd Frontend && npm run tauri:build"
