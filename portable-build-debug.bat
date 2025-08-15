@echo off
setlocal

echo ============================================
echo   SCORM Builder - Debug Portable Build
echo ============================================
echo.

:: Kill any processes that might lock files
echo Killing any blocking processes...
powershell -Command "Get-Process node, esbuild -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" 2>nul
timeout /t 2 /nobreak >nul

:: Clean previous portable build
if exist portable-build rmdir /s /q portable-build
mkdir portable-build

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
if exist src-tauri\target\release rmdir /s /q src-tauri\target\release
if exist src-tauri\target\debug rmdir /s /q src-tauri\target\debug

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

:: Build frontend with debug settings
echo.
echo Building frontend with debug enabled...
call npx tsc
if errorlevel 1 (
    echo ERROR: TypeScript compilation failed
    exit /b 1
)

:: Build with source maps and minimal minification for debugging
set VITE_BUILD_SOURCEMAP=true
call npx vite build --sourcemap --minify false
if errorlevel 1 (
    echo ERROR: Vite build failed
    exit /b 1
)

:: Show built files for debugging
echo.
echo Built assets:
dir dist\assets\*.js /b
echo.

:: Build Tauri in debug mode with console window
echo.
echo Building Tauri application in debug mode...
call npx tauri build --no-bundle --debug
if errorlevel 1 (
    echo ERROR: Tauri debug build failed
    exit /b 1
)

:: Copy to portable folder
echo.
echo Creating portable debug distribution...
cd ..

:: Copy debug executable
if exist scorm-builder\src-tauri\target\debug\scorm-builder.exe (
    if not exist portable-build\SCORM-Builder-Debug mkdir portable-build\SCORM-Builder-Debug
    copy scorm-builder\src-tauri\target\debug\scorm-builder.exe portable-build\SCORM-Builder-Debug\SCORM-Builder-Debug.exe
    if errorlevel 1 (
        echo ERROR: Failed to copy debug executable
        exit /b 1
    )
) else (
    echo ERROR: Debug build output not found at scorm-builder\src-tauri\target\debug\scorm-builder.exe
    exit /b 1
)

:: Copy DLLs if they exist
if exist scorm-builder\src-tauri\target\debug\*.dll (
    copy scorm-builder\src-tauri\target\debug\*.dll portable-build\SCORM-Builder-Debug\
)

:: Create a launcher that shows console output
echo @echo off > portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Starting SCORM Builder Debug Version... >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Press Ctrl+C to close if application hangs >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo. >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo SCORM-Builder-Debug.exe >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo. >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Application closed. Press any key to exit... >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo pause >> portable-build\SCORM-Builder-Debug\launch-with-console.bat

echo.
echo ============================================
echo   Debug Build Complete!
echo ============================================
echo Debug executable: portable-build\SCORM-Builder-Debug\SCORM-Builder-Debug.exe
echo Console launcher: portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo.
echo DEBUGGING TIPS:
echo 1. Run launch-with-console.bat to see any error messages
echo 2. Press F12 in the app to open developer tools
echo 3. Check the console tab for JavaScript errors
echo 4. Check the Network tab for failed resource loads
echo.
pause