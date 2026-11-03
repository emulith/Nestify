@echo off
cd /d "%~dp0"
title Nestify Spotify Controller

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
echo   Nestify Spotify Controller (Auto-Cast)
echo ====================================================
echo.
echo Checking for updates...
node lib/update-manager.js
echo.
node lib/service-manager.js start
