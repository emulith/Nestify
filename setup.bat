@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Nestify — 1-Click Setup
color 0A

echo ====================================================================
echo   🍏 Nestify — Spotify Apple Liquid Glass Controller for Nest Hub
echo ====================================================================
echo.
echo Welcome! This script will automatically install and configure Nestify.
echo.

rem 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is not installed on your computer.
    echo Node.js is required to run Nestify.
    echo.
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        set /p installNode="Would you like us to install Node.js automatically via winget? (Y/N): "
        if /i "!installNode!"=="Y" set installNode=Y
        if /i "!installNode!"=="J" set installNode=Y
        if /i "!installNode!"=="Y" (
            echo.
            echo Downloading and installing Node.js...
            winget install OpenJS.NodeJS -e --accept-package-agreements --accept-source-agreements
            echo.
            rem Refresh PATH in this session immediately
            for /f "delims=" %%p in ('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"') do set "PATH=%%p"
            where node >nul 2>nul
            if !errorlevel! equ 0 (
                echo [OK] Node.js successfully installed and active!
            ) else (
                echo [OK] Node.js is installed! Please restart setup.bat once.
                pause
                exit /b
            )
        )
    )
    if not exist "%ProgramFiles%\nodejs\node.exe" (
        where node >nul 2>nul
        if !errorlevel! neq 0 (
            echo Download and install Node.js for free from: https://nodejs.org/
            start https://nodejs.org/
            pause
            exit /b
        )
    )
)

echo [1/4] Node.js detected:
node --version
echo.

rem 2. Install dependencies via npm
echo [2/4] Installing required packages (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [!] Error running npm install. Please check your internet connection and try again.
    pause
    exit /b
)
echo [OK] All packages installed!
echo.

rem 3. Configuration file
echo [3/4] Checking configuration file...
if not exist "config\config.json" (
    copy "config\config.example.json" "config\config.json" >nul
    echo [OK] config\config.json created.
) else (
    echo [OK] config\config.json exists.
)
echo.

rem 4. Desktop shortcuts and Autostart
echo [4/4] Creating Desktop shortcuts...
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $ws = New-Object -ComObject WScript.Shell; $s1 = $ws.CreateShortcut((Join-Path $desktop 'Start Nestify.lnk')); $s1.TargetPath = 'wscript.exe'; $s1.Arguments = '\"%~dp0start-silent.vbs\"'; $s1.WorkingDirectory = '%~dp0'; $s1.Description = 'Start Nestify silently in the background'; $s1.Save(); $s2 = $ws.CreateShortcut((Join-Path $desktop 'Stop Nestify.lnk')); $s2.TargetPath = 'wscript.exe'; $s2.Arguments = '\"%~dp0stop-silent.vbs\"'; $s2.WorkingDirectory = '%~dp0'; $s2.Description = 'Stop Nestify'; $s2.Save()"
echo [OK] 'Start Nestify' and 'Stop Nestify' shortcuts placed on your Desktop!
echo.

set /p autostartChoice="Would you like Nestify to start automatically on Windows boot? (Y/N, default Y): "
if "%autostartChoice%"=="" set autostartChoice=Y
if /i "%autostartChoice%"=="J" set autostartChoice=Y
if /i "%autostartChoice%"=="Y" (
    powershell -NoProfile -Command "$startup = \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\"; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut((Join-Path $startup 'Nestify.lnk')); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0start-silent.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Nestify'; $s.Save()"
    echo [OK] Windows Startup integration enabled!
)
echo.

echo ====================================================================
echo   🎉 Setup Complete!
echo ====================================================================
echo.
echo Starting Nestify in the background...
start "" wscript.exe "%~dp0start-silent.vbs"

echo Waiting for server to initialize...
powershell -NoProfile -Command "Start-Sleep -Seconds 2"

echo Opening your browser for the Web Setup Wizard...
start "" "http://127.0.0.1:8888/"
echo.
echo Quick Steps:
echo 1. Enter your Spotify Client ID & Secret in the opened browser window.
echo 2. Click 'Auto-detect' to automatically discover your Google Nest Hub.
echo 3. Click 'Connect with Spotify' to link your account.
echo 4. All done! Whenever music plays, Nestify will appear on your Nest Hub!
echo.
echo You can safely close this terminal window. Enjoy Nestify!
echo.
pause
