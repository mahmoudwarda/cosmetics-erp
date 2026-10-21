@echo off
chcp 65001 >nul
title إيقاف Apex Software ERP
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-windows.ps1"
echo.
pause
