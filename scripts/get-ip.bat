@echo off
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r /c:"IPv4 Address" /c:"عنوان IPv4"') do (
    set "IP=%%a"
    goto :found
)
:found
set "IP=%IP: =%"
echo %IP%
