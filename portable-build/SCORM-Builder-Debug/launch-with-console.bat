@echo off 
title SCORM Builder Debug Console 
set RUST_LOG=debug 
set RUST_BACKTRACE=1 
echo ===================================== 
echo   SCORM Builder Debug Version 
echo ===================================== 
echo Starting with debug logging enabled... 
echo Logs will be saved to debug-logs.txt 
echo Press Ctrl+C to force close if needed 
echo. 
echo Starting at %date% %time% 
SCORM-Builder-Debug.exe 2>&1 | tee -a debug-logs.txt 
echo. 
echo Application closed at %date% %time% 
echo Logs saved to debug-logs.txt 
echo. 
echo Press any key to exit... 
pause 
