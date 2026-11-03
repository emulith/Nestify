@echo off
cd /d "%~dp0"
title Stop Nestify Spotify Controller

rem Ensure node is in PATH if in standard install locations
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else if exist "%LocalAppData%\Programs\node\node.exe" (
        set "PATH=%LocalAppData%\Programs\node;%PATH%"
    )
)

echo ====================================================
echo   Stopping Nestify Controller
echo ====================================================
echo.
node lib/service-manager.js stop
rem Safeguard cleanup for port 8888
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
powershell -NoProfile -Command "Start-Sleep -Seconds 2"
