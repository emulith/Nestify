@echo off
cd /d "%~dp0"
title Stop Nestify Spotify Controller
echo ====================================================
echo   Stopping Nestify Controller
echo ====================================================
echo.
echo Returning Google Nest Hub to home screen...
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:8888/api/shutdown' -Method POST -TimeoutSec 2 -ErrorAction SilentlyContinue } catch {}" >nul 2>&1
node -e "try { const caster = require('./lib/caster'); const spotify = require('./lib/spotify'); caster.stopCast(spotify.config.nestHubIp || '192.168.1.39').then(() => process.exit(0)).catch(() => process.exit(0)); } catch(e) { process.exit(0); }" >nul 2>&1
echo Stopping server process on port 8888...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo [OK] Nestify stopped and Nest Hub returned to home screen.
timeout /t 2 /nobreak >nul
