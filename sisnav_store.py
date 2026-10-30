# =============================================================================
# SISNAV COSTEIRO - sisnav_store.py (Camada de Persistência)
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
# Data/Hora: 2026-10-29 21:30 (UTC-3)   Versão: 3.6.0-cloud
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  v3.6.0-cloud (2026-10-29) - Arquivo NOVO. Migração cPanel -> Railway/Supabase:
#   [1] Banco de convites e frota sai dos arquivos JSON de data/ e vai para o
#       Postgres do Supabase (tabelas sisnav_invites, sisnav_fleet, sisnav_kv),
#       via API REST (PostgREST) com a chave service_role - só o servidor fala
#       com o banco; o navegador nunca vê a chave.
#   [2] Fallback automático: sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no
#       ambiente, continua usando os arquivos JSON de data/ (modo cPanel/local).
#   [3] Senhas de convite passam a ser guardadas como HASH PBKDF2-SHA256
#       (200.000 iterações + sal aleatório). Senhas antigas em texto puro ainda
#       validam uma vez e são convertidas para hash no primeiro login
#       ("migração preguiçosa").
# -----------------------------------------------------------------------------
# ANALOGIA NÁUTICA: o disco do Railway é como o convés lavado por onda - tudo
# que fica solto (arquivo local) vai embora no próximo deploy. O Supabase é o
# paiol estanque: o que é guardado lá sobrevive a qualquer mar.
#
# FÓRMULA DO HASH (PBKDF2):
#   hash = HMAC_SHA256 aplicado N vezes sobre (senha, sal), N = 200.000
#   - Aumentar N  -> cada tentativa de força bruta custa N vezes mais CPU.
#   - Sal único   -> duas senhas iguais geram hashes diferentes (mata tabelas
#                    pré-calculadas, as "rainbow tables").
# =============================================================================
import os
import json
import time
import hmac
import base64
import hashlib
import logging

import requests

logger = logging.getLogger(__name__)

SUPABASE_URL = (os.environ.get('SUPABASE_URL') or '').rstrip('/')
SUPABASE_KEY = (os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or '').strip()
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
INVITES_FILE = os.path.join(DATA_DIR, 'sisnav_invites_db.json')
FLEET_FILE = os.path.join(DATA_DIR, 'sisnav_fleet_data.json')
KV_DIR = DATA_DIR  # modo arquivo: sisnav_kv_<chave>.json

PBKDF2_ITER = 200_000
HASH_PREFIX = 'pbkdf2_sha256'


# -----------------------------------------------------------------------------
# HASH DE SENHA
# -----------------------------------------------------------------------------
def hash_password(password):
    """Formato: pbkdf2_sha256$<iter>$<sal_b64>$<hash_b64>"""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', str(password).encode('utf-8'), salt, PBKDF2_ITER)
    return f"{HASH_PREFIX}${PBKDF2_ITER}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def is_hashed(value):
    return isinstance(value, str) and value.startswith(HASH_PREFIX + '$')


def verify_password(password, stored):
    """Compara em tempo constante. Aceita hash novo ou texto puro legado."""
    if stored is None or password is None:
        return False
    if is_hashed(stored):
        try:
            _, it, salt_b64, hash_b64 = stored.split('$')
            dk = hashlib.pbkdf2_hmac('sha256', str(password).encode('utf-8'),
                                     base64.b64decode(salt_b64), int(it))
            return hmac.compare_digest(dk, base64.b64decode(hash_b64))
        except Exception:
            return False
    # legado (texto puro) - será convertido no primeiro login válido
    return hmac.compare_digest(str(password).encode('utf-8'), str(stored).encode('utf-8'))


# -----------------------------------------------------------------------------
# CLIENTE REST DO SUPABASE (PostgREST)
# -----------------------------------------------------------------------------
def _headers(extra=None):
    h = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }
    if extra:
        h.update(extra)
    return h


def _rest(method, table, params=None, body=None, prefer=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.request(method, url, params=params, json=body,
                         headers=_headers({'Prefer': prefer} if prefer else None), timeout=15)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase {method} {table} -> {r.status_code}: {r.text[:300]}")
    if r.text:
        try:
            return r.json()
        except ValueError:
            return None
    return None


# -----------------------------------------------------------------------------
# CONVERSÃO linha do banco <-> objeto usado pelo front-end (camelCase legado)
# -----------------------------------------------------------------------------
_INVITE_COLS = {'token', 'email', 'type', 'status', 'password_hash', 'created_at_ms', 'first_access', 'extra'}


def _invite_to_row(inv):
    inv = dict(inv)
    row = {
        'token': inv.pop('token'),
        'email': inv.pop('email', None),
        'type': inv.pop('type', None),
        'status': inv.pop('status', 'pending'),
        'created_at_ms': inv.pop('createdAt', None),
        'first_access': inv.pop('firstAccess', None),
    }
    pw = inv.pop('password', None)
    if pw is not None:
        row['password_hash'] = pw if is_hashed(pw) else hash_password(pw)
    row['extra'] = inv  # campos extras que o front venha a criar
    return row


def _row_to_invite(row, include_secret=False):
    inv = dict(row.get('extra') or {})
    inv.update({
        'token': row.get('token'),
        'email': row.get('email'),
        'type': row.get('type'),
        'status': row.get('status'),
        'createdAt': row.get('created_at_ms'),
        'firstAccess': row.get('first_access'),
    })
    if include_secret:
        inv['password'] = row.get('password_hash')
    return inv


# -----------------------------------------------------------------------------
# MODO ARQUIVO (fallback)
# -----------------------------------------------------------------------------
def _read_json(path, default):
    try:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Erro lendo {path}: {e}")
    return default


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)  # troca atômica: nunca deixa arquivo pela metade


# =============================================================================
# API PÚBLICA - CONVITES
# =============================================================================
def list_invites():
    """Lista convites SEM a senha/hash (o painel admin não precisa dela)."""
    if USE_SUPABASE:
        rows = _rest('GET', 'sisnav_invites', params={'select': '*', 'order': 'created_at_ms.desc.nullslast'})
        return [_row_to_invite(r) for r in rows or []]
    out = []
    for i in _read_json(INVITES_FILE, []):
        i = dict(i)
        i.pop('password', None)
        out.append(i)
    return out


def get_invite(token, include_secret=False):
    if not token:
        return None
    if USE_SUPABASE:
        rows = _rest('GET', 'sisnav_invites', params={'select': '*', 'token': f'eq.{token}', 'limit': 1})
        return _row_to_invite(rows[0], include_secret) if rows else None
    for i in _read_json(INVITES_FILE, []):
        if i.get('token') == token:
            i = dict(i)
            if not include_secret:
                i.pop('password', None)
            return i
    return None


def create_invite(inv):
    """Retorna 'ok' | 'duplicate'."""
    if get_invite(inv.get('token')):
        return 'duplicate'
    if USE_SUPABASE:
        _rest('POST', 'sisnav_invites', body=_invite_to_row(inv), prefer='return=minimal')
        return 'ok'
    data = _read_json(INVITES_FILE, [])
    inv = dict(inv)
    if inv.get('password') is not None and not is_hashed(inv['password']):
        inv['password'] = hash_password(inv['password'])
    data.append(inv)
    _write_json(INVITES_FILE, data)
    return 'ok'


def update_invite(token, updates):
    """Retorna True se encontrou. 'password' em updates é convertido em hash."""
    updates = dict(updates or {})
    updates.pop('token', None)  # token é a chave primária - não muda
    if USE_SUPABASE:
        current = _rest('GET', 'sisnav_invites', params={'select': '*', 'token': f'eq.{token}', 'limit': 1})
        if not current:
            return False
        merged = _row_to_invite(current[0], include_secret=True)
        merged.update(updates)
        row = _invite_to_row(merged)
        row.pop('token')
        _rest('PATCH', 'sisnav_invites', params={'token': f'eq.{token}'}, body=row, prefer='return=minimal')
        return True
    data = _read_json(INVITES_FILE, [])
    for i in data:
        if i.get('token') == token:
            if 'password' in updates and not is_hashed(updates['password']):
                updates['password'] = hash_password(updates['password'])
            i.update(updates)
            _write_json(INVITES_FILE, data)
            return True
    return False


def delete_invite(token):
    if USE_SUPABASE:
        rows = _rest('DELETE', 'sisnav_invites', params={'token': f'eq.{token}'}, prefer='return=representation')
        return bool(rows)
    data = _read_json(INVITES_FILE, [])
    new = [i for i in data if i.get('token') != token]
    if len(new) == len(data):
        return False
    _write_json(INVITES_FILE, new)
    return True


def invite_is_usable(token):
    inv = get_invite(token)
    return bool(inv and inv.get('status') in ('active', 'pending'))


# =============================================================================
# API PÚBLICA - FROTA (posições AIS-like enviadas pelo app)
# =============================================================================
def upsert_position(vessel_id, payload):
    rec = {
        'name': payload.get('name', vessel_id),
        'lat': payload.get('lat'),
        'lon': payload.get('lon'),
        'sog': payload.get('sog'),
        'cog': payload.get('cog'),
        'routeId': payload.get('routeId'),
        'destination': payload.get('destination'),
        'timestamp': time.time(),
    }
    if USE_SUPABASE:
        row = {
            'vessel_id': vessel_id, 'name': rec['name'], 'lat': rec['lat'], 'lon': rec['lon'],
            'sog': rec['sog'], 'cog': rec['cog'], 'route_id': rec['routeId'],
            'destination': rec['destination'], 'ts': rec['timestamp'],
        }
        _rest('POST', 'sisnav_fleet', params={'on_conflict': 'vessel_id'}, body=row,
              prefer='resolution=merge-duplicates,return=minimal')
        return rec
    fleet = _read_json(FLEET_FILE, {})
    fleet[vessel_id] = rec
    _write_json(FLEET_FILE, fleet)
    return rec


def _fleet_row_to_rec(r):
    return {
        'name': r.get('name'), 'lat': r.get('lat'), 'lon': r.get('lon'), 'sog': r.get('sog'),
        'cog': r.get('cog'), 'routeId': r.get('route_id'), 'destination': r.get('destination'),
        'timestamp': r.get('ts') or 0,
    }


def get_position(vessel_id):
    if USE_SUPABASE:
        rows = _rest('GET', 'sisnav_fleet', params={'select': '*', 'vessel_id': f'eq.{vessel_id}', 'limit': 1})
        return _fleet_row_to_rec(rows[0]) if rows else None
    return _read_json(FLEET_FILE, {}).get(vessel_id)


def load_fleet():
    """dict {vessel_id: rec} - mesmo formato do JSON legado."""
    if USE_SUPABASE:
        rows = _rest('GET', 'sisnav_fleet', params={'select': '*'})
        return {r['vessel_id']: _fleet_row_to_rec(r) for r in rows or []}
    return _read_json(FLEET_FILE, {})


def purge_fleet_older_than(seconds):
    cutoff = time.time() - seconds
    if USE_SUPABASE:
        _rest('DELETE', 'sisnav_fleet', params={'ts': f'lt.{cutoff}'}, prefer='return=minimal')
        return
    fleet = _read_json(FLEET_FILE, {})
    new = {k: v for k, v in fleet.items() if (v.get('timestamp') or 0) >= cutoff}
    if len(new) != len(fleet):
        _write_json(FLEET_FILE, new)


# =============================================================================
# API PÚBLICA - KV (arquivos de dados dinâmicos: marés, meteo, índice de rotas)
# =============================================================================
def kv_set(key, content_text):
    if USE_SUPABASE:
        _rest('POST', 'sisnav_kv', params={'on_conflict': 'key'},
              body={'key': key, 'value_text': content_text, 'updated_at_ms': int(time.time() * 1000)},
              prefer='resolution=merge-duplicates,return=minimal')
        return
    with open(os.path.join(KV_DIR, f'sisnav_kv_{key}'), 'w', encoding='utf-8') as f:
        f.write(content_text)


def kv_get(key):
    if USE_SUPABASE:
        rows = _rest('GET', 'sisnav_kv', params={'select': 'value_text', 'key': f'eq.{key}', 'limit': 1})
        return rows[0]['value_text'] if rows else None
    p = os.path.join(KV_DIR, f'sisnav_kv_{key}')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            return f.read()
    return None


def backend_name():
    return 'supabase' if USE_SUPABASE else 'json-files'
