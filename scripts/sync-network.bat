@echo off
setlocal enabledelayedexpansion

set "TARGET_DIR=%~dp0..\data\network"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
set "TARGET_FILE=%TARGET_DIR%\host_ip.txt"

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r /c:"IPv4 Address" /c:"عنوان IPv4"') do (
    set "RAW_IP=%%a"
    set "CLEAN_IP=!RAW_IP: =!"
    if not "!CLEAN_IP!"=="" (
        if not "!CLEAN_IP:~0,4!"=="127." (
            if not "!CLEAN_IP:~0,7!"=="169.254" (
                echo !CLEAN_IP! > "%TARGET_FILE%"
                echo [Network Sync] Active Host IP set to: http://!CLEAN_IP!:3000
                goto :done
            )
        )
    )
)

:done
endlocal
