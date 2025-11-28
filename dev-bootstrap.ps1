<#
 Dev bootstrap helper (PowerShell)
 Runs full stack bootstrap then health check.
 Usage:  ./dev-bootstrap.ps1  (from repo root)
#>

Write-Host "[dev-bootstrap] Starting" -ForegroundColor Cyan

if (-Not (Test-Path .env)) {
  Write-Host "[dev-bootstrap] Creating .env from config/env.example" -ForegroundColor Yellow
  Copy-Item config/env.example .env
}

if (-Not (Test-Path node_modules)) {
  Write-Host "[dev-bootstrap] Installing npm dependencies" -ForegroundColor Yellow
  npm install
}

Write-Host "[dev-bootstrap] Running npm bootstrap:dev" -ForegroundColor Cyan
npm run bootstrap:dev

Write-Host "[dev-bootstrap] Running dev:check" -ForegroundColor Cyan
npm run dev:check

Write-Host "[dev-bootstrap] Complete" -ForegroundColor Green
