$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$dataDir = Join-Path $projectRoot "data"
$envFile = Join-Path $dataDir ".env"
$startupLog = Join-Path $dataDir "startup-error.log"

try {
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

  $pgRoot = Join-Path $projectRoot "runtime\postgresql"
  if (-not (Test-Path $pgRoot)) {
    $pgRoot = Join-Path $projectRoot "work\postgresql-portable\pgsql"
  }
  $pgData = Join-Path $dataDir "pgdata"
  $pgBin = Join-Path $pgRoot "bin"
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"

  $node = Join-Path $projectRoot "runtime\node.exe"
  if (-not (Test-Path $node)) {
    $node = (Get-Command "node.exe" -ErrorAction SilentlyContinue).Source
  }

  if (-not $node -or -not (Test-Path $pgCtl)) {
    throw "ملفات التشغيل غير مكتملة. لم يتم العثور على Node.js أو PostgreSQL Portable."
  }

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
    
    # Initialize PostgreSQL data folder if PG_VERSION doesn't exist
    if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
      $pgPasswordFile = Join-Path $dataDir "pg-password.tmp"
      Set-Content -LiteralPath $pgPasswordFile -Value $dbPassword -NoNewline -Encoding ascii
      & (Join-Path $pgBin "initdb.exe") -D $pgData -U cosmetics -A scram-sha-256 --pwfile=$pgPasswordFile -E UTF8 *>&1 | Out-Null
      Remove-Item $pgPasswordFile -Force -ErrorAction SilentlyContinue
    }
    
    [Environment]::SetEnvironmentVariable("ERP_FIRST_ADMIN_PASSWORD", $adminPassword, "Process")
    
    # Save initial credentials file
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
  $pgRunning = $false
  try {
    $testTcp = New-Object System.Net.Sockets.TcpClient
    $connect = $testTcp.BeginConnect("127.0.0.1", 55432, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)
    if ($wait -and $testTcp.Connected) {
      $testTcp.EndConnect($connect)
      $pgRunning = $true
    }
    $testTcp.Close()
  } catch {}

  if (-not $pgRunning) {
    $pidFile = Join-Path $pgData "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item -Force $pidFile -ErrorAction SilentlyContinue }
    
    & $pgCtl -D $pgData -l (Join-Path $dataDir "postgres-server.log") -o "-h 127.0.0.1 -p 55432" start
    
    # Wait up to 8 seconds for database socket
    for ($i = 0; $i -lt 8; $i++) {
      Start-Sleep -Seconds 1
      try {
        $testTcp = New-Object System.Net.Sockets.TcpClient
        $connect = $testTcp.BeginConnect("127.0.0.1", 55432, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(800, $false)
        if ($wait -and $testTcp.Connected) {
          $testTcp.EndConnect($connect)
          $testTcp.Close()
          $pgRunning = $true
          break
        }
        $testTcp.Close()
      } catch {}
    }
  }

  # 3. Ensure database cosmetics_erp exists
  $psql = Join-Path $pgBin "psql.exe"
  $dbExists = & $psql -h 127.0.0.1 -p 55432 -U cosmetics -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cosmetics_erp'" 2>&1
  if ($dbExists -notlike "*1*") {
    & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p 55432 -U cosmetics cosmetics_erp 2>&1 | Out-Null
  }

  # 4. Run database migrations
  $migrateScript = Join-Path $projectRoot "scripts\migrate-runtime.mjs"
  if (Test-Path $migrateScript) {
    & $node $migrateScript
  }

  # 5. Seed initial admin account
  $adminExists = & $psql -h 127.0.0.1 -p 55432 -U cosmetics -d cosmetics_erp -tAc "SELECT 1 FROM users WHERE username='admin' LIMIT 1" 2>&1
  if ($adminExists -notlike "*1*") {
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

  # 6. Check if Web Server is already running
  $existing = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { 
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
      $testTcp = New-Object System.Net.Sockets.TcpClient
      $connect = $testTcp.BeginConnect("127.0.0.1", 3001, $null, $null)
      $wait = $connect.AsyncWaitHandle.WaitOne(600, $false)
      if ($wait -and $testTcp.Connected) {
        $testTcp.EndConnect($connect)
        $testTcp.Close()
        break
      }
      $testTcp.Close()
    } catch {}
    Start-Sleep -Milliseconds 500
  }

  # 8. Open default browser
  Start-Process "http://127.0.0.1:3001"

} catch {
  $errMsg = $_.Exception.ToString()
  Set-Content -LiteralPath $startupLog -Value $errMsg -Encoding UTF8
  
  # Try to show a GUI alert to the user so they know what happened
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      "حدث خطأ أثناء تشغيل Apex Software ERP:`n`n$($_.Exception.Message)`n`nتم حفظ التفاصيل في: data\startup-error.log",
      "Apex Software ERP - تنبيه",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {}
  
  exit 1
}
