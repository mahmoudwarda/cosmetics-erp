@echo off
setlocal
cd /d "%~dp0"

rem Prefer the bundled Node.js runtime in the offline transfer package.
if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

if not exist ".env" (
  echo .env is missing. Copy .env.example to .env and set AUTH_SECRET first.
  exit /b 1
)

set "PGROOT=%~dp0work\postgresql-portable\pgsql"
set "PG_CTL=%PGROOT%\bin\pg_ctl.exe"
if not exist "%PG_CTL%" (
  echo Local PostgreSQL binaries are missing from work\postgresql-portable\pgsql.
  exit /b 1
)

set "PGDATA=%~dp0data\pgdata"
set "FRESH_DB=0"
if not exist "%PGDATA%\PG_VERSION" (
  set "FRESH_DB=1"
  if not exist "%PGDATA%" mkdir "%PGDATA%"
  "%PGROOT%\bin\initdb.exe" -D "%PGDATA%" -U cosmetics -A trust -E UTF8
  if errorlevel 1 exit /b 1
  "%PGROOT%\bin\pg_ctl.exe" -D "%PGDATA%" -l "%~dp0data\postgres-server.log" -o "-h 127.0.0.1 -p 5432" start
  if errorlevel 1 exit /b 1
  "%PGROOT%\bin\createdb.exe" -h 127.0.0.1 -p 5432 -U cosmetics cosmetics_erp
  if errorlevel 1 exit /b 1
) else (
  "%PG_CTL%" -D "%PGDATA%" status >nul 2>&1
  if errorlevel 1 (
    rem A previous forced shutdown can leave a stale PID file; status above confirmed no server is running.
    if exist "%PGDATA%\postmaster.pid" del /q "%PGDATA%\postmaster.pid"
    "%PG_CTL%" -D "%PGDATA%" -l "%~dp0data\postgres-server.log" -o "-h 127.0.0.1 -p 5432" start
    if errorlevel 1 (
      echo PostgreSQL failed to start. See data\postgres-server.log.
      exit /b 1
    )
  )
)

call npm run db:migrate
if errorlevel 1 (
  echo Database migration failed. Check .env and PostgreSQL status.
  exit /b 1
)
if "%FRESH_DB%"=="1" call npm run db:seed
if errorlevel 1 exit /b 1

call scripts\sync-network.bat

if not exist ".next-bundle\BUILD_ID" (
  echo Production build missing. Building locally; this may take a few minutes the first time.
  call npm run build
  if errorlevel 1 (
    echo Build failed. The error above is the cause; startup has stopped to avoid an endless restart loop.
    exit /b 1
  )
)

echo Starting Lamset Gamal on http://127.0.0.1:3001
echo Keep this window open while using the system. Press Ctrl+C to stop it.
call npm run start
if errorlevel 1 echo The app stopped with an error. See the message above and data\next-server.log.
endlocal
