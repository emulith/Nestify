@echo off
cd /d "%~dp0"
title Nestify Spotify Controller
echo ====================================================
echo   Nestify Spotify Controller (Auto-Cast)
echo ====================================================
echo.
echo Checking for updates...
node lib/update-manager.js
echo.
echo Starting server and automatically connecting to Nest Hub...
echo When you close this window or exit, Nest Hub returns to its home screen.
echo.
node server.js --autocast
echo.
echo Returning Google Nest Hub to home screen...
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:8888/api/shutdown' -Method POST -TimeoutSec 2 -ErrorAction SilentlyContinue } catch {}" >nul 2>&1
node -e "try { const caster = require('./lib/caster'); const spotify = require('./lib/spotify'); caster.stopCast(spotify.config.nestHubIp || '192.168.1.39').then(() => process.exit(0)).catch(() => process.exit(0)); } catch(e) { process.exit(0); }" >nul 2>&1
pause
