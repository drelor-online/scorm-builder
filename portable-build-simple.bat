@echo off
setlocal

REM Simple portable build script that leaves running Node processes alone
set "FRONTEND_ONLY=0"
if /I "%~1"=="--frontend-only" set "FRONTEND_ONLY=1"

echo ============================================
if "%FRONTEND_ONLY%"=="1" (
  echo   SCORM Builder - Frontend Build
) else (
  echo   SCORM Builder - Portable Build
)
echo ============================================

echo.
echo Preparing workspace...
if not exist portable-build mkdir portable-build >nul 2>&1
if not exist portable-build\SCORM-Builder-Portable mkdir portable-build\SCORM-Builder-Portable >nul 2>&1

pushd scorm-builder >nul 2>&1
if errorlevel 1 (
  echo ERROR: Unable to enter scorm-builder directory
  exit /b 1
)

if exist dist rmdir /s /q dist
if exist src-tauri\target\release\scorm-builder.exe del /q src-tauri\target\release\scorm-builder.exe >nul 2>&1

REM Install dependencies if needed
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed
    popd
    exit /b 1
  )
)

echo.
echo Building frontend bundle...
call npm run build
if errorlevel 1 (
  echo ERROR: Frontend build failed
  popd
  exit /b 1
)

if "%FRONTEND_ONLY%"=="0" (
  echo.
  echo Building Tauri shell...
  call npx tauri build --no-bundle
  if errorlevel 1 (
    echo ERROR: Tauri build failed
    popd
    exit /b 1
  )
) else (
  echo Skipping Tauri build (frontend only mode)
)

set "BUILT_EXE=src-tauri\target\release\scorm-builder.exe"
popd >nul

echo.
if "%FRONTEND_ONLY%"=="0" (
  if exist "scorm-builder\%BUILT_EXE%" (
    copy /y "scorm-builder\%BUILT_EXE%" "portable-build\SCORM-Builder-Portable\SCORM-Builder.exe" >nul
    echo Portable executable copied to portable-build\SCORM-Builder-Portable\
  ) else (
    echo WARNING: No executable found at scorm-builder\%BUILT_EXE%
  )
) else (
  echo Frontend assets available under scorm-builder\dist\
  if exist "scorm-builder\%BUILT_EXE%" (
    echo Existing executable remains untouched.
  )
)

echo.
echo Build complete.
echo ============================================
exit /b 0
