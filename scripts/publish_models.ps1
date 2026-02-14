
# Publish Models to Railway via GitHub
# Usage: .\scripts\publish_models.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Model Publish Workflow..." -ForegroundColor Cyan

# 1. Check if models exist
$ModelDir = "ml_service/models"
if (-not (Test-Path $ModelDir)) {
    Write-Error "❌ Model directory not found: $ModelDir"
}

# 2. Add models to git
Write-Host "📦 Staging model files..." -ForegroundColor Yellow
git add ml_service/models/*.pkl
git add ml_service/models/scaler.pkl

# 3. Check status
$status = git status --porcelain ml_service/models/
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ No model changes detected. Nothing to push." -ForegroundColor Green
    exit
}

# 4. Commit using a standard message
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$commitMsg = "🤖 Model Update: $timestamp"
Write-Host "📝 Committing: $commitMsg" -ForegroundColor Yellow
git commit -m "$commitMsg"

# 5. Push to GitHub (triggers Railway deploy)
Write-Host "🚀 Pushing to GitHub (this will trigger Railway build)..." -ForegroundColor Cyan
git push origin main

Write-Host "✅ Done! Railway should be building the new ML Service now." -ForegroundColor Green
Write-Host "   Check status at: https://railway.app/project/..." -ForegroundColor Gray
