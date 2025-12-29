from flask import Flask, send_from_directory, jsonify, Response
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
            
# File-Based Persistence (Solves Multi-Process/Worker Sync on cPanel)
FLEET_FILE = os.path.join(os.getcwd(), 'fleet_data.json')

def load_fleet_data():
    try:
        if os.path.exists(FLEET_FILE):
            with open(FLEET_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading fleet data: {e}")
    return {}

def save_fleet_data(data):
    try:
        # Atomic Write (Write to temp then rename) prevents corruption
        temp_file = FLEET_FILE + '.tmp'
        with open(temp_file, 'w') as f:
            json.dump(data, f)
        os.replace(temp_file, FLEET_FILE)
    except Exception as e:
        logger.error(f"Error saving fleet data: {e}")

@app.route('/api/fleet', methods=['GET'])
def get_fleet():
    fleet_positions = load_fleet_data()
    
    # Return list of active vessels (seen in last 24h)
    now = time.time()
    active_fleet = []
    
    # Clean up stale data while we are at it
    clean_needed = False
    
    for vid, data in list(fleet_positions.items()):
        timestamp = data.get('timestamp', 0)
        # Filter active (e.g., seen in last 24h)
        if now - timestamp < 86400:
             active_fleet.append({
                 "id": vid,
                 "name": data.get('name', vid),
                 "lat": data.get('lat'),
                 "lon": data.get('lon'),
                 "sog": data.get('sog'),
                 "last_seen": timestamp
             })
        else:
            # Mark for cleanup if very old (> 48h) to keep file small
            if now - timestamp > 172800: 
                del fleet_positions[vid]
                clean_needed = True
    
    if clean_needed:
        save_fleet_data(fleet_positions)
        
    return jsonify(active_fleet)

@app.route('/api/position', methods=['GET', 'POST'])
def handle_position():
    if request.method == 'POST':
        try:
            data = request.json
            vessel_id = data.get('id') 
            
            if not vessel_id:
                return jsonify({"error": "Missing vessel ID"}), 400

            # 1. Load current state
            fleet = load_fleet_data()
            
            # 2. Update vessel
            fleet[vessel_id] = {
                "name": data.get('name', vessel_id),
                "lat": data.get('lat'),
                "lon": data.get('lon'),
                "sog": data.get('sog'),
                "cog": data.get('cog'),
                "timestamp": time.time()
            }
            
            # 3. Save state
            save_fleet_data(fleet)
            
            return jsonify({"status": "success", "id": vessel_id}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    else: # GET
        # Get specific vessel
        vessel_id = request.args.get('id')
        if vessel_id:
            fleet = load_fleet_data()
            data = fleet.get(vessel_id)
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
