$ErrorActionPreference = "Stop"

# Use relative path from script location so it works on ANY machine
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$pgroot = Join-Path $projectRoot "work\postgresql-portable\pgsql"
$pgdata = Join-Path $projectRoot "data\pgdata"
$logfile = Join-Path $projectRoot "data\postgres-server.log"
$pgctl = Join-Path $pgroot "bin\pg_ctl.exe"

# If first run on client machine, initialize fresh database
if (-not (Test-Path "$pgdata\PG_VERSION")) {
    Write-Host "Initializing fresh database for this computer..." -ForegroundColor Yellow
    if (-not (Test-Path $pgdata)) {
        New-Item -ItemType Directory -Path $pgdata -Force | Out-Null
    }
    
    $initdb = Join-Path $pgroot "bin\initdb.exe"
    & $initdb -D $pgdata -U cosmetics -A trust -E UTF8
    
    Write-Host "Starting database to create database schema..." -ForegroundColor Yellow
    & $pgctl -D $pgdata -l $logfile -o "-h 127.0.0.1 -p 5432" start
    Start-Sleep -Seconds 3
    
    $createdb = Join-Path $pgroot "bin\createdb.exe"
    & $createdb -h 127.0.0.1 -p 5432 -U cosmetics cosmetics_erp
    Write-Host "Database created successfully!" -ForegroundColor Green
    exit 0
}

# Remove stale lock file if left over from improper shutdown
$pidFile = Join-Path $pgdata "postmaster.pid"
if (Test-Path $pidFile) {
    # Check if server is actually running
    $status = & $pgctl -D $pgdata status 2>&1
    if ($status -like "*no server running*") {
        Remove-Item -Force $pidFile
    }
}

# Start server if not running
$status = & $pgctl -D $pgdata status 2>&1
if ($status -like "*no server running*") {
    & $pgctl -D $pgdata -l $logfile -o "-h 127.0.0.1 -p 5432" start
    Start-Sleep -Seconds 2
}

& $pgctl -D $pgdata status
