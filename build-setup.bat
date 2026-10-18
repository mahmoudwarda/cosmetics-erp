@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Compiling Cosmetics-Setup.exe with Inno Setup...
"C:\Users\Rafal\AppData\Local\Programs\Inno Setup 6\ISCC.exe" "%~dp0installer.iss"
if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo      SUCCESS! Installer created in dist-installer
    echo ========================================================
) else (
    echo.
    echo Build failed with error %errorlevel%
)
