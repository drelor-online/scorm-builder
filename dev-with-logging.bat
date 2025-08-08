@echo off
echo ============================================
echo   SCORM Builder - Dev Mode with Logging
echo ============================================
echo.

cd scorm-builder
if errorlevel 1 (
    echo ERROR: Failed to navigate to scorm-builder directory
    exit /b 1
)

:: Set environment variables for enhanced logging
echo Setting up enhanced logging...
set RUST_LOG=debug
set RUST_BACKTRACE=1
set NODE_ENV=development
:: Removed DEBUG=* to avoid Babel transpiler noise
:: Use app-specific logging instead via logger categories

:: For Tauri-specific logging
set WEBKIT_DISABLE_COMPOSITING_MODE=1

echo.
echo Logging Configuration:
echo - Rust: DEBUG level
echo - Node: Development mode
echo - Backtrace: Enabled
echo.

:: Kill any running instances
echo Closing any running instances...
taskkill /F /IM scorm-builder.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting development mode with verbose logging...
echo.
echo ============================================
echo   Logs will appear in:
echo   - Console (Rust backend)
echo   - Browser DevTools (Frontend)
echo   - Debug Panel (In-app)
echo   
echo   To open DevTools:
echo   - Right-click in app
echo   - Select "Inspect Element"
echo   OR press F12
echo ============================================
echo.

npm run tauri:dev