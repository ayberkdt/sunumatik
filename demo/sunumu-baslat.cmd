@echo off
rem Sunumatik demo destesini yerel sunucuyla acar.
rem Tarayicilar file:// altinda ES modullerini engelledigi icin sunucu sart.
cd /d "%~dp0.."
start "" http://localhost:8781/demo/index.html
python -m http.server 8781
