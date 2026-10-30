# -*- coding: utf-8 -*-
# =============================================================================
# SISNAV COSTEIRO - dhn_avradio.py (Avisos-Rádio Náuticos oficiais da DHN/CHM)
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
# Data/Hora: 2026-10-30 (UTC-3)   Versão: 3.7.0 (Etapa A)
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  v3.7.0 (2026-10-30) - Arquivo NOVO. Substitui a API paga Sealagom pela fonte
#   oficial e gratuita da DHN: o arquivo JSON que alimenta o mapa da página
#   "Avisos-Rádio Náuticos e SAR" do CHM (marinha.mil.br). O nome do arquivo
#   muda a cada publicação (ex.: .../files/2026-10-[DEV]/avradio_88.json), por
#   isso o endereço é DESCOBERTO lendo a página a cada consulta (com cache).
# -----------------------------------------------------------------------------
# ESTRUTURA DO JSON (observada em 30/10/2026, 636 avisos):
#   {"atualizado": "30/10/2026 03:22",
#    "avisos": [{"numero": "SAR 0150/26", "costa": "SAR", "tipo": "Z",
#                "textoPT": "...", "textoEN": "...",
#                "geometry": "new google.maps.Marker({\"position\": new google.maps.LatLng(-0.97,-46.72)})"}]}
#   costa: I = NAVAREA V | N = Costa Norte | E = Costa Leste | S = Costa Sul
#          HG = Hidrovias | SAR = Busca e salvamento | " " = sem costa
#   geometry: Marker (ponto), Polygon/Polyline (vários LatLng), Circle (centro)
#             ou vazio - nesse caso a posição costuma estar no TEXTO, no padrão
#             náutico "00-58.18S 046-43.37W" (graus-minutos.decimais).
# -----------------------------------------------------------------------------
# FILTRO PELA DERROTA:
#   Um aviso entra se QUALQUER ponto dele cair na caixa lat/lon da rota
#   (portos de saída e chegada + margem de 1°). Analogia: é a "faixa de
#   segurança" do planejamento - tudo que cai dentro do corredor é lido.
#   Aviso sem posição alguma: entra numa lista à parte ("sem posição") só se
#   for NAVAREA V ou SAR, para o oficial avaliar manualmente.
#
# CONVERSÃO DE COORDENADAS (texto -> decimal):
#   decimal = graus + minutos / 60 ;  sinal negativo para S e W
#   ex.: 00-58.18S -> -(0 + 58.18/60) = -0.96967
# =============================================================================
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)

AVRADIO_PAGE = (
    "https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/"
    "avisos-radio-nauticos-e-sar"
)
CHM_HOME = "https://www.marinha.mil.br/chm/"
CACHE_TTL_S = int(os.environ.get("DHN_AVRADIO_CACHE_S") or "1800")  # 30 min

COSTA_NOMES = {
    "I": "NAVAREA V",
    "N": "Costa Norte",
    "E": "Costa Leste",
    "S": "Costa Sul",
    "HG": "Hidrovias",
    "SAR": "SAR (busca e salvamento)",
}
COSTA_ORDEM = ["I", "N", "E", "S", "SAR", "HG"]

_RE_JSON_HREF = re.compile(r"""["']([^"']*avradio_\d+\.json)["']""", re.I)
_RE_LATLNG = re.compile(r"LatLng\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)")
_RE_TXT_COORD = re.compile(
    r"(\d{1,2})-(\d{1,2}(?:\.\d+)?)\s*([NS])\s+(\d{1,3})-(\d{1,2}(?:\.\d+)?)\s*([EW])"
)

_cache: Dict[str, Any] = {"t": 0.0, "data": None, "url": None}


# -----------------------------------------------------------------------------
# DOWNLOAD
# -----------------------------------------------------------------------------
def _headers(referer: str) -> Dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
        "Referer": referer,
    }


def discover_json_url(session: requests.Session) -> str:
    """Lê a página de avisos-rádio e devolve o endereço atual do avradio_NN.json.
    DHN_AVRADIO_URL no ambiente força um endereço fixo (contingência)."""
    forced = (os.environ.get("DHN_AVRADIO_URL") or "").strip()
    if forced:
        return forced
    r = session.get(AVRADIO_PAGE, timeout=45, headers=_headers(CHM_HOME))
    r.raise_for_status()
    found = _RE_JSON_HREF.findall(r.text)
    if not found:
        raise RuntimeError("Arquivo avradio_*.json não encontrado na página de Avisos-Rádio do CHM.")
    # Se houver mais de um, usa o de maior número (o mais recente).
    def num(u: str) -> int:
        m = re.search(r"avradio_(\d+)\.json", u)
        return int(m.group(1)) if m else -1
    best = max(found, key=num)
    return urljoin(AVRADIO_PAGE, best)


def fetch_avisos(force: bool = False) -> Dict[str, Any]:
    """Retorna {"atualizado", "avisos", "url"}; usa cache de CACHE_TTL_S segundos."""
    now = time.time()
    if not force and _cache["data"] and now - _cache["t"] < CACHE_TTL_S:
        return _cache["data"]
    with requests.Session() as s:
        try:
            s.get(CHM_HOME, timeout=20, headers=_headers(CHM_HOME))  # aquece cookies do WAF
        except requests.RequestException as exc:
            logger.info("DHN warm-up: %s", exc)
        url = discover_json_url(s)
        r = s.get(url, timeout=60, headers=_headers(AVRADIO_PAGE))
        r.raise_for_status()
        raw = r.json()
    data = {
        "atualizado": raw.get("atualizado") or "",
        "avisos": raw.get("avisos") or [],
        "url": url,
    }
    _cache.update(t=now, data=data, url=url)
    return data


# -----------------------------------------------------------------------------
# POSIÇÕES
# -----------------------------------------------------------------------------
def points_from_geometry(geometry: Optional[str]) -> List[Tuple[float, float]]:
    """Extrai todos os (lat, lon) de uma string 'new google.maps.X(...)'."""
    if not geometry:
        return []
    return [(float(a), float(b)) for a, b in _RE_LATLNG.findall(geometry)]


def points_from_text(text: Optional[str]) -> List[Tuple[float, float]]:
    """Extrai posições no padrão náutico 'GG-MM.mmS GGG-MM.mmW' do texto."""
    out: List[Tuple[float, float]] = []
    for gl, ml, ns, gL, mL, ew in _RE_TXT_COORD.findall(text or ""):
        lat = int(gl) + float(ml) / 60.0
        lon = int(gL) + float(mL) / 60.0
        out.append((-lat if ns == "S" else lat, -lon if ew == "W" else lon))
    return out


def aviso_points(aviso: Dict[str, Any]) -> List[Tuple[float, float]]:
    pts = points_from_geometry(aviso.get("geometry"))
    return pts or points_from_text(aviso.get("textoPT"))


def _in_bbox(lat: float, lon: float, bbox: Dict[str, float]) -> bool:
    return bbox["min_lat"] <= lat <= bbox["max_lat"] and bbox["min_lon"] <= lon <= bbox["max_lon"]


# -----------------------------------------------------------------------------
# FILTRO E FORMATAÇÃO
# -----------------------------------------------------------------------------
def select_for_route(avisos: List[Dict[str, Any]], bbox: Optional[Dict[str, float]]):
    """Devolve (na_rota, sem_posicao). Sem bbox (portos não informados) => todos."""
    na_rota, sem_pos = [], []
    for a in avisos:
        costa = (a.get("costa") or "").strip()
        pts = aviso_points(a)
        if not pts:
            if costa in ("I", "SAR"):
                sem_pos.append(a)
            continue
        if bbox is None or any(_in_bbox(la, lo, bbox) for la, lo in pts):
            na_rota.append(a)
    return na_rota, sem_pos


def _fmt(a: Dict[str, Any]) -> str:
    texto = (a.get("textoPT") or a.get("textoEN") or "").replace("\r\n", "\n").strip()
    return f"--- {a.get('numero', '?')} ---\n{texto}"


def format_blocks(data: Dict[str, Any], bbox: Optional[Dict[str, float]]) -> Dict[str, str]:
    """Gera os dois textos que o front exibe:
       navarea  -> NAVAREA V + SAR (na rota) + NAVAREA/SAR sem posição
       costeiro -> Costa Norte/Leste/Sul + Hidrovias (na rota)"""
    na_rota, sem_pos = select_for_route(data["avisos"], bbox)
    cab = (
        f"Fonte: DHN/CHM — Avisos-Rádio Náuticos e SAR (oficial)\n"
        f"Atualizado pela DHN em: {data.get('atualizado') or '?'}\n"
        f"Total publicado: {len(data['avisos'])} avisos | na área da rota: {len(na_rota)}\n"
        + "=" * 60
    )

    def bloco(costas: List[str], extra: Optional[List[Dict[str, Any]]] = None) -> str:
        partes = [cab]
        n = 0
        for c in costas:
            itens = [a for a in na_rota if (a.get("costa") or "").strip() == c]
            if not itens:
                continue
            partes.append(f"\n## {COSTA_NOMES.get(c, c)} — {len(itens)} aviso(s)\n")
            partes.extend(_fmt(a) for a in itens)
            n += len(itens)
        if extra:
            partes.append(f"\n## Sem posição informada — avaliar manualmente ({len(extra)})\n")
            partes.extend(_fmt(a) for a in extra)
        if n == 0 and not extra:
            partes.append("\n(Nenhum aviso em vigor com posição dentro da área da rota.)")
        return "\n".join(partes)

    return {
        "navarea": bloco(["I", "SAR"], sem_pos),
        "costeiro": bloco(["N", "E", "S", "HG"]),
    }
