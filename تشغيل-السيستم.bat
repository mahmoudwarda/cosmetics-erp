@echo off
chcp 65001 >nul
title Apex Software ERP - نظام إدارة النشاط التجاري
cd /d "%~dp0"

echo =====================================================================
echo                Apex Software ERP - نظام إدارة النشاط التجاري
echo =====================================================================
echo.

rem Prefer bundled Node.js runtime if present
if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"
if exist "%~dp0runtime\node.exe" set "PATH=%~dp0runtime;%PATH%"

rem 1. Allow port 3001 in Windows Firewall (Silent)
netsh advfirewall firewall show rule name="ApexSoftwareERP_3001" >nul 2>nul
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="ApexSoftwareERP_3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>nul
)

echo [1/3] فحص وتشغيل السيستم وقاعدة البيانات في الخلفية...
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1"
if errorlevel 1 (
    echo.
    echo فشل التشغيل. راجع ملفات السجلات في مجلد data\
    pause
    exit /b 1
)

rem Get Local Network IP
set "LOCAL_IP=127.0.0.1"
for /f "delims=" %%i in ('call "%~dp0scripts\get-ip.bat" 2^>nul') do set "LOCAL_IP=%%i"

echo.
echo =====================================================================
echo               🎉 يعمل الآن بنجاح في الخلفية كخدمة صامتة!
echo =====================================================================
echo   🖥️ للفتح من هذا الجهاز (السيرفر):
echo      http://localhost:3001
echo.
echo   📱 للفتح من أي جهاز آخر في نفس المكان (كاشير 2 / تابلت / موبايل):
echo      http://%LOCAL_IP%:3001
echo.
echo   💾 كل البيانات تُحفظ محلياً على هذا الجهاز في مجلد: data\pgdata
echo   🔑 اسم المستخدم الأولي: admin  ^|  راجع ملف: بيانات_الدخول_الأولية.txt
echo =====================================================================
echo   💡 ملاحظة هامة:
echo   السيستم يعمل الآن في الخلفية ولا حاجة لترك هذه الشاشة مفتوحة.
echo   يمكنك إغلاق هذه النافذة بأمان تام ولن يتوقف السيستم.
echo.
echo   🛑 لإيقاف النظام في أي وقت: شغّل ملف "إيقاف-السيستم.bat"
echo =====================================================================
echo.
echo سيتم إغلاق هذه الشاشة تلقائياً خلال 6 ثوانٍ...
timeout /t 6 >nul
exit /b 0
