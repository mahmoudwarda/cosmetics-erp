$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$payload = Join-Path $projectRoot "build\windows-payload"
$output = Join-Path $projectRoot "dist-installer"
$pgSource = Join-Path $projectRoot "work\postgresql-portable\pgsql"

# Find node.exe dynamically
$nodeSource = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodeSource)) {
  $nodeSource = "C:\Program Files (x86)\nodejs\node.exe"
}
if (-not (Test-Path $nodeSource)) {
  $cmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if ($cmd) { $nodeSource = $cmd.Source }
}
if (-not (Test-Path $nodeSource) -and $env:ProgramFiles) {
  $pfNode = Join-Path $env:ProgramFiles "nodejs\node.exe"
  if (Test-Path $pfNode) { $nodeSource = $pfNode }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   تجهيز حزمة ويندوز لنظام Apex Software ERP              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $projectRoot ".next-bundle\standalone\server.js"))) {
  throw "ملفات Next.js standalone غير موجودة. شغّل npm run build أولاً."
}
if (-not (Test-Path (Join-Path $pgSource "bin\pg_ctl.exe"))) { 
  throw "ملفات PostgreSQL Portable غير موجودة في $pgSource." 
}
if (-not $nodeSource -or -not (Test-Path $nodeSource)) { 
  throw "لم يتم العثور على Node.js في النظام. يرجى تثبيت Node.js من https://nodejs.org/" 
}

Write-Host "[1/5] تنظيف وإعادة إنشاء مجلد الحزمة (windows-payload)..." -ForegroundColor Yellow
Remove-Item -LiteralPath $payload -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $payload | Out-Null

Write-Host "[2/5] نسخ ملفات النظام وNext.js Standalone..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $projectRoot ".next-bundle\standalone\*") -Destination $payload -Recurse -Force
New-Item -ItemType Directory -Force -Path `
  (Join-Path $payload ".next-bundle\static"), `
  (Join-Path $payload ".next\static"), `
  (Join-Path $payload "runtime"), `
  (Join-Path $payload "drizzle"), `
  (Join-Path $payload "scripts"), `
  (Join-Path $payload "node_modules") | Out-Null

Copy-Item -Path (Join-Path $projectRoot ".next-bundle\static\*") -Destination (Join-Path $payload ".next-bundle\static") -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot ".next-bundle\static\*") -Destination (Join-Path $payload ".next\static") -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot "public\*") -Destination (Join-Path $payload "public") -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot "drizzle\*") -Destination (Join-Path $payload "drizzle") -Recurse -Force

# Copy critical dependencies
$criticalModules = @("drizzle-orm", "pg", "argon2")
foreach ($mod in $criticalModules) {
  $srcMod = Join-Path $projectRoot "node_modules\$mod"
  $destMod = Join-Path $payload "node_modules\$mod"
  if (Test-Path $srcMod -and -not (Test-Path $destMod)) {
    Copy-Item -Path $srcMod -Destination $destMod -Recurse -Force
  }
}

Write-Host "[3/5] نسخ السكربتات وأدوات التشغيل الصامت..." -ForegroundColor Yellow
$scriptsToCopy = @("migrate-runtime.mjs", "seed-runtime.mjs", "start-windows.ps1", "stop-windows.ps1", "status-windows.ps1", "get-ip.bat")
foreach ($s in $scriptsToCopy) {
  $src = Join-Path $PSScriptRoot $s
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $payload "scripts") -Force
  }
}

$rootFiles = @("Apex-ERP.vbs", "start-windows.bat", "تشغيل-السيستم.bat", "إيقاف-السيستم.bat", "حالة-السيستم.bat")
foreach ($rf in $rootFiles) {
  $src = Join-Path $projectRoot $rf
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination $payload -Force
  }
}

Write-Host "[4/5] نسخ بيئة التشغيل المحمولة (Node.js & PostgreSQL Portable)..." -ForegroundColor Yellow
Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $payload "runtime\node.exe") -Force

$pgDestination = Join-Path $payload "runtime\postgresql"
Copy-Item -Path (Join-Path $pgSource "bin") -Destination $pgDestination -Recurse -Force
Copy-Item -Path (Join-Path $pgSource "lib") -Destination $pgDestination -Recurse -Force
Copy-Item -Path (Join-Path $pgSource "share") -Destination $pgDestination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $pgSource "server_license.txt") -Destination $pgDestination -ErrorAction SilentlyContinue

$payloadSizeMB = [math]::Round((Get-ChildItem $payload -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)
Write-Host "تم تجهيز مجلد الحزمة بنجاح: build\windows-payload (الحجم: $payloadSizeMB ميجابايت)" -ForegroundColor Green

Write-Host "[5/5] البحث عن مترجم Inno Setup 6 لبناء ملف التسطيب Setup.exe..." -ForegroundColor Yellow
$isccPaths = @(
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
  "C:\Program Files\Inno Setup 6\ISCC.exe",
  "C:\Users\$env:USERNAME\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
)
$iscc = $isccPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($iscc) {
  Write-Host "تم العثور على Inno Setup: $iscc" -ForegroundColor Green
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  & $iscc (Join-Path $projectRoot "installer.iss")
  if ($LASTEXITCODE -ne 0) { throw "فشل Inno Setup بكود خطأ $LASTEXITCODE." }

  $setup = Join-Path $output "Apex-Software-ERP-Setup.exe"
  if (-not (Test-Path $setup)) { 
    $setup = Join-Path $output "Cosmetics-ERP-Setup.exe"
  }
  if (Test-Path $setup) {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "   🎉 ملف التسطيب جاهز بنجاح: $setup" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
  }
} else {
  Write-Host "==========================================================" -ForegroundColor Yellow
  Write-Host "  تنبيه: لم يتم العثور على Inno Setup 6 (ISCC.exe)." -ForegroundColor Yellow
  Write-Host "  1. مجلد الحزمة المحمولة جاهز بالكامل في: build\windows-payload" -ForegroundColor White
  Write-Host "     يمكنك ضغط هذا المجلد ونقله لأي جهاز ليعمل فوراً بدون تسطيب!" -ForegroundColor White
  Write-Host "  2. لإنشاء ملف Setup.exe تثبيت تلقائي بنقرة واحدة:" -ForegroundColor White
  Write-Host "     حمّل Inno Setup 6 مجاناً من: https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
  Write-Host "     ثم أعد تشغيل build-setup.bat وسينشئ ملف Setup.exe فوراً!" -ForegroundColor White
  Write-Host "==========================================================" -ForegroundColor Yellow
}
