@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
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
            echo.
            echo Bezig met downloaden en installeren van Node.js...
            winget install OpenJS.NodeJS -e --accept-package-agreements --accept-source-agreements
            echo.
            rem PATH variabelen direct verversen in deze sessie
            for /f "delims=" %%p in ('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"') do set "PATH=%%p"
            where node >nul 2>nul
            if !errorlevel! equ 0 (
                echo [OK] Node.js is succesvol geinstalleerd en direct actief!
            ) else (
                echo [OK] Node.js is geinstalleerd! Herstart a.u.b. eenmalig setup.bat.
                pause
                exit /b
            )
        )
    )
    if not exist "%ProgramFiles%\nodejs\node.exe" (
        where node >nul 2>nul
        if !errorlevel! neq 0 (
            echo Download en installeer Node.js gratis vanaf: https://nodejs.org/
            start https://nodejs.org/
            pause
            exit /b
        )
    )
)

echo [1/4] Node.js gevonden:
node --version
echo.

rem 2. Installeer dependencies via npm
echo [2/4] Benodigde pakketten installeren (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [!] Fout bij uitvoeren van npm install. Controleer je internetverbinding en probeer opnieuw.
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
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $ws = New-Object -ComObject WScript.Shell; $s1 = $ws.CreateShortcut((Join-Path $desktop 'Start Nestify.lnk')); $s1.TargetPath = 'wscript.exe'; $s1.Arguments = '\"%~dp0start-stil.vbs\"'; $s1.WorkingDirectory = '%~dp0'; $s1.Description = 'Start Nestify op de achtergrond zonder venster'; $s1.Save(); $s2 = $ws.CreateShortcut((Join-Path $desktop 'Stop Nestify.lnk')); $s2.TargetPath = 'wscript.exe'; $s2.Arguments = '\"%~dp0stop-stil.vbs\"'; $s2.WorkingDirectory = '%~dp0'; $s2.Description = 'Stop Nestify'; $s2.Save()"
echo [OK] 'Start Nestify' en 'Stop Nestify' staan op je Bureaublad!
echo.

set /p autostartChoice="Wil je dat Nestify automatisch op de achtergrond start zodra je PC aangaat? (J/N, standaard J): "
if "%autostartChoice%"=="" set autostartChoice=J
if /i "%autostartChoice%"=="J" (
    powershell -NoProfile -Command "$startup = \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\"; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut((Join-Path $startup 'Nestify.lnk')); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0start-stil.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Nestify'; $s.Save()"
    echo [OK] Automatisch opstarten met Windows is geactiveerd!
)
echo.

echo ====================================================================
echo   🎉 Installatie geslaagd!
echo ====================================================================
echo.
echo Nestify wordt nu gestart...
start "" wscript.exe "%~dp0start-stil.vbs"

echo Even wachten op de server...
powershell -NoProfile -Command "Start-Sleep -Seconds 2"

echo Je browser wordt geopend voor de eenmalige configuratie wizard...
start "" "http://127.0.0.1:8888/"
echo.
echo Instructies:
echo 1. Vul je Spotify Client ID en Secret in op de geopende pagina.
echo 2. Klik op 'Auto-detect' om je Google Nest Hub automatisch te vinden.
echo 3. Klik op 'Verbinden met Spotify'.
echo 4. Klaar! Zodra je muziek afspeelt, verschijnt Nestify op je Nest Hub!
echo.
echo Je kunt dit zwarte venster nu gerust sluiten. Veel plezier met Nestify!
echo.
pause
