@echo off
echo ============================================
echo   SCORM Builder - Clean Dev Mode Start
echo ============================================
echo.

cd scorm-builder
if errorlevel 1 (
    echo ERROR: Failed to navigate to scorm-builder directory
    exit /b 1
)

:: Kill any running instances
echo Closing any running instances...
taskkill /F /IM scorm-builder.exe 2>nul
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*vite*'} | Stop-Process -Force" 2>nul
timeout /t 2 /nobreak >nul

:: Clear caches for fresh start
echo Clearing caches...
if exist node_modules\.vite (
    rmdir /s /q node_modules\.vite
    echo - Cleared .vite cache
)
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo - Cleared .cache
)
if exist .vite (
    rmdir /s /q .vite
    echo - Cleared local .vite
)

:: Clear Rust target cache if needed (optional, commented out by default)
:: echo Clearing Rust debug cache...
:: if exist src-tauri\target\debug\.fingerprint rmdir /s /q src-tauri\target\debug\.fingerprint

echo.
echo Starting development mode with clean caches...
echo.
echo ============================================
echo   Frontend: http://localhost:1420
echo   
echo   Hot Reload: Enabled
echo   - Frontend changes: Instant
echo   - Rust changes: Restart required
echo   
echo   Press Ctrl+C to stop
echo ============================================
echo.

npm run tauri:dev