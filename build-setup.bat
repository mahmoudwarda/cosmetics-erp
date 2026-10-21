@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Building the production app and Windows installer...
call npm run build
if errorlevel 1 exit /b 1
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\package-windows.ps1"
if errorlevel 1 exit /b 1
echo Installer created under dist-installer\Cosmetics-ERP-Setup.exe
pause
