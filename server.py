# =============================================================================
# SISNAV Costeiro — Sistema de Auxílio à Navegação
# Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
# Autor: Jossian Brito | Contato: jossiancosta@gmail.com
# Este software é proprietário e confidencial. O uso não autorizado é proibido.
# =============================================================================

import os
from flask import Flask, request, jsonify, send_from_directory
from datetime import datetime
import json

app = Flask(__name__, static_folder='.')

# Configurações de segurança e caminhos
# No cPanel, o ideal é usar caminhos absolutos se necessário
# ou caminhos relativos ao root do app Python.
INVITES_FILE = os.path.join('/tmp', 'invites_db.json') if os.path.exists('/home/jovix') else 'invites_db.json'

def load_invites():
    if not os.path.exists(INVITES_FILE):
        return {}
    with open(INVITES_FILE, 'r') as f:
        return json.load(f)

def save_invites(data):
    with open(INVITES_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('.', path)

@app.route('/api/invites/validate', methods=['POST'])
def validate_invite():
    data = request.json
    code = data.get('code')
    invites = load_invites()
    
    if code in invites and not invites[code]['used']:
        return jsonify({"success": True, "message": "Convite válido."})
    return jsonify({"success": False, "message": "Convite inválido ou já utilizado."}), 401

@app.route('/api/invites/use', methods=['POST'])
def use_invite():
    data = request.json
    code = data.get('code')
    invites = load_invites()
    
    if code in invites and not invites[code]['used']:
        invites[code]['used'] = True
        invites[code]['used_at'] = datetime.now().isoformat()
        save_invites(invites)
        return jsonify({"success": True})
    return jsonify({"success": False}), 400

@app.route('/api/fleet', methods=['GET'])
def get_fleet():
    # Mock data ou leitura de arquivo seguro
    return jsonify([
        {"id": 1, "name": "SAAM RENE", "lat": -20.315, "lon": -40.295},
        {"id": 2, "name": "SAAM MARIANA", "lat": -20.320, "lon": -40.300}
    ])

if __name__ == '__main__':
    # Em produção (cPanel/Gunicorn), o Flask não roda via __main__
    app.run(debug=True, port=5000)
