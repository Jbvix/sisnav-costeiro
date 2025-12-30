/**
 * ARQUIVO: ChartService.js
 * AUTOR: Jossian Brito
 * DATA: 2025-12-30
 * DESCRIÇÃO: Serviço para identificar a Carta Náutica (DHN) baseada em coordenadas.
 * Dados baseados em 'library/CHARTS_BRAZIL.txt' + Coordenadas aproximadas.
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

const ChartService = {
    /**
     * Retorna a carta mais adequada para uma coordenada (Lat/Lon).
     * Prioriza cartas de aproximação (escala menor) sobre costeiras.
     * @param {number} lat 
     * @param {number} lon 
     * @returns {string} ID da Carta (ex: "BR-21040") ou "-"
     */
    getChartForPosition: function (lat, lon) {
        // Filtra todas que contém o ponto
        const candidates = CHART_DB.filter(c =>
            lat <= c.bounds.n && lat >= c.bounds.s &&
            lon >= c.bounds.w && lon <= c.bounds.e
        );

        if (candidates.length === 0) return "-";

        // Ordena por Escala (Menor escala = Mais detalhe/Zoom = Prioridade)
        // Ex: 1:50.000 (50000) < 1:1.000.000 (1000000)
        // Queremos o menor valor de Scale.
        candidates.sort((a, b) => a.scale - b.scale);

        return "BR-" + candidates[0].id; // Prefixo BR padrão
    }
};

export default ChartService;
