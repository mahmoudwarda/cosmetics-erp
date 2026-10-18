@echo off
chcp 65001 >nul
title نظام لمسة جمال - السيرفر المحلي
cd /d "%~dp0"

echo =====================================================================
echo                نظام إدارة النشاط التجاري (لمسة جمال)
echo =====================================================================
echo.

rem Prefer bundled Node.js runtime if present
if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

rem 1. Allow port 3001 in Windows Firewall (Silent)
netsh advfirewall firewall show rule name="CosmeticsERP_3001" >nul 2>nul
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="CosmeticsERP_3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>nul
)

echo [1/3] بدء تشغيل قاعدة البيانات المحلية (PostgreSQL Portable)...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start-db.ps1"

echo.
echo [2/3] فحص وتحديث الجداول...
call npm run db:migrate
call npm run db:seed

rem Get Local Network IP
set "LOCAL_IP=127.0.0.1"
for /f "delims=" %%i in ('call "%~dp0scripts\get-ip.bat"') do set "LOCAL_IP=%%i"

echo.
echo [3/3] تشغيل واجهة النظام...
start http://localhost:3001

echo.
echo =====================================================================
echo                      🎉 النظام يعمل الآن بنجاح!
echo =====================================================================
echo   🖥️ للفتح من هذا الجهاز (السيرفر):
echo      http://localhost:3001
echo.
echo   📱 للفتح من أي جهاز آخر في نفس المكان (كاشير 2 / تابلت / موبايل):
echo      http://%LOCAL_IP%:3001
echo.
echo   💾 كل البيانات تُحفظ محلياً على هذا الجهاز في مجلد: data\pgdata
echo   🔑 بيانات الدخول: admin  ^|  كلمة المرور: ChangeMe123!
echo =====================================================================
echo   (يرجى ترك هذه الشاشة مفتوحة طوال فترة عمل المحل/الشركة)
echo.

call npm run start

pause
