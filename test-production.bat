@echo off
setlocal enabledelayedexpansion

:: Test Production Build Script
:: Enables fast frontend testing with production exe

set FRONTEND_BUILD=1
set FULL_BUILD=0
set EXE_PATH=scorm-builder\src-tauri\target\release\scorm-builder.exe

:: Parse command line arguments
:parse_args
if "%1"=="" goto :end_parse
if "%1"=="--skip-build" (
    set FRONTEND_BUILD=0
    shift
    goto :parse_args
)
if "%1"=="--full-build" (
    set FULL_BUILD=1
    shift
    goto :parse_args
)
if "%1"=="--help" (
    goto :show_help
)
shift
goto :parse_args
:end_parse

echo ============================================
echo   SCORM Builder - Production Testing
echo ============================================
echo.

:: Check if release exe exists
if not exist "%EXE_PATH%" (
    echo Release exe not found at %EXE_PATH%
    echo.
    if %FULL_BUILD%==0 (
        echo Run with --full-build flag to create it:
        echo   test-production.bat --full-build
        echo.
        echo Or run a full Tauri build first:
        echo   cd scorm-builder
        echo   npm run tauri:build
        exit /b 1
    ) else (
        echo Will perform full build first...
        set FULL_BUILD=1
    )
)

cd scorm-builder
if errorlevel 1 (
    echo ERROR: Failed to navigate to scorm-builder directory
    exit /b 1
)

:: Kill any running instances
echo Closing any running instances...
taskkill /F /IM scorm-builder.exe 2>nul
timeout /t 1 /nobreak >nul

:: Full build if requested or required
if %FULL_BUILD%==1 (
    echo.
    echo ============================================
    echo   Performing Full Tauri Build
    echo   This will take several minutes...
    echo ============================================
    echo.
    
    :: Clean caches for fresh build
    if exist node_modules\.vite rmdir /s /q node_modules\.vite
    if exist dist rmdir /s /q dist
    
    :: Build frontend
    echo Building frontend...
    call npm run build
    if errorlevel 1 (
        echo ERROR: Frontend build failed
        exit /b 1
    )
    
    :: Build Tauri (no bundle for speed)
    echo.
    echo Building Tauri release exe...
    call npx tauri build --no-bundle
    if errorlevel 1 (
        echo ERROR: Tauri build failed
        exit /b 1
    )
    
    echo.
    echo Full build complete!
    echo.
)

:: Frontend rebuild if not skipped
if %FRONTEND_BUILD%==1 (
    echo Building frontend...
    call npm run build
    if errorlevel 1 (
        echo ERROR: Frontend build failed
        exit /b 1
    )
    echo Frontend build complete!
    echo.
)

:: Run the release exe
echo ============================================
echo   Launching Production Build
echo ============================================
echo.
echo Starting: %EXE_PATH%
echo.
echo NOTE: This exe should use the dist/ folder in:
echo   %CD%\dist
echo.
echo If frontend changes aren't reflected, the exe
echo may be using embedded resources. In that case,
echo use --full-build to rebuild with new frontend.
echo.
echo Press Ctrl+C to stop the application
echo ============================================
echo.

:: Start the exe from the current directory so it finds dist/
start "" src-tauri\target\release\scorm-builder.exe

echo Application launched!
echo.
echo To test frontend changes:
echo   1. Make your changes
echo   2. Close the app
echo   3. Run: test-production.bat
echo.
echo For faster restarts without rebuild:
echo   test-production.bat --skip-build
echo.

goto :end

:show_help
echo.
echo SCORM Builder - Production Testing Script
echo.
echo Usage: test-production.bat [options]
echo.
echo Options:
echo   --skip-build    Skip frontend rebuild, just run exe
echo   --full-build    Perform full Tauri build (slow)
echo   --help          Show this help message
echo.
echo Default behavior:
echo   - Rebuilds frontend (fast)
echo   - Runs existing release exe
echo   - Exe uses external dist/ folder for testing
echo.
echo First time setup:
echo   test-production.bat --full-build
echo.
echo Normal testing:
echo   test-production.bat
echo.
echo Quick restart:
echo   test-production.bat --skip-build
echo.

:end
endlocal