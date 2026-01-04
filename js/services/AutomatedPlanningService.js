/**
 * AutomatedPlanningService.js
 * 
 * Serviço responsável por analisar a geometria da rota (GPX)
 * e sugerir automaticamente:
 * 1. Cartas Náuticas (Baseado em Bounding Boxes)
 * 2. Faróis e Auxílios (Baseado em Proximidade)
 */

import NavMath from '../core/NavMath.js';
import PortDatabase from './PortDatabase.js';

const AutomatedPlanningService = {

    /**
     * Banco de Dados Geográfico de Cartas Náuticas (Hardcoded para MVP)
     * Formato: ID: { n: NorthLat, s: SouthLat, w: WestLon, e: EastLon }
     * Coordenadas aproximadas baseadas nos títulos das cartas DHN.
     */
    chartGeoDB: {
        // Costeiras (Escala 1:1.000.000 aprox)
        '21010': { title: 'De Cayenne ao Cabo Gurupi', n: 7.0, s: -1.5, w: -54.0, e: -45.0 },
        '21020': { title: 'De Salinópolis a Fortaleza', n: 1.0, s: -5.0, w: -48.0, e: -37.0 },
        '21030': { title: 'De Fortaleza a Maceió', n: -2.0, s: -11.0, w: -42.0, e: -34.0 }, // Não estava no TXT mas é crucial?
        // Ajuste baseado no TXT (Se não tiver no TXT, o match por ID falha, mas deixamos aqui)
        '21040': { title: 'De Natal ao Rio Itariri', n: -4.0, s: -13.0, w: -39.0, e: -34.0 }, // Cobre Recife/Salvador norte
        '21050': { title: 'Do Rio Itariri ao Arq. Abrolhos', n: -11.0, s: -19.0, w: -41.0, e: -36.0 },
        '21060': { title: 'Do Arq. Abrolhos ao Cabo Frio', n: -17.0, s: -24.0, w: -43.0, e: -39.0 },
        '21070': { title: 'Do Cabo Frio ao Cabo de Santa Marta', n: -22.0, s: -29.0, w: -49.0, e: -41.0 },
        '21080': { title: 'Do Cabo de Santa Marta ao Arroio Chuí', n: -28.0, s: -35.0, w: -54.0, e: -48.0 },

        // Aproximação / Portos (Áreas pequenas)
        '410': { title: 'Prox. Baía de São Marcos (Itaqui)', n: -2.0, s: -3.0, w: -44.8, e: -43.8 },
        '710': { title: 'Prox. Porto de Mucuripe (Fortaleza)', n: -3.6, s: -3.8, w: -38.65, e: -38.35 },
        '810': { title: 'Prox. Porto de Natal', n: -5.7, s: -5.9, w: -35.3, e: -35.1 },
        '930': { title: 'Prox. Porto do Recife / Suape', n: -7.9, s: -8.5, w: -35.0, e: -34.75 }, // Cobre Suape tb? Chart 930 é Recife. Suape é prox.
        '1101': { title: 'Prox. Porto de Salvador', n: -12.8, s: -13.2, w: -38.7, e: -38.3 },
        '1410': { title: 'Prox. Portos de Vitória e Tubarão', n: -20.2, s: -20.4, w: -40.4, e: -40.1 },
        '1506': { title: 'Prox. Baía de Guanabara (Rio)', n: -22.7, s: -23.1, w: -43.3, e: -42.9 },
        '1711': { title: 'Prox. Porto de Santos', n: -23.9, s: -24.1, w: -46.5, e: -46.2 },
        '1820': { title: 'Prox. Barra de Paranaguá', n: -25.4, s: -25.7, w: -48.6, e: -48.2 },
        '1902': { title: 'Prox. Ilha de Santa Catarina', n: -27.2, s: -27.9, w: -48.7, e: -48.3 },
        '2110': { title: 'Prox. Porto do Rio Grande', n: -31.9, s: -32.3, w: -52.2, e: -51.9 }
    },

    // Mapeamento Porto -> Carta de Aproximação Recomendada (Override Manual)
    portToChart: {
        'BR_FOR': ['710'],      // Mucuripe
        'BR_PEC': ['710'],      // Pecém (Prox)
        'BR_NAT': ['810'],      // Natal
        'BR_CAB': ['21040'],    // Cabedelo (Genérica pois não temos especifica no TXT?)
        'BR_REC': ['930'],      // Recife
        'BR_SUA': ['930'],      // Suape (Prox Recife)
        'BR_SSA': ['1101'],     // Salvador
        'BR_VIT': ['1410'],     // Vitória
        'BR_RIO': ['1506'],     // Rio
        'BR_SSZ': ['1711'],     // Santos
        'BR_PNG': ['1820'],     // Paranaguá
        'BR_RIG': ['2110'],     // Rio Grande
        'BR_ITA': ['410'],      // Itaqui
    },

    /**
     * Executa a análise completa
     * @param {Array} routePoints - Array de {lat, lon}
     * @param {Array} availableLighthouses - Lista completa de faróis carregados
     * @param {String} depPortId - ID do Porto de Partida (ex: 'BR_FOR')
     * @param {String} arrPortId - ID do Porto de Chegada
     */
    analyzeRoute: function (routePoints, availableLighthouses, depPortId, arrPortId) {
        console.time("AutomatedPlanning");

        const suggestions = {
            charts: new Set(),
            lighthouses: []
        };

        // 1. ANÁLISE DE CARTAS (Bounding Box Intersection)
        // Otimização: Verificar BBox da rota inteira primeiro? 
        // Para MVP, checamos cada carta contra a rota (sampling)

        // Amostragem da rota para performance (a cada 10 pontos ou 20 milhas)
        const sampleRate = Math.max(1, Math.floor(routePoints.length / 50));
        const samplePoints = routePoints.filter((_, i) => i % sampleRate === 0);

        Object.entries(this.chartGeoDB).forEach(([chartId, bbox]) => {
            // Se algum ponto da rota está dentro do BBox da carta
            const intersects = samplePoints.some(p =>
                p.lat <= bbox.n && p.lat >= bbox.s &&
                p.lon >= bbox.w && p.lon <= bbox.e
            );

            if (intersects) {
                suggestions.charts.add(chartId);
            }
        });

        // 2. FORÇAR PORTOS (Partida/Chegada/Intermediários)
        // Adiciona cartas dos portos extremos
        if (depPortId && this.portToChart[depPortId]) {
            this.portToChart[depPortId].forEach(c => suggestions.charts.add(c));
        }
        if (arrPortId && this.portToChart[arrPortId]) {
            this.portToChart[arrPortId].forEach(c => suggestions.charts.add(c));
        }

        // Sugerir cartas de portos INTERMEDIÁRIOS próximos da rota
        // Iterar sobre todos os portos conhecidos
        PortDatabase.forEach(port => {
            // Se já não é dep/arr
            if (port.id !== depPortId && port.id !== arrPortId && this.portToChart[port.id]) {
                // Checar distancia da rota
                const isNear = this.isLocationNearRoute(port.lat, port.lon, samplePoints, 20); // 20 NM buffer
                if (isNear) {
                    this.portToChart[port.id].forEach(c => suggestions.charts.add(c));
                    console.log(`AutoPlan: Porto Intermediário detectado: ${port.name} -> Add Chart`);
                }
            }
        });

        // 3. ANÁLISE DE FARÓIS (Proximidade)
        // Filtra faróis num raio de X milhas da rota
        const LIGHTHOUSE_BUFFER = 15; // NM

        if (availableLighthouses && availableLighthouses.length > 0) {
            availableLighthouses.forEach(lh => {
                // Pular se não tem coords
                if (!lh.latDec) return;

                // Check distance to ANY point in sample
                // Otimização: Check BBox da rota primeiro? Sim, idealmente.
                // Mas Haversine Simples resolve pra < 500 faróis e 50 pontos.

                const isRelevant = this.isLocationNearRoute(lh.latDec, lh.lonDec, samplePoints, LIGHTHOUSE_BUFFER);
                if (isRelevant) {
                    suggestions.lighthouses.push(lh);
                }
            });
        }

        console.timeEnd("AutomatedPlanning");
        console.log(`AutoPlan: ${suggestions.charts.size} Cartas, ${suggestions.lighthouses.length} Faróis sugeridos.`);

        return {
            charts: Array.from(suggestions.charts),
            lighthouses: suggestions.lighthouses
        };
    },

    /**
     * Helper: Verifica se um ponto (lat,lon) está próximo de algum ponto da rota
     */
    isLocationNearRoute: function (lat, lon, routePoints, bufferNM) {
        // Fast Check: BBox
        // ... (Skipping for brevity in MVP)

        // Exact Check
        return routePoints.some(p => {
            const dist = NavMath.calcDist(lat, lon, p.lat, p.lon);
            return dist <= bufferNM;
        });
    }
};

export default AutomatedPlanningService;
