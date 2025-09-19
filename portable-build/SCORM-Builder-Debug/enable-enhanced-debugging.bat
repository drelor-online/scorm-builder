@echo off 
echo Enabling enhanced WebView debugging... 
echo This will modify Windows registry to enable WebView2 developer tools. 
echo. 
echo Press any key to continue or Ctrl+C to cancel... 
pause 
regedit /s enable-webview-debug.reg 
echo. 
echo Enhanced debugging enabled! Restart the app for changes to take effect. 
pause 
