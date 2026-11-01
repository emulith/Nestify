@echo off
title Stop Nestify Spotify Controller
echo Stopping Nestify Controller...
powershell -Command "Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo [OK] Controller stopped.
timeout /t 2 /nobreak >nul
