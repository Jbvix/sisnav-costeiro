/**
 * =============================================================================
 * SISNAV COSTEIRO - js/services/ChartService.js (carta náutica DHN por posição)
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems
 * Data/Hora: 2026-11-01 22:58 (UTC-3)   Versão: 2.0 (v3.15.0)
 * -----------------------------------------------------------------------------
 * HISTÓRICO DE MODIFICAÇÕES
 *  2.0 (v3.15.0, 2026-11-01, assistido por Claude):
 *   [1] Catálogo COMPLETO: carrega dados/cartas_dhn.json (628 cartas raster da
 *       DHN, gerado por tools/extrair_catalogo_cartas.py a partir dos .KAP)
 *       com número, folha, nome, escala, edição e último Aviso aos Navegantes.
 *       A tabela antiga (17 cartas, limites aproximados) fica como reserva
 *       enquanto o catálogo não carrega ou se o arquivo faltar.
 *   [2] getChartInfo(lat, lon): devolve a ficha da carta de MAIOR escala
 *       (mais detalhe) que contém o ponto; usa a moldura (polígono) quando a
 *       carta tem uma, senão o retângulo de limites.
 *   [3] estadoCorrecao(carta): "ok" / "antiga" (último AN com mais de 2 anos)
 *       / "sem" (sem AN registrado no arquivo) - aprovado por Charlie Bravo.
 *   [4] getChartForPosition() mantém a mesma resposta ("BR-1711" ou "-").
 *  1.0 (2025-12-30) - tabela com 17 cartas e limites aproximados.
 * -----------------------------------------------------------------------------
 * REGRA DE ESCOLHA: entre as cartas que contêm o ponto, vence a de MENOR
 *   denominador de escala: 1:10.000 (porto) vence 1:80.000 (aproximação), que
 *   vence 1:1.000.000 (costeira). É o que o navegador faz no passadiço: usar
 *   sempre a carta de maior escala disponível para a área.
 * PONTO NO POLÍGONO (raio): traça-se uma linha do ponto para leste e contam-se
 *   os cruzamentos com os lados da moldura; ímpar = dentro, par = fora.
 *   Analogia: como saber se a boia está dentro da área de fundeio contando
 *   quantas vezes o alinhamento corta o limite da área.
 * IDADE DA CORREÇÃO: dias = (hoje - data do AN) / 86 400 000 ms;
 *   "antiga" quando dias > 730 (2 anos).
 * =============================================================================
 */

const CHART_DB = [
    // --- CARTAS COSTEIRAS (ESCALA 1:1.000.000 ou similar) ---
    {
        id: "21010",
        title: "De Cayenne ao Cabo Gurupi",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: 6.0, s: -1.5, w: -54.0, e: -45.5 }
    },
    {
        id: "21020",
        title: "De Salinópolis a Fortaleza",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: -0.5, s: -4.0, w: -47.5, e: -38.0 } // Cobre litoral norte
    },
    {
        id: "21030", // Inferido (Gap no TXT, mas existe na costa) - De Fortaleza a Natal?
        title: "De Fortaleza a Natal (Aprox)",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: -3.0, s: -6.0, w: -39.0, e: -35.0 }
    },
    {
        id: "21040",
        title: "De Natal ao Rio Itariri",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: -5.0, s: -12.5, w: -38.0, e: -34.5 } // Cobre NE descendo
    },
    {
        id: "21050",
        title: "Do Rio Itariri ao Arquipélago dos Abrolhos",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: -11.5, s: -18.5, w: -40.0, e: -37.0 }
    },
    {
        id: "21060",
        title: "Do Arquipélago dos Abrolhos ao Cabo Frio",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: -17.5, s: -23.5, w: -42.5, e: -38.5 }
    },
    {
        id: "21070",
        title: "Do Cabo Frio ao Cabo de Santa Marta Grande",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: -22.5, s: -29.0, w: -49.0, e: -41.5 } // Cobre Santos/Paranagua
    },
    {
        id: "21080",
        title: "Do Cabo de Santa Marta Grande ao Arroio Chuí",
        category: "Costeira",
        scale: 1000000,
        bounds: { n: -28.0, s: -34.5, w: -54.0, e: -48.0 }
    },

    // --- CARTAS DE APROXIMAÇÃO (ESCALA MENOR = MAIS ZOOM) ---
    // Prioridade na busca se estiver dentro
    {
        id: "410",
        title: "Proximidades da Baía de São Marcos",
        category: "Aproximação",
        scale: 135000,
        bounds: { n: -2.0, s: -2.8, w: -44.8, e: -43.8 } // Itaqui/SLZ
    },
    {
        id: "710",
        title: "Pecém e Porto de Mucuripe",
        category: "Aproximação",
        scale: 50000,
        bounds: { n: -3.4, s: -3.8, w: -39.0, e: -38.3 } // Fortaleza
    },
    {
        id: "810",
        title: "Proximidades do Porto de Natal",
        category: "Aproximação",
        scale: 50000,
        bounds: { n: -5.6, s: -5.9, w: -35.3, e: -35.1 }
    },
    {
        id: "930",
        title: "Proximidades do Porto do Recife",
        category: "Aproximação",
        scale: 100000,
        bounds: { n: -7.9, s: -8.5, w: -35.0, e: -34.7 } // Recife/Suape (Suape é mais ao sul, 930 cobre PE range?)
    },
    {
        id: "2110", // ??? Suape Específica? O TXT lista.
        // TXT: 2110 Rio Grande. Suape usually is 21xxx or 22xxx
        // Let's rely on TXT. 
        // 930 is Recife. Suape is nearby. Let's assume 930 covers Suape for now or add explicit logic.
        // Actually Suape is ~8.4S. 930 covers it.
        // Wait, 21020 is listed twice? No.
        // Let's stick to TXT list mostly.
        id: "1902", // Ilha de SC
        title: "Proximidades da Ilha de Santa Catarina",
        category: "Aproximação",
        scale: 100928,
        bounds: { n: -27.0, s: -28.0, w: -48.8, e: -48.2 }
    },
    {
        id: "2110",
        title: "Proximidades do Porto do Rio Grande",
        category: "Aproximação",
        scale: 50000,
        bounds: { n: -32.0, s: -32.3, w: -52.2, e: -52.0 }
    },
    {
        id: "1506",
        title: "Proximidades da Baía de Guanabara",
        category: "Aproximação",
        scale: 75000,
        bounds: { n: -22.7, s: -23.1, w: -43.3, e: -43.0 } // Rio
    },
    {
        id: "1711",
        title: "Proximidades do Porto de Santos",
        category: "Aproximação",
        scale: 80000,
        bounds: { n: -23.9, s: -24.1, w: -46.5, e: -46.2 }
    }
];

// v3.15.0: catálogo completo (carregado sob demanda) e a fronteira de "antiga"
const CATALOGO_URL = 'dados/cartas_dhn.json?v=1';
const DIAS_CORRECAO_ANTIGA = 730;   // 2 anos (aprovado por Charlie Bravo)

/** [2] Ponto (lat, lon) dentro do polígono [[lat, lon], ...]? Algoritmo do raio. */
function dentroPoligono(lat, lon, ply) {
    let dentro = false;
    for (let i = 0, j = ply.length - 1; i < ply.length; j = i++) {
        const [ai, oi] = ply[i], [aj, oj] = ply[j];
        // o lado (j -> i) cruza a latitude do ponto, a leste dele?
        if ((ai > lat) !== (aj > lat) && lon < (oj - oi) * (lat - ai) / (aj - ai) + oi) dentro = !dentro;
    }
    return dentro;
}

const ChartService = {
    _cartas: null,        // lista do catálogo, já ordenada por escala (maior detalhe primeiro)
    _carregando: null,    // Promise do carregamento (evita baixar duas vezes)

    /** [1] Carrega o catálogo uma vez. Resolve com a lista (ou null se falhar). */
    carregarCatalogo: function () {
        if (this._carregando) return this._carregando;
        this._carregando = fetch(CATALOGO_URL)
            .then(r => (r.ok ? r.json() : null))
            .then(j => {
                if (j && Array.isArray(j.cartas)) {
                    this._cartas = j.cartas.slice().sort((a, b) => (a.escala || 1e9) - (b.escala || 1e9));
                }
                return this._cartas;
            })
            .catch(() => null);   // sem catálogo: segue com a tabela reserva
        return this._carregando;
    },

    /** [2] Ficha da carta de maior escala que contém o ponto, ou null. */
    getChartInfo: function (lat, lon) {
        if (this._cartas) {
            for (const c of this._cartas) {   // já ordenadas: o 1º que contém vence
                const [s, w, n, e] = c.b;
                if (lat < s || lat > n || lon < w || lon > e) continue;
                if (c.ply && !dentroPoligono(lat, lon, c.ply)) continue;
                return c;
            }
            return null;
        }
        // Reserva (v1.0): tabela aproximada
        const cand = CHART_DB.filter(c => lat <= c.bounds.n && lat >= c.bounds.s && lon >= c.bounds.w && lon <= c.bounds.e)
            .sort((a, b) => a.scale - b.scale);
        if (!cand.length) return null;
        return { numero: cand[0].id, nome: cand[0].title, escala: cand[0].scale, reserva: true };
    },

    /** [3] Situação da última correção registrada no arquivo da carta. */
    estadoCorrecao: function (carta, hoje = Date.now()) {
        if (!carta || carta.reserva) return { nivel: 'desconhecido', dias: null };
        if (!carta.an_data) return { nivel: 'sem', dias: null };
        const dias = Math.floor((hoje - Date.parse(carta.an_data + 'T00:00:00')) / 86400000);
        return { nivel: dias > DIAS_CORRECAO_ANTIGA ? 'antiga' : 'ok', dias };
    },

    /**
     * Retorna a carta mais adequada para uma coordenada (Lat/Lon).
     * [4] Mesmo formato de antes: "BR-1711" ou "-".
     */
    getChartForPosition: function (lat, lon) {
        const c = this.getChartInfo(lat, lon);
        return c ? 'BR-' + c.numero : '-';
    }
};

ChartService.carregarCatalogo();   // começa a baixar já (218 KB, uma vez por sessão)

export default ChartService;
