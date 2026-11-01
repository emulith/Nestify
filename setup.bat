@echo off
setlocal EnableDelayedExpansion
title Nestify — 1-Click Setup
color 0A

echo ====================================================================
echo   🍏 Nestify — Spotify Apple Liquid Glass Controller for Nest Hub
echo ====================================================================
echo.
echo Welkom! Dit script installeert en configureert Nestify automatisch.
echo.

rem 1. Controleer of Node.js aanwezig is
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is nog niet geinstalleerd op je computer.
    echo Node.js is vereist om Nestify te draaien.
    echo.
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        set /p installNode="Wil je dat we Node.js nu automatisch voor je installeren via winget? (J/N): "
        if /i "!installNode!"=="J" (
            echo Node.js installeren...
            winget install OpenJS.NodeJS -e --accept-package-agreements --accept-source-agreements
            echo.
            echo [OK] Node.js is geinstalleerd! Herstart a.u.b. even setup.bat.
            pause
            exit /b
        )
    )
    echo Download en installeer Node.js gratis vanaf: https://nodejs.org/
    start https://nodejs.org/
    pause
    exit /b
)

echo [1/4] Node.js gevonden:
node --version
echo.

rem 2. Installeer dependencies via npm
echo [2/4] Benodigde pakketten installeren (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [!] Fout bij uitvoeren van npm install. Controleer je internetverbinding.
    pause
    exit /b
)
echo [OK] Alle pakketten zijn geinstalleerd!
echo.

rem 3. Configuratiebestand
echo [3/4] Configuratiebestand controleren...
if not exist "config\config.json" (
    copy "config\config.example.json" "config\config.json" >nul
    echo [OK] config\config.json aangemaakt.
) else (
    echo [OK] config\config.json bestaat al.
)
echo.

rem 4. Snelkoppelingen en Autostart
echo [4/4] Bureaublad snelkoppelingen aanmaken...
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$desktop\Start Nestify.lnk\"); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0start-stil.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Start Nestify op de achtergrond zonder venster'; $s.Save(); $s2 = $ws.CreateShortcut(\"$desktop\Stop Nestify.lnk\"); $s2.TargetPath = 'wscript.exe'; $s2.Arguments = '\"%~dp0stop-stil.vbs\"'; $s2.WorkingDirectory = '%~dp0'; $s2.Description = 'Stop Nestify'; $s2.Save()"
echo [OK] 'Start Nestify' en 'Stop Nestify' staan op je Bureaublad!
echo.

set /p autostartChoice="Wil je dat Nestify automatisch op de achtergrond start zodra je PC aangaat? (J/N): "
if /i "%autostartChoice%"=="J" (
    powershell -NoProfile -Command "$startup = \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\"; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$startup\Nestify.lnk\"); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0start-stil.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Nestify'; $s.Save()"
    echo [OK] Automatisch opstarten met Windows is geactiveerd!
)
echo.

echo ====================================================================
echo   🎉 Installatie geslaagd!
echo ====================================================================
echo.
echo Nestify wordt nu gestart en je browser opent om in te loggen...
echo.

start "" "http://127.0.0.1:8888/"
start "" wscript.exe "%~dp0start-stil.vbs"

echo Je kunt dit venster nu gerust sluiten. Veel plezier met Nestify!
echo.
pause
