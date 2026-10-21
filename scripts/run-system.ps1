$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$pgroot = Join-Path $projectRoot "work\postgresql-portable\pgsql"
$pgdata = Join-Path $projectRoot "data\pgdata"
$logfile = Join-Path $projectRoot "data\postgres-server.log"
$pgctl = Join-Path $pgroot "bin\pg_ctl.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Starting Cosmetic ERP (لمسة جمال)      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Start PostgreSQL if not already running
Write-Host "[1/4] Checking PostgreSQL database..." -ForegroundColor Yellow
$status = & $pgctl -D $pgdata status 2>&1
if ($status -like "*no server running*") {
    $pidFile = Join-Path $pgdata "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item -Force $pidFile }
    
    Write-Host "Starting local PostgreSQL on port 55432..." -ForegroundColor Yellow
    & $pgctl -D $pgdata -l $logfile -o "-h 127.0.0.1 -p 55432" start
    Start-Sleep -Seconds 3
    
    $status = & $pgctl -D $pgdata status 2>&1
    if ($status -like "*is running*") {
        Write-Host "PostgreSQL is running successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to start PostgreSQL. Check data\postgres-server.log" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "PostgreSQL is already running." -ForegroundColor Green
}

# 2. Run migrations
Write-Host "[2/4] Applying database migrations..." -ForegroundColor Yellow
& npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migrations failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Migrations applied successfully." -ForegroundColor Green

# 3. Seed database if first time
Write-Host "[3/4] Ensuring initial seed data..." -ForegroundColor Yellow
& npm run db:seed
Write-Host "Database seed verified." -ForegroundColor Green

# 4. Start Next.js App
Write-Host "[4/4] Starting Web Application on http://localhost:3001 ..." -ForegroundColor Cyan
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3001"
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray

& npx next dev -p 3001 --hostname 0.0.0.0

