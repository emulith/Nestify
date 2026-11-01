@echo off
title Installeer Nestify Stil Opstarten
echo ====================================================
echo   Nestify - Spotify Google Nest Hub Controller
echo ====================================================
echo.
echo Dit script zorgt ervoor dat Nestify automatisch op de
echo achtergrond start zodra je je PC aanzet, ZONDER venster!
echo.
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_VBS=%~dp0start-stil.vbs"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Nestify.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

rem Maak ook een snelkoppeling op het bureaublad
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$desktop\Start Nestify.lnk\"); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [OK] Succesvol geinstalleerd in Windows Opstarten!
    echo [OK] Snelkoppeling 'Start Nestify' op je Bureaublad geplaatst!
    echo Vanaf nu start Nestify automatisch 100%% stil op de achtergrond.
) else (
    echo [!] Kon snelkoppeling niet aanmaken.
)
echo.
pause
