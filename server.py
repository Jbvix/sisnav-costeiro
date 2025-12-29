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
    import build_route_index # New
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

@app.route('/api/upload-gpx', methods=['POST'])
def upload_gpx():
    from flask import request
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file and file.filename.lower().endswith('.gpx'):
        try:
            # Save to gpx/ folder
            save_path = os.path.join(os.getcwd(), 'gpx', file.filename)
            file.save(save_path)
            
            # Rebuild Index
            gpx_dir = os.path.join(os.getcwd(), 'gpx')
            output_file = os.path.join(os.getcwd(), 'js', 'data', 'known_routes.json')
            
            # Capture output or just run?
            # We can mock the print or just trust it.
            build_route_index.build_index(gpx_dir, output_file)
            
            return jsonify({'status': 'OK', 'message': f'Rota {file.filename} adicionada e índice atualizado!'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
# In-Memory Storage for Multi-Vessel Fleet
# Format: { "VESSEL_ID": { "lat":..., "lon":..., "name":..., "updated":... } }
fleet_positions = {}

@app.route('/api/fleet', methods=['GET'])
def get_fleet():
    # Return list of active vessels (seen in last 24h)
    now = time.time()
    active_fleet = []
    for vid, data in fleet_positions.items():
        # Filter stale data (optional, e.g., > 24h)
        if now - data.get('timestamp', 0) < 86400:
             active_fleet.append({
                 "id": vid,
                 "name": data.get('name', vid),
                 "lat": data.get('lat'),
                 "lon": data.get('lon'),
                 "sog": data.get('sog'),
                 "last_seen": data.get('timestamp')
             })
    return jsonify(active_fleet)

@app.route('/api/position', methods=['GET', 'POST'])
def handle_position():
    global fleet_positions
    
    if request.method == 'POST':
        # AUTH: Simple PIN check (can be upgraded later)
        # For now, relying on obscure URL or known clients
        try:
            data = request.json
            vessel_id = data.get('id') # Unique ID (e.g. IMO or Name)
            
            if not vessel_id:
                return jsonify({"error": "Missing vessel ID"}), 400

            fleet_positions[vessel_id] = {
                "name": data.get('name', vessel_id),
                "lat": data.get('lat'),
                "lon": data.get('lon'),
                "sog": data.get('sog'),
                "cog": data.get('cog'),
                "timestamp": time.time()
            }
            return jsonify({"status": "success", "id": vessel_id}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    else: # GET
        # Get specific vessel
        vessel_id = request.args.get('id')
        if vessel_id:
            data = fleet_positions.get(vessel_id)
            if data:
                return jsonify(data)
            else:
                return jsonify({"error": "Vessel not found"}), 404
        else:
            return jsonify({"error": "Please specify vessel ID"}), 400


if __name__ == '__main__':
    print("="*60)
    print(" SISNAV COSTEIRO - SERVIDOR LOCAL")
    print(" Acesso: http://localhost:5000")
    print("="*60)
    app.run(host='0.0.0.0', port=5000, debug=True)
