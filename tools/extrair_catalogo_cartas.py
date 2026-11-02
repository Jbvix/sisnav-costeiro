# =============================================================================
# SISNAV COSTEIRO - tools/extrair_catalogo_cartas.py
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
# Data/Hora: 2026-11-01 22:50 (UTC-3)   Versão: 1.0 (v3.15.0)
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  1.0 (v3.15.0, 2026-11-01) - Arquivo NOVO: lê o CABEÇALHO de texto de cada
#      carta raster da DHN (formato BSB/KAP) e gera dados/cartas_dhn.json com
#      número, nome, escala, edição, último Aviso aos Navegantes (NTM),
#      limites da carta e zoom nativo. Usado pelo ChartService (v3.15.0) para
#      mostrar "a carta do centro do mapa" e alertar correção antiga.
# -----------------------------------------------------------------------------
# COMO RODAR (na raiz):
#     python tools/extrair_catalogo_cartas.py  <pasta com os .KAP>
#   ex.: python tools/extrair_catalogo_cartas.py  ~/RNC/BRASIL
# Os .KAP NÃO vão para o repositório (356 MB); só o catálogo gerado (~200 KB).
#
# O CABEÇALHO KAP é texto até o byte 0x1A; depois vem a imagem. Linhas que
# interessam (exemplo real da carta 171101):
#   BSB/NA=PROXIMIDADES DO PORTO DE SANTOS,NU=171101,RA=9125,11311,DU=300
#   KNP/SC=80000,...,DX=6.773333,DY=6.773333     <- escala e metros por pixel
#   CED/SE=3,RE=1,ED=02/24/2005                  <- edição 3, de 24/02/2005
#   NTM/NE=2025-61,ND=06/03/2025                 <- último aviso aplicado
#   REF/n,x,y,lat,lon                            <- pontos de georreferência
#   PLY/n,lat,lon                                <- polígono da moldura
#   Linhas que começam com 4 espaços CONTINUAM a linha anterior.
# DATAS vêm no formato americano MÊS/DIA/ANO (conferido nas 628 cartas: o 1º
#   campo nunca passa de 12; o 2º passa em 633 casos). Gravamos em ISO.
#
# ZOOM NATIVO: o zoom da Web Mercator em que 1 pixel da tela ≈ 1 pixel da carta.
#   resolução no zoom z (m/px) = 156543,03 · cos(lat) / 2^z
#   z_nativo = teto( log2( 156543,03 · cos(lat) / DX ) ),  limitado a 17.
#   Ex.: Santos, DX = 6,77 m/px, lat 24,2°S -> log2(21 107) = 14,4 -> z 15.
#        Carta de porto 1:10 000 (DX ≈ 0,85 m) -> z 17 (limite).
#   Analogia: é a "escala da carta" traduzida para a régua do mapa da tela;
#   ampliar além disso é como olhar a carta de papel com lupa: não aparece
#   detalhe novo, só pixel maior.
# =============================================================================
import glob
import json
import math
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'dados', 'cartas_dhn.json')
Z_MAX = 17


def ler_cabecalho(caminho):
    """Devolve a lista de linhas lógicas do cabeçalho (continuações já unidas)."""
    with open(caminho, 'rb') as f:
        bruto = f.read(400_000)
    fim = bruto.find(b'\x1a')
    if fim >= 0:
        bruto = bruto[:fim]
    linhas = []
    for l in bruto.decode('latin-1').replace('\r', '').split('\n'):
        if l.startswith('    ') and linhas:
            linhas[-1] += ',' + l.strip()       # continuação da linha anterior
        elif l.strip():
            linhas.append(l.strip())
    return linhas


def campos(linha):
    """'BSB/NA=X,NU=1,RA=9,11' -> {'NA':'X','NU':'1','RA':'9,11'} (valor com vírgula fica junto)."""
    corpo = linha.split('/', 1)[1] if '/' in linha else ''
    d, chave = {}, None
    for parte in corpo.split(','):
        if '=' in parte and parte.split('=', 1)[0].isalnum() and parte.split('=', 1)[0].isupper():
            chave, valor = parte.split('=', 1)
            d[chave] = valor
        elif chave:
            d[chave] += ',' + parte
    return d


def data_iso(mdy):
    """'02/24/2005' (mês/dia/ano) -> '2005-02-24'; inválida -> None."""
    try:
        m, d, a = [int(x) for x in mdy.strip().split('/')]
        if 1 <= m <= 12 and 1 <= d <= 31 and a > 1900:
            return f'{a:04d}-{m:02d}-{d:02d}'
    except (ValueError, AttributeError):
        pass
    return None


def numero_carta(nu):
    """
    Número exibido. Nos arquivos da DHN, 6 dígitos = carta de 4 dígitos +
    folha/plano de 2 (171101 = carta 1711, folha 01); 7 dígitos = 5 + 2
    (2107001 = carta 21070, folha 01). Demais: como vieram.
    """
    nu = (nu or '').strip()
    if len(nu) == 6 and nu.isdigit():
        return nu[:4], nu[4:]
    if len(nu) == 7 and nu.isdigit():          # 2107001 = carta 21070, folha 01
        return nu[:5], nu[5:]
    return nu, None


def extrair(caminho):
    L = ler_cabecalho(caminho)
    info = {'arquivo': os.path.splitext(os.path.basename(caminho))[0]}
    refs, ply = [], []
    for l in L:
        tag = l[:4]
        if tag == 'BSB/' or tag == 'NOS/':
            c = campos(l)
            info['nu_bruto'] = c.get('NU', '').strip()
            info['nome'] = c.get('NA', '').strip()
        elif tag == 'KNP/':
            c = campos(l)
            info['escala'] = int(float(c.get('SC', '0') or 0))
            try:
                info['dx'] = float(c.get('DX', '0') or 0)
            except ValueError:
                info['dx'] = 0
            info['datum'] = c.get('GD', '').strip()
            info['proj'] = c.get('PR', '').strip()
        elif tag == 'CED/':
            c = campos(l)
            info['edicao'] = c.get('SE', '').strip() or None
            info['edicao_data'] = data_iso(c.get('ED', ''))
        elif tag == 'NTM/':
            c = campos(l)
            info['an'] = c.get('NE', '').strip() or None          # Aviso aos Navegantes
            info['an_data'] = data_iso(c.get('ND', ''))
        elif tag == 'REF/':
            p = l[4:].split(',')
            if len(p) >= 5:
                refs.append((float(p[3]), float(p[4])))
        elif tag == 'PLY/':
            p = l[4:].split(',')
            if len(p) >= 3:
                ply.append((float(p[1]), float(p[2])))
    pts = ply or refs
    if not pts:
        return None
    lats = [p[0] for p in pts]
    lons = [p[1] for p in pts]
    # limites [sul, oeste, norte, leste] com 5 casas (~1 m)
    info['b'] = [round(min(lats), 5), round(min(lons), 5), round(max(lats), 5), round(max(lons), 5)]
    # Moldura: só guardamos o polígono se NÃO for o próprio retângulo dos limites
    if len(ply) >= 4:
        uniq = {(round(a, 4), round(o, 4)) for a, o in ply}
        if len(uniq) > 4:
            info['ply'] = [[round(a, 5), round(o, 5)] for a, o in ply]
    # Zoom nativo (fórmula no cabeçalho)
    lat_c = (info['b'][0] + info['b'][2]) / 2
    dx = info.get('dx') or (info.get('escala', 0) * 0.0254 / 300)
    if dx > 0:
        z = math.ceil(math.log2(156543.03 * math.cos(math.radians(lat_c)) / dx))
        info['z'] = max(0, min(Z_MAX, z))
    num, folha = numero_carta(info.get('nu_bruto') or info['arquivo'])
    info['numero'] = num
    if folha:
        info['folha'] = folha
    return info


def main():
    if len(sys.argv) < 2:
        print('uso: python tools/extrair_catalogo_cartas.py <pasta com .KAP>')
        sys.exit(1)
    arquivos = sorted(glob.glob(os.path.join(sys.argv[1], '*.KAP')) + glob.glob(os.path.join(sys.argv[1], '*.kap')))
    cartas, falhas = [], []
    for a in arquivos:
        try:
            i = extrair(a)
        except Exception as e:  # cabeçalho corrompido: registra e segue
            i = None
            print('  ! falha', os.path.basename(a), e)
        if i:
            # campos de trabalho que não vão para o navegador
            for k in ('dx', 'nu_bruto', 'datum', 'proj'):
                i.pop(k, None)
            cartas.append(i)
        else:
            falhas.append(os.path.basename(a))
    # Ordem: maior escala (mais detalhe) primeiro -> o navegador pega o 1º que contém o ponto
    cartas.sort(key=lambda c: (c.get('escala') or 10**9, c['arquivo']))
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, 'w', encoding='utf-8') as f:
        json.dump({'fonte': 'DHN - Cartas Raster (RNC/BSB)',
                   'gerado_por': 'tools/extrair_catalogo_cartas.py v1.0',
                   'total': len(cartas), 'cartas': cartas},
                  f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(cartas)} cartas -> {SAIDA} ({os.path.getsize(SAIDA) // 1024} KB); falhas: {len(falhas)} {falhas[:5]}')


if __name__ == '__main__':
    main()
