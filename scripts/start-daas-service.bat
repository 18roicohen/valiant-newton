@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Dynep Autonomous Micro-DaaS 24/7 Engine Supervisor
:: Location: C:\Users\roiro\Documents\antigravity\valiant-newton
:: Endpoint: https://data.dynep.com (Cloudflare Tunnel: dynep-daas)
:: ============================================================================

cd /d "C:\Users\roiro\Documents\antigravity\valiant-newton"
title Dynep Micro-DaaS Autonomous Engine

echo [Dynep DaaS] Initializing 24/7 Background Services at %date% %time%...

:: 1. Verify and start Cloudflare Tunnel if not currently running
tasklist /fi "imagename eq cloudflared.exe" 2>NUL | find /i /n "cloudflared.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [Dynep DaaS] Cloudflare Tunnel (cloudflared.exe) is ALREADY running.
) else (
    echo [Dynep DaaS] Starting Cloudflare Tunnel (dynep-daas)...
    start /min "Dynep Cloudflare Tunnel" "C:\Users\roiro\Documents\antigravity\valiant-newton\cloudflared.exe" tunnel run dynep-daas
)

:: 2. Start PM2 Engine if PM2 is available
where pm2.cmd >nul 2>nul
if "%ERRORLEVEL%"=="0" (
    echo [Dynep DaaS] Starting application under PM2 process manager...
    call pm2.cmd start ./node_modules/tsx/dist/cli.mjs --name dynep-daas -- src/index.ts
    call pm2.cmd start scripts/watchdog.js --name dynep-watchdog
    call pm2.cmd save
    echo [Dynep DaaS] PM2 processes registered and saved.
    goto monitor
)

:: 3. Fallback: Supervised native auto-restart loop
echo [Dynep DaaS] PM2 not detected in standard path, falling back to supervised loop...

:run_loop
echo [Dynep DaaS] [%date% %time%] Spawning Fastify Gateway & Worker Engine...
call npx tsx src/index.ts
echo [Dynep DaaS] WARNING: Application exited with code %ERRORLEVEL%.
echo [Dynep DaaS] Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto run_loop

:monitor
echo [Dynep DaaS] Engine running under PM2 supervisor. Monitoring health status...
call pm2.cmd status
