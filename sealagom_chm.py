# -*- coding: utf-8 -*-
"""
Agrega dados para Meteomarinha, Avisos de Mau Tempo (CHM oficial) e NAVAREA / avisos costeiros (Sealagom).
O token Sealagom vem de SEALAGOM_API_TOKEN (nunca expor no browser).
Documentação: https://www.sealagom.com/api/docs/
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SEALAGOM_BASE = "https://sealagom.com/api/v1"

URLS_CHM = {
    "meteoromarinha": "https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas",
    "avisos_mau_tempo": "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo",
}

# Mesmos IDs/lat/lon que js/services/PortDatabase.js (derrota origem–destino)
PORT_COORDS: Dict[str, Tuple[float, float]] = {
    "BR_STN": (-0.058, -51.170),
    "BR_VDC": (-1.533, -48.750),
    "BR_BEL": (-1.450, -48.500),
    "BR_ITQ": (-2.566, -44.366),
    "BR_PEC": (-3.550, -38.800),
    "BR_FOR": (-3.716, -38.466),
    "BR_NAT": (-5.755, -35.192),
    "BR_CAB": (-6.971, -34.838),
    "BR_SUA": (-8.397, -34.959),
    "BR_REC": (-8.050, -34.866),
    "BR_MAC": (-9.673, -35.725),
    "BR_SAL": (-12.966, -38.516),
    "BR_ILH": (-14.793, -39.032),
    "BR_VIT": (-20.316, -40.283),
    "BR_RIO": (-22.896, -43.165),
    "BR_ITG": (-22.930, -43.840),
    "BR_ANG": (-23.000, -44.316),
    "BR_SSB": (-23.815, -45.416),
    "BR_STS": (-23.960, -46.310),
    "BR_PNG": (-25.583, -48.316),
    "BR_SFS": (-26.233, -48.633),
    "BR_ITJ": (-26.916, -48.650),
    "BR_IMB": (-28.233, -48.650),
    "BR_RIG": (-32.180, -52.080),
}


def route_bbox(dep_id: str, arr_id: str, margin_deg: float = 1.0) -> Optional[Dict[str, float]]:
    p1 = PORT_COORDS.get(dep_id)
    p2 = PORT_COORDS.get(arr_id)
    if not p1 or not p2:
        return None
    lat1, lon1 = p1
    lat2, lon2 = p2
    return {
        "min_lat": min(lat1, lat2) - margin_deg,
        "max_lat": max(lat1, lat2) + margin_deg,
        "min_lon": min(lon1, lon2) - margin_deg,
        "max_lon": max(lon1, lon2) + margin_deg,
    }


def _point_in_bbox(lat: float, lon: float, bbox: Dict[str, float]) -> bool:
    return (
        bbox["min_lat"] <= lat <= bbox["max_lat"]
        and bbox["min_lon"] <= lon <= bbox["max_lon"]
    )


def _extract_decimal_points(msg: Dict[str, Any]) -> List[Tuple[float, float]]:
    """Devolve [(lat, lon), ...] a partir de coordinates.decimal_coordinates."""
    out: List[Tuple[float, float]] = []
    coords = msg.get("coordinates") or {}
    dec = coords.get("decimal_coordinates")
    if not dec:
        return out
    for pair in dec:
        if isinstance(pair, (list, tuple)) and len(pair) >= 2:
            try:
                lat, lon = float(pair[0]), float(pair[1])
                out.append((lat, lon))
            except (TypeError, ValueError):
                continue
    return out


def message_touches_route(msg: Dict[str, Any], bbox: Optional[Dict[str, float]]) -> bool:
    if not bbox:
        return True
    pts = _extract_decimal_points(msg)
    if not pts:
        return True
    return any(_point_in_bbox(lat, lon, bbox) for lat, lon in pts)


def _sealagom_headers(token: str) -> Dict[str, str]:
    return {
        "X-API-Token": token,
        "User-Agent": "SISNAV-Costeiro/1.0 (+https://github.com/Jbvix/sisnav-costeiro)",
    }


def _fetch_sealagom_paginated(first_url: str, token: str) -> List[Dict[str, Any]]:
    headers = _sealagom_headers(token)
    items: List[Dict[str, Any]] = []
    url: Optional[str] = first_url
    for _ in range(50):
        if not url:
            break
        resp = requests.get(url, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        items.extend(data.get("results") or [])
        url = data.get("next")
    return items


def _chm_page_plaintext(url: str, max_chars: int = 250_000) -> str:
    r = requests.get(
        url,
        timeout=45,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SISNAV-Costeiro/1.0; +https://github.com/Jbvix/sisnav-costeiro)"
        },
    )
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    block = soup.find("div", class_="region-content") or soup.body
    if not block:
        return ""
    lines = [ln.strip() for ln in block.get_text("\n", strip=True).split("\n") if ln.strip()]
    text = "\n".join(lines)
    return text[:max_chars]


def format_navarea_v_block(items: List[Dict[str, Any]], bbox: Optional[Dict[str, float]]) -> str:
    lines: List[str] = []
    ts = __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M")
    lines.append(f"NAVAREA — fonte Sealagom (filtrado à rota quando há coordenadas) — {ts}")
    lines.append("=" * 60)

    for area in items:
        title = area.get("title") or ""
        if not re.search(r"NAVAREA\s*V\b", title, re.I):
            continue
        lines.append(f"\n## {area.get('title', 'NAVAREA')}")
        for msg in area.get("active_messages") or []:
            if not message_touches_route(msg, bbox):
                continue
            num = msg.get("number") or ""
            added = msg.get("added_on") or ""
            body = (msg.get("content") or "").strip()
            lines.append(f"\n--- {num} ({added}) ---\n{body}")

    if len(lines) <= 2:
        lines.append("\n(Nenhuma mensagem ativa NAVAREA V retornada pela API ou filtro excluiu todas.)")
    return "\n".join(lines)


def _is_brazil_coastal(entry: Dict[str, Any]) -> bool:
    country = (entry.get("country") or "") + " " + (entry.get("title") or "")
    c = country.upper()
    return "BRAZIL" in c or "BRASIL" in c or "BRA" in c


def format_coastal_block(items: List[Dict[str, Any]], bbox: Optional[Dict[str, float]]) -> str:
    lines: List[str] = []
    ts = __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M")
    lines.append(f"Avisos costeiros (Sealagom) — {ts}")
    lines.append("=" * 60)

    brazil_only = [a for a in items if _is_brazil_coastal(a)]
    use_list = brazil_only if brazil_only else items

    count = 0
    for area in use_list:
        t = area.get("title") or "Coastal"
        lines.append(f"\n## {t}")
        for msg in area.get("active_messages") or []:
            if not message_touches_route(msg, bbox):
                continue
            num = msg.get("number") or ""
            added = msg.get("added_on") or ""
            body = (msg.get("content") or "").strip()
            lines.append(f"\n--- {num} ({added}) ---\n{body}")
            count += 1

    if count == 0:
        lines.append("\n(Nenhum aviso costeiro do Brasil com interseção na caixa da rota, ou API sem coordenadas.)")
    return "\n".join(lines)


def fetch_all(dep_port: Optional[str], arr_port: Optional[str], token: str) -> Dict[str, Any]:
    if not token or not str(token).strip():
        return {"status": "error", "message": "SEALAGOM_API_TOKEN não definido no servidor."}

    bbox = None
    if dep_port and arr_port:
        bbox = route_bbox(dep_port, arr_port)

    q = "include_messages=true&include_coordinates=true&include_enhanced_coordinates=true&include_keywords=true"
    nav_url = f"{SEALAGOM_BASE}/navarea/?{q}"

    try:
        nav_items = _fetch_sealagom_paginated(nav_url, token)
    except requests.HTTPError as e:
        logger.exception("Sealagom navarea HTTP")
        return {"status": "error", "message": f"Sealagom NAVAREA: {e.response.status_code}"}

    coastal_url = f"{SEALAGOM_BASE}/coastal/?{q}&country=Brazil"
    try:
        coastal_items = _fetch_sealagom_paginated(coastal_url, token)
    except requests.HTTPError:
        logger.info("Sealagom coastal com country=Brazil falhou; tentando sem filtro país.")
        coastal_url = f"{SEALAGOM_BASE}/coastal/?{q}"
        try:
            coastal_items = _fetch_sealagom_paginated(coastal_url, token)
        except requests.HTTPError as e2:
            logger.exception("Sealagom coastal HTTP")
            return {"status": "error", "message": f"Sealagom coastal: {e2.response.status_code}"}

    nav_text = format_navarea_v_block(nav_items, bbox)
    coastal_text = format_coastal_block(coastal_items, bbox)

    try:
        meteo = _chm_page_plaintext(URLS_CHM["meteoromarinha"])
    except Exception as e:
        logger.warning("CHM meteo fetch failed: %s", e)
        meteo = f"(Erro ao obter Meteomarinha do CHM: {e})"

    try:
        mau_chm = _chm_page_plaintext(URLS_CHM["avisos_mau_tempo"])
    except Exception as e:
        logger.warning("CHM mau tempo fetch failed: %s", e)
        mau_chm = f"(Erro ao obter Avisos de Mau Tempo do CHM: {e})"

    # Caixa “Avisos de Mau Tempo”: texto oficial CHM + bloco costeiro Sealagom (avisos localizados)
    mau_combined = (
        "=== AVISOS DE MAU TEMPO (CHM / Marinha) ===\n\n"
        + mau_chm
        + "\n\n\n=== AVISOS COSTEIROS — Sealagom (Brasil, trecho da rota quando há coordenadas) ===\n\n"
        + coastal_text
    )

    if bbox:
        hdr = (
            f"Trecho considerado (caixa lat/lon com margem): "
            f"lat [{bbox['min_lat']:.3f}, {bbox['max_lat']:.3f}], "
            f"lon [{bbox['min_lon']:.3f}, {bbox['max_lon']:.3f}]\n"
            f"Portos: {dep_port or '?'} → {arr_port or '?'}\n\n"
        )
        nav_text = hdr + nav_text
        mau_combined = hdr + mau_combined

    return {
        "status": "success",
        "data": {
            "meteo": meteo,
            "mau_tempo": mau_combined,
            "navarea": nav_text,
        },
    }
