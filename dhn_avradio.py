# -*- coding: utf-8 -*-
# =============================================================================
# SISNAV COSTEIRO - dhn_avradio.py (Avisos-Rádio Náuticos oficiais da DHN/CHM)
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
# Data/Hora: 2026-10-30 23:35 (UTC-3)   Versão: 3.10.2
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  v3.10.2 (2026-10-30 23:35) - Gravação CONFIRMADA no envio pelo favorito:
#   save_upload() grava com sisnav_store.kv_set SEM engolir erro e relê a chave
#   para conferir. Se falhar -> GravacaoFalhou (a página mostra "Não gravado").
#   Antes: _kv_set só registrava no log e a página dizia "recebidos" mesmo sem
#   gravar (risco de o oficial achar que o boletim estava atualizado).
#  v3.7.0 (2026-10-30) - Arquivo NOVO. Substitui a API paga Sealagom pela fonte
#   oficial e gratuita da DHN: o arquivo JSON que alimenta o mapa da página
#   "Avisos-Rádio Náuticos e SAR" do CHM (marinha.mil.br). O nome do arquivo
#   muda a cada publicação (ex.: .../files/2026-10-[DEV]/avradio_88.json), por
#   isso o endereço é DESCOBERTO lendo a página a cada consulta (com cache).
#  v3.7.1 (2026-10-30) - Em produção (Railway) a página respondeu 403 (WAF).
#   Correções: cabeçalhos idênticos aos da Meteoromarinha (que passa no WAF),
#   sessão com cabeçalhos fixos, e "plano B" no banco: último endereço do JSON
#   e última leitura boa ficam em sisnav_kv e são usados se a DHN recusar.
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
import json
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
    "NAV": "NAVAREA V",
    "SEM": "Sem série informada",
    "I": "Série I",
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
    """v3.7.1: mesmos cabeçalhos de navegador usados na Meteoromarinha (que o WAF
    da Marinha aceita a partir do Railway). Antes faltavam Upgrade-Insecure-Requests
    e Cache-Control, e a página de avisos-rádio respondia 403."""
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": referer,
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
    }


def _kv_get(key: str) -> Optional[str]:
    try:
        import sisnav_store
        return sisnav_store.kv_get(key)
    except Exception as exc:  # banco fora do ar não pode derrubar a consulta
        logger.info("kv_get %s: %s", key, exc)
        return None


def _kv_set(key: str, value: str) -> None:
    try:
        import sisnav_store
        sisnav_store.kv_set(key, value)
    except Exception as exc:
        logger.info("kv_set %s: %s", key, exc)


def discover_json_url(session: requests.Session) -> str:
    """Lê a página de avisos-rádio e devolve o endereço atual do avradio_NN.json.
    Ordem de tentativa (v3.7.1):
      1) DHN_AVRADIO_URL no ambiente (contingência manual);
      2) link encontrado na página do CHM;
      3) último endereço que funcionou, guardado no banco (sisnav_kv)."""
    forced = (os.environ.get("DHN_AVRADIO_URL") or "").strip()
    if forced:
        return forced
    try:
        r = session.get(AVRADIO_PAGE, timeout=45, headers=_headers(CHM_HOME))
        r.raise_for_status()
        found = _RE_JSON_HREF.findall(r.text)
        if not found:
            raise RuntimeError("Arquivo avradio_*.json não encontrado na página de Avisos-Rádio do CHM.")

        def num(u: str) -> int:
            m = re.search(r"avradio_(\d+)\.json", u)
            return int(m.group(1)) if m else -1

        url = urljoin(AVRADIO_PAGE, max(found, key=num))  # maior número = mais recente
        _kv_set("dhn_avradio_url", url)
        return url
    except Exception as exc:
        last = _kv_get("dhn_avradio_url")
        if last:
            logger.warning("DHN: página indisponível (%s); usando último endereço salvo.", exc)
            return last
        raise


def fetch_avisos(force: bool = False) -> Dict[str, Any]:
    """Retorna {"atualizado", "avisos", "url", "origem", "enviado_em"?}.
    v3.8.0: o firewall da Marinha só libera NAVEGADORES de verdade (desafio
    "Um momento..."). Por isso a fonte principal passa a ser a cópia enviada
    pelo botão "Enviar ao SISNAV" (save_upload). A busca direta continua como
    tentativa quando ainda não existe nenhuma cópia no banco."""
    now = time.time()
    if not force and _cache["data"] and now - _cache["t"] < min(CACHE_TTL_S, 300):
        return _cache["data"]
    saved = _kv_get("dhn_avradio_last")
    if saved:
        data = json.loads(saved)
    else:
        with requests.Session() as s:
            s.headers.update(_headers(CHM_HOME))
            url = discover_json_url(s)
            r = s.get(url, timeout=60, headers=_headers(AVRADIO_PAGE))
            r.raise_for_status()
            raw = r.json()
        data = {"atualizado": raw.get("atualizado") or "", "avisos": raw.get("avisos") or [],
                "url": url, "origem": "dhn"}
        _kv_set("dhn_avradio_last", json.dumps(data, ensure_ascii=False))
    _cache.update(t=now, data=data, url=data.get("url"))
    return data


def _parse_atualizado(txt: str) -> float:
    """'30/10/2026 03:22' (hora de Brasília) -> epoch. 0 se inválido."""
    try:
        from datetime import datetime, timedelta, timezone
        dt = datetime.strptime((txt or "").strip(), "%d/%m/%Y %H:%M")
        return dt.replace(tzinfo=timezone(timedelta(hours=-3))).timestamp()
    except Exception:
        return 0.0


class GravacaoFalhou(Exception):
    """v3.10.2: o envio era válido, mas o banco não confirmou a gravação."""


def save_upload(payload: Dict[str, Any], quem: str) -> Dict[str, Any]:
    """Valida e grava o JSON enviado pelo botão "Enviar ao SISNAV".
    Regras (evitam dado falso ou velho sobrescrevendo o bom):
      - precisa ter 'atualizado' no formato da DHN e lista 'avisos' (1 a 5000);
      - cada aviso precisa de 'numero' e 'costa';
      - só substitui a cópia atual se 'atualizado' for igual ou MAIS NOVO."""
    atual = (payload.get("atualizado") or "").strip()
    avisos = payload.get("avisos")
    t_new = _parse_atualizado(atual)
    if not t_new:
        raise ValueError("Campo 'atualizado' ausente ou fora do formato da DHN (dd/mm/aaaa hh:mm).")
    if not isinstance(avisos, list) or not (1 <= len(avisos) <= 5000):
        raise ValueError("Lista de avisos ausente ou com tamanho inválido.")
    limpos = []
    for a in avisos:
        if not isinstance(a, dict) or "numero" not in a or "costa" not in a:
            raise ValueError("Aviso sem 'numero' ou 'costa' — arquivo não parece ser da DHN.")
        limpos.append({k: (str(a.get(k)) if a.get(k) is not None else "")
                       for k in ("numero", "costa", "tipo", "textoPT", "textoEN", "geometry")})
    fonte = str(payload.get("fonte") or "")
    if fonte and not fonte.startswith("https://www.marinha.mil.br/"):
        raise ValueError("Fonte não é o site da Marinha.")

    saved = _kv_get("dhn_avradio_last")
    if saved:
        t_old = _parse_atualizado(json.loads(saved).get("atualizado", ""))
        if t_old and t_new < t_old:
            return {"status": "ignorado", "message":
                    f"O SISNAV já tem uma versão mais nova (DHN {json.loads(saved).get('atualizado')})."}

    data = {"atualizado": atual, "avisos": limpos, "url": fonte, "origem": "navegador",
            "enviado_em": time.strftime("%d/%m/%Y %H:%M", time.gmtime(time.time() - 3 * 3600)),
            "enviado_por": quem}
    # v3.10.2: grava SEM engolir erro e confere relendo (prova de gravação).
    texto = json.dumps(data, ensure_ascii=False)
    try:
        import sisnav_store
        sisnav_store.kv_set("dhn_avradio_last", texto)
        relido = sisnav_store.kv_get("dhn_avradio_last")
    except Exception as exc:
        logger.error("save_upload: falha ao gravar no banco: %s", exc)
        raise GravacaoFalhou(f"O banco de dados recusou a gravação ({type(exc).__name__}). Tente de novo em alguns minutos; se persistir, avise o administrador.")
    if relido != texto:
        raise GravacaoFalhou("A gravação não foi confirmada na releitura do banco. Tente de novo; se persistir, avise o administrador.")
    if fonte:
        _kv_set("dhn_avradio_url", fonte)  # auxiliar: falhar aqui não compromete o envio
    _cache.update(t=0.0, data=None)  # força releitura
    return {"status": "ok", "message": f"{len(limpos)} avisos da DHN (atualizados em {atual}) gravados e conferidos no banco do SISNAV."}


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
            if classify(a) in ("NAV", "SAR"):
                sem_pos.append(a)
            continue
        if bbox is None or any(_in_bbox(la, lo, bbox) for la, lo in pts):
            na_rota.append(a)
    return na_rota, sem_pos


def _fmt(a: Dict[str, Any]) -> str:
    texto = (a.get("textoPT") or a.get("textoEN") or "").replace("\r\n", "\n").strip()
    return f"--- {a.get('numero', '?')} ---\n{texto}"


def _aviso_idade(atualizado: str) -> str:
    """Alerta quando a cópia tem mais de 24 h: o oficial deve reenviar."""
    t = _parse_atualizado(atualizado)
    if t and time.time() - t > 24 * 3600:
        h = int((time.time() - t) // 3600)
        return (f"ATENÇÃO: cópia com {h} h. Abra a página de Avisos-Rádio da DHN e clique no "
                f"favorito 'Enviar ao SISNAV' para atualizar.\n")
    return ""


def classify(a: Dict[str, Any]) -> str:
    """Série do aviso. v3.8.0: 'I' NÃO é tratado como NAVAREA V (correção);
    NAVAREA V é reconhecido pelo número ('NAVAREA ...'). Códigos ainda a
    confirmar com os dados reais ficam com nome neutro ('Série I')."""
    num = (a.get("numero") or "").upper()
    if "NAVAREA" in num:
        return "NAV"
    c = (a.get("costa") or "").strip()
    return c or "SEM"


def format_blocks(data: Dict[str, Any], bbox: Optional[Dict[str, float]]) -> Dict[str, str]:
    """Gera os dois textos que o front exibe:
       navarea  -> NAVAREA V + SAR (na rota) + NAVAREA/SAR sem posição
       costeiro -> Costa Norte/Leste/Sul + Hidrovias (na rota)"""
    na_rota, sem_pos = select_for_route(data["avisos"], bbox)
    cab = (
        f"Fonte: DHN/CHM — Avisos-Rádio Náuticos e SAR (oficial)\n"
        f"Atualizado pela DHN em: {data.get('atualizado') or '?'}"
        + (f" | enviado ao SISNAV em {data['enviado_em']}" if data.get("enviado_em") else "")
        + "\n"
        + _aviso_idade(data.get("atualizado", ""))
        + f"Total publicado: {len(data['avisos'])} avisos | na área da rota: {len(na_rota)}\n"
        + "=" * 60
    )

    def bloco(costas: List[str], extra: Optional[List[Dict[str, Any]]] = None) -> str:
        partes = [cab]
        n = 0
        for c in costas:
            itens = [a for a in na_rota if classify(a) == c]
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
        "navarea": bloco(["NAV", "SAR"], sem_pos),
        "costeiro": bloco(["N", "E", "S", "I", "HG", "SEM"]),
    }
