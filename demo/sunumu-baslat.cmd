@echo off
rem Sunumatik demo destesini yerel sunucuyla acar.
rem Tarayicilar file:// altinda ES modullerini engelledigi icin sunucu sart.
rem Port 8790 doluysa 8795 denenir; hata olursa pencere ACIK KALIR.
setlocal
cd /d "%~dp0.."

set "PY=python"
where python >nul 2>nul || set "PY=py"

set "PORT=8790"
netstat -an | findstr /c":%PORT% " | findstr LISTENING >nul && set "PORT=8795"

start "" http://localhost:%PORT%/demo/index.html
echo Sunucu basliyor: http://localhost:%PORT%/demo/index.html
echo Kapatmak icin bu pencerede Ctrl+C.
%PY% -m http.server %PORT%

echo.
echo Sunucu beklenmedik sekilde durdu. Olasi nedenler:
echo  - %PORT% portu baska bir uygulamada acik
echo  - Python kurulu degil (python.org'dan kurun)
pause
