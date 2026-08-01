<#
    Build a private, keyed copy of the app.

    For a handful of known users, this is simpler than any server: it bakes the
    keys into a single file that you send them directly. They open it and
    everything works — no signup, no pasting, no setup screen.

    The output is stock.local.html, which .gitignore already blocks, so it can
    never reach the public repo.

        .\tools\build-private.ps1 -Finnhub "your_finnhub_key" -Gemini "your_gemini_key"

    Gemini is optional; leave it out and everything except the analyst works.

    Send the resulting file the way you would send any private document.
    Anyone who receives it receives the keys — that is the trade being made,
    and it is a reasonable one for a small trusted group. It is NOT reasonable
    for a public link, which is what worker/README.md is for.
#>
param(
    [Parameter(Mandatory = $true)][string]$Finnhub,
    [string]$Gemini = '',
    [string]$Out = 'stock.local.html'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$srcPath = Join-Path $root 'stock.html'
$outPath = Join-Path $root $Out
if (-not (Test-Path $srcPath)) { throw "stock.html not found in $root" }

if ($Out -notlike '*.local.html') {
    Write-Host "REFUSING: output must end in .local.html so .gitignore blocks it." -ForegroundColor Red
    exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$html = [System.IO.File]::ReadAllText($srcPath)

# ---- verify the keys actually work before baking them in -------------------
Write-Host ""
Write-Host "Checking keys..." -ForegroundColor Cyan

try {
    $q = Invoke-RestMethod -Uri ("https://finnhub.io/api/v1/quote?symbol=AAPL&token=" + [uri]::EscapeDataString($Finnhub)) -TimeoutSec 25
    if (-not $q.c -or $q.c -eq 0) { throw "returned no price" }
    Write-Host ("  ok    Finnhub  (AAPL = " + $q.c + ")") -ForegroundColor Green
} catch {
    Write-Host "  FAIL  Finnhub key rejected: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($Gemini) {
    try {
        $body = '{"contents":[{"parts":[{"text":"Reply with: ok"}]}],"generationConfig":{"maxOutputTokens":8,"thinkingConfig":{"thinkingBudget":0}}}'
        Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30 `
            -Uri ("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + [uri]::EscapeDataString($Gemini)) | Out-Null
        Write-Host "  ok    Gemini" -ForegroundColor Green
    } catch {
        $msg = $_.Exception.Message
        if ($msg -match '429') { $msg += "  (a 'limit: 0' quota means that Google project has no free tier - make a key in a NEW project)" }
        Write-Host "  FAIL  Gemini key rejected: $msg" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  skip  Gemini not supplied - the analyst will be off in this build" -ForegroundColor DarkGray
}

# ---- bake ------------------------------------------------------------------
$fhPattern = "var FINNHUB_KEY = '';"
$aiPattern = "var AI_KEY      = '';"
if ($html -notmatch [regex]::Escape($fhPattern)) {
    Write-Host "  FAIL  could not find the empty FINNHUB_KEY line in stock.html" -ForegroundColor Red
    exit 1
}
$html = $html.Replace($fhPattern, "var FINNHUB_KEY = '$Finnhub';")
if ($Gemini) { $html = $html.Replace($aiPattern, "var AI_KEY      = '$Gemini';") }

# a visible reminder inside the file itself
$banner = "<!-- PRIVATE BUILD - CONTAINS API KEYS. Do not commit, publish or post this file. Regenerate with tools/build-private.ps1 -->`r`n"
$html = $html -replace '(?<=<!doctype html>\r?\n)', $banner

[System.IO.File]::WriteAllText($outPath, $html, $utf8)

# ---- confirm ---------------------------------------------------------------
Write-Host ""
$check = [System.IO.File]::ReadAllText($outPath)
$hasFh = $check -match [regex]::Escape("var FINNHUB_KEY = '$Finnhub';")
$hasAi = (-not $Gemini) -or ($check -match [regex]::Escape("var AI_KEY      = '$Gemini';"))
if ($hasFh -and $hasAi) {
    Write-Host "Built $Out" -ForegroundColor Green
    "{0:N0} bytes" -f (Get-Item $outPath).Length | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "FAILED to bake keys into $Out" -ForegroundColor Red
    exit 1
}

# ---- safety net ------------------------------------------------------------
# ls-files prints the path only when tracked, and writes nothing to stderr,
# unlike --error-unmatch which errors on the healthy case.
$tracked = (git ls-files -- $Out | Out-String).Trim()
if ($tracked) {
    Write-Host ""
    Write-Host "DANGER: $Out is TRACKED BY GIT. Remove it before committing:" -ForegroundColor Red
    Write-Host "    git rm --cached $Out" -ForegroundColor Red
    exit 1
}
$ignored = (git check-ignore -- $Out | Out-String).Trim()
if ($ignored) {
    Write-Host "  ok    git is ignoring it - it cannot reach the public repo" -ForegroundColor Green
} else {
    Write-Host "  WARNING: git is NOT ignoring $Out. Add '*.local.html' to .gitignore." -ForegroundColor Yellow
}

# also confirm the public file is still clean
$pub = [System.IO.File]::ReadAllText($srcPath)
if ($pub -match "var (FINNHUB_KEY|AI_KEY)\s*=\s*'[^']+';") {
    Write-Host "  DANGER: stock.html itself now contains a key. Undo that before pushing." -ForegroundColor Red
    exit 1
} else {
    Write-Host "  ok    stock.html (the public one) is still key-free" -ForegroundColor Green
}

Write-Host ""
Write-Host "Send $Out to your users. They open it and everything works." -ForegroundColor Cyan
Write-Host "Re-run this after any change to stock.html." -ForegroundColor DarkGray
Write-Host ""
