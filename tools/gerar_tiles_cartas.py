# =============================================================================
# SISNAV COSTEIRO - tools/gerar_tiles_cartas.py (gerador de tiles das cartas DHN)
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
# Data/Hora: 2026-11-01 23:20 (UTC-3)   Versão: 1.0 (v3.15.0)
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  1.0 (v3.15.0, 2026-11-01) - Arquivo NOVO: gera tiles PNG 256x256 na grade
#      Web Mercator (z/x/y, a mesma do Leaflet/OpenStreetMap) a partir das
#      cartas raster originais da DHN (.KAP), substituindo os tiles do cPanel:
#   [1] cada carta é gerada ATÉ O SEU ZOOM NATIVO (porto até 17), e não mais
#       cortada no 15 -> carta de porto nítida;
#   [2] fora da carta o tile é TRANSPARENTE (canal alfa), nada de branco;
#       cartas com moldura irregular (PLY) são recortadas pela moldura;
#   [3] onde cartas se sobrepõem, a de MAIOR escala fica por cima;
#   [4] dentro de um tile, onde a carta detalhada não cobre, aparece a carta
#       de menor escala da mesma área (fundo herdado do tile "pai").
# -----------------------------------------------------------------------------
# REQUISITOS: Python 3.10+, rasterio (com GDAL e driver BSB), numpy, Pillow.
#   pip install rasterio numpy pillow
# COMO RODAR (na raiz):
#   Estimar quantos tiles:   python tools/gerar_tiles_cartas.py KAP_DIR SAIDA --estimar
#   Piloto (só uma área):    python tools/gerar_tiles_cartas.py KAP_DIR SAIDA --bbox -24.2,-46.5,-23.8,-46.1
#   Tudo:                    python tools/gerar_tiles_cartas.py KAP_DIR SAIDA
#   O catálogo dados/cartas_dhn.json (tools/extrair_catalogo_cartas.py) diz
#   escala, limites, moldura e zoom nativo de cada carta.
# -----------------------------------------------------------------------------
# FÓRMULAS
#  Tile que contém (lat, lon) no zoom z (n = 2^z tiles por lado):
#     x = floor( (lon + 180) / 360 · n )
#     y = floor( (1 - ln(tan φ + sec φ) / π) / 2 · n )
#   Ex.: Santos (-23,98; -46,30) no z15 -> x = 12169, y = 18633.
#  Faixa de zoom de cada carta (zn = zoom nativo, do catálogo):
#     de  zn - 3  até  zn        (cartas de escala <= 1:1.000.000: zn - 5)
#   Abaixo de zn-3 a carta fica pequena demais para ler (8x reduzida) e quem
#   aparece é a carta de menor escala da área; acima de zn não há detalhe novo
#   (o navegador amplia o último tile: ver MapService, "sobrezoom").
#  Reamostragem: ao REDUZIR (zoom < zn) usa "média" dos pixels (suaviza, sem
#   serrilhado); no zoom nativo usa "bilinear".
#   Analogia: reduzir a carta é como olhar de longe pelo binóculo: as cores
#   se misturam; com o "vizinho mais próximo" sobrariam pontos soltos.
#  Composição (canal alfa a = 0..1):  cor = a·carta + (1 - a)·fundo
#   Na borda a carta entra com alfa parcial (anti-serrilhado da moldura).
# =============================================================================
import argparse
import json
import math
import os
import sys
import time

import numpy as np
import rasterio
from rasterio import features
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform as transformar
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGO = os.path.join(RAIZ, 'dados', 'cartas_dhn.json')
R = 6378137.0                      # raio da esfera Web Mercator (m)
ORIGEM = math.pi * R               # 20 037 508,34 m: meia volta ao mundo
TILE = 256
BLOCO = 16                         # processa 16x16 tiles (4096 px) por vez
Z_MAX = 17


# ---------------------------------------------------------------- grade XYZ
def tile_xy(lat, lon, z):
    """(lat, lon) -> (x, y) do tile no zoom z (fórmula no cabeçalho)."""
    n = 2 ** z
    lat = max(min(lat, 85.0511), -85.0511)
    x = int((lon + 180.0) / 360.0 * n)
    phi = math.radians(lat)
    y = int((1.0 - math.log(math.tan(phi) + 1.0 / math.cos(phi)) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def limites_tile_m(x, y, z):
    """Limites do tile em metros Web Mercator: (oeste, sul, leste, norte)."""
    lado = 2 * ORIGEM / 2 ** z
    oeste = -ORIGEM + x * lado
    norte = ORIGEM - y * lado
    return oeste, norte - lado, oeste + lado, norte


def faixa_zoom(c):
    zn = min(int(c.get('z') or 0), Z_MAX)
    abaixo = 5 if (c.get('escala') or 0) >= 1_000_000 else 3
    return max(zn - abaixo, 3), zn


# ---------------------------------------------------------- leitura da carta
def carregar_rgba(caminho, carta):
    """
    Lê a carta (índices de paleta) e devolve (rgba[4,h,w], transform, crs).
    A paleta da carta (RGB/n do cabeçalho, ~20 cores) vira cor real; o alfa é
    255 dentro da moldura e 0 fora.
    """
    with rasterio.open(caminho) as src:
        idx = src.read(1)
        cmap = src.colormap(1)
        tr, crs = src.transform, src.crs
    lut = np.zeros((256, 4), dtype=np.uint8)
    for k, v in cmap.items():
        lut[k] = v
    lut[:, 3] = 255
    rgba = lut[idx].transpose(2, 0, 1).copy()       # [4, h, w]
    del idx
    if carta.get('ply'):                            # [2] moldura irregular
        lats = [p[0] for p in carta['ply']]
        lons = [p[1] for p in carta['ply']]
        xs, ys = transformar('EPSG:4326', crs, lons, lats)
        geom = {'type': 'Polygon', 'coordinates': [list(zip(xs, ys))]}
        dentro = features.rasterize([(geom, 1)], out_shape=rgba.shape[1:], transform=tr, fill=0, dtype='uint8')
        rgba[3] = np.where(dentro == 1, 255, 0).astype(np.uint8)
    return rgba, tr, crs


# ------------------------------------------------------------ tiles em disco
def caminho_tile(saida, z, x, y):
    return os.path.join(saida, str(z), str(x), f'{y}.png')


def fundo_herdado(saida, z, x, y, max_niveis=6):
    """
    [4] Fundo para um tile NOVO: recorta e amplia o ancestral mais próximo já
    gerado (zoom z-1, z-2...). Ex.: o tile (z, x, y) é o quadrante
    (x % 2, y % 2) do pai (z-1, x//2, y//2).
    """
    for k in range(1, max_niveis + 1):
        zp = z - k
        if zp < 0:
            break
        xp, yp = x >> k, y >> k
        p = caminho_tile(saida, zp, xp, yp)
        if os.path.exists(p):
            lado = TILE >> k                      # pedaço do pai que vira este tile
            ox, oy = (x - (xp << k)) * lado, (y - (yp << k)) * lado
            img = Image.open(p).convert('RGBA').crop((ox, oy, ox + lado, oy + lado))
            return img.resize((TILE, TILE), Image.BILINEAR)
    return None


def gravar(img, caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    # Paleta de até 256 cores (as cartas têm ~20): PNG 3-4x menor, sem perda visível
    img.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(caminho, optimize=True)


# ------------------------------------------------------------- uma carta
def gerar_carta(caminho_kap, carta, saida, bbox=None, cont=None):
    z0, z1 = faixa_zoom(carta)
    s, w, n, e = carta['b']
    if bbox:                                       # piloto: só a interseção
        s, w, n, e = max(s, bbox[0]), max(w, bbox[1]), min(n, bbox[2]), min(e, bbox[3])
        if s >= n or w >= e:
            return 0
    rgba, tr, crs = carregar_rgba(caminho_kap, carta)
    res_carta = abs(tr.a)                          # m/px no CRS da carta
    gravados = 0
    for z in range(z0, z1 + 1):
        xa, ya = tile_xy(n, w, z)                  # canto NO
        xb, yb = tile_xy(s, e, z)                  # canto SE
        res_z = 2 * ORIGEM / 2 ** z / TILE
        # [reamostragem] reduzir -> média; nativo -> bilinear
        metodo = Resampling.average if res_z > res_carta * 1.5 else Resampling.bilinear
        for bx in range(xa, xb + 1, BLOCO):
            for by in range(ya, yb + 1, BLOCO):
                nx, ny = min(BLOCO, xb + 1 - bx), min(BLOCO, yb + 1 - by)
                o, _, _, nn = limites_tile_m(bx, by, z)
                _, ss, ee, _ = limites_tile_m(bx + nx - 1, by + ny - 1, z)
                dst = np.zeros((4, ny * TILE, nx * TILE), dtype=np.uint8)
                reproject(rgba, dst, src_transform=tr, src_crs=crs,
                          dst_transform=from_bounds(o, ss, ee, nn, nx * TILE, ny * TILE),
                          dst_crs='EPSG:3857', resampling=metodo, num_threads=4)
                for i in range(nx):
                    for j in range(ny):
                        bloco = dst[:, j * TILE:(j + 1) * TILE, i * TILE:(i + 1) * TILE]
                        if not bloco[3].any():     # [2] nada da carta aqui
                            continue
                        x, y = bx + i, by + j
                        cam = caminho_tile(saida, z, x, y)
                        carta_img = Image.fromarray(bloco.transpose(1, 2, 0), 'RGBA')
                        if os.path.exists(cam):    # [3] por cima do que já existe
                            base = Image.open(cam).convert('RGBA')
                        else:
                            base = fundo_herdado(saida, z, x, y) or Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
                        base.alpha_composite(carta_img)
                        gravar(base, cam)
                        gravados += 1
    del rgba
    return gravados


# --------------------------------------------------------------- estimativa
def estimar(cartas, bbox=None):
    total, por_z = 0, {}
    for c in cartas:
        s, w, n, e = c['b']
        if bbox:
            s, w, n, e = max(s, bbox[0]), max(w, bbox[1]), min(n, bbox[2]), min(e, bbox[3])
            if s >= n or w >= e:
                continue
        z0, z1 = faixa_zoom(c)
        for z in range(z0, z1 + 1):
            xa, ya = tile_xy(n, w, z)
            xb, yb = tile_xy(s, e, z)
            k = (xb - xa + 1) * (yb - ya + 1)
            por_z[z] = por_z.get(z, 0) + k
            total += k
    return total, dict(sorted(por_z.items()))


def main():
    ap = argparse.ArgumentParser(description='Gera tiles das cartas DHN (.KAP).')
    ap.add_argument('kap_dir')
    ap.add_argument('saida')
    ap.add_argument('--bbox', help='sul,oeste,norte,leste (graus) - gera só esta área')
    ap.add_argument('--estimar', action='store_true', help='só conta os tiles (teto, com sobreposição)')
    a = ap.parse_args()
    bbox = [float(v) for v in a.bbox.split(',')] if a.bbox else None
    with open(CATALOGO, encoding='utf-8') as f:
        cartas = json.load(f)['cartas']
    # [3] menor escala primeiro (1:1.000.000 antes de 1:10.000): a mais detalhada pinta por último
    cartas.sort(key=lambda c: -(c.get('escala') or 0))
    if bbox:
        cartas = [c for c in cartas if not (c['b'][2] < bbox[0] or c['b'][0] > bbox[2] or c['b'][3] < bbox[1] or c['b'][1] > bbox[3])]
    total, por_z = estimar(cartas, bbox)
    print(f'{len(cartas)} cartas; teto de {total:,} gravações de tile; por zoom: {por_z}')
    if a.estimar:
        return
    t0, feitos = time.time(), 0
    for i, c in enumerate(cartas, 1):
        kap = os.path.join(a.kap_dir, c['arquivo'] + '.KAP')
        if not os.path.exists(kap):
            print(f'  ! falta {kap}')
            continue
        t = time.time()
        g = gerar_carta(kap, c, a.saida, bbox)
        feitos += g
        print(f'  [{i}/{len(cartas)}] {c["arquivo"]} 1:{c.get("escala")} z{faixa_zoom(c)} -> {g} tiles ({time.time() - t:.0f} s)', flush=True)
    print(f'Fim: {feitos:,} gravações em {(time.time() - t0) / 60:.1f} min -> {a.saida}')


if __name__ == '__main__':
    main()
