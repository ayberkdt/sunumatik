@echo off
rem Sunumatik demo destesini ONBELLEKSIZ yerel sunucuyla acar.
rem (Tarayicilar file:// altinda ES modullerini engeller; ayrica duz http.server
rem  onbellek basligi gondermedigi icin eski sayfalar ekranda kalabiliyordu.)
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "PY=python"
where python >nul 2>nul || set "PY=py"

set "PORT=8790"
netstat -an | findstr /c":8790 " | findstr LISTENING >nul && set "PORT=8795"
netstat -an | findstr /c":!PORT! " | findstr LISTENING >nul && set "PORT=8798"

start "" "http://localhost:!PORT!/demo/index.html"
echo Sunucu basliyor (onbelleksiz): http://localhost:!PORT!/demo/index.html
echo Kapatmak icin bu pencerede Ctrl+C.
%PY% serve.py !PORT!

echo.
echo Sunucu beklenmedik sekilde durdu (port dolu ya da Python yok).
pause
