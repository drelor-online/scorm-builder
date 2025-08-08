@echo off
echo ============================================
echo   Frontend Mode Checker
echo ============================================
echo.
echo This script helps determine if the release exe
echo uses external dist/ or embedded resources.
echo.

cd scorm-builder
if errorlevel 1 (
    echo ERROR: Failed to navigate to scorm-builder directory
    exit /b 1
)

:: Check if release exe exists
if not exist src-tauri\target\release\scorm-builder.exe (
    echo ERROR: Release exe not found!
    echo Run 'test-production.bat --full-build' first
    exit /b 1
)

:: Check if dist exists
if not exist dist\index.html (
    echo ERROR: dist folder not found or empty!
    echo Run 'npm run build' first
    exit /b 1
)

echo Test Instructions:
echo ==========================================
echo.
echo 1. The script will add a visible marker to index.html
echo 2. Run the release exe
echo 3. If you see "TEST MARKER" in the title bar,
echo    the exe uses EXTERNAL dist (good for testing!)
echo 4. If not, it uses EMBEDDED resources (need full rebuild)
echo.
pause

:: Backup original index.html
copy dist\index.html dist\index.html.backup >nul

:: Add test marker to title
powershell -Command "(Get-Content dist\index.html) -replace '<title>.*</title>', '<title>TEST MARKER - SCORM Builder</title>' | Set-Content dist\index.html"

echo.
echo Marker added to dist\index.html
echo.
echo Starting release exe...
echo Look for "TEST MARKER" in the window title!
echo.

start "" src-tauri\target\release\scorm-builder.exe

echo.
echo Press any key after checking the title bar...
pause >nul

:: Restore original
move /Y dist\index.html.backup dist\index.html >nul

echo.
echo Original index.html restored.
echo.
echo Results:
echo --------
echo If you saw "TEST MARKER" in the title:
echo   ✓ Exe uses EXTERNAL dist - perfect for testing!
echo   ✓ Use test-production.bat for fast iteration
echo.
echo If you didn't see "TEST MARKER":
echo   ✗ Exe uses EMBEDDED resources
echo   ✗ Need --full-build for each change
echo   ✗ Consider using 'npm run tauri:dev' instead
echo.
pause