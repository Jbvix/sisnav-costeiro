# -*- coding: utf-8 -*-
"""
v3.10.3 (2026-11-01 11:13 UTC-3 - Jossian Brito / assistido por Claude): removido o código
morto da API Sealagom (8 funções e a constante SEALAGOM_BASE, desligados desde a
v3.7.0). O parâmetro token de fetch_all() passa a ser opcional e é ignorado.
Este módulo segue em uso para a Meteoromarinha e os Avisos de Mau Tempo do CHM.

v3.7.0 (2026-10-30 - Jossian Brito / assistido por Claude): NAVAREA V e avisos
costeiros agora vêm da DHN (dhn_avradio.py); Sealagom desligado. O parâmetro
token de fetch_all() é mantido só por compatibilidade e não é mais usado.

Agrega dados para Meteomarinha, Avisos de Mau Tempo (CHM oficial, HTML marinha.mil.br)
e NAVAREA / avisos costeiros (API Sealagom — não inclui texto Meteomarinha CHM).
O token Sealagom é passado pelo servidor (env: SEALAGOM_API_TOKEN ou sisnav_costeiro no cPanel).
Documentação Sealagom: https://www.sealagom.com/api/docs/
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


# Páginas HTML oficiais do CHM (não há endpoint Sealagom para Meteomarinha / aviso texto CHM).
# Ordem: tentar 24h, depois 48h (meteo); WAF da Marinha pode bloquear IPs de datacenter (403).
CHM_HOME = "https://www.marinha.mil.br/chm/"
URLS_CHM_METEO = [
    "https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas",
    "https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-48-horas",
]
URLS_CHM_MAU = [
    "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo",
]

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


def _chm_browser_headers(referer: str) -> Dict[str, str]:
    """Cabeçalhos próximos de um browser; reduz 403 por WAF em relação a User-Agent mínimo."""
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": referer,
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
    }


def _chm_page_plaintext(url: str, max_chars: int = 250_000) -> str:
    """GET HTML do CHM com sessão + cookies (warm-up na home do CHM)."""
    headers = _chm_browser_headers(CHM_HOME)
    with requests.Session() as s:
        s.headers.update(headers)
        try:
            s.get(CHM_HOME, timeout=25, allow_redirects=True)
        except requests.RequestException as exc:
            logger.info("CHM warm-up %s: %s", CHM_HOME, exc)
        r = s.get(url, timeout=45, allow_redirects=True)
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


def _chm_fetch_first_ok(urls: List[str], label: str, max_chars: int = 250_000) -> str:
    """Tenta várias URLs CHM; útil se uma página responder 403 e outra não."""
    last: Optional[BaseException] = None
    for u in urls:
        try:
            return _chm_page_plaintext(u, max_chars=max_chars)
        except requests.HTTPError as e:
            last = e
            code = e.response.status_code if e.response is not None else "?"
            logger.warning("CHM %s HTTP %s — %s", label, code, u)
        except Exception as e:
            last = e
            logger.warning("CHM %s falhou — %s: %s", label, u, e)
    if last is not None:
        raise last
    raise RuntimeError(f"CHM {label}: lista de URLs vazia")


def _chm_error_message(label: str, exc: BaseException) -> str:
    base = f"(Erro ao obter {label} do CHM: {exc})"
    if isinstance(exc, requests.HTTPError) and exc.response is not None and exc.response.status_code == 403:
        base += (
            " [403: o marinha.mil.br costuma bloquear pedidos automatizados ou IPs de alojamento "
            "(WAF). A API Sealagom não substitui estas páginas — use o site no browser e «Colar», "
            "ou um proxy no Brasil se o bloqueio for por geolocalização.]"
        )
    return base


def fetch_all(dep_port: Optional[str], arr_port: Optional[str], token: str = "") -> Dict[str, Any]:
    """
    Meteomarinha e avisos CHM (HTML) são sempre tentados.
    Sealagom (NAVAREA + costeiro) é opcional: falhas HTTP (ex.: 403 token/plano)
    não impedem o restante; o cliente recebe status 'partial' e avisos em 'warnings'.
    """
    token = (token or "").strip()
    bbox = None
    if dep_port and arr_port:
        bbox = route_bbox(dep_port, arr_port)

    # v3.7.0 (2026-10-30, Etapa A): NAVAREA V e avisos costeiros passam a vir
    # da fonte OFICIAL da DHN (avisos-rádio náuticos, JSON público do CHM).
    # A API Sealagom (paga, com token) foi desligada a pedido do Comandante.
    warnings: List[str] = []
    try:
        import dhn_avradio
        dhn = dhn_avradio.fetch_avisos()
        blocos = dhn_avradio.format_blocks(dhn, bbox)
        nav_text = blocos["navarea"]
        coastal_text = blocos["costeiro"]
    except Exception as e:
        logger.exception("DHN avisos-radio")
        warnings.append(f"Avisos-Rádio DHN indisponíveis no momento: {e}")
        nav_text = "(Avisos-Rádio NAVAREA V da DHN indisponíveis — consulte https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar)"
        coastal_text = "(Avisos costeiros da DHN indisponíveis.)"

    try:
        meteo = _chm_fetch_first_ok(URLS_CHM_METEO, "Meteomarinha")
    except Exception as e:
        logger.warning("CHM meteo fetch failed: %s", e)
        meteo = _chm_error_message("Meteomarinha", e)

    try:
        mau_chm = _chm_fetch_first_ok(URLS_CHM_MAU, "Avisos de Mau Tempo")
    except Exception as e:
        logger.warning("CHM mau tempo fetch failed: %s", e)
        mau_chm = _chm_error_message("Avisos de Mau Tempo", e)

    # Caixa “Avisos de Mau Tempo”: texto oficial CHM + bloco costeiro Sealagom (avisos localizados)
    mau_combined = (
        "=== AVISOS DE MAU TEMPO (CHM / Marinha) ===\n\n"
        + mau_chm
        + "\n\n\n=== AVISOS-RÁDIO COSTEIROS — DHN (trecho da rota) ===\n\n"
        + coastal_text
    )

    if warnings:
        banner = "=== AVISOS DE INTEGRAÇÃO (servidor) ===\n" + "\n".join(f"- {w}" for w in warnings) + "\n\n"
        nav_text = banner + nav_text
        mau_combined = banner + mau_combined

    if bbox:
        hdr = (
            f"Trecho considerado (caixa lat/lon com margem): "
            f"lat [{bbox['min_lat']:.3f}, {bbox['max_lat']:.3f}], "
            f"lon [{bbox['min_lon']:.3f}, {bbox['max_lon']:.3f}]\n"
            f"Portos: {dep_port or '?'} → {arr_port or '?'}\n\n"
        )
        nav_text = hdr + nav_text
        mau_combined = hdr + mau_combined

    status = "partial" if warnings else "success"
    out: Dict[str, Any] = {
        "status": status,
        "data": {
            "meteo": meteo,
            "mau_tempo": mau_combined,
            "navarea": nav_text,
        },
    }
    if warnings:
        out["warnings"] = warnings
    return out
