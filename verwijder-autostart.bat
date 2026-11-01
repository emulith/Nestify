@echo off
title Verwijder Automatisch Opstarten
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Spotify Nest Hub Controller.lnk"

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [OK] Automatisch opstarten is verwijderd.
) else (
    echo De autostart-koppeling was niet gevonden.
)
pause
