@echo off
echo ===================================================
echo SISNAV COSTEIRO - ATUALIZADOR DE DADOS
echo ===================================================
echo.
echo 1. Atualizando Base de Mares (rebuild_csv.py)...
python rebuild_csv.py
echo.
echo 2. Atualizando Base Meteorologica (update_weather_batch.py)...
python update_weather_batch.py
echo.
echo ===================================================
echo ATUALIZACAO CONCLUIDA!
echo Os arquivos tides_scraped.csv e weather_scraped.csv foram renovados.
echo Voce pode fechar esta janela.
echo ===================================================
pause
