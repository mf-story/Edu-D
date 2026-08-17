# =====================================================================
# start-dev.ps1 - Menjalankan backend (port 4000) dan frontend (port 5173)
# masing-masing di jendela PowerShell baru.
# Jalankan:  powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
# =====================================================================
$root = $PSScriptRoot

Write-Host "Menjalankan backend Edu-D (port 4000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
  "cd '$root\server'; if (-not (Test-Path node_modules)) { npm.cmd install }; if (-not (Test-Path data)) { npm.cmd run seed }; npm.cmd start"
)

Start-Sleep -Seconds 2

Write-Host "Menjalankan frontend Edu-D (port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
  "cd '$root\client'; if (-not (Test-Path node_modules)) { npm.cmd install }; npm.cmd run dev"
)

Write-Host ""
Write-Host "Selesai. Buka http://localhost:5173 di peramban." -ForegroundColor Green
