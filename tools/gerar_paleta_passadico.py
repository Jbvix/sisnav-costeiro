# =============================================================================
# SISNAV COSTEIRO - tools/gerar_paleta_passadico.py
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems
# Data/Hora: 2026-10-30 22:26 (UTC-3)   Versão: 1.0 (v3.9.0)
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  1.0 (v3.9.0, 2026-10-30) - Arquivo NOVO (assistido por Claude): gera
#      css/passadico_paleta.css com as cores das três iluminações do
#      "Padrão Passadiço": DIA, CREPÚSCULO e NOITE (IEC 62288).
# -----------------------------------------------------------------------------
# COMO RODAR (na raiz do projeto):   python tools/gerar_paleta_passadico.py
# Rode de novo sempre que mudar alguma regra abaixo. O CSS gerado é
# commitado junto (o Netlify não roda Python no build).
#
# IDEIA CENTRAL
#   O app usa ~880 classes de cor do Tailwind (bg-slate-900, text-blue-600...).
#   Em vez de reescrever o HTML, cada cor do Tailwind passa a ler uma
#   VARIÁVEL CSS. Trocar a iluminação = trocar o valor das variáveis.
#   Analogia: os instrumentos do passadiço são os mesmos; muda o dimmer.
#
#   Três variáveis por cor, porque o mesmo tom tem papéis diferentes:
#     --c-<cor>-<tom>  fundo (bg-, from-, to-, ring-)   ex.: bg-slate-900
#     --t-<cor>-<tom>  texto (text-, placeholder-)      ex.: text-slate-900
#     --b-<cor>-<tom>  borda (border-, divide-)         ex.: border-slate-200
#   No DIA as três são iguais à paleta original (o app fica como sempre foi).
#   No escuro elas divergem: "slate-900" como FUNDO continua escuro (cabeçalho),
#   mas como TEXTO precisa ficar claro para continuar legível.
#
# FORMATO: "R G B" (sem vírgulas), para o Tailwind aplicar transparência:
#   rgb(var(--c-blue-600) / 0.5)  ->  azul a 50 %.
# =============================================================================
import colorsys
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORES = json.load(open(os.path.join(RAIZ, "tools", "tailwind_v3_cores.json"), encoding="utf-8"))
SAIDA = os.path.join(RAIZ, "css", "passadico_paleta.css")

TONS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]
NEUTRAS = {"slate", "gray", "zinc", "neutral", "stone"}

# Papel de cada família à NOITE (só tons quentes: o olho adaptado ao escuro
# perde a visão noturna com azul/branco). Matiz em graus no círculo HSL:
# 0-10 = vermelho, 20-30 = laranja, 40 = âmbar escuro.
PAPEL_NOITE = {
    "neutra": 8, "red": 2, "rose": 2, "pink": 2, "fuchsia": 4,
    "orange": 22, "amber": 30, "yellow": 34,
    "green": 42, "emerald": 42, "lime": 42, "teal": 40,
    "blue": 12, "sky": 12, "indigo": 12, "violet": 10, "purple": 10, "cyan": 14,
}


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(v))) for v in c)


def mix(a, b, t):
    """Mistura linear: t=0 -> a ; t=1 -> b (como dosar duas tintas)."""
    a, b = hex2rgb(a), hex2rgb(b)
    return rgb2hex(tuple(a[i] + (b[i] - a[i]) * t for i in range(3)))


def luminancia(h):
    """Luminância relativa (WCAG): Y = 0,2126 R + 0,7152 G + 0,0722 B
    com cada canal linearizado (gama sRGB). Y=0 preto, Y=1 branco.
    O verde pesa mais porque o olho é mais sensível a ele."""
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in hex2rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# -----------------------------------------------------------------------------
# CREPÚSCULO: remapeamento de tons DENTRO da própria família do Tailwind.
# Ex.: fundo "blue-50" (azul quase branco) vira um azul muito escuro;
#      texto "blue-700" (azul escuro) vira "blue-300" (azul claro).
# -----------------------------------------------------------------------------
PAGINA_CREP = "#0f1720"  # fundo da página (entre slate-900 e slate-950)

FUNDO_NEUTRO = {"50": "900", "100": "PAGINA", "200": "700", "300": "600", "400": "500", "500": "500",
                "600": "600", "700": "700", "800": "900", "900": "950", "950": "950"}
TEXTO_NEUTRO = {"50": "50", "100": "100", "200": "200", "300": "300", "400": "400", "500": "400",
                "600": "300", "700": "200", "800": "100", "900": "50", "950": "50"}
BORDA_NEUTRA = {"50": "800", "100": "800", "200": "700", "300": "600", "400": "500", "500": "500",
                "600": "500", "700": "600", "800": "700", "900": "800", "950": "800"}
TEXTO_COR = {"50": "50", "100": "100", "200": "200", "300": "300", "400": "400", "500": "400",
             "600": "400", "700": "300", "800": "200", "900": "200", "950": "100"}
BORDA_COR = {"50": "900", "100": "900", "200": "800", "300": "700", "400": "600", "500": "500",
             "600": "500", "700": "400", "800": "300", "900": "300", "950": "300"}


def crep(fam, tom, papel):
    f = CORES[fam]
    if papel == "c":
        if fam in NEUTRAS:
            alvo = FUNDO_NEUTRO[tom]
            return PAGINA_CREP if alvo == "PAGINA" else f[alvo]
        # fundos "suaves" (50-300) viram tintas escuras da cor sobre a página
        suaves = {"50": 0.16, "100": 0.24, "200": 0.34, "300": 0.48}
        if tom in suaves:
            return mix(PAGINA_CREP, f["800"], suaves[tom] / 0.48 * 0.75)
        return f["600"] if tom == "400" else f[tom]
    if papel == "t":
        return f[TEXTO_NEUTRO[tom]] if fam in NEUTRAS else f[TEXTO_COR[tom]]
    return f[BORDA_NEUTRA[tom]] if fam in NEUTRAS else f[BORDA_COR[tom]]


def noite(hexcor, fam):
    """NOITE: converte a cor do crepúsculo para vermelho/âmbar de baixa luz.
    Brilho (lightness HSL) em função da luminância Y da cor de crepúsculo:
        L = 3 % + 45 % * Y^0,6
      Y=0,01 (fundo) -> L~5,6 %   (quase preto)
      Y=0,18 (cinza) -> L~19 %
      Y=0,95 (texto) -> L~46 %    (teto: nada brilha mais que isso)
    O expoente 0,6 "abre" os tons escuros para os painéis continuarem
    distinguíveis entre si. Saturação alta mantém o vermelho "puro"."""
    y = luminancia(hexcor)
    luz = 0.03 + 0.45 * (y ** 0.6)
    matiz = PAPEL_NOITE["neutra" if fam in NEUTRAS else fam] / 360
    sat = 0.55 if fam in NEUTRAS else 0.85
    r, g, b = colorsys.hls_to_rgb(matiz, luz, sat)
    return rgb2hex((r * 255, g * 255, b * 255))


def canais(h):
    return "%d %d %d" % hex2rgb(h)


def bloco(seletor, pares, comentario):
    linhas = [f"/* {comentario} */", f"{seletor} {{"]
    linhas += [f"  {k}: {v};" for k, v in pares]
    linhas.append("}")
    return "\n".join(linhas)


def main():
    dia, cre, noi = [], [], []
    for fam in CORES:
        for tom in TONS:
            orig = CORES[fam][tom]
            dia.append((f"--c-{fam}-{tom}", canais(orig)))
            for papel in "ctb":
                c = crep(fam, tom, papel)
                cre.append((f"--{papel}-{fam}-{tom}", canais(c)))
                noi.append((f"--{papel}-{fam}-{tom}", canais(noite(c, fam))))
        for tom in TONS:  # no DIA texto e borda = fundo (paleta original)
            dia.append((f"--t-{fam}-{tom}", f"var(--c-{fam}-{tom})"))
            dia.append((f"--b-{fam}-{tom}", f"var(--c-{fam}-{tom})"))

    # Branco e preto também mudam de papel: bg-white = superfície do cartão;
    # text-white = texto sobre fundo sólido (botão, cabeçalho).
    extras = {
        "dia": {"c-white": "#ffffff", "t-white": "#ffffff", "b-white": "#ffffff",
                "c-black": "#000000", "t-black": "#000000", "b-black": "#000000"},
        "crep": {"c-white": "#1b2632", "t-white": "#f1f5f9", "b-white": "#334155",
                 "c-black": "#000000", "t-black": "#e2e8f0", "b-black": "#000000"},
    }
    extras["noite"] = {k: noite(v, "slate") if k != "c-black" else "#000000" for k, v in extras["crep"].items()}
    for nome, lista in (("dia", dia), ("crep", cre), ("noite", noi)):
        lista += [(f"--{k}", canais(v)) for k, v in extras[nome].items()]

    cab = (
        "/* =============================================================================\n"
        " * SISNAV COSTEIRO - css/passadico_paleta.css  (ARQUIVO GERADO - não editar)\n"
        " * Gerado por tools/gerar_paleta_passadico.py | Autor: Jossian Brito\n"
        " * Versão: 1.0 (v3.9.0) | 2026-10-30 22:26 (UTC-3)\n"
        " * Cores no formato 'R G B'. Paleta base: Tailwind CSS v3.4.17 (licença MIT).\n"
        " * ============================================================================= */\n"
    )
    css = "\n\n".join([
        cab,
        bloco(':root, :root[data-luz="dia"]', dia, "DIA - paleta original (luz do sol)"),
        bloco(':root[data-luz="crepusculo"]', cre, "CREPÚSCULO - escuro azulado (cabine com pouca luz)"),
        bloco(':root[data-luz="noite"]', noi, "NOITE - vermelhos de baixa luz (preserva a visão noturna)"),
    ]) + "\n"
    with open(SAIDA, "w", encoding="utf-8") as fh:
        fh.write(css)
    print(f"gerado: {SAIDA} ({len(css) // 1024} KB, {len(dia) + len(cre) + len(noi)} variáveis)")


if __name__ == "__main__":
    main()
