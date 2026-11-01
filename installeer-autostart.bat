@echo off
title Installeer Automatisch Opstarten met Windows
echo ====================================================
echo   Spotify Nest Hub Controller - Windows Autostart
echo ====================================================
echo.
echo Dit script zorgt ervoor dat de controller automatisch op de
echo achtergrond start zodra je je PC aanzet.
echo.
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_VBS=Z:\Edit zooi- Vids\progameren\spotify\start-stil.vbs"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Spotify Nest Hub Controller.lnk"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_VBS%'; $s.WorkingDirectory = 'Z:\Edit zooi- Vids\progameren\spotify'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [OK] Succesvol geinstalleerd in Windows Opstarten!
    echo Vanaf nu start je Nest Hub controller altijd stil mee op met je PC.
) else (
    echo [!] Kon snelkoppeling niet aanmaken.
)
echo.
pause
