@echo off
title Install Nestify Silent Autostart
echo ====================================================
echo   Nestify - Spotify Google Nest Hub Controller
echo ====================================================
echo.
echo This script configures Nestify to start silently in the
echo background when your PC boots, with zero windows!
echo.
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_VBS=%~dp0start-silent.vbs"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Nestify.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

rem Create desktop shortcut as well
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut((Join-Path $desktop 'Start Nestify.lnk')); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [OK] Successfully registered in Windows Startup!
    echo [OK] 'Start Nestify' shortcut created on your Desktop!
    echo Nestify will now start 100%% silently in the background on boot.
) else (
    echo [!] Could not create shortcut.
)
echo.
pause
