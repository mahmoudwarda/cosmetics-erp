@echo off
cd /d "%~dp0"
start "" /B wscript.exe "%~dp0Apex-ERP.vbs"
if errorlevel 1 (
    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\start-windows.ps1"
)
exit /b 0
