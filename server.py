# =============================================================================
# SISNAV COSTEIRO - server.py (Flask / Passenger)
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems
# Data/Hora: 2026-10-30 23:05 (UTC-3)   Versão: 3.10.0
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  v3.10.0 (2026-10-30 23:05) - Etapa B (assistido por Claude):
#   [1] POST /api/marine/legs: previsão do mar por perna (Open-Meteo), com
#       corrente decomposta no rumo (SOG, abatimento) e selo de alerta.
#       Lógica em marine_openmeteo.py. Exige convite (como /api/fleet).
#  v3.8.1 (2026-10-30 17:06) - Assistido por Claude:
#   [1] /api/health devolvia a versão fixa '3.6.0-cloud'. Agora lê a constante
#       SISNAV_VERSION de version.py (fonte única) e informa também a data
#       da versão ('release'). Assim o healthcheck confirma qual versão está
#       de fato rodando no Railway após cada deploy.
#  v3.6.0-cloud (2026-10-29) - Migração cPanel -> Railway (API) + Netlify (front)
#                              + Supabase (banco). Assistido por Claude:
#   [1] Persistência de convites/frota/dados dinâmicos delegada ao módulo
#       sisnav_store.py (Supabase quando configurado, JSON local como reserva).
#   [2] Senhas de convite com hash PBKDF2 (ver sisnav_store.py); /invites/list
#       não devolve mais senha alguma ao navegador.
#   [3] /api/fleet e /api/position agora exigem convite válido (antes eram
#       abertas: qualquer um lia a posição da frota ou injetava posição falsa).
#   [4] CORRIGIDO: /api/update-data enviava "\\n\\n" literal no fluxo SSE; o
#       front separa eventos por quebra de linha real -> barra de progresso
#       nunca atualizava. Mesmo defeito corrigido em /api/contacts ("\\t").
#   [5] CORS restrito às origens de ALLOWED_ORIGINS (ex.: o domínio Netlify).
#   [6] Nova rota /api/data/<arquivo> entrega marés/meteo/índice de rotas
#       atualizados (o disco do Railway é efêmero - o dado vive no Supabase).
#   [7] /api/health para o healthcheck do Railway; porta lida de $PORT.
#  v3.5.0-sec (2026-10-13) - Hardening de segurança (assistido por Claude):
#   [1] require_admin: rotas administrativas (/api/invites/create|list|update|
#       delete e /api/system-info) exigem o cabeçalho X-Admin-Key, comparado em
#       tempo constante (hmac.compare_digest) com a chave lida da variável de
#       ambiente SISNAV_ADMIN_KEY ou do arquivo ~/.sisnav_admin_key (fora da
#       área pública). Sem chave configurada => tudo negado (falha segura).
#   [2] require_invite: /api/update-data e /api/upload-gpx exigem o cabeçalho
#       X-Invite-Token com um convite válido (status active/pending) no banco
#       do servidor - ou a chave de admin.
#   [3] /api/admin/login: valida a chave de admin no servidor (antes era só
#       localStorage do navegador, trivial de burlar).
#   [4] upload-gpx: nome do arquivo saneado com secure_filename (impede
#       gravação fora de gpx/ via "../").
#   [5] serve_static: deixa de entregar QUALQUER arquivo da pasta; agora só
#       extensões de front-end e nunca data/, scripts/, tools/, ocultos etc.
# -----------------------------------------------------------------------------
# ANALOGIA: antes o portão tinha guarita mas a chave ficava pendurada do lado
# de fora (validação no navegador). Agora quem decide é o servidor - o
# "passadiço" - e o navegador só apresenta a credencial.
# =============================================================================
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
import requests

import sisnav_store as store  # v3.6.0 [1]
from version import SISNAV_VERSION, SISNAV_RELEASE_DATE  # v3.8.1 [1]

# Import scripts (Ensure they are clean/modular)
try:
    import rebuild_csv
    import update_weather_batch
    import build_route_index
except Exception as e:
    print(f"Warning: Update scripts not found or failed to load: {e}")

app = Flask(__name__)
# PRODUÇÃO: Debug desligado para segurança
app.config['DEBUG'] = False
app.config['PROPAGATE_EXCEPTIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024  # v3.8.0: teto de 8 MB por envio
# v3.8.0: o JSON da DHN (~0,6 MB) chega num campo de formulário; o limite
# padrão do Werkzeug para campos é 500 KB -> erro 413. Sobe para 8 MB.
app.config['MAX_FORM_MEMORY_SIZE'] = 8 * 1024 * 1024
try:
    from flask import Request as _Req
    _Req.max_form_memory_size = 8 * 1024 * 1024
except Exception:
    pass

# Enable CORS safely
if CORS:
    # v3.6.0 [5]: só as origens autorizadas (vírgula). Vazio => '*' (modo local).
    _origins = [o.strip() for o in (os.environ.get('ALLOWED_ORIGINS') or '').split(',') if o.strip()]
    CORS(app, resources={r"/api/*": {"origins": _origins or '*'}},
         allow_headers=['Content-Type', 'X-Invite-Token', 'X-Admin-Key'])
else:
    print("Warning: Flask-CORS not found. CORS is disabled.")

# Base Directory for absolute paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR) # Ensure data dir exists (requires 755 permission on parent)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# SEGURANÇA (v3.5.0-sec) - autenticação no servidor
# =============================================================================
import hmac
from functools import wraps
from werkzeug.utils import secure_filename

# Arquivo da chave fica um nível ACIMA de sisnav_app (home do usuário),
# portanto fora do alcance do Apache/Flask.
ADMIN_KEY_FILE = os.path.join(os.path.dirname(BASE_DIR), '.sisnav_admin_key')

def _load_admin_key():
    """Prioridade: variável de ambiente > arquivo. Retorna None se ausente."""
    env_key = os.environ.get('SISNAV_ADMIN_KEY', '').strip()
    if env_key:
        return env_key
    try:
        with open(ADMIN_KEY_FILE, 'r') as f:
            k = f.read().strip()
            return k or None
    except Exception:
        return None

def _is_admin_request():
    """compare_digest leva o mesmo tempo para qualquer entrada: impede que um
    atacante descubra a chave medindo a demora da resposta (timing attack)."""
    expected = _load_admin_key()
    given = request.headers.get('X-Admin-Key', '')
    if not expected or not given:
        return False
    return hmac.compare_digest(given.encode('utf-8'), expected.encode('utf-8'))

def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not _is_admin_request():
            return jsonify({'error': 'Acesso administrativo negado'}), 401
        return fn(*args, **kwargs)
    return wrapper

def require_invite(fn):
    """Aceita convite válido (X-Invite-Token) ou a chave de admin."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if _is_admin_request():
            return fn(*args, **kwargs)
        token = request.headers.get('X-Invite-Token', '').strip()
        if token and store.invite_is_usable(token):  # v3.6.0 [1]
            return fn(*args, **kwargs)
        return jsonify({'error': 'Convite inválido ou ausente'}), 401
    return wrapper

# NOTA: rotas estáticas (/, /<path>) ficam no FIM do ficheiro com methods GET/HEAD apenas,
# para não capturarem POST em /api/... (evita HTTP 405 em /api/chm/fetch).

@app.route('/api/update-data', methods=['POST'])
@require_invite
def update_data():
    def generate():
        yield f"data: {json.dumps({'status': 'Iniciando atualização...', 'progress': 5})}\n\n"
        
        try:
            # 1. Tides
            yield f"data: {json.dumps({'status': 'Baixando Marés (Base Nacional)...', 'progress': 20})}\n\n"
            # Redirect stdout to capture logs? Or just run blind?
            # ideally modify rebuild_csv to yield progress, but for now blocking call
            if rebuild_csv and rebuild_csv.TideDataCollector:
                rebuild_csv.run() 
                _publish_data_file('tides_scraped.csv')  # v3.6.0 [6]
                yield f"data: {json.dumps({'status': 'Marés Atualizadas!', 'progress': 50})}\n\n"
            else:
                 yield f"data: {json.dumps({'status': 'Ignorando Marés (Módulo ausente)', 'progress': 50})}\n\n"

            # 2. Weather
            yield f"data: {json.dumps({'status': 'Baixando Meteorologia (18 Portos)...', 'progress': 60})}\n\n"
            if update_weather_batch and update_weather_batch.WeatherCollector:
                update_weather_batch.run()
                _publish_data_file('weather_scraped.csv')  # v3.6.0 [6]
                yield f"data: {json.dumps({'status': 'Meteorologia Atualizada!', 'progress': 90})}\n\n"
            else:
                 yield f"data: {json.dumps({'status': 'Ignorando Clima (Módulo ausente)', 'progress': 90})}\n\n"

            yield f"data: {json.dumps({'status': 'Concluído!', 'progress': 100})}\n\n"
            
        except Exception as e:
            logger.error(f"Update Error: {e}")
            yield f"data: {json.dumps({'status': f'Erro: {str(e)}', 'progress': 0, 'error': True})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/upload-gpx', methods=['POST'])
@require_invite
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
            safe_name = secure_filename(file.filename)  # v3.5.0-sec [4]
            if not safe_name.lower().endswith('.gpx'):
                return jsonify({'error': 'Nome de arquivo inválido'}), 400
            save_path = os.path.join(os.getcwd(), 'gpx', safe_name)
            file.save(save_path)
            
            # Rebuild Index
            gpx_dir = os.path.join(os.getcwd(), 'gpx')
            output_file = os.path.join(os.getcwd(), 'js', 'data', 'known_routes.json')
            
            # Capture output or just run?
            # We can mock the print or just trust it.
            if build_route_index:
                build_route_index.build_index(gpx_dir, output_file)
                _publish_data_file('known_routes.json', output_file)  # v3.6.0 [6]
            
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
@require_invite  # v3.6.0: telefones/e-mails reais - só com convite
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

# =============================================================================
# v3.6.0-cloud - FROTA, CONVITES E DADOS DINÂMICOS via sisnav_store
# -----------------------------------------------------------------------------
# Toda leitura/gravação passa pelo "paiol" (sisnav_store). O Flask só decide
# QUEM pode fazer O QUÊ; ONDE o dado mora (Supabase ou JSON) é problema do store.
# =============================================================================
FLEET_ACTIVE_WINDOW_S = 86400    # 24 h: embarcação aparece no mapa da frota
FLEET_PURGE_AFTER_S = 172800     # 48 h: registro é apagado do banco


def _publish_data_file(name, path=None):
    """Copia um arquivo gerado no disco efêmero para o banco (sisnav_kv), para
    que o front (Netlify) leia sempre a versão mais recente via /api/data/<name>."""
    try:
        path = path or os.path.join(os.getcwd(), name)
        with open(path, 'r', encoding='utf-8') as f:
            store.kv_set(name, f.read())
    except Exception as e:
        logger.error(f"Falha ao publicar {name} no banco: {e}")


DATA_FILES = {
    'tides_scraped.csv': ('text/csv', os.path.join(BASE_DIR, 'tides_scraped.csv')),
    'weather_scraped.csv': ('text/csv', os.path.join(BASE_DIR, 'weather_scraped.csv')),
    'known_routes.json': ('application/json', os.path.join(BASE_DIR, 'js', 'data', 'known_routes.json')),
}


@app.route('/api/data/<name>', methods=['GET'])
def get_data_file(name):
    """v3.6.0 [6]: banco primeiro; se vazio, o arquivo que veio no repositório."""
    if name not in DATA_FILES:
        return jsonify({'error': 'Not found'}), 404
    mime, path = DATA_FILES[name]
    try:
        content = store.kv_get(name)
    except Exception as e:
        logger.error(f"kv_get {name}: {e}")
        content = None
    if content is None:
        if not os.path.exists(path):
            return jsonify({'error': 'Not found'}), 404
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    return Response(content, mimetype=mime, headers={'Cache-Control': 'no-store'})


@app.route('/api/library/contacts.txt', methods=['GET'])
@require_invite
def get_contacts_raw():
    """v3.6.0: CONTACTS.txt tem telefones/e-mails de pessoas reais - sai da área
    pública do Netlify e passa a ser entregue só a quem tem convite válido."""
    path = os.path.join(BASE_DIR, 'library', 'CONTACTS.txt')
    if not os.path.exists(path):
        return jsonify({'error': 'Not found'}), 404
    with open(path, 'r', encoding='utf-8') as f:
        return Response(f.read(), mimetype='text/plain', headers={'Cache-Control': 'no-store'})


@app.route('/api/dhn/avradio-upload', methods=['POST'])
def dhn_avradio_upload():
    """v3.8.0 - recebe os Avisos-Rádio da DHN enviados pelo favorito
    "Enviar ao SISNAV" (clicado na página oficial da Marinha).
    POR QUE FORMULÁRIO E NÃO fetch(): a página da Marinha tem CSP
    connect-src 'self' (bloqueia fetch para outros sites), mas permite
    form-action https: - então o favorito envia um <form> POST.
    Campos: token (convite SISNAV) e payload (JSON da DHN).
    Resposta: página HTML curta com o resultado."""
    import html as _html
    import dhn_avradio

    def page(titulo, msg, ok):
        cor = '#16a34a' if ok else '#dc2626'
        body = (f"<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width'>"
                f"<title>SISNAV - {_html.escape(titulo)}</title>"
                f"<body style='font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:24px'>"
                f"<h2 style='color:{cor}'>{_html.escape(titulo)}</h2><p>{_html.escape(msg)}</p>"
                f"<p style='color:#94a3b8'>Pode fechar esta aba.</p></body>")
        return Response(body, status=200 if ok else 400, mimetype='text/html')

    token = (request.form.get('token') or request.headers.get('X-Invite-Token') or '').strip()
    if not (_is_admin_request() or (token and store.invite_is_usable(token))):
        return page('Convite inválido', 'Token de convite ausente, revogado ou incorreto. '
                    'Clique de novo no favorito e informe o token do seu convite SISNAV.', False)
    raw = request.form.get('payload')
    try:
        payload = json.loads(raw) if raw else (request.get_json(silent=True) or {})
        inv = store.get_invite(token) or {}
        res = dhn_avradio.save_upload(payload, quem=str(inv.get('type') or 'admin'))
    except Exception as e:
        logger.warning(f"avradio-upload rejeitado: {e}")
        return page('Envio rejeitado', str(e), False)
    titulo = 'Avisos-Rádio recebidos' if res['status'] == 'ok' else 'Nada a atualizar'
    return page(titulo, res['message'], True)


@app.route('/api/marine/legs', methods=['POST'])
@require_invite
def marine_legs():
    """v3.10.0 [1] - Previsão do mar por perna da rota.
    Corpo JSON: {"pernas": [{lat, lon, t_ms, rumo, dist_nm, vel_kn}, ...]}
      lat/lon = ponto médio da perna (graus decimais, S e W negativos)
      t_ms    = instante (UTC, milissegundos) em que o navio passa pelo meio
    Resposta: ver marine_openmeteo.previsao_pernas()."""
    import marine_openmeteo
    body = request.get_json(silent=True) or {}
    pernas = body.get('pernas')
    if not isinstance(pernas, list) or not pernas:
        return jsonify({'status': 'error', 'message': 'Envie a lista "pernas".'}), 400
    try:
        limpas = []
        for p in pernas:
            lat, lon, t = float(p['lat']), float(p['lon']), float(p['t_ms'])
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError('coordenada fora do intervalo')
            limpas.append({'lat': lat, 'lon': lon, 't_ms': t, 'rumo': float(p.get('rumo') or 0),
                           'dist_nm': float(p.get('dist_nm') or 0), 'vel_kn': float(p.get('vel_kn') or 10)})
        return jsonify(marine_openmeteo.previsao_pernas(limpas))
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({'status': 'error', 'message': f'Perna inválida: {e}'}), 400
    except requests.RequestException as e:
        logger.warning(f"marine_legs: Open-Meteo indisponível: {e}")
        return jsonify({'status': 'error', 'message': 'Serviço de previsão (Open-Meteo) indisponível. Tente em alguns minutos.'}), 502


@app.route('/api/health', methods=['GET'])
def health():
    """v3.6.0 [7]: usado pelo healthcheck do Railway.
    v3.8.1 [1]: versão lida de version.py (antes texto fixo '3.6.0-cloud')."""
    return jsonify({'status': 'ok', 'version': SISNAV_VERSION,
                    'release': SISNAV_RELEASE_DATE, 'storage': store.backend_name()})


@app.route('/api/fleet', methods=['GET'])
@require_invite  # v3.6.0 [3]
def get_fleet():
    try:
        store.purge_fleet_older_than(FLEET_PURGE_AFTER_S)
        now = time.time()
        active_fleet = []
        for vid, data in store.load_fleet().items():
            timestamp = data.get('timestamp', 0) or 0
            if now - timestamp < FLEET_ACTIVE_WINDOW_S:
                active_fleet.append({
                    "id": vid,
                    "name": data.get('name', vid),
                    "lat": data.get('lat'),
                    "lon": data.get('lon'),
                    "sog": data.get('sog'),
                    "last_seen": timestamp
                })
        return jsonify(active_fleet)
    except Exception as e:
        logger.error(f"fleet: {e}")
        return jsonify({'error': 'Falha ao ler a frota'}), 500


@app.route('/api/position', methods=['GET', 'POST'])
@require_invite  # v3.6.0 [3]
def handle_position():
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            vessel_id = str(data.get('id') or '').strip()
            if not vessel_id:
                return jsonify({"error": "Missing vessel ID"}), 400
            store.upsert_position(vessel_id, data)
            return jsonify({"status": "success", "id": vessel_id}), 200
        except Exception as e:
            logger.error(f"position POST: {e}")
            return jsonify({"error": "Falha ao gravar posição"}), 500

    vessel_id = request.args.get('id')
    if not vessel_id:
        return jsonify({"error": "Please specify vessel ID"}), 400
    data = store.get_position(vessel_id)
    if data:
        return jsonify(data)
    return jsonify({"error": "Vessel not found"}), 404


# -------------------------------------------------------------------
# INVITES SYSTEM (Backend Persistence) - v3.6.0 via sisnav_store
# -------------------------------------------------------------------
def load_invites():
    """Compatibilidade com código legado: lista SEM senhas."""
    return store.list_invites()


@app.route('/api/invites/create', methods=['POST'])
@require_admin
def create_invite():
    try:
        data = request.get_json(silent=True)
        if not data or 'token' not in data:
            return jsonify({'error': 'Invalid data'}), 400
        if store.create_invite(data) == 'duplicate':
            return jsonify({'error': 'Token already exists'}), 409
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"create_invite: {e}")
        return jsonify({'error': 'Failed to save'}), 500


@app.route('/api/invites/list', methods=['GET'])
@require_admin
def list_invites():
    return jsonify(store.list_invites())


@app.route('/api/invites/update', methods=['POST'])
@require_admin
def update_invite():
    try:
        data = request.get_json(silent=True) or {}
        token = data.get('token')
        updates = data.get('updates')
        if not token or not updates:
            return jsonify({'error': 'Missing params'}), 400
        if store.update_invite(token, updates):
            return jsonify({'status': 'success'})
        return jsonify({'error': 'Token not found'}), 404
    except Exception as e:
        logger.error(f"update_invite: {e}")
        return jsonify({'error': 'Failed to update'}), 500


@app.route('/api/invites/delete', methods=['POST'])
@require_admin
def delete_invite():
    try:
        data = request.get_json(silent=True) or {}
        token = data.get('token')
        if not token:
            return jsonify({'error': 'Missing token'}), 400
        if store.delete_invite(token):
            return jsonify({'status': 'success'})
        return jsonify({'error': 'Token not found'}), 404
    except Exception as e:
        logger.error(f"delete_invite: {e}")
        return jsonify({'error': 'Failed to delete'}), 500


@app.route('/api/invites/validate', methods=['POST'])
def validate_invite():
    try:
        data = request.get_json(silent=True) or {}
        token = data.get('token')
        password = data.get('password')

        invite = store.get_invite(token, include_secret=True)
        if not invite:
            time.sleep(0.5)  # freio contra varredura de tokens
            return jsonify({'valid': False, 'error': 'Token inválido'}), 404

        if invite.get('status') not in ('active', 'pending'):
            return jsonify({'valid': False, 'error': 'Convite revogado ou inativo'}), 403

        stored = invite.get('password')
        if not store.verify_password(password, stored):
            time.sleep(0.5)
            return jsonify({'valid': False, 'error': 'Senha incorreta'}), 401

        updates = {}
        if not store.is_hashed(stored):
            updates['password'] = password  # migração preguiçosa -> vira hash
        if invite.get('status') == 'pending':
            updates['status'] = 'active'
            updates['firstAccess'] = time.time()
        if updates:
            store.update_invite(token, updates)

        return jsonify({'valid': True, 'type': invite.get('type'), 'email': invite.get('email')})
    except Exception as e:
        logger.error(f"validate_invite: {e}")
        return jsonify({'error': 'Falha na validação'}), 500



# --- KRATOS (xAI Grok) — assistente náutico ---------------------------------
def _log_kratos_error(summary, detail=None, exception=None):
    """Grava logs detalhados de erros do Kratos na pasta local data/."""
    log_path = os.path.join(DATA_DIR, 'kratos_debug.log')
    import traceback
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    try:
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] ERROR: {summary}\n")
            if detail:
                f.write(f"Detail: {detail}\n")
            if exception:
                f.write(f"Exception: {str(exception)}\n")
                f.write(traceback.format_exc())
            f.write("-" * 50 + "\n")
    except Exception as e:
        logger.error("Falha ao gravar log do Kratos: %s", e)


def _load_kratos_instruction_files():
    """Documentação anexa ao system prompt (Markdown)."""
    chunks = []
    for rel in ('library/docs/kratos_instructions.md', 'data/kratos_operator_knowledge.md'):
        p = os.path.join(BASE_DIR, *rel.split('/'))
        if os.path.isfile(p):
            try:
                with open(p, 'r', encoding='utf-8') as fh:
                    chunks.append(fh.read())
            except OSError as e:
                logger.warning('KRATOS: não leu %s — %s', p, e)
    return '\n\n---\n\n'.join(chunks) if chunks else ''


# Texto extraído de PDFs em library/ para o KRATOS (cache por impressão digital dos ficheiros)
_kratos_library_pdf_cache = {'fingerprint': None, 'text': None}


def _library_pdf_fingerprint(lib_path):
    """(max_mtime, count, total_size) — altera quando PDFs são adicionados, removidos ou gravados."""
    max_m = 0.0
    count = 0
    total_sz = 0
    if not os.path.isdir(lib_path):
        return (0.0, 0, 0)
    for root, _, files in os.walk(lib_path):
        for fname in files:
            if not fname.lower().endswith('.pdf'):
                continue
            fp = os.path.join(root, fname)
            try:
                st = os.stat(fp)
                max_m = max(max_m, st.st_mtime)
                total_sz += int(st.st_size)
                count += 1
            except OSError:
                continue
    return (max_m, count, total_sz)


def _extract_text_from_pdf(path, max_chars):
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    try:
        reader = PdfReader(path)
        parts = []
        for page in reader.pages:
            try:
                t = page.extract_text() or ''
            except Exception:
                t = ''
            if t:
                parts.append(t)
        full = '\n'.join(parts)
        full = ' '.join(full.split())  # normaliza espaços
        if len(full) > max_chars:
            return full[:max_chars] + '\n[… texto truncado por limite por ficheiro …]'
        return full
    except Exception as e:
        logger.warning('KRATOS PDF: falha a ler %s — %s', path, e)
        return None


def get_kratos_library_pdf_corpus():
    """
    Extrai texto de todos os *.pdf sob library/ (recursivo).
    Limites: KRATOS_LIBRARY_PDF_MAX_PER_FILE (defeito 6000), KRATOS_LIBRARY_PDF_MAX_TOTAL (defeito 72000).
    PDFs só com imagem (digitalização) podem devolver pouco ou nenhum texto.
    """
    global _kratos_library_pdf_cache
    lib_path = os.path.join(BASE_DIR, 'library')
    fp = _library_pdf_fingerprint(lib_path)
    if _kratos_library_pdf_cache['fingerprint'] == fp and _kratos_library_pdf_cache['text'] is not None:
        return _kratos_library_pdf_cache['text']

    try:
        from pypdf import PdfReader  # noqa: F401 — verificar dependência cedo
    except ImportError:
        return (
            '[KRATOS] Biblioteca pypdf não instalada. No servidor: pip install pypdf\n'
            '(reinicie o Flask após instalar.)\n'
        )

    max_per = int(os.environ.get('KRATOS_LIBRARY_PDF_MAX_PER_FILE') or '6000')
    max_total = int(os.environ.get('KRATOS_LIBRARY_PDF_MAX_TOTAL') or '72000')

    pdf_paths = []
    for root, _, files in os.walk(lib_path):
        for fname in files:
            if fname.lower().endswith('.pdf'):
                pdf_paths.append(os.path.join(root, fname))
    pdf_paths.sort()

    blocks = []
    used = 0
    for path in pdf_paths:
        if used >= max_total:
            blocks.append('\n[… limite global KRATOS_LIBRARY_PDF_MAX_TOTAL atingido; restantes PDFs omitidos …]\n')
            break
        rel = os.path.relpath(path, BASE_DIR).replace('\\', '/')
        raw = _extract_text_from_pdf(path, max_per)
        if not raw or not str(raw).strip():
            block = f'\n### PDF: {rel}\n(sem texto extraível — possível digitalização só-imagem ou PDF protegido)\n'
        else:
            block = f'\n### PDF: {rel}\n{raw}\n'
        if used + len(block) > max_total:
            block = block[: max(0, max_total - used)]
        blocks.append(block)
        used += len(block)

    text = '\n'.join(blocks)
    if not text.strip():
        text = '(Nenhum PDF encontrado em library/ ou todos vazios após extração.)\n'

    logger.info(
        'KRATOS: corpus PDF library/ atualizado (%d ficheiros, %d chars, fingerprint=%s)',
        len(pdf_paths), len(text), fp,
    )
    _kratos_library_pdf_cache['fingerprint'] = fp
    _kratos_library_pdf_cache['text'] = text
    return text


def _kratos_last_user_text(user_messages):
    if not isinstance(user_messages, list):
        return ''
    for m in reversed(user_messages):
        if isinstance(m, dict) and m.get('role') == 'user' and isinstance(m.get('content'), str):
            return m.get('content', '').strip()
    return ''


def _kratos_build_web_search_query(body, voyage_ctx, last_user_text):
    explicit = (body.get('webSearchQuery') or '').strip()
    if explicit:
        return explicit[:220]
    parts = []
    if isinstance(voyage_ctx, dict):
        portos = voyage_ctx.get('portos') or {}
        if portos.get('partidaNome'):
            parts.append(str(portos['partidaNome']))
        if portos.get('chegadaNome'):
            parts.append(str(portos['chegadaNome']))
    if last_user_text:
        parts.append(last_user_text[:140])
    q = ' '.join(parts).strip()
    return q[:220] if q else ''


def fetch_duckduckgo_instant_answer(query, max_chars=3500):
    """
    Instant Answer público DuckDuckGo (sem API key). Uso: cruzar factos gerais, não fonte regulatória.
    """
    q = (query or '').strip()
    if len(q) < 3:
        return ''
    try:
        r = requests.get(
            'https://api.duckduckgo.com/',
            params={'q': q[:220], 'format': 'json', 'no_html': 1, 'skip_disambig': 1},
            timeout=14,
            headers={
                'User-Agent': 'SISNAV-Costeiro/Kratos (nautical planning; +https://github.com/)',
                'Accept': 'application/json',
            },
        )
        r.raise_for_status()
        j = r.json()
    except Exception as e:
        logger.warning('KRATOS web DDG: %s', e)
        return f'(DuckDuckGo indisponível: {e!s})'

    chunks = []
    heading = j.get('Heading') or ''
    abs_txt = (j.get('AbstractText') or '').strip()
    abs_url = (j.get('AbstractURL') or '').strip()
    if heading or abs_txt:
        line = heading
        if abs_txt:
            line = f'{heading}: {abs_txt}' if heading else abs_txt
        if abs_url:
            line += f'\nURL: {abs_url}'
        chunks.append(line)

    for rt in (j.get('RelatedTopics') or [])[:8]:
        if isinstance(rt, dict):
            t = (rt.get('Text') or '').strip()
            u = (rt.get('FirstURL') or '').strip()
            if t:
                chunks.append(f'• {t}' + (f'\n  {u}' if u else ''))
        elif isinstance(rt, str) and rt.strip():
            chunks.append(f'• {rt.strip()}')

    infobox = j.get('Infobox')
    if isinstance(infobox, dict):
        for inf in (infobox.get('content') or [])[:12]:
            if isinstance(inf, dict):
                lab = (inf.get('label') or '').strip()
                val = (inf.get('value') or '').strip()
                if lab and val:
                    chunks.append(f'{lab}: {val}')

    out = '\n\n'.join(chunks).strip()
    if not out:
        return '(DuckDuckGo não devolveu resumo instantâneo para esta consulta — tente outras palavras-chave.)'
    if len(out) > max_chars:
        return out[:max_chars] + '\n… (truncado)'
    return out


@app.route('/api/kratos/status', methods=['GET'])
def kratos_status():
    key = (os.environ.get('XAI_API_KEY') or '').strip()
    xai_models = None
    
    # Query xAI available models and log them to kratos_debug.log
    if key:
        try:
            r = requests.get(
                'https://api.x.ai/v1/models',
                headers={'Authorization': f'Bearer {key}'},
                timeout=10
            )
            if r.ok:
                xai_models = r.json()
                _log_kratos_error(summary="Querying xAI Models", detail=json.dumps(xai_models, indent=2))
            else:
                _log_kratos_error(summary=f"Querying xAI Models failed with HTTP {r.status_code}", detail=r.text)
        except Exception as e:
            _log_kratos_error(summary="Exception querying xAI Models", exception=e)

    lib_path = os.path.join(BASE_DIR, 'library')
    pdf_fp = _library_pdf_fingerprint(lib_path)
    try:
        import pypdf  # noqa: F401
        pypdf_ok = True
    except ImportError:
        pypdf_ok = False
    return jsonify({
        'configured': bool(key),
        'model': (os.environ.get('XAI_MODEL') or 'grok-4.20-reasoning').strip(),
        'libraryPdfCount': pdf_fp[1],
        'pypdfInstalled': pypdf_ok,
        'kratosPdfMaxTotal': int(os.environ.get('KRATOS_LIBRARY_PDF_MAX_TOTAL') or '72000'),
        'kratosPdfMaxPerFile': int(os.environ.get('KRATOS_LIBRARY_PDF_MAX_PER_FILE') or '6000'),
        'webValidationSupported': True,
        'xaiModels': xai_models,
    })


@app.route('/api/kratos/chat', methods=['POST'])
def kratos_chat():
    """
    Corpo JSON: { "messages": [...], "voyageContext": {...},
      "webValidation": true/false — opcional; se true, o servidor consulta DuckDuckGo Instant Answer
      e injeta um bloco de texto para cruzar factos (não é fonte oficial).
      "webSearchQuery": "..." — opcional; sobrepõe a query automática (portos + última pergunta).
    """
    api_key = (os.environ.get('XAI_API_KEY') or '').strip()
    if not api_key:
        return jsonify({
            'error': 'Assistente KRATOS não configurado no servidor (defina XAI_API_KEY).',
            'code': 'missing_key',
        }), 503

    body = request.get_json(silent=True) or {}
    user_messages = body.get('messages')
    if not isinstance(user_messages, list):
        return jsonify({'error': 'O campo "messages" deve ser uma lista.'}), 400

    voyage_ctx = body.get('voyageContext')

    static_docs = _load_kratos_instruction_files()
    if not (static_docs or '').strip():
        static_docs = (
            'Você é KRATOS, assistente náutico do SISNAV Costeiro (xAI). Responda em português do Brasil. '
            'Coloque o arquivo library/docs/kratos_instructions.md no servidor para documentação anexa.'
        )

    try:
        voyage_json = json.dumps(voyage_ctx, ensure_ascii=False, indent=2) if voyage_ctx is not None else '{}'
    except (TypeError, ValueError):
        voyage_json = '{}'
    if len(voyage_json) > 120000:
        voyage_json = voyage_json[:120000] + '\n… (truncado)'

    pdf_corpus = get_kratos_library_pdf_corpus()
    pdf_section = ''
    if (pdf_corpus or '').strip():
        pdf_section = (
            '\n\n---\n\n## Texto extraído de PDFs (pasta library/, recursivo)\n\n'
            'Conteúdo obtido no servidor com extração automática (pypdf). Pode haver erros de OCR '
            'ou tabelas desformatadas; PDFs só-imagem podem aparecer vazios. Não substitui carta '
            'oficial nem decisão do comandante.\n\n'
            + pdf_corpus
        )

    last_user_raw = _kratos_last_user_text(user_messages)
    web_section = ''
    web_used = False
    wv = body.get('webValidation')
    if wv in (True, 'true', '1', 1, 'on', 'yes'):
        wq = _kratos_build_web_search_query(body, voyage_ctx, last_user_raw)
        if wq:
            snippets = fetch_duckduckgo_instant_answer(
                wq,
                max_chars=int(os.environ.get('KRATOS_WEB_SNIPPET_MAX') or '3500'),
            )
            if snippets:
                web_used = True
                web_section = (
                    '\n\n---\n\n## Validação rápida na Web (DuckDuckGo Instant Answer)\n\n'
                    f'Consulta usada no servidor: «{wq}»\n\n'
                    'Isso é um resumo automático de enciclopédia / tópicos relacionados — pode estar incompleto ou desatualizado. '
                    'Não substitui avisos à navegação, CHM, Marinha nem carta. Cruze com o JSON da viagem e com os PDFs em library/.\n\n'
                    + snippets
                )

    system_content = (
        static_docs
        + pdf_section
        + web_section
        + '\n\n---\n\n## Contexto dinâmico da viagem (JSON — fonte de verdade)\n\n'
        + 'Use estes dados como base factual. O JSON pode incluir «comentariosSobreFormulario», «formularioAssistencia» e «doubleCheckNavareaDerrota» '
        + 'sobre o Appraisal e o planejamento — incorpore essas notas nas respostas (reconheça o preenchido e alerte para lacunas '
        + 'de segurança quando relevante), antes ou junto da resposta à pergunta do usuário. '
        + 'Trate o comandante como titular da decisão: acompanhamento e double-check colaborativo em pt-BR (confirmações, lembretes sobre implicações dos dados), '
        + 'incluindo cruzamento NAVAREA/avisos com o trecho da derrota quando houver texto. '
        + 'Sem substituir o comandante. '
        + 'Se faltar informação, indique lacunas e sugira preenchimento no SISNAV '
        '(GPX, portos, CHM/Sealagom, perfil de consumo, velocidade).\n\n'
        + '```json\n'
        + voyage_json
        + '\n```'
    )
    max_sys = int(os.environ.get('KRATOS_MAX_SYSTEM_CHARS') or '190000')
    if len(system_content) > max_sys:
        system_content = system_content[:max_sys] + '\n… (system prompt truncado)\n'

    clean_msgs = []
    for m in user_messages[-24:]:
        if not isinstance(m, dict):
            continue
        role = m.get('role')
        content = m.get('content')
        if role not in ('user', 'assistant') or not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        clean_msgs.append({'role': role, 'content': content[:12000]})

    if not clean_msgs or clean_msgs[-1]['role'] != 'user':
        return jsonify({'error': 'Envie pelo menos uma mensagem do usuário por turno.'}), 400

    messages = [{'role': 'system', 'content': system_content}] + clean_msgs

    model = (os.environ.get('XAI_MODEL') or 'grok-4.20-reasoning').strip()
    url = 'https://api.x.ai/v1/responses'

    try:
        payload = {
            'model': model,
            'input': messages,
            'temperature': 0.25,
            'max_output_tokens': 4096,
        }

        r = requests.post(
            url,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=240,
        )
        if not r.ok:
            detail = (r.text or '')[:800]
            logger.error('KRATOS xAI HTTP %s: %s', r.status_code, detail)
            _log_kratos_error(
                summary=f"xAI API returned HTTP {r.status_code}",
                detail=detail
            )
            return jsonify({'error': f'Erro xAI HTTP {r.status_code}', 'detail': detail}), 500

        data = r.json()
        reply = ''

        # 1. Try Responses API structure: iterate over all items in output array
        if 'output' in data and isinstance(data['output'], list):
            for out_item in data['output']:
                if isinstance(out_item, dict) and 'content' in out_item and isinstance(out_item['content'], list):
                    for block in out_item['content']:
                        if isinstance(block, dict) and block.get('type') == 'output_text':
                            reply = block.get('text') or ''
                            break
                if reply:
                    break
            
            # Fallback if we found content but not of type 'output_text'
            if not reply:
                for out_item in data['output']:
                    if isinstance(out_item, dict) and 'content' in out_item and isinstance(out_item['content'], list):
                        if len(out_item['content']) > 0:
                            first_block = out_item['content'][0]
                            if isinstance(first_block, dict):
                                reply = first_block.get('text') or first_block.get('content') or ''
                                if reply:
                                    break

        # 2. Try legacy chat completions structure as fallback
        if not reply and 'choices' in data and isinstance(data['choices'], list) and len(data['choices']) > 0:
            choice0 = data['choices'][0]
            if isinstance(choice0, dict):
                msg = choice0.get('message') or {}
                if isinstance(msg, dict):
                    reply = msg.get('content') or ''

        # 3. Simple direct output_text fallback
        if not reply and 'output_text' in data:
            reply = data.get('output_text') or ''

        if not reply:
            logger.warning('Could not extract reply from xAI response: %s', json.dumps(data))
            _log_kratos_error(
                summary="Failed to parse response content from xAI Responses API",
                detail=json.dumps(data, indent=2)
            )

        return jsonify({'reply': reply, 'model': model, 'webValidationUsed': web_used})
    except requests.RequestException as e:
        logger.exception('KRATOS request')
        _log_kratos_error(
            summary="Network or timeout failure when calling xAI API",
            exception=e
        )
        return jsonify({'error': f'Falha de rede ou tempo esgotado: {e!s}'}), 500


# --- CHM / Sealagom (Meteo, Mau tempo, NAVAREA) ---
try:
    import sealagom_chm
except ImportError:
    sealagom_chm = None


@app.route('/api/chm/fetch', methods=['POST'])
def chm_fetch():
    """
    Corpo JSON opcional: { "depPort": "BR_SAL", "arrPort": "BR_RIG" }
    Token no ambiente: SEALAGOM_API_TOKEN ou sisnav_costeiro (Web Application cPanel).
    """
    if not sealagom_chm:
        return jsonify({'status': 'error', 'message': 'Módulo sealagom_chm não disponível.'}), 500

    token = (
        os.environ.get('SEALAGOM_API_TOKEN')
        or os.environ.get('sisnav_costeiro')
        or ''
    ).strip()
    body = request.get_json(silent=True) or {}
    dep = body.get('depPort') or body.get('dep')
    arr = body.get('arrPort') or body.get('arr')

    try:
        result = sealagom_chm.fetch_all(dep, arr, token)
        st = result.get('status')
        code = 200 if st in ('success', 'partial') else 503
        return jsonify(result), code
    except Exception as e:
        logger.exception("chm_fetch")
        return jsonify({'status': 'error', 'message': str(e)}), 500


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
@require_admin
def get_system_info():
    """Returns the server network info for client-side link generation."""
    return jsonify({
        'ip': get_ip(),
        'port': 5000,
        'hostname': socket.gethostname() 
    })


# --- v3.5.0-sec [3] Login administrativo validado no servidor ---
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json(silent=True) or {}
    expected = _load_admin_key()
    given = str(data.get('key', ''))
    if expected and given and hmac.compare_digest(given.encode('utf-8'), expected.encode('utf-8')):
        return jsonify({'success': True})
    time.sleep(1)  # freio contra tentativas em massa (força bruta)
    return jsonify({'success': False, 'error': 'Credenciais inválidas'}), 401


# --- Ficheiros estáticos (por último: catch-all só GET/HEAD) ---
@app.route('/', methods=['GET', 'HEAD'])
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:path>', methods=['GET', 'HEAD'])
def serve_static(path):
    # v3.5.0-sec [5]: lista de permissões. Só entrega arquivos de front-end;
    # código-fonte, bancos (data/), scripts e arquivos ocultos => 404.
    norm = path.replace('\\', '/').lstrip('/')
    parts = norm.split('/')
    ext = os.path.splitext(norm)[1].lower()
    if (any(p.startswith('.') for p in parts)
            or parts[0] in STATIC_BLOCKED_DIRS
            or ext not in STATIC_ALLOWED_EXT
            or (ext in ('.txt', '.csv') and len(parts) == 1)):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(BASE_DIR, norm)


STATIC_ALLOWED_EXT = {'.html', '.js', '.mjs', '.css', '.map', '.json', '.txt',
                      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
                      '.woff', '.woff2', '.ttf', '.gpx', '.pdf'}
STATIC_BLOCKED_DIRS = {'data', 'scripts', 'tools', 'tmp', '_arquivos_temporarios',
                       '__pycache__', 'relatorios', 'cgi-bin', 'docs'}


if __name__ == '__main__':
    local_ip = get_ip()
    print(f" SISNAV COSTEIRO | Servidor Orientado a Rede")
    print(f" > Local:   http://localhost:5000")
    print(f" > Rede:    http://{local_ip}:5000 (Acesse por este IP)")
    print(f"---------------------------------------------------")
    port = int(os.environ.get('PORT', '5000'))  # v3.6.0 [7]
    app.run(debug=os.environ.get('FLASK_DEBUG') == '1', host='0.0.0.0', port=port)
