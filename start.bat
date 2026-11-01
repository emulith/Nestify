@echo off
title Spotify Nest Hub Controller
echo ====================================================
echo   Spotify Nest Hub Controller
echo ====================================================
echo.
echo Server wordt gestart op poort 8888...
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8888"
node server.js
pause
