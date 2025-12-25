from flask import Flask, send_from_directory, jsonify, Response, safe_join
import os
import sys
import logging
import json
import time

# Import scripts (Ensure they are clean/modular)
try:
    import rebuild_csv
    import update_weather_batch
except ImportError as e:
    print(f"Warning: Update scripts not found: {e}")

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Serve Static Files (Default)
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Security: Ensure path is within current directory
    return send_from_directory('.', path)

@app.route('/api/update-data', methods=['POST'])
def update_data():
    def generate():
        yield f"data: {json.dumps({'status': 'Iniciando atualização...', 'progress': 5})}\n\n"
        
        try:
            # 1. Tides
            yield f"data: {json.dumps({'status': 'Baixando Marés (Base Nacional)...', 'progress': 20})}\n\n"
            # Redirect stdout to capture logs? Or just run blind?
            # ideally modify rebuild_csv to yield progress, but for now blocking call
            rebuild_csv.run() 
            yield f"data: {json.dumps({'status': 'Marés Atualizadas!', 'progress': 50})}\n\n"

            # 2. Weather
            yield f"data: {json.dumps({'status': 'Baixando Meteorologia (18 Portos)...', 'progress': 60})}\n\n"
            update_weather_batch.run()
            yield f"data: {json.dumps({'status': 'Meteorologia Atualizada!', 'progress': 90})}\n\n"

            yield f"data: {json.dumps({'status': 'Conuído!', 'progress': 100})}\n\n"
            
        except Exception as e:
            logger.error(f"Update Error: {e}")
            yield f"data: {json.dumps({'status': f'Erro: {str(e)}', 'progress': 0, 'error': True})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    print("="*60)
    print(" SISNAV COSTEIRO - SERVIDOR LOCAL")
    print(" Acesso: http://localhost:5000")
    print("="*60)
    app.run(host='0.0.0.0', port=5000, debug=True)
