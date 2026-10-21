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

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "          حالة تشغيل نظام Apex Software ERP               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check PostgreSQL
$pgRunning = $false
if (Test-Path $pgCtl) {
  $pgStatus = & $pgCtl -D $pgData status 2>&1
  if ($pgStatus -like "*is running*") { $pgRunning = $true }
}
if ($pgRunning) {
  Write-Host "  [+] قاعدة البيانات (PostgreSQL): تعمل بنجاح (منفذ 55432)" -ForegroundColor Green
} else {
  Write-Host "  [-] قاعدة البيانات (PostgreSQL): متوقفة" -ForegroundColor Red
}

# 2. Check Web Server
$existing = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { 
  $_.CommandLine -like "*$projectRoot*" -or $_.CommandLine -like "*standalone*server.js*"
}
if ($existing) {
  $pidList = ($existing | ForEach-Object { $_.ProcessId }) -join ", "
  Write-Host "  [+] خادم الويب (Web Server): يعمل بنجاح (منفذ 3001) - PID: $pidList" -ForegroundColor Green
} else {
  Write-Host "  [-] خادم الويب (Web Server): متوقف" -ForegroundColor Red
}

# 3. Check port 3001 availability
$portListening = $false
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $tcp.Connect("127.0.0.1", 3001)
  if ($tcp.Connected) {
    $tcp.Close()
    $portListening = $true
  }
} catch {}

if ($portListening) {
  Write-Host "  [+] منفذ الخدمة 3001: متاح ويستقبل الطلبات" -ForegroundColor Green
} else {
  Write-Host "  [-] منفذ الخدمة 3001: غير متصل" -ForegroundColor DarkGray
}

Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  روابط الوصول إلى النظام:" -ForegroundColor Yellow
Write-Host "  🖥️ محلياً على هذا الجهاز:  http://localhost:3001" -ForegroundColor White

$ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { 
  $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notlike '127.*' 
}
foreach ($ip in $ips) {
  Write-Host "  📱 على الشبكة (موبايل/كاشير): http://$($ip.IPAddressToString):3001" -ForegroundColor Cyan
}
Write-Host "==========================================================" -ForegroundColor Cyan
