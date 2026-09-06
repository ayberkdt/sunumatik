@echo off
rem Sunumatik demo destesini Python gerektirmeden yerel sunucuyla acar.
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8790 -OpenPath "/demo/index.html"

if errorlevel 1 (
  echo.
  echo Sunucu beklenmedik sekilde durdu.
  pause
)
