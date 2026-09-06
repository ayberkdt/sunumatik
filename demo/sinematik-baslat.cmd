@echo off
rem Sinematik Uzay Sahnesi'ni Python gerektirmeden yerel sunucuyla acar.
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8790 -OpenPath "/presets/cinematic_space/index.html"

if errorlevel 1 (
  echo.
  echo Sunucu beklenmedik sekilde durdu.
  pause
)
