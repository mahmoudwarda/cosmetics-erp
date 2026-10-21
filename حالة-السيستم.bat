@echo off
chcp 65001 >nul
title حالة Apex Software ERP
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\status-windows.ps1"
echo.
pause
