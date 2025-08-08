@echo off
:: This launcher ensures build-portable.bat runs in proper CMD context
:: Use this when running from PowerShell: .\run-portable-build.cmd
:: Or with fresh flag: .\run-portable-build.cmd --fresh

cmd /c "%~dp0build-portable.bat" %*