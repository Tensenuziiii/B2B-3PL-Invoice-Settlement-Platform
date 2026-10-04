# =====================================================================
# verify-frontend.ps1
# Frontend verification script — no aliases, no inline regex in $()
# =====================================================================

$ErrorActionPreference = "Continue"
$out = "frontend-verification.txt"
Remove-Item $out -ErrorAction SilentlyContinue

function Write-Line($text) { $text | Out-File $out -Append -Encoding utf8 }
function Sep { Write-Line ("-" * 70) }
function Section($text) { Write-Line ""; Sep; Write-Line "== $text"; Sep }

Section "FRONTEND VERIFICATION REPORT"
Write-Line "Generated : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Line "Directory : $(Get-Location)"
Write-Line ""

# ---------------------------------------------------------------------
Section "1. REQUIRED FILES PRESENCE"
# ---------------------------------------------------------------------
$files = @(
  "lib\api\client.ts",
  "lib\api\refresh.ts",
  "lib\api\types.ts",
  "lib\api\index.ts",
  "mocks\handlers.ts",
  "mocks\browser.ts",
  "middleware.ts",
  "app\layout.tsx",
  "app\page.tsx",
  "app\login\page.tsx",
  "app\invite\accept\page.tsx",
  "app\dispatch\page.tsx",
  "app\driver\page.tsx",
  "app\audit\page.tsx",
  "app\accounts\page.tsx",
  "app\client-portal\page.tsx",
  "app\admin\page.tsx",
  "app\admin\users\page.tsx",
  "app\admin\vehicles\page.tsx",
  "app\admin\clients\page.tsx",
  "app\admin\vendors\page.tsx",
  "app\admin\routes\page.tsx",
  "app\admin\rate-cards\page.tsx",
  "app\vendor-portal\page.tsx"
)

foreach ($f in $files) {
  $exists = Test-Path $f
  if ($exists) {
    Write-Line ("  [FOUND  ] {0}" -f $f)
  } else {
    Write-Line ("  [MISSING] {0}" -f $f)
  }
}

# ---------------------------------------------------------------------
Section "2. MIDDLEWARE.TS CONTENT"
# ---------------------------------------------------------------------
if (Test-Path ".\middleware.ts") {
  Get-Content .\middleware.ts | ForEach-Object { Write-Line $_ }
} else {
  Write-Line "  (middleware.ts NOT FOUND)"
}

# ---------------------------------------------------------------------
Section "3. API CLIENT LAYER (lib/api/*.ts)"
# ---------------------------------------------------------------------
$apiFiles = Get-ChildItem -Path ".\lib\api" -Recurse -Include *.ts -ErrorAction SilentlyContinue
if ($apiFiles -and $apiFiles.Count -gt 0) {
  foreach ($f in $apiFiles) {
    Write-Line ""
    Write-Line ">>> FILE: $($f.FullName)"
    $lineCount = (Get-Content $f.FullName | Measure-Object -Line).Lines
    Write-Line "    Lines: $lineCount"
    Get-Content $f.FullName | Select-Object -First 60 | ForEach-Object { Write-Line "    $_" }
  }
} else {
  Write-Line "  lib\api\ directory empty or missing"
}

# ---------------------------------------------------------------------
Section "4. MSW SETUP"
# ---------------------------------------------------------------------
if (Test-Path ".\mocks") {
  Get-ChildItem .\mocks -Recurse -Include *.ts | ForEach-Object {
    Write-Line ">>> FILE: $($_.FullName)"
    Get-Content $_.FullName | Select-Object -First 30 | ForEach-Object { Write-Line "    $_" }
    Write-Line ""
  }
} else {
  Write-Line "  mocks\ directory missing"
}

$pkg = Get-Content .\package.json | ConvertFrom-Json
$mswVersion = $null
if ($pkg.dependencies -and $pkg.dependencies.msw) {
  $mswVersion = $pkg.dependencies.msw
} elseif ($pkg.devDependencies -and $pkg.devDependencies.msw) {
  $mswVersion = $pkg.devDependencies.msw
}
if ($mswVersion) {
  Write-Line "  package.json msw: $mswVersion"
} else {
  Write-Line "  package.json msw: NOT PRESENT"
}

# ---------------------------------------------------------------------
Section "5. MOCK DATA STILL IN PAGE FILES"
# ---------------------------------------------------------------------
Write-Line "  Searching: INITIAL_ / simulated / TRIP-8842 / VEC-INV- / MH 12 RN"
Write-Line ""
Get-ChildItem -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.next\\|\\dist\\' } |
  Select-String -Pattern "INITIAL_|simulated|TRIP-8842|VEC-INV-|MH 12 RN" |
  ForEach-Object {
    $rel = $_.Path.Replace((Get-Location).Path, "")
    Write-Line ("  {0}:{1}  {2}" -f $rel, $_.LineNumber, $_.Line.Trim())
  }

# ---------------------------------------------------------------------
Section "6. REAL API IMPORTS IN PAGES"
# ---------------------------------------------------------------------
Write-Line "  Looking for: from '@/lib/api' / apiClient. / await fetch("
Write-Line ""
Get-ChildItem -Path ".\app" -Recurse -Include *.tsx,*.ts -ErrorAction SilentlyContinue |
  Select-String -Pattern "from '@/lib/api|apiClient\.|await fetch\(" -List |
  ForEach-Object {
    $rel = $_.Path.Replace((Get-Location).Path, "")
    Write-Line ("  {0}" -f $rel)
  }

# ---------------------------------------------------------------------
Section "7. AUTH WIRING — /login"
# ---------------------------------------------------------------------
if (Test-Path ".\app\login\page.tsx") {
  $loginLines = (Get-Content .\app\login\page.tsx | Measure-Object -Line).Lines
  $hasDemoCookie = Select-String -Path .\app\login\page.tsx -Pattern 'demo_session_token' -Quiet
  $hasApiClient  = Select-String -Path .\app\login\page.tsx -Pattern 'apiClient|authService' -Quiet
  $hasLoginCall  = Select-String -Path .\app\login\page.tsx -Pattern 'login' -Quiet

  Write-Line "  Lines: $loginLines"
  Write-Line "  Contains 'demo_session_token': $hasDemoCookie"
  Write-Line "  Contains 'apiClient|authService': $hasApiClient"
  Write-Line "  Contains 'login': $hasLoginCall"
} else {
  Write-Line "  login/page.tsx MISSING"
}

# ---------------------------------------------------------------------
Section "8. MIDDLEWARE RED FLAGS"
# ---------------------------------------------------------------------
if (Test-Path ".\middleware.ts") {
  $mw = Get-Content .\middleware.ts -Raw
  $hasDemoToken  = [bool]($mw -match 'demo_session_token')
  $hasVectoToken = [bool]($mw -match 'vecto_access_token')
  $hasJwtVerify  = [bool]($mw -match 'jose|jwtVerify|verifyJwt|decodeJwt')
  $hasLoginRedir = [bool]($mw -match '/login')
  $hasMatcher    = [bool]($mw -match 'matcher')

  Write-Line "  demo_session_token      : $hasDemoToken"
  Write-Line "  vecto_access_token      : $hasVectoToken"
  Write-Line "  JWT verify (jose/jwt)   : $hasJwtVerify"
  Write-Line "  Redirects to /login     : $hasLoginRedir"
  Write-Line "  Uses matcher config     : $hasMatcher"
} else {
  Write-Line "  middleware.ts MISSING"
}

# ---------------------------------------------------------------------
Section "9. PACKAGE.JSON"
# ---------------------------------------------------------------------
Write-Line "  Dependencies:"
$pkg.dependencies.PSObject.Properties | ForEach-Object {
  Write-Line ("    {0,-40} {1}" -f $_.Name, $_.Value)
}
Write-Line ""
Write-Line "  Dev Dependencies:"
$pkg.devDependencies.PSObject.Properties | ForEach-Object {
  Write-Line ("    {0,-40} {1}" -f $_.Name, $_.Value)
}
Write-Line ""
Write-Line "  Scripts:"
$pkg.scripts.PSObject.Properties | ForEach-Object {
  Write-Line ("    {0,-20} {1}" -f $_.Name, $_.Value)
}

# ---------------------------------------------------------------------
Section "10. LINE COUNT PER ROUTE"
# ---------------------------------------------------------------------
$routes = @(
  "app\login\page.tsx",
  "app\invite\accept\page.tsx",
  "app\page.tsx",
  "app\dispatch\page.tsx",
  "app\driver\page.tsx",
  "app\audit\page.tsx",
  "app\accounts\page.tsx",
  "app\client-portal\page.tsx",
  "app\admin\page.tsx",
  "app\vendor-portal\page.tsx"
)
foreach ($r in $routes) {
  if (Test-Path $r) {
    $lines = (Get-Content $r | Measure-Object -Line).Lines
    Write-Line ("  {0,-45} {1} lines" -f $r, $lines)
  } else {
    Write-Line ("  {0,-45} MISSING" -f $r)
  }
}

# ---------------------------------------------------------------------
Section "11. ADMIN SUB-ROUTES"
# ---------------------------------------------------------------------
foreach ($s in @("users","vehicles","clients","vendors","routes","rate-cards")) {
  $p = "app\admin\$s\page.tsx"
  $exists = Test-Path $p
  if ($exists) {
    Write-Line ("  {0,-45} FOUND" -f $p)
  } else {
    Write-Line ("  {0,-45} MISSING" -f $p)
  }
}

# ---------------------------------------------------------------------
Section "12. TSC + BUILD"
# ---------------------------------------------------------------------
if (Test-Path ".\node_modules") {
  Write-Line "  Running: npx tsc --noEmit"
  Write-Line ""
  $tscOut = npx tsc --noEmit 2>&1
  Write-Line "  tsc exit code: $LASTEXITCODE"
  if ($tscOut) {
    $tscOut | ForEach-Object { Write-Line "    $_" }
  } else {
    Write-Line "    (clean — no errors)"
  }

  Write-Line ""
  Write-Line "  Running: npm run build"
  Write-Line ""
  $buildOut = npm run build 2>&1
  Write-Line "  build exit code: $LASTEXITCODE"
  $buildOut | Select-Object -Last 40 | ForEach-Object { Write-Line "    $_" }
} else {
  Write-Line "  node_modules not found. Run 'npm install' first."
}

# ---------------------------------------------------------------------
Section "END OF REPORT"
# ---------------------------------------------------------------------

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " VERIFICATION COMPLETE" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Report: $(Resolve-Path $out)" -ForegroundColor Cyan
Write-Host ""
Write-Host " Open with:" -ForegroundColor Yellow
Write-Host "   notepad frontend-verification.txt" -ForegroundColor Yellow
Write-Host ""