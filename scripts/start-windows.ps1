$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$dataDir = Join-Path $projectRoot "data"
$envFile = Join-Path $dataDir ".env"
$pgRoot = Join-Path $projectRoot "runtime\postgresql"
$pgData = Join-Path $dataDir "pgdata"
$pgBin = Join-Path $pgRoot "bin"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$node = Join-Path $projectRoot "runtime\node.exe"

if (-not (Test-Path $node) -or -not (Test-Path $pgCtl)) {
  throw "The installed runtime is incomplete. Run the installer again or contact support."
}
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if (-not (Test-Path $envFile)) {
  Write-Host "First-time setup: create the administrator password."
  $securePassword = Read-Host "Admin password (minimum 14 characters)" -AsSecureString
  $adminPassword = [System.Net.NetworkCredential]::new("", $securePassword).Password
  if ($adminPassword.Length -lt 14) { throw "The password must contain at least 14 characters." }
  $rngBytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($rngBytes)
  $authSecret = [Convert]::ToBase64String($rngBytes)
  $dbPassword = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
  $config = @(
    "DATABASE_URL=postgres://cosmetics:$dbPassword@127.0.0.1:55432/cosmetics_erp",
    "AUTH_SECRET=$authSecret",
    "SESSION_COOKIE_SECURE=false",
    "TRUST_PROXY=false",
    "HOSTNAME=0.0.0.0",
    "PORT=3001",
    "UPLOADS_DIR=./data/uploads",
    "BACKUP_DIR=./data/backups"
  )
  Set-Content -LiteralPath $envFile -Value $config -Encoding ascii
  $pgPasswordFile = Join-Path $dataDir "pg-password.tmp"
  Set-Content -LiteralPath $pgPasswordFile -Value $dbPassword -NoNewline -Encoding ascii
  & (Join-Path $pgBin "initdb.exe") -D $pgData -U cosmetics -A scram-sha-256 --pwfile=$pgPasswordFile -E UTF8
  if ($LASTEXITCODE -ne 0) {
    Remove-Item $envFile, $pgPasswordFile -Force -ErrorAction SilentlyContinue
    throw "PostgreSQL initialization failed."
  }
  Remove-Item $pgPasswordFile -Force -ErrorAction SilentlyContinue
  $plain = ConvertTo-SecureString $adminPassword -AsPlainText -Force
  $adminPassword = $null
  $securePassword = $null
  [Environment]::SetEnvironmentVariable("ERP_FIRST_ADMIN_PASSWORD", [System.Net.NetworkCredential]::new("", $plain).Password, "Process")
}

foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") }
}
$env:PGPASSWORD = ($env:DATABASE_URL -replace '^postgres://[^:]+:([^@]+)@.*$', '$1')
$status = & $pgCtl -D $pgData status 2>&1
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $pgData -l (Join-Path $dataDir "postgres-server.log") -o "-h 127.0.0.1 -p 55432" start
  if ($LASTEXITCODE -ne 0) { throw "The local database could not start. Check data\postgres-server.log." }
}

$psql = Join-Path $pgBin "psql.exe"
$dbExists = & $psql -h 127.0.0.1 -p 55432 -U cosmetics -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cosmetics_erp'"
if ($LASTEXITCODE -ne 0) { throw "Could not connect to the local database." }
if (-not $dbExists) {
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p 55432 -U cosmetics cosmetics_erp
  if ($LASTEXITCODE -ne 0) { throw "Could not create the application database." }
}

& $node (Join-Path $projectRoot "scripts\migrate-runtime.mjs")
if ($LASTEXITCODE -ne 0) { throw "Database migrations failed. No application process was started." }
$adminExists = & $psql -h 127.0.0.1 -p 55432 -U cosmetics -d cosmetics_erp -tAc "SELECT 1 FROM users WHERE username='admin' LIMIT 1"
if (-not $adminExists) {
  if (-not $env:ERP_FIRST_ADMIN_PASSWORD) { $securePassword = Read-Host "Initial admin password (minimum 14 characters)" -AsSecureString; $env:ERP_FIRST_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password }
  if ($env:ERP_FIRST_ADMIN_PASSWORD.Length -lt 14) { throw "The password must contain at least 14 characters." }
  $env:SEED_ADMIN_PASSWORD = $env:ERP_FIRST_ADMIN_PASSWORD
  & $node (Join-Path $projectRoot "scripts\seed-runtime.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Initial account setup failed." }
  $env:ERP_FIRST_ADMIN_PASSWORD = $null
  $env:SEED_ADMIN_PASSWORD = $null
  $remaining = Get-Content -LiteralPath $envFile | Where-Object { $_ -notmatch '^SEED_ADMIN_PASSWORD=' }
  Set-Content -LiteralPath $envFile -Value $remaining -Encoding ascii
}

$existing = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.CommandLine -like "*$projectRoot*server.js*" }
if (-not $existing) {
  $env:HOSTNAME = "0.0.0.0"
  $env:PORT = "3001"
  $server = Join-Path $projectRoot "server.js"
  Start-Process -FilePath $node -ArgumentList @($server) -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $dataDir "app.log") -RedirectStandardError (Join-Path $dataDir "app-error.log")
  Start-Sleep -Seconds 3
}
Start-Process "http://127.0.0.1:3001"
Write-Host "System is running. Other shop devices can open this computer's LAN IP on port 3001."
