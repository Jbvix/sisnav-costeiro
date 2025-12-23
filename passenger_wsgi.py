import sys
import os
from flask import Flask, send_from_directory, jsonify

# Define o diretório raiz da aplicação forçosamente
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(SCRIPT_DIR)

# Tenta importar os coletores
try:
    from scraping_weather import WeatherCollector
    from scraping_tide import TideDataCollector
except ImportError:
    WeatherCollector = None
    TideDataCollector = None

app = Flask(__name__)

@app.route('/')
def home():
    # Serve o index.html usando caminho absoluto
    return send_from_directory(SCRIPT_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Proteção: Se o cPanel mandar o caminho 'sisnav/css/...' removemos o 'sisnav/'
    if path.startswith('sisnav/'):
        path = path.replace('sisnav/', '', 1)
    
    # Serve arquivos usando caminho absoluto
    return send_from_directory(SCRIPT_DIR, path)

@app.route('/status')
def status():
    return jsonify({
        "status": "online",
        "message": "SISNAV Costeiro rodando via Python/Flask!",
        "cwd": os.getcwd(),
        "script_dir": SCRIPT_DIR
    })

application = app
