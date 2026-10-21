$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$payload = Join-Path $projectRoot "build\windows-payload"
$output = Join-Path $projectRoot "dist-installer"
$pgSource = Join-Path $projectRoot "work\postgresql-portable\pgsql"
$nodeSource = "C:\Program Files\nodejs\node.exe"

if (-not (Test-Path (Join-Path $projectRoot ".next-bundle\standalone\server.js"))) {
  throw "Next standalone build output is missing. Run npm run build first."
}
if (-not (Test-Path (Join-Path $pgSource "bin\pg_ctl.exe"))) { throw "Portable PostgreSQL runtime was not found." }
if (-not (Test-Path $nodeSource)) { throw "Node.js runtime was not found at $nodeSource." }

Remove-Item -LiteralPath $payload -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $payload | Out-Null
Copy-Item -Path (Join-Path $projectRoot ".next-bundle\standalone\*") -Destination $payload -Recurse -Force
New-Item -ItemType Directory -Force -Path (Join-Path $payload ".next-bundle\static"), (Join-Path $payload "runtime"), (Join-Path $payload "drizzle"), (Join-Path $payload "scripts") | Out-Null
Copy-Item -Path (Join-Path $projectRoot ".next-bundle\static\*") -Destination (Join-Path $payload ".next-bundle\static") -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot "public\*") -Destination (Join-Path $payload "public") -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot "drizzle\*") -Destination (Join-Path $payload "drizzle") -Recurse -Force

# Copy Scripts
$scriptsToCopy = @("migrate-runtime.mjs", "seed-runtime.mjs", "start-windows.ps1", "stop-windows.ps1", "status-windows.ps1", "get-ip.bat")
foreach ($s in $scriptsToCopy) {
  $src = Join-Path $PSScriptRoot $s
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $payload "scripts") -Force
  }
}

# Copy Root Launchers and Utilities
$rootFiles = @("Apex-ERP.vbs", "start-windows.bat", "تشغيل-السيستم.bat", "إيقاف-السيستم.bat", "حالة-السيستم.bat")
foreach ($rf in $rootFiles) {
  $src = Join-Path $projectRoot $rf
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination $payload -Force
  }
}

Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $payload "runtime\node.exe") -Force

$pgDestination = Join-Path $payload "runtime\postgresql"
Copy-Item -Path (Join-Path $pgSource "bin") -Destination $pgDestination -Recurse -Force
Copy-Item -Path (Join-Path $pgSource "lib") -Destination $pgDestination -Recurse -Force
Copy-Item -Path (Join-Path $pgSource "share") -Destination $pgDestination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $pgSource "server_license.txt") -Destination $pgDestination -ErrorAction SilentlyContinue

$iscc = @(
  "C:\Users\$env:USERNAME\AppData\Local\Programs\Inno Setup 6\ISCC.exe",
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 compiler (ISCC.exe) is required to produce the Setup.exe." }
New-Item -ItemType Directory -Force -Path $output | Out-Null
& $iscc (Join-Path $projectRoot "installer.iss")
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed with exit code $LASTEXITCODE." }

$setup = Join-Path $output "Apex-Software-ERP-Setup.exe"
if (-not (Test-Path $setup)) { 
  $setup = Join-Path $output "Cosmetics-ERP-Setup.exe"
}
if (-not (Test-Path $setup)) { throw "Inno Setup reported success but did not create the installer." }
Write-Host "Installer ready: $setup"
Write-Host "Payload size: $([math]::Round((Get-ChildItem $payload -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)) MB"
