@echo off
title EduMuh - Buka Akses HP
REM Minta izin administrator (UAC) secara otomatis
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Meminta izin administrator...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ============================================================
echo   EduMuh - Mengizinkan akses dari HP / Smart TV
echo ============================================================
echo.

REM Hapus aturan lama jika ada, lalu buat aturan baru
netsh advfirewall firewall delete rule name="EduMuh Vite 5173" >nul 2>&1
netsh advfirewall firewall add rule name="EduMuh Vite 5173" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall delete rule name="EduMuh Server 4000" >nul 2>&1
netsh advfirewall firewall add rule name="EduMuh Server 4000" dir=in action=allow protocol=TCP localport=4000

echo.
echo Selesai! Akses dari HP / Smart TV sudah diizinkan.
echo.
echo Alamat IP komputer ini di Wi-Fi:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  echo    HP / browser modern : http://%%a:5173
  echo    Smart TV / browser lama : http://%%a:4000
)
echo.
echo Untuk Smart TV gunakan alamat port 4000 (versi produksi).
echo (Perangkat harus tersambung ke Wi-Fi yang sama dengan komputer ini)
echo.
pause
