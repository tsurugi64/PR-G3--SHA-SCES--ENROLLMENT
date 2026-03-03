# Enrollment System - File Cleanup Script
# This script organizes non-functional files into separate folders for backup and cleanup

# Run this script from your project folder:
# powershell -ExecutionPolicy Bypass -File cleanup.ps1

Write-Host "====== SHA ENROLLMENT SYSTEM - FILE CLEANUP ======" -ForegroundColor Cyan
Write-Host ""

$projectPath = Get-Location
Write-Host "Project Path: $projectPath" -ForegroundColor Yellow

# Create folders
$extrasPath = Join-Path $projectPath "extras"
$docsPath = Join-Path $extrasPath "documentation"
$unusedHtmlPath = Join-Path $extrasPath "unused-html"

Write-Host ""
Write-Host "Creating folders..." -ForegroundColor Yellow

if (!(Test-Path $extrasPath)) {
    New-Item -ItemType Directory -Path $extrasPath | Out-Null
    Write-Host "[OK] Created: extras/" -ForegroundColor Green
}

if (!(Test-Path $docsPath)) {
    New-Item -ItemType Directory -Path $docsPath | Out-Null
    Write-Host "[OK] Created: extras/documentation/" -ForegroundColor Green
}

if (!(Test-Path $unusedHtmlPath)) {
    New-Item -ItemType Directory -Path $unusedHtmlPath | Out-Null
    Write-Host "[OK] Created: extras/unused-html/" -ForegroundColor Green
}

Write-Host ""
Write-Host "Moving documentation files..." -ForegroundColor Yellow

# Documentation files to move
$docFiles = @(
    "ARCHITECTURE.md",
    "AUDIT_SUMMARY.md", 
    "COMPLETE_REFERENCE.md",
    "DATABASE_SETUP.md",
    "DEPLOYMENT_GUIDE.md",
    "FINAL_REPORT.md",
    "QUICK_START.md",
    "README.md",
    "SYSTEM_REVIEW.md",
    "TESTING_GUIDE.md",
    "URL_REPLACEMENT_GUIDE.md",
    "VERIFICATION_UPDATES.md",
    "ONLINE_SETUP.md"
)

foreach ($file in $docFiles) {
    $filePath = Join-Path $projectPath $file
    if (Test-Path $filePath) {
        Move-Item -Path $filePath -Destination $docsPath -Force
        Write-Host "  [MOVE] $file"
    }
}

Write-Host ""
Write-Host "Moving unused HTML files..." -ForegroundColor Yellow

# Unused HTML files to move
$htmlFiles = @(
    "index.html",
    "Home.html",
    "SHS Program.html",
    "verification.html",
    "verify-code.html"
)

foreach ($file in $htmlFiles) {
    $filePath = Join-Path $projectPath $file
    if (Test-Path $filePath) {
        Move-Item -Path $filePath -Destination $unusedHtmlPath -Force
        Write-Host "  [MOVE] $file"
    }
}

Write-Host ""
Write-Host "Removing empty/broken files..." -ForegroundColor Yellow

# Files to delete (empty or broken)
$deleteFiles = @(
    "app.js"
)

foreach ($file in $deleteFiles) {
    $filePath = Join-Path $projectPath $file
    if (Test-Path $filePath) {
        Remove-Item -Path $filePath -Force
        Write-Host "  [DELETE] $file"
    }
}

Write-Host ""
Write-Host "====== CLEANUP COMPLETE ======" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  [DOCS] extras/documentation/ - 13 documentation files" -ForegroundColor White
Write-Host "  [HTML] extras/unused-html/   - 5 unused HTML files" -ForegroundColor White
Write-Host "  [DEL]  Deleted               - 1 empty file" -ForegroundColor White
Write-Host ""
Write-Host "Your project is now clean!" -ForegroundColor Green
Write-Host ""
