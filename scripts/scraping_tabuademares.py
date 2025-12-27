"""
Projeto: NavWatch / TugLife - Parser Marés & Meteo (TabuaDeMares)
Versão: 1.0.0
Data: 2025-12-27 (America/Fortaleza)
Autor: Jossian Brito

Mudanças (changelog):
- v1.0.0: Implementa coleta e parsing de marés (7 dias) + tempo/vento (hora a hora),
          normalizando para JSON único por porto.

Uso típico:
- Rodar a cada 6h e cachear em disco (offline-friendly).
- Validar sanidade dos dados antes de publicar no dashboard.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup


# ---------------------------
# Configuração (portos)
# ---------------------------
PORTS = {
    # Norte
    "Vila do Conde-PA (proxy Barcarena)": "https://tabuademares.com/br/para/barcarena",
    "Belém-PA (Porto)": "https://tabuademares.com/br/para/belem",
    "Santana-AP (Porto)": "https://tabuademares.com/br/amapa/santana",
    # Nordeste
    "Itaqui-MA": "https://tabuademares.com/br/maranhao/itaqui",   # se existir no site, mantém; senão ajustar
    "Pecém-CE": "https://tabuademares.com/br/ceara/pecem",       # se existir no site, mantém; senão ajustar
    "Mucuripe-CE (Fortaleza)": "https://tabuademares.com/br/ceara/fortaleza",
    "Suape-PE": "https://tabuademares.com/br/pernambuco/suape",
    "Recife-PE (Porto)": "https://tabuademares.com/br/pernambuco/recife",
    "Salvador-BA": "https://tabuademares.com/br/bahia/salvador",
    # Sudeste
    "Vitória-ES": "https://tabuademares.com/br/espirito-santo/vitoria",
    "Rio de Janeiro-RJ": "https://tabuademares.com/br/rio-de-janeiro/rio-de-janeiro",
    "Angra dos Reis-RJ": "https://tabuademares.com/br/rio-de-janeiro/angra-dos-reis",
    "Sepetiba-RJ": "https://tabuademares.com/br/rio-de-janeiro/sepetiba",
    "Santos-SP (Porto)": "https://tabuademares.com/br/so-paulo/santos",
    # Sul
    "Paranaguá-PR": "https://tabuademares.com/br/parana/paranagua",
    "São Francisco do Sul-SC": "https://tabuademares.com/br/santa-catarina/sao-francisco-do-sul",
    "Itajaí-SC": "https://tabuademares.com/br/santa-catarina/itajai",
    "Rio Grande-RS (Porto)": "https://tabuademares.com/br/rio-grande-do-sul/porto-do-rio-grande",
}


HEADERS = {
    "User-Agent": "NavWatch/1.0 (TugLife; +https://tuglife.store) requests",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
    "Connection": "keep-alive",
}


# ---------------------------
# Modelos
# ---------------------------
@dataclass
class TideEvent:
    date_iso: str          # 2025-12-27
    time_local: str        # HH:MM
    height_m: Optional[float]
    coef: Optional[int]


@dataclass
class HourlyVector:
    date_iso: str
    hour_local: str        # HH:MM
    value: str             # ex: "SSW" ou "Céu limpo" ou "14 km/h"
    extra: dict[str, Any]


def _get(url: str, timeout_s: int = 20) -> str:
    r = requests.get(url, headers=HEADERS, timeout=timeout_s)
    r.raise_for_status()
    return r.text


def _to_float_maybe(s: str) -> Optional[float]:
    """
    Converte alturas tipo '1,4 m' em float 1.4
    Comportamento:
    - Se vier vazio ou sem número, retorna None
    """
    s = (s or "").strip().lower()
    m = re.search(r"(-?\d+(?:[.,]\d+)?)", s)
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def _to_int_maybe(s: str) -> Optional[int]:
    m = re.search(r"(\d+)", (s or "").strip())
    return int(m.group(1)) if m else None


def parse_tides_7d(html: str) -> list[TideEvent]:
    """
    Parser da página .../previsao/mares
    Estratégia:
    - A página lista dias e, dentro de cada dia, linhas com: hora, altura, coef.
    - A estrutura é bastante estável no TabuaDeMares.
    """
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)

    # Padrão visto nas páginas:
    # 27 DEZ ... Marés Altura Coef. 3:14 0,7 m 56 ...
    # Vamos varrer blocos por data (DD MMM) e pegar trincas (hora, altura, coef)
    # Nota: MMM vem em PT (DEZ, JAN etc). Vamos mapear o mês.
    month_map = {
        "JAN": "01", "FEV": "02", "MAR": "03", "ABR": "04",
        "MAI": "05", "JUN": "06", "JUL": "07", "AGO": "08",
        "SET": "09", "OUT": "10", "NOV": "11", "DEZ": "12",
    }

    # Pega todas as ocorrências de "DD MMM" no texto
    date_marks = list(re.finditer(r"\b(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b", text))
    if not date_marks:
        return []

    # Ano: o site é “próximos 7 dias”, assume ano corrente local
    year = datetime.now().year

    events: list[TideEvent] = []
    for i, dm in enumerate(date_marks):
        dd = int(dm.group(1))
        mm = month_map[dm.group(2)]
        date_iso = f"{year}-{mm}-{dd:02d}"

        start = dm.end()
        end = date_marks[i + 1].start() if i + 1 < len(date_marks) else len(text)
        block = text[start:end]

        # Captura linhas de maré: "3:14 0,7 m 56"
        for m in re.finditer(r"\b(\d{1,2}:\d{2})\s+(-?\d+(?:[.,]\d+)?)\s*m\s+(\d{1,3})\b", block):
            hhmm = m.group(1)
            height = _to_float_maybe(m.group(2))
            coef = _to_int_maybe(m.group(3))
            events.append(TideEvent(date_iso=date_iso, time_local=hhmm, height_m=height, coef=coef))

    return events


def parse_hourly_table_like(text: str) -> list[tuple[str, str]]:
    """
    Utilitário para páginas tipo .../previsao/tempo e .../previsao/vento:
    Elas costumam repetir blocos: "14:00" + "Céu limpo" ou "14 km/h" + direção.
    Aqui a gente faz uma extração simples hora->valor, e o chamador enriquece.
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    out: list[tuple[str, str]] = []

    # Heurística: sempre que achar HH:00, pega a próxima linha como valor (se existir)
    for idx, ln in enumerate(lines):
        if re.fullmatch(r"\d{1,2}:\d{2}", ln):
            val = lines[idx + 1] if idx + 1 < len(lines) else ""
            out.append((ln, val))
    return out


def _kmh_to_knots(s: str) -> str:
    """
    Converte string '14 km/h' para '7.6 kn'
    """
    m = re.search(r"(\d+)", s)
    if not m:
        return s
    kmh = float(m.group(1))
    knots = kmh / 1.852
    return f"{knots:.1f} kn"

def parse_wind_hourly(html: str) -> list[HourlyVector]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)
    today = datetime.now().strftime("%Y-%m-%d")

    pairs = parse_hourly_table_like(text)
    vectors: list[HourlyVector] = []

    # Em páginas de vento, geralmente aparece: "14 km/h" e direção em linha separada perto do horário.
    # Vamos tentar capturar um padrão mais rico:
    # Exemplo visto: "14:00" "WSW" "7 km/h" (a ordem pode variar)
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    for i, ln in enumerate(lines):
        if re.fullmatch(r"\d{1,2}:\d{2}", ln):
            # coleta janela próxima
            win = lines[i:i+6]
            direction = next((x for x in win if re.fullmatch(r"[A-Z]{1,3}", x)), None)
            speed_kmh = next((x for x in win if re.search(r"\bkm/h\b", x)), None)
            
            if direction or speed_kmh:
                val_kn = _kmh_to_knots(speed_kmh) if speed_kmh else ""
                vectors.append(HourlyVector(
                    date_iso=today,
                    hour_local=ln,
                    value=val_kn,
                    extra={"direction": direction}
                ))

    # fallback simples
    if not vectors and pairs:
        for hhmm, val in pairs:
            # Tenta converter também no fallback se parecer km/h
            val_final = _kmh_to_knots(val) if "km/h" in val else val
            vectors.append(HourlyVector(date_iso=today, hour_local=hhmm, value=val_final, extra={}))

    return vectors


def parse_weather_hourly(html: str) -> list[HourlyVector]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)
    today = datetime.now().strftime("%Y-%m-%d")

    pairs = parse_hourly_table_like(text)
    vectors: list[HourlyVector] = []
    for hhmm, cond in pairs:
        # cond costuma ser "Céu limpo", "Nublado", "Aguaceiros isolados", etc.
        vectors.append(HourlyVector(date_iso=today, hour_local=hhmm, value=cond, extra={}))
    return vectors


def collect_port(base_url: str) -> dict[str, Any]:
    tides_url = f"{base_url}/previsao/mares"
    weather_url = f"{base_url}/previsao/tempo"
    wind_url = f"{base_url}/previsao/vento"

    out: dict[str, Any] = {
        "base_url": base_url,
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
        "tides_7d": [],
        "weather_hourly": [],
        "wind_hourly": [],
        "errors": [],
    }

    try:
        tides_html = _get(tides_url)
        out["tides_7d"] = [asdict(x) for x in parse_tides_7d(tides_html)]
    except Exception as e:
        out["errors"].append({"stage": "tides_7d", "url": tides_url, "err": str(e)})

    try:
        w_html = _get(weather_url)
        out["weather_hourly"] = [asdict(x) for x in parse_weather_hourly(w_html)]
    except Exception as e:
        out["errors"].append({"stage": "weather_hourly", "url": weather_url, "err": str(e)})

    try:
        wind_html = _get(wind_url)
        out["wind_hourly"] = [asdict(x) for x in parse_wind_hourly(wind_html)]
    except Exception as e:
        out["errors"].append({"stage": "wind_hourly", "url": wind_url, "err": str(e)})

    # Sanidade mínima
    if len(out["tides_7d"]) < 4:
        out["errors"].append({"stage": "sanity", "err": "Poucos eventos de maré extraídos (<4). HTML pode ter mudado."})

    return out


def main() -> None:
    db: dict[str, Any] = {"ports": {}}

    for name, url in PORTS.items():
        print(f"[INFO] Coletando: {name} -> {url}")
        db["ports"][name] = collect_port(url)
        time.sleep(0.7)  # respeita o servidor (evita parecer ataque)

    with open("maritimo_mare_meteo.json", "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    print("[OK] Arquivo gerado: maritimo_mare_meteo.json")


if __name__ == "__main__":
    main()
