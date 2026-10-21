$ErrorActionPreference = "SilentlyContinue"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$dataDir = Join-Path $projectRoot "data"

$pgRoot = Join-Path $projectRoot "runtime\postgresql"
if (-not (Test-Path $pgRoot)) {
  $pgRoot = Join-Path $projectRoot "work\postgresql-portable\pgsql"
}
$pgData = Join-Path $dataDir "pgdata"
$pgCtl = Join-Path $pgRoot "bin\pg_ctl.exe"

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "         إيقاف نظام Apex Software ERP                     " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

# 1. Stop Node processes
Write-Host "[1/2] إيقاف خادم الويب (Node.js)..." -ForegroundColor Cyan
$pidFile = Join-Path $dataDir "app.pid"
if (Test-Path $pidFile) {
  $savedPid = Get-Content $pidFile
  if ($savedPid) {
    Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { 
  $_.CommandLine -like "*$projectRoot*" -or $_.CommandLine -like "*standalone*server.js*"
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Write-Host "تم إيقاف خادم الويب بنجاح." -ForegroundColor Green

# 2. Stop PostgreSQL cleanly
Write-Host "[2/2] إيقاف قاعدة البيانات المحلية (PostgreSQL)..." -ForegroundColor Cyan
if (Test-Path $pgCtl) {
  & $pgCtl -D $pgData stop -m fast | Out-Null
}
Write-Host "تم إيقاف قاعدة البيانات بنجاح." -ForegroundColor Green

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      ✅ تم إيقاف نظام Apex Software ERP بالكامل          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
