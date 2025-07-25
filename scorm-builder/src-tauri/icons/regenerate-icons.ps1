# PowerShell script to regenerate icons properly
# Run this with: powershell -ExecutionPolicy Bypass -File regenerate-icons.ps1

Write-Host "Regenerating Tauri icons from original PNG..."

# Check if ImageMagick is available
$magickPath = Get-Command "magick.exe" -ErrorAction SilentlyContinue
if (-not $magickPath) {
    Write-Host "ImageMagick not found. Please install ImageMagick:"
    Write-Host "1. Download from: https://imagemagick.org/script/download.php#windows"
    Write-Host "2. Install and add to PATH"
    Write-Host "3. Restart terminal and try again"
    exit 1
}

# Check if original PNG exists
if (-not (Test-Path "original-app-icon.png")) {
    Write-Host "Error: original-app-icon.png not found!"
    Write-Host "Please save the PNG icon as 'original-app-icon.png' in this directory"
    exit 1
}

# Generate icons
Write-Host "Generating 32x32.png..."
& magick.exe "original-app-icon.png" -resize 32x32 "32x32.png"

Write-Host "Generating 128x128.png..."
& magick.exe "original-app-icon.png" -resize 128x128 "128x128.png"

Write-Host "Generating 128x128@2x.png (256x256)..."
& magick.exe "original-app-icon.png" -resize 256x256 "128x128@2x.png"

Write-Host "Generating icon.png (512x512)..."
& magick.exe "original-app-icon.png" -resize 512x512 "icon.png"

Write-Host "Generating icon.ico (Windows)..."
& magick.exe "original-app-icon.png" -resize 256x256 "icon.ico"

Write-Host "Creating icon.icns (macOS) from PNG..."
Copy-Item "icon.png" "icon.icns"

Write-Host "All icons generated successfully!"
Write-Host "Now rebuild the Tauri application with: npm run tauri build"