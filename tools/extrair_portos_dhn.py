# =============================================================================
# SISNAV COSTEIRO - tools/extrair_portos_dhn.py
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
# Data/Hora: 2026-11-01 (UTC-3)   Versão: 1.0 (v3.12.0)
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  1.0 (v3.12.0, 2026-11-01) - Arquivo NOVO: lê o CABEÇALHO de cada tábua de
#      marés da DHN 2026 (library/tabua mares 2026/*.pdf) e gera
#      dados/portos_dhn.json com nome, posição da estação maregráfica, fuso,
#      nível médio (Z0) e carta. Usado pela "Janela da barra" (v3.12.0).
# -----------------------------------------------------------------------------
# COMO RODAR (na raiz):   python tools/extrair_portos_dhn.py
# Rode de novo quando chegarem as tábuas de um novo ano.
#
# POSIÇÃO: "23° 57'.4 S" -> -(23 + 57,4/60) = -23,9567°
#   Aceita "05° 46' S" (sem décimos) e "22° 60' S" (60' = 1°, vira 23°00').
# NÍVEL MÉDIO (Z0): altura do nível médio do mar ACIMA do zero da carta (NR).
#   As previsões da DHN são medidas a partir do zero da carta; modelos como a
#   Open-Meteo dão o nível em relação ao nível médio. Logo:
#       altura_tábua ≈ altura_modelo + Z0
# =============================================================================
import glob
import json
import os
import re
import sys

from pypdf import PdfReader

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(RAIZ, 'library', 'tabua mares 2026')
SAIDA = os.path.join(RAIZ, 'dados', 'portos_dhn.json')

RE_POS = re.compile(r"Latitude\s+(\d+)°\s*(\d+)'(?:\.(\d+))?\s*([NS])\s+Longitude\s+(\d+)°\s*(\d+)'(?:\.(\d+))?\s*([EW])")
RE_NM = re.compile(r"N[ií]vel\s+M[eé]dio\s+(-?\d+(?:[.,]\d+)?)\s*m", re.I)
RE_CARTA = re.compile(r"Carta\s+(\d+)")
RE_FUSO = re.compile(r"Fuso\s+(?:UTC\s*)?([+-]\d+(?:\.\d+)?)")


def graus(g, m, dec, hemi):
    """Graus + minutos decimais -> graus decimais com sinal (S e W negativos)."""
    minutos = float(f"{m}.{dec}" if dec else m)
    valor = int(g) + minutos / 60.0          # 60' vira +1° automaticamente
    return round(-valor if hemi in 'SW' else valor, 5)


def ler(pdf):
    texto = '\n'.join(PdfReader(pdf).pages[0].extract_text().split('\n')[:8])
    nome = texto.split('\n')[1].strip() if '\n' in texto else ''
    nome = re.sub(r'\s*-\s*20\d\d\s*$', '', nome)       # tira " - 2026"
    pos, nm = RE_POS.search(texto), RE_NM.search(texto)
    if not pos:
        raise ValueError('posição não encontrada no cabeçalho')
    lat = graus(*pos.group(1, 2, 3, 4))
    lon = graus(*pos.group(5, 6, 7, 8))
    arquivo = os.path.basename(pdf)
    return {
        'id': arquivo.split(' ')[0],                       # nº da estação na publicação
        'nome': nome,
        'lat': lat, 'lon': lon,
        'nivel_medio_m': float(nm.group(1).replace(',', '.')) if nm else None,
        'fuso': (RE_FUSO.search(texto).group(1) if RE_FUSO.search(texto) else None),
        'carta': (RE_CARTA.search(texto).group(1) if RE_CARTA.search(texto) else None),
        'pdf': 'library/tabua mares 2026/' + arquivo,
    }


def main():
    portos, falhas = [], []
    for pdf in sorted(glob.glob(os.path.join(PASTA, '*.pdf'))):
        try:
            portos.append(ler(pdf))
        except Exception as e:  # noqa: BLE001 - registra e segue
            falhas.append(f'{os.path.basename(pdf)}: {e}')
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, 'w', encoding='utf-8') as f:
        json.dump({'fonte': 'DHN - Tábuas das Marés 2026 (cabeçalhos)', 'portos': portos}, f, ensure_ascii=False, indent=1)
    sem_nm = [p['nome'] for p in portos if p['nivel_medio_m'] is None]
    print(f'{len(portos)} portos gravados em {SAIDA}; sem nível médio: {sem_nm}; falhas: {falhas}')
    return 1 if falhas else 0


if __name__ == '__main__':
    sys.exit(main())
