@echo off
title Nestify Spotify Controller
echo ====================================================
echo   Nestify Spotify Controller
echo ====================================================
echo.
echo Starting server on port 8888...
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8888"
node server.js
pause
