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
set RUST_LOG=debug
set RUST_BACKTRACE=1
call npx tauri build --debug
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

:: Create debug readme for beta testers
echo DEBUGGING INSTRUCTIONS FOR BETA TESTERS > portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo ========================================= >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo. >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo This is a DEBUG version of SCORM Builder for troubleshooting. >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo. >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo HOW TO RUN: >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 1. Double-click launch-with-console.bat to run with debug output >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 2. OR double-click SCORM-Builder-Debug.exe to run normally >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo. >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo DEBUGGING FEATURES: >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 1. Press F12 in the app to open Developer Tools >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 2. Check the Console tab for JavaScript errors >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 3. Check the Network tab for failed resource loads >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 4. Console output is saved to debug-logs.txt >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo. >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo REPORTING ISSUES: >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 1. Run launch-with-console.bat when reproducing the issue >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 2. Include debug-logs.txt when reporting bugs >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 3. Include screenshots of any error messages >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo 4. Include F12 Developer Tools Console output if applicable >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt
echo. >> portable-build\SCORM-Builder-Debug\DEBUG-README.txt

:: Create a launcher that shows console output and captures logs
echo @echo off > portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo title SCORM Builder Debug Console >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo set RUST_LOG=debug >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo set RUST_BACKTRACE=1 >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo ===================================== >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo   SCORM Builder Debug Version >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo ===================================== >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Starting with debug logging enabled... >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Logs will be saved to debug-logs.txt >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Press Ctrl+C to force close if needed >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo. >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Starting at %%date%% %%time%% > debug-logs.txt >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo SCORM-Builder-Debug.exe 2^>^&1 ^| tee -a debug-logs.txt >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo. >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Application closed at %%date%% %%time%% >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Logs saved to debug-logs.txt >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo. >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo echo Press any key to exit... >> portable-build\SCORM-Builder-Debug\launch-with-console.bat
echo pause >> portable-build\SCORM-Builder-Debug\launch-with-console.bat

:: Create WebView debug enabler registry file
echo Creating WebView debug registry file...
echo Windows Registry Editor Version 5.00 > portable-build\SCORM-Builder-Debug\enable-webview-debug.reg
echo. >> portable-build\SCORM-Builder-Debug\enable-webview-debug.reg
echo [HKEY_CURRENT_USER\Software\Policies\Microsoft\Edge\WebView2] >> portable-build\SCORM-Builder-Debug\enable-webview-debug.reg
echo "DeveloperToolsEnabled"=dword:00000001 >> portable-build\SCORM-Builder-Debug\enable-webview-debug.reg
echo "AdditionalBrowserArguments"="--enable-logging --v=1" >> portable-build\SCORM-Builder-Debug\enable-webview-debug.reg

:: Create a simple launcher script for WebView debugging
echo @echo off > portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo echo Enabling enhanced WebView debugging... >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo echo This will modify Windows registry to enable WebView2 developer tools. >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo echo. >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo echo Press any key to continue or Ctrl+C to cancel... >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo pause >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo regedit /s enable-webview-debug.reg >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo echo. >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo echo Enhanced debugging enabled! Restart the app for changes to take effect. >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat
echo pause >> portable-build\SCORM-Builder-Debug\enable-enhanced-debugging.bat

echo.
echo ============================================
echo   Debug Build Complete!
echo ============================================
echo.
echo DEBUG FILES CREATED:
echo - SCORM-Builder-Debug.exe           (Main debug executable)
echo - launch-with-console.bat           (Run with console + log capture)
echo - DEBUG-README.txt                  (Instructions for beta testers)
echo - enable-enhanced-debugging.bat     (Enable WebView2 advanced debugging)
echo - enable-webview-debug.reg          (Registry file for WebView2 debugging)
echo.
echo FOR BETA TESTERS:
echo 1. Read DEBUG-README.txt for full instructions
echo 2. Use launch-with-console.bat for best debugging
echo 3. Logs are saved to debug-logs.txt automatically
echo 4. Press F12 in app for JavaScript debugging
echo 5. Run enable-enhanced-debugging.bat for advanced WebView debugging
echo.
echo FOR DEVELOPERS:
echo - Debug symbols included for detailed crash reports
echo - Source maps enabled for readable stack traces
echo - Rust debug logging enabled (RUST_LOG=debug)
echo - WebView2 developer tools available
echo.
pause