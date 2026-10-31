# =============================================================================
# SISNAV COSTEIRO - marine_openmeteo.py (previsão do mar por perna da rota)
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems
# Data/Hora: 2026-10-30 23:05 (UTC-3)   Versão: 1.0 (v3.10.0)
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  1.0 (v3.10.0, 2026-10-30) - Arquivo NOVO (Etapa B, assistido por Claude):
#   [1] Consulta Open-Meteo Marine (onda, swell, corrente) e Forecast (vento)
#       para o PONTO MÉDIO de cada perna, na HORA ESTIMADA de passagem.
#   [2] Todas as pernas numa única chamada a cada API (coordenadas separadas
#       por vírgula) + cache de 1 h em memória -> muito abaixo do limite
#       gratuito (10.000 chamadas/dia, 600/min, por IP).
#   [3] Decompõe corrente e vento no RUMO da perna (SOG estimada, abatimento,
#       vento de proa) e classifica a perna: normal / atenção / restritivo.
# -----------------------------------------------------------------------------
# FONTES E CONVENÇÕES (verificadas na documentação oficial em 2026-10-30):
#   - Onda e swell: direção "DE ONDE VEM" (0° = vem do norte).
#   - Vento a 10 m: direção meteorológica, "DE ONDE SOPRA".
#   - Corrente: direção "PARA ONDE VAI" (segue o fluxo; 0° = corre para o norte).
#   - Corrente: modelo MeteoFrance SMOC (Copernicus Marine), ~8 km, com maré;
#     velocidade em km/h -> convertida para nós (÷ 1,852).
#   - Horizonte: Marine até 8 dias; Forecast até 16 dias.
#   - Licença CC BY 4.0, uso NÃO comercial gratuito (citar a fonte).
# ANALOGIA: é o "boletim do prático" para cada trecho - não substitui a
# tábua de marés da DHN nem a Meteoromarinha do CHM, que seguem oficiais.
# =============================================================================
import math
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

URL_MARINE = "https://marine-api.open-meteo.com/v1/marine"
URL_FORECAST = "https://api.open-meteo.com/v1/forecast"
MAX_PERNAS = 60          # teto por consulta (uma derrota costeira longa tem ~20-40 pernas)
CACHE_TTL_S = 3600       # 1 h: os modelos são atualizados a cada poucas horas
KMH_POR_NO = 1.852       # 1 nó = 1 milha náutica/hora = 1,852 km/h

# Limites do selo (aprovados por Jossian Brito em 2026-10-30). Ajustar aqui.
LIMITES = {
    "hs_atencao_m": 2.0, "hs_restritivo_m": 3.0,          # altura significativa de onda
    "vento_atencao_kn": 20.0, "vento_restritivo_kn": 28.0,  # vento médio (Beaufort 6 e 7)
}

VARS_MARINE = ["wave_height", "wave_direction", "wave_period",
               "swell_wave_height", "swell_wave_direction", "swell_wave_period",
               "ocean_current_velocity", "ocean_current_direction"]
VARS_VENTO = ["wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"]

_cache: Dict[str, Any] = {}


# -----------------------------------------------------------------------------
# FÓRMULAS
# -----------------------------------------------------------------------------
def ang_rel(direcao: float, rumo: float) -> float:
    """Ângulo de 'direcao' em relação à proa, normalizado em -180..+180.
    Ex.: rumo 090°, direção 120° -> +30° (30° por boreste da proa)."""
    return (direcao - rumo + 540.0) % 360.0 - 180.0


def decompor_corrente(vc_kn: float, dir_para: float, rumo: float, vel_maquina: float) -> Dict[str, float]:
    """Corrente no referencial da perna.
        a = θc − R   (θc = para onde a corrente vai; R = rumo da perna)
        longitudinal = Vc · cos(a)   (+ a favor | − contra)
        transversal  = Vc · sen(a)   (+ empurra para boreste | − para bombordo)
        SOG ≈ Vmáquina + longitudinal          (aproximação para corrente << Vmáq)
        abatimento ≈ atan(transversal / SOG)   (graus a corrigir no rumo)
    Ex.: Vc=1,2 kn contra a 30° da proa (a=150°): long=−1,04 kn, transv=+0,60 kn;
         a 10 kn -> SOG 8,96 kn e abatimento ≈ 3,8°."""
    a = math.radians(ang_rel(dir_para, rumo))
    longi = vc_kn * math.cos(a)
    transv = vc_kn * math.sin(a)
    sog = max(0.5, vel_maquina + longi)  # piso de 0,5 kn evita divisão por ~0
    abat = math.degrees(math.atan2(transv, sog))
    return {"long_kn": round(longi, 2), "transv_kn": round(transv, 2),
            "sog_kn": round(sog, 2), "abatimento_graus": round(abat, 1)}


def vento_de_proa(vw_kn: float, dir_de: float, rumo: float) -> float:
    """Componente do vento NA PROA: Vw · cos(θw − R), com θw = de onde sopra.
    + = vento de proa (aumenta consumo) | − = vento de popa."""
    return round(vw_kn * math.cos(math.radians(ang_rel(dir_de, rumo))), 1)


def setor(direcao_de: float, rumo: float) -> str:
    """Setor de chegada da onda: proa (|rel|<45°), través (45-135°), popa (>135°)."""
    r = abs(ang_rel(direcao_de, rumo))
    return "proa" if r < 45 else ("través" if r <= 135 else "popa")


def classificar(hs: Optional[float], vento: Optional[float]) -> str:
    """Pior caso entre onda e vento (o limite mais restritivo manda)."""
    nivel = "normal"
    if (hs is not None and hs >= LIMITES["hs_atencao_m"]) or (vento is not None and vento >= LIMITES["vento_atencao_kn"]):
        nivel = "atencao"
    if (hs is not None and hs >= LIMITES["hs_restritivo_m"]) or (vento is not None and vento >= LIMITES["vento_restritivo_kn"]):
        nivel = "restritivo"
    return nivel


# -----------------------------------------------------------------------------
# CONSULTA
# -----------------------------------------------------------------------------
def _consultar(url: str, lats: List[float], lons: List[float], variaveis: List[str], extra: Dict[str, str]) -> List[Dict]:
    params = {"latitude": ",".join(f"{v:.3f}" for v in lats),
              "longitude": ",".join(f"{v:.3f}" for v in lons),
              "hourly": ",".join(variaveis), "timezone": "GMT", **extra}
    r = requests.get(url, params=params, timeout=20, headers={"User-Agent": "SISNAV-Costeiro/3.10 (TugLife)"})
    r.raise_for_status()
    dados = r.json()
    return dados if isinstance(dados, list) else [dados]


def _com_cache(chave: str, func):
    agora = time.time()
    item = _cache.get(chave)
    if item and agora - item[0] < CACHE_TTL_S:
        return item[1], True
    valor = func()
    _cache[chave] = (agora, valor)
    if len(_cache) > 200:  # limpeza simples: descarta os mais antigos
        for k in sorted(_cache, key=lambda k: _cache[k][0])[:100]:
            _cache.pop(k, None)
    return valor, False


def _indice_hora(tempos: List[str], alvo_ms: float) -> Optional[int]:
    """Índice da hora mais próxima do instante alvo; None se fora da série."""
    if not tempos:
        return None
    t0 = datetime.fromisoformat(tempos[0]).replace(tzinfo=timezone.utc).timestamp()
    i = round((alvo_ms / 1000.0 - t0) / 3600.0)
    return i if 0 <= i < len(tempos) else None


def _val(serie: Dict[str, List], nome: str, i: int) -> Optional[float]:
    v = (serie.get(nome) or [None] * (i + 1))[i] if i is not None else None
    return None if v is None else float(v)


def previsao_pernas(pernas: List[Dict[str, Any]]) -> Dict[str, Any]:
    """pernas: [{lat, lon, t_ms (UTC, meio da perna), rumo, dist_nm, vel_kn}]."""
    if not pernas:
        raise ValueError("Nenhuma perna informada.")
    if len(pernas) > MAX_PERNAS:
        raise ValueError(f"Rota com {len(pernas)} pernas; o limite é {MAX_PERNAS}.")
    lats = [round(float(p["lat"]), 2) for p in pernas]
    lons = [round(float(p["lon"]), 2) for p in pernas]
    # Chave do cache: pontos arredondados (~1 km) + hora cheia da consulta
    hora = int(time.time() // CACHE_TTL_S)
    chave = f"{hora}|" + ";".join(f"{a},{b}" for a, b in zip(lats, lons))

    def buscar():
        mar = _consultar(URL_MARINE, lats, lons, VARS_MARINE, {"forecast_days": "8"})
        vento = _consultar(URL_FORECAST, lats, lons, VARS_VENTO, {"forecast_days": "8", "wind_speed_unit": "kn"})
        return {"mar": mar, "vento": vento, "emitido": datetime.now(timezone.utc).isoformat(timespec="minutes")}

    bruto, do_cache = _com_cache(chave, buscar)
    saida, extra_h = [], 0.0
    for n, p in enumerate(pernas):
        m = (bruto["mar"][n] if n < len(bruto["mar"]) else {}).get("hourly", {})
        w = (bruto["vento"][n] if n < len(bruto["vento"]) else {}).get("hourly", {})
        im, iw = _indice_hora(m.get("time", []), p["t_ms"]), _indice_hora(w.get("time", []), p["t_ms"])
        rumo, vel = float(p.get("rumo") or 0), float(p.get("vel_kn") or 10)
        perna = {"n": n + 1, "lat": lats[n], "lon": lons[n], "t_ms": p["t_ms"], "rumo": round(rumo, 1)}
        if im is None and iw is None:
            perna["status"] = "fora_horizonte"
            saida.append(perna)
            continue
        hs = _val(m, "wave_height", im)
        vc_kmh = _val(m, "ocean_current_velocity", im)
        vw = _val(w, "wind_speed_10m", iw)
        perna.update({
            "status": "ok",
            "onda": {"hs_m": hs, "periodo_s": _val(m, "wave_period", im), "dir_de": _val(m, "wave_direction", im)},
            "swell": {"h_m": _val(m, "swell_wave_height", im), "periodo_s": _val(m, "swell_wave_period", im),
                      "dir_de": _val(m, "swell_wave_direction", im)},
            "vento": {"kn": vw, "rajada_kn": _val(w, "wind_gusts_10m", iw), "dir_de": _val(w, "wind_direction_10m", iw)},
            "corrente": {"kn": None if vc_kmh is None else round(vc_kmh / KMH_POR_NO, 2),
                         "dir_para": _val(m, "ocean_current_direction", im)},
        })
        if perna["onda"]["dir_de"] is not None:
            perna["onda"]["setor"] = setor(perna["onda"]["dir_de"], rumo)
        if perna["swell"]["dir_de"] is not None:
            perna["swell"]["setor"] = setor(perna["swell"]["dir_de"], rumo)
        if vw is not None and perna["vento"]["dir_de"] is not None:
            perna["vento"]["de_proa_kn"] = vento_de_proa(vw, perna["vento"]["dir_de"], rumo)
        c = perna["corrente"]
        if c["kn"] is not None and c["dir_para"] is not None:
            c.update(decompor_corrente(c["kn"], c["dir_para"], rumo, vel))
            # Tempo extra da perna por causa da corrente: dist/SOG − dist/Vmáq (h)
            dist = float(p.get("dist_nm") or 0)
            if dist > 0:
                c["delta_h"] = round(dist / c["sog_kn"] - dist / vel, 2)
                extra_h += c["delta_h"]
        perna["nivel"] = classificar(hs, vw)
        saida.append(perna)

    niveis = [p.get("nivel") for p in saida if p.get("status") == "ok"]
    return {
        "status": "ok", "pernas": saida, "cache": do_cache, "emitido_utc": bruto["emitido"],
        "resumo": {
            "pior": "restritivo" if "restritivo" in niveis else ("atencao" if "atencao" in niveis else "normal"),
            "hs_max_m": max([p["onda"]["hs_m"] for p in saida if p.get("status") == "ok" and p["onda"]["hs_m"] is not None], default=None),
            "vento_max_kn": max([p["vento"]["kn"] for p in saida if p.get("status") == "ok" and p["vento"]["kn"] is not None], default=None),
            "delta_corrente_h": round(extra_h, 2),
            "fora_horizonte": sum(1 for p in saida if p.get("status") == "fora_horizonte"),
        },
        "limites": LIMITES,
        "fonte": "Open-Meteo (CC BY 4.0) · ondas e corrente: Copernicus Marine / MeteoFrance (SMOC, inclui maré) · vento: modelos globais",
    }
