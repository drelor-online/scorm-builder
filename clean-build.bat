@echo off
setlocal

echo ============================================
echo   SCORM Builder - Complete Clean Build
echo ============================================
echo.
echo This script performs a complete clean build by:
echo   - Removing ALL caches and dependencies
echo   - Fresh install of all packages
echo   - Complete rebuild from source
echo.
echo Press Ctrl+C to cancel, or
pause

:: Get current directory
set "PROJECT_ROOT=%cd%"
set "BUILD_DIR=%PROJECT_ROOT%\scorm-builder"

:: Navigate to project directory
cd /d "%BUILD_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to navigate to project directory: %BUILD_DIR%
    exit /b 1
)

:: Remove ALL caches and build artifacts
echo.
echo Step 1: Removing all caches and build artifacts...
echo.

echo   - Removing node_modules...
if exist "node_modules" rmdir /s /q "node_modules"

echo   - Removing dist folder...
if exist "dist" rmdir /s /q "dist"

echo   - Removing .vite cache...
if exist ".vite" rmdir /s /q ".vite"

echo   - Removing .vite-temp cache...
if exist ".vite-temp" rmdir /s /q ".vite-temp"

echo   - Removing node_modules\.vite cache...
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"

echo   - Removing node_modules\.cache...
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

echo   - Removing .turbo cache...
if exist ".turbo" rmdir /s /q ".turbo"

echo   - Removing .parcel-cache...
if exist ".parcel-cache" rmdir /s /q ".parcel-cache"

echo   - Removing Tauri target folder...
if exist "src-tauri\target" rmdir /s /q "src-tauri\target"

echo   - Removing Tauri cache...
if exist "src-tauri\.tauri" rmdir /s /q "src-tauri\.tauri"

echo.
echo [OK] All caches and artifacts removed

:: Fresh install of dependencies
echo.
echo Step 2: Fresh install of dependencies...
echo   - This may take several minutes...
echo.
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [OK] Dependencies installed

:: Build frontend
echo.
echo Step 3: Building frontend...
echo   - Compiling TypeScript...
echo   - Bundling assets...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build frontend
    exit /b 1
)

:: Verify build
echo.
echo Step 4: Verifying build...
if exist "dist\index.html" (
    echo   [OK] index.html created
) else (
    echo   [ERROR] index.html not found
    exit /b 1
)

if exist "dist\assets\*.js" (
    echo   [OK] JavaScript bundles created
) else (
    echo   [WARNING] No JavaScript files found in dist/assets
)

:: Build complete
echo.

:: Success message
echo.
echo ============================================
echo   Clean Build Complete!
echo ============================================
echo.
echo The application has been completely rebuilt from source.
echo All caches were cleared and dependencies reinstalled.
echo.
echo Next steps:
echo   1. Test the application locally: npm run tauri dev
echo   2. Build portable version: build-portable.bat
echo   3. Build installer: npm run tauri build
echo.

:: Return to original directory
cd /d "%PROJECT_ROOT%"

endlocal
pause