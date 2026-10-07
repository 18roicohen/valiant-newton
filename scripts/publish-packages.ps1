Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "          DYNEP MICRO-DAAS: PACKAGE PUBLISHING WIZARD" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. npm publish
Write-Host "[1/2] Checking npm status for 'dynep-spot' CLI..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\..\packages\cli"

$whoami = & npm.cmd whoami 2>$null
if (-not $whoami) {
    Write-Host "[npm] Not logged in. Please authenticate with npm:" -ForegroundColor Yellow
    & npm.cmd login
}

Write-Host "[npm] Publishing 'dynep-spot' to registry.npmjs.org..." -ForegroundColor Green
& npm.cmd publish --access public

Write-Host ""
# 2. PyPI publish
Write-Host "[2/2] Checking PyPI publication for 'dynep' Python SDK..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\..\packages\python-sdk"

if (-not $env:TWINE_PASSWORD) {
    $token = Read-Host "Enter your PyPI API Token (starts with pypi-...)"
    $env:TWINE_PASSWORD = $token
}

$env:TWINE_USERNAME = "__token__"
python -m twine upload dist/*

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "                      PUBLISHING FINISHED" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
