@echo off
title Verwijder Nestify Autostart
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_FOLDER%\Nestify.lnk" del "%STARTUP_FOLDER%\Nestify.lnk"
if exist "%STARTUP_FOLDER%\Spotify Nest Hub Controller.lnk" del "%STARTUP_FOLDER%\Spotify Nest Hub Controller.lnk"
echo [OK] Automatisch opstarten is verwijderd.
pause
