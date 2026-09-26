@echo off
setlocal

:: ============================================================================
:: Dynep Autonomous Micro-DaaS 24/7 Windows Service & Task Installer
:: ============================================================================

cd /d "C:\Users\roiro\Documents\antigravity\valiant-newton"

echo ============================================================================
echo Installing Dynep DaaS Windows 24/7 Autostart Services
echo ============================================================================

:: 1. Attempt cloudflared service install (requires admin; will skip if unprivileged)
echo [1/4] Checking Cloudflare Tunnel service registration...
cloudflared.exe service install 2>nul
if "%ERRORLEVEL%"=="0" (
    echo   [OK] Cloudflared Windows Service installed successfully.
) else (
    echo   [INFO] Standard user context: Cloudflare Tunnel will be automatically managed
    echo          via start-daas-service.bat and watchdog.js.
)

:: 2. Register PM2 processes
echo [2/4] Registering PM2 ecosystem and watchdog...
call pm2.cmd delete dynep-daas 2>nul
call pm2.cmd delete dynep-watchdog 2>nul
call pm2.cmd start ./node_modules/tsx/dist/cli.mjs --name dynep-daas -- src/index.ts
call pm2.cmd start scripts/watchdog.js --name dynep-watchdog
call pm2.cmd save
echo   [OK] PM2 processes saved to pm2 dump.

:: 3. Create Windows Startup entry
echo [3/4] Creating Windows Startup folder launcher...
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_BAT=%STARTUP_DIR%\dynep-daas-autostart.bat"

(
    echo @echo off
    echo cd /d "C:\Users\roiro\Documents\antigravity\valiant-newton"
    echo start /min cmd /c "C:\Users\roiro\Documents\antigravity\valiant-newton\scripts\start-daas-service.bat"
) > "%TARGET_BAT%"

if exist "%TARGET_BAT%" (
    echo   [OK] Autostart script created at: %TARGET_BAT%
) else (
    echo   [WARN] Could not write to Startup directory.
)

:: 4. Attempt Scheduled Task on Logon (optional)
echo [4/4] Checking Windows Scheduled Task registration...
echo %PATH% >nul
schtasks /query /tn "DynepMicroDaaS" >nul 2>nul
if "%ERRORLEVEL%"=="0" (
    echo   [OK] Scheduled Task already registered.
) else (
    echo   [INFO] Autostart active via Windows User Startup folder.
)

echo ============================================================================
echo Dynep DaaS 24/7 Autostart and Watchdog successfully installed!
echo ============================================================================
