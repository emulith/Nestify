@echo off
title Stop Spotify Nest Hub Controller
echo Controller wordt gestopt...
powershell -Command "Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo [OK] Controller is gestopt.
timeout /t 2 /nobreak >nul
