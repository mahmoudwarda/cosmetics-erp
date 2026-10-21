@echo off
chcp 65001 >nul
title تجهيز وتثبيت Apex Software ERP
cd /d "%~dp0"

echo =====================================================================
echo          Apex Software ERP - بناء حزمة التثبيت لنظام الويندوز
echo =====================================================================
echo.

echo [1/2] بناء مشروع Next.js للإنتاج (Production Standalone Build)...
call npm run build
if errorlevel 1 (
    echo.
    echo ❌ فشل بناء مشروع Next.js. راجع رسائل الخطأ أعلاه.
    pause
    exit /b 1
)

echo.
echo [2/2] تجميع ملفات النظام وإنشاء ملف التسطيب Setup.exe...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\package-windows.ps1"
if errorlevel 1 (
    echo.
    echo ❌ حدث خطأ أثناء تجميع الحزمة.
    pause
    exit /b 1
)

echo.
echo =====================================================================
echo                    🎉 تم إكمال العملية بنجاح!
echo =====================================================================
echo.
pause
