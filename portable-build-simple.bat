@echo off
setlocal

:: Check for --frontend-only flag
set FRONTEND_ONLY=0
if "%1"=="--frontend-only" set FRONTEND_ONLY=1

echo ============================================
if %FRONTEND_ONLY%==1 (
    echo   SCORM Builder - Frontend Build Only
) else (
    echo   SCORM Builder - Portable Build (Simple)
)
echo ============================================
echo.

:: Kill any processes that might lock files
echo Killing any blocking processes...
powershell -Command "Get-Process node, esbuild -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" 2>nul
timeout /t 2 /nobreak >nul

:: Clean previous portable build (skip for frontend-only)
if %FRONTEND_ONLY%==0 (
    if exist portable-build rmdir /s /q portable-build
    mkdir portable-build
)

:: Navigate to build directory
cd scorm-builder
if errorlevel 1 (
    echo ERROR: Failed to navigate to scorm-builder directory
    exit /b 1
)

:: Clean caches
echo Clearing build caches...
if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist node_modules\.cache rmdir /s /q node_modules\.cache  
if exist .vite rmdir /s /q .vite
if exist .vite-temp rmdir /s /q .vite-temp
if exist dist rmdir /s /q dist
:: Only clean Tauri target for full builds
if %FRONTEND_ONLY%==0 (
    if exist src-tauri\target\release rmdir /s /q src-tauri\target\release
)

:: Install dependencies
echo.
echo Installing dependencies...
call npm ci
if errorlevel 1 (
    echo WARNING: npm ci failed, trying npm install...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        exit /b 1
    )
)

:: Build frontend
echo.
echo Building frontend...
call npx tsc
if errorlevel 1 (
    echo ERROR: TypeScript compilation failed
    exit /b 1
)

call npx vite build
if errorlevel 1 (
    echo ERROR: Vite build failed
    exit /b 1
)

:: Build Tauri (skip if frontend-only)
if %FRONTEND_ONLY%==0 (
    echo.
    echo Building Tauri application...
    call npx tauri build --no-bundle
    if errorlevel 1 (
        echo ERROR: Tauri build failed
        exit /b 1
    )
) else (
    echo.
    echo Skipping Tauri build - frontend only mode
)

:: Copy to portable folder
echo.
echo Creating portable distribution...
cd ..

:: Only create folder and copy if exe exists
if exist scorm-builder\src-tauri\target\release\scorm-builder.exe (
    if not exist portable-build\SCORM-Builder-Portable mkdir portable-build\SCORM-Builder-Portable
    copy scorm-builder\src-tauri\target\release\scorm-builder.exe portable-build\SCORM-Builder-Portable\SCORM-Builder.exe
    if errorlevel 1 (
        echo ERROR: Failed to copy executable
        exit /b 1
    )
) else (
    if %FRONTEND_ONLY%==1 (
        echo.
        echo WARNING: No Tauri executable found.
        echo Run without --frontend-only flag to build the full application first.
        echo Frontend has been rebuilt successfully.
    ) else (
        echo ERROR: Build output not found at scorm-builder\src-tauri\target\release\scorm-builder.exe
        exit /b 1
    )
)

:: Copy DLLs if they exist
if exist scorm-builder\src-tauri\target\release\*.dll (
    copy scorm-builder\src-tauri\target\release\*.dll portable-build\SCORM-Builder-Portable\
)

echo.
echo ============================================
if %FRONTEND_ONLY%==1 (
    echo   Frontend Build Complete!
    echo ============================================
    if exist portable-build\SCORM-Builder-Portable\SCORM-Builder.exe (
        echo Portable app: portable-build\SCORM-Builder-Portable\SCORM-Builder.exe
        echo Run the existing executable to test frontend changes.
    ) else (
        echo Frontend built to: scorm-builder\dist\
        echo Note: No portable executable found. Run without --frontend-only to create one.
    )
) else (
    echo   Build Complete!
    echo ============================================
    echo Portable build: portable-build\SCORM-Builder-Portable\
)
echo.
pause