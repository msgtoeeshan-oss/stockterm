<#
    stockterm setup

    Stamps your GitHub username and repository name into every placeholder,
    keeps index.html in sync with stock.html, and checks nothing is broken
    before you publish.

    Run it once, from this folder:

        .\setup.ps1 -User yourname

    Optionally give a different repo name (default: stockterm):

        .\setup.ps1 -User yourname -Repo my-research-tool
#>
param(
    [Parameter(Mandatory = $true)][string]$User,
    [string]$Repo = 'stockterm'
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$site = "https://$User.github.io/$Repo"
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Text($path, $text) {
    [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot $path), $text, $utf8)
}
function Read-Text($path) {
    [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot $path))
}

Write-Host ""
Write-Host "stockterm setup" -ForegroundColor Cyan
Write-Host "  user : $User"
Write-Host "  repo : $Repo"
Write-Host "  site : $site"
Write-Host ""

# ---- 1. stamp placeholders ------------------------------------------------
$targets = @('README.md', '.github\ISSUE_TEMPLATE\config.yml', 'stock.html')
$stamped = 0
foreach ($f in $targets) {
    if (-not (Test-Path $f)) { continue }
    $t = Read-Text $f
    $before = $t
    $t = $t.Replace('SITE_URL', $site)
    $t = $t.Replace('YOUR-USERNAME/stockterm', "$User/$Repo")
    $t = $t.Replace('YOUR-USERNAME.github.io/stockterm', "$User.github.io/$Repo")
    $t = $t.Replace('YOUR-USERNAME', $User)
    $t = $t.Replace('REPO-NAME', $Repo)
    if ($t -ne $before) {
        Write-Text $f $t
        Write-Host "  stamped  $f" -ForegroundColor Green
        $stamped++
    }
}
if ($stamped -eq 0) { Write-Host "  nothing left to stamp (already done)" -ForegroundColor DarkGray }

# ---- 2. keep the hosted copy identical ------------------------------------
Copy-Item stock.html index.html -Force
Write-Host "  synced   index.html" -ForegroundColor Green

# ---- 3. checks ------------------------------------------------------------
Write-Host ""
Write-Host "checks" -ForegroundColor Cyan
$fail = 0

$html = Read-Text 'stock.html'

if ($html -match "var\s+(FINNHUB_KEY|AI_KEY)\s*=\s*['`"][^'`"]+['`"]") {
    Write-Host "  FAIL  an API key is in the source - remove it before publishing" -ForegroundColor Red; $fail++
} else { Write-Host "  ok    no API key in source" -ForegroundColor Green }

if ($html -match 'AIza[0-9A-Za-z_-]{30,}') {
    Write-Host "  FAIL  something shaped like a Google API key is present" -ForegroundColor Red; $fail++
} else { Write-Host "  ok    no Google key pattern" -ForegroundColor Green }

if ($html -match '<script[^>]+src=' -or $html -match "<link[^>]+href=[`"']http") {
    Write-Host "  FAIL  external resource reference - the file must be self-contained" -ForegroundColor Red; $fail++
} else { Write-Host "  ok    self-contained, no external resources" -ForegroundColor Green }

$left = Select-String -Path README.md, stock.html, .github\ISSUE_TEMPLATE\config.yml -Pattern 'YOUR-USERNAME|SITE_URL|REPO-NAME' -ErrorAction SilentlyContinue
if ($left) {
    Write-Host "  FAIL  placeholders remain:" -ForegroundColor Red
    $left | ForEach-Object { Write-Host ("        {0}:{1}" -f $_.Filename, $_.LineNumber) -ForegroundColor Red }
    $fail++
} else { Write-Host "  ok    no placeholders left" -ForegroundColor Green }

if ((Get-FileHash stock.html).Hash -eq (Get-FileHash index.html).Hash) {
    Write-Host "  ok    index.html matches stock.html" -ForegroundColor Green
} else { Write-Host "  FAIL  index.html out of sync" -ForegroundColor Red; $fail++ }

if (Get-Command node -ErrorAction SilentlyContinue) {
    $a = $html.IndexOf('<script>'); $b = $html.LastIndexOf('</' + 'script>')
    [System.IO.File]::WriteAllText("$env:TEMP\stockterm-check.js", $html.Substring($a + 8, $b - $a - 8), $utf8)
    node --check "$env:TEMP\stockterm-check.js" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "  ok    app script parses" -ForegroundColor Green }
    else { Write-Host "  FAIL  app script has a syntax error" -ForegroundColor Red; $fail++ }
    Remove-Item "$env:TEMP\stockterm-check.js" -ErrorAction SilentlyContinue
} else {
    Write-Host "  skip  node not installed, cannot syntax-check" -ForegroundColor DarkGray
}

Write-Host ""
if ($fail -gt 0) {
    Write-Host "$fail check(s) failed - fix before publishing" -ForegroundColor Red
    exit 1
}

Write-Host "Ready to publish." -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. Create an empty PUBLIC repo named '$Repo' at https://github.com/new"
Write-Host "     Do NOT tick 'Add a README file'."
Write-Host ""
Write-Host "  2. Run these three commands:"
Write-Host "       git add -A"
Write-Host "       git commit -m `"set site links`""
Write-Host "       git remote add origin https://github.com/$User/$Repo.git"
Write-Host "       git push -u origin main"
Write-Host ""
Write-Host "  3. In the repo: Settings > Pages > Deploy from a branch > main > / (root) > Save"
Write-Host ""
Write-Host "  4. After about a minute your site is live at:"
Write-Host "       $site/" -ForegroundColor Cyan
Write-Host ""
