$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$dataDir = Join-Path $projectRoot "data"
$envFile = Join-Path $dataDir ".env"
$pgRoot = Join-Path $projectRoot "runtime\postgresql"
if (-not (Test-Path $pgRoot)) {
  $pgRoot = Join-Path $projectRoot "work\postgresql-portable\pgsql"
}
$pgData = Join-Path $dataDir "pgdata"
$pgBin = Join-Path $pgRoot "bin"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$node = Join-Path $projectRoot "runtime\node.exe"
if (-not (Test-Path $node)) {
  # Fallback to system node if running in developer mode
  $node = (Get-Command "node.exe" -ErrorAction SilentlyContinue).Source
}

if (-not $node -or -not (Test-Path $pgCtl)) {
  throw "The installed runtime is incomplete. Node.js or PostgreSQL portable runtime was not found."
}
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# 1. Initialize environment file (.env) if missing
if (-not (Test-Path $envFile)) {
  $adminPassword = $env:SEED_ADMIN_PASSWORD
  if (-not $adminPassword -or $adminPassword.Length -lt 14) {
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
      try {
        $securePassword = Read-Host "Admin password (minimum 14 characters, press Enter for default)" -AsSecureString
        $inputPass = [System.Net.NetworkCredential]::new("", $securePassword).Password
        if ($inputPass.Length -ge 14) { $adminPassword = $inputPass }
      } catch {}
    }
  }
  if (-not $adminPassword -or $adminPassword.Length -lt 14) {
    $adminPassword = "Admin@Apex2026!"
  }

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
  
  [Environment]::SetEnvironmentVariable("ERP_FIRST_ADMIN_PASSWORD", $adminPassword, "Process")
  
  # Save credentials text file for the user
  $credContent = @"
========================================================
             Apex Software ERP - بيانات الدخول
========================================================
اسم المستخدم: admin
كلمة المرور : $adminPassword
الرابط المحلي : http://localhost:3001
========================================================
يمكنك تغيير كلمة المرور في أي وقت من شاشة الإعدادات أو المستخدمين.
"@
  Set-Content -LiteralPath (Join-Path $projectRoot "بيانات_الدخول_الأولية.txt") -Value $credContent -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $dataDir "credentials.txt") -Value $credContent -Encoding UTF8
}

foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") }
}
$env:PGPASSWORD = ($env:DATABASE_URL -replace '^postgres://[^:]+:([^@]+)@.*$', '$1')

# 2. Check and start PostgreSQL
$status = & $pgCtl -D $pgData status 2>&1
if ($LASTEXITCODE -ne 0) {
  # Clean up stale postmaster.pid if server is not actually running
  $pidFile = Join-Path $pgData "postmaster.pid"
  if (Test-Path $pidFile) { Remove-Item -Force $pidFile -ErrorAction SilentlyContinue }
  
  & $pgCtl -D $pgData -l (Join-Path $dataDir "postgres-server.log") -o "-h 127.0.0.1 -p 55432" start
  Start-Sleep -Seconds 2
  $status = & $pgCtl -D $pgData status 2>&1
  if ($LASTEXITCODE -ne 0) { throw "The local database could not start. Check data\postgres-server.log." }
}

# 3. Ensure database cosmetics_erp exists
$psql = Join-Path $pgBin "psql.exe"
$dbExists = & $psql -h 127.0.0.1 -p 55432 -U cosmetics -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cosmetics_erp'"
if ($LASTEXITCODE -ne 0) { throw "Could not connect to the local database." }
if (-not $dbExists) {
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p 55432 -U cosmetics cosmetics_erp
  if ($LASTEXITCODE -ne 0) { throw "Could not create the application database." }
}

# 4. Run migrations
$migrateScript = Join-Path $projectRoot "scripts\migrate-runtime.mjs"
if (Test-Path $migrateScript) {
  & $node $migrateScript
  if ($LASTEXITCODE -ne 0) { throw "Database migrations failed." }
}

# 5. Seed initial admin if needed
$adminExists = & $psql -h 127.0.0.1 -p 55432 -U cosmetics -d cosmetics_erp -tAc "SELECT 1 FROM users WHERE username='admin' LIMIT 1"
if (-not $adminExists) {
  if (-not $env:ERP_FIRST_ADMIN_PASSWORD) {
    $env:ERP_FIRST_ADMIN_PASSWORD = "Admin@Apex2026!"
  }
  $env:SEED_ADMIN_PASSWORD = $env:ERP_FIRST_ADMIN_PASSWORD
  $seedScript = Join-Path $projectRoot "scripts\seed-runtime.mjs"
  if (Test-Path $seedScript) {
    & $node $seedScript
  }
  $env:ERP_FIRST_ADMIN_PASSWORD = $null
  $env:SEED_ADMIN_PASSWORD = $null
}

# 6. Start Next.js App in Background (Hidden)
$existing = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { 
  $_.CommandLine -like "*$projectRoot*" -or $_.CommandLine -like "*standalone*server.js*"
}

if (-not $existing) {
  $env:HOSTNAME = "0.0.0.0"
  $env:PORT = "3001"
  $server = Join-Path $projectRoot "server.js"
  if (-not (Test-Path $server)) {
    $server = Join-Path $projectRoot ".next-bundle\standalone\server.js"
  }
  
  if (Test-Path $server) {
    $proc = Start-Process -FilePath $node -ArgumentList @($server) -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $dataDir "app.log") -RedirectStandardError (Join-Path $dataDir "app-error.log") -WindowStyle Hidden -PassThru
    if ($proc) {
      Set-Content -LiteralPath (Join-Path $dataDir "app.pid") -Value $proc.Id -Encoding ascii
    }
  } else {
    # If server.js is not built yet (source code mode), launch via npm run start
    $npmCmd = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue).Source
    if ($npmCmd) {
      $proc = Start-Process -FilePath $npmCmd -ArgumentList @("run", "start") -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $dataDir "app.log") -RedirectStandardError (Join-Path $dataDir "app-error.log") -WindowStyle Hidden -PassThru
      if ($proc) {
        Set-Content -LiteralPath (Join-Path $dataDir "app.pid") -Value $proc.Id -Encoding ascii
      }
    }
  }
}

# 7. Wait for port 3001 to respond before launching browser
for ($i = 0; $i -lt 15; $i++) {
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 3001)
    if ($tcp.Connected) {
      $tcp.Close()
      break
    }
  } catch {
    Start-Sleep -Milliseconds 600
  }
}

# 8. Open default browser
Start-Process "http://127.0.0.1:3001"
