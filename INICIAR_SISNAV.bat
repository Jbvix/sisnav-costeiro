@echo off
echo ===================================================
echo SISNAV COSTEIRO - INICIANDO SERVIDOR
echo ===================================================
echo.
echo 1. Iniciando servidor local (v3.4)...
echo 2. O navegador sera aberto automaticamente.
echo.
echo IMPORTANTE: Nao feche esta janela preta enquanto usar o app.
echo.

start "" "http://localhost:5000"
python server.py

pause
