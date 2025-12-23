import sys
import os
from flask import Flask, send_from_directory, jsonify

# Adiciona o diretório atual ao path para importar modulos locais
sys.path.append(os.getcwd())

# Tenta importar os coletores - usando try/except para evitar crash se os arquivos não estivem lá ainda
try:
    from scraping_weather import WeatherCollector
    from scraping_tide import TideDataCollector
except ImportError:
    WeatherCollector = None
    TideDataCollector = None

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def home():
    # Serve o index.html na raiz
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Serve qualquer outro arquivo (CSS, JS, Imagens, CSVs)
    return send_from_directory('.', path)

# Rota especial para verificar se o app está rodando
@app.route('/status')
def status():
    return jsonify({"status": "online", "message": "SISNAV Costeiro está rodando via Python/Flask!"})

# Objeto application que o Passenger procura
application = app
