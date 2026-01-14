from flask import Flask, send_from_directory, jsonify, Response, request
try:
    from flask_cors import CORS
except ImportError:
    CORS = None

import os
import sys
import logging
import json
import time

# Import scripts (Ensure they are clean/modular)
try:
    import rebuild_csv
    import update_weather_batch
    import build_route_index
    import chm_manager # New Scraper Module
except ImportError as e:
    print(f"Warning: Update scripts not found: {e}")

app = Flask(__name__)

# Enable CORS safely
if CORS:
    CORS(app)
else:
    print("Warning: Flask-CORS not found. CORS is disabled.")

# Base Directory for absolute paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Serve Static Files (Default)
@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Security: Ensure path is within current directory
    return send_from_directory(BASE_DIR, path)

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

@app.route('/api/chm/fetch', methods=['POST'])
def fetch_chm_data():
    try:
        # Check if requested to use chm_manager
        result = chm_manager.run_scrape()
        return jsonify(result)
    except Exception as e:
        logger.error(f"CHM Scrape Error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
            
            return jsonify({'status': 'OK', 'message': f'Rota {file.filename} adicionada e índice atualizado!'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/tide-files', methods=['GET'])
def list_tide_files():
    try:
        tide_dir = os.path.join(BASE_DIR, 'library', 'tabua mares 2026')
        if not os.path.exists(tide_dir):
             return jsonify([])
        
        files = [f for f in os.listdir(tide_dir) if f.lower().endswith('.pdf') or f.lower().endswith('.docx')]
        # Sort for better UX (numeric sort if possible, but alpha is fine)
        files.sort()
        return jsonify(files)
    except Exception as e:
        logger.error(f"Error listing tide files: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/contacts', methods=['GET'])
def get_contacts():
    try:
        contacts_path = os.path.join(BASE_DIR, 'library', 'CONTACTS.txt')
        if not os.path.exists(contacts_path):
             return jsonify([])
        
        contacts = []
        with open(contacts_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            # Skip header if present (assuming first line is header if it starts with 'NAME')
            start_idx = 1 if lines and 'NAME' in lines[0].upper() else 0
            
            for line in lines[start_idx:]:
                parts = line.strip().split('\t')
                if len(parts) >= 2: # At least Name and Phone
                    contacts.append({
                        'name': parts[0].strip(),
                        'phone': parts[1].strip(),
                        'email': parts[2].strip() if len(parts) > 2 else '',
                        'role': parts[3].strip() if len(parts) > 3 else ''
                    })
        return jsonify(contacts)
    except Exception as e:
        logger.error(f"Error reading contacts: {e}")
        return jsonify({'error': str(e)}), 500

# File-Based Persistence
# Using /tmp ensures write permissions on Linux/cPanel environments
import tempfile
FLEET_FILE = os.path.join(tempfile.gettempdir(), 'sisnav_fleet_data.json')

def load_fleet_data():
    try:
        if os.path.exists(FLEET_FILE):
            with open(FLEET_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        sys.stderr.write(f"Error loading: {e}\n")
    return {}

def save_fleet_data(data):
    try:
        with open(FLEET_FILE, 'w') as f:
            json.dump(data, f)
        return True, None
    except Exception as e:
        err_msg = f"Save Error: {str(e)}"
        sys.stderr.write(err_msg + "\n")
        return False, err_msg

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
                "routeId": data.get('routeId'),
                "destination": data.get('destination'),
                "timestamp": time.time()
            }
            
            # 3. Save state
            success, err = save_fleet_data(fleet)
            
            if not success:
                return jsonify({"error": err}), 500
            
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


# -------------------------------------------------------------------
# INVITES SYSTEM (Backend Persistence)
# -------------------------------------------------------------------

INVITES_FILE = os.path.join(tempfile.gettempdir(), 'sisnav_invites_db.json')

def load_invites():
    try:
        if os.path.exists(INVITES_FILE):
            with open(INVITES_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading invites: {e}")
    return []

def save_invites(data):
    try:
        with open(INVITES_FILE, 'w') as f:
            json.dump(data, f)
        return True
    except Exception as e:
        logger.error(f"Error saving invites: {e}")
        return False

@app.route('/api/invites/create', methods=['POST'])
def create_invite():
    try:
        data = request.json
        if not data or 'token' not in data:
            return jsonify({'error': 'Invalid data'}), 400
            
        invites = load_invites()
        
        # Check duplicate
        if any(i['token'] == data['token'] for i in invites):
             return jsonify({'error': 'Token already exists'}), 409

        invites.append(data)
        
        if save_invites(invites):
            return jsonify({'status': 'success'})
        else:
            return jsonify({'error': 'Failed to save'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invites/list', methods=['GET'])
def list_invites():
    # In production, check for Admin Session here!
    return jsonify(load_invites())

@app.route('/api/invites/update', methods=['POST'])
def update_invite():
    try:
        data = request.json
        token = data.get('token')
        updates = data.get('updates')
        
        if not token or not updates:
            return jsonify({'error': 'Missing params'}), 400
            
        invites = load_invites()
        found = False
        
        for i in range(len(invites)):
            if invites[i]['token'] == token:
                invites[i].update(updates)
                found = True
                break
        
        if found:
            save_invites(invites)
            return jsonify({'status': 'success'})
        else:
            return jsonify({'error': 'Token not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invites/delete', methods=['POST'])
def delete_invite():
    try:
        data = request.json
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Missing token'}), 400
            
        invites = load_invites()
        
        # Filter out the invite with the matching token
        new_invites = [i for i in invites if i['token'] != token]
        
        if len(new_invites) < len(invites):
            save_invites(new_invites)
            return jsonify({'status': 'success'})
        else:
            return jsonify({'error': 'Token not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invites/validate', methods=['POST'])
def validate_invite():
    try:
        data = request.json
        token = data.get('token')
        password = data.get('password')
        
        # 1. Check Static/Hardcoded first (Fallback/Recovery)
        # Note: We can implement static check in Python too if we want backend to be single source of truth, 
        # but for now let's focus on the dynamic DB.
        
        # 2. Check Dynamic DB
        invites = load_invites()
        invite = next((i for i in invites if i['token'] == token), None)
        
        if not invite:
            return jsonify({'valid': False, 'error': 'Token inválido'}), 404
            
        if invite.get('status') != 'active' and invite.get('status') != 'pending':
            return jsonify({'valid': False, 'error': 'Convite revogado ou inativo'}), 403
            
        if invite.get('password') != password:
            return jsonify({'valid': False, 'error': 'Senha incorreta'}), 401
            
        # Success
        # Auto-activate pending
        if invite.get('status') == 'pending':
            invite['status'] = 'active'
            invite['firstAccess'] = time.time()
            save_invites(invites)
            
        return jsonify({
            'valid': True, 
            'type': invite.get('type'), 
            'email': invite.get('email')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

import socket

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

@app.route('/api/system-info', methods=['GET'])
def get_system_info():
    """Returns the server network info for client-side link generation."""
    return jsonify({
        'ip': get_ip(),
        'port': 5000,
        'hostname': socket.gethostname() 
    })

if __name__ == '__main__':
    local_ip = get_ip()
    print(f" SISNAV COSTEIRO | Servidor Orientado a Rede")
    print(f" > Local:   http://localhost:5000")
    print(f" > Rede:    http://{local_ip}:5000 (Acesse por este IP)")
    print(f"---------------------------------------------------")
    app.run(debug=True, host='0.0.0.0', port=5000)
