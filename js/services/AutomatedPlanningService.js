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
        '301': { title: 'Do Rio Pará ao Porto de Belém', n: -0.5, s: -2.0, w: -48.8, e: -48.0 },
        '410': { title: 'Prox. Baía de São Marcos (Itaqui)', n: -2.0, s: -3.0, w: -44.8, e: -43.8 },
        '411': { title: 'Porto do Itaqui', n: -2.5, s: -2.65, w: -44.45, e: -44.30 },
        '710': { title: 'Prox. Porto de Mucuripe (Fortaleza)', n: -3.6, s: -3.8, w: -38.65, e: -38.35 },
        '810': { title: 'Prox. Porto de Natal', n: -5.7, s: -5.9, w: -35.3, e: -35.1 },
        '830': { title: 'Porto de Cabedelo', n: -6.9, s: -7.1, w: -34.9, e: -34.75 },
        '930': { title: 'Prox. Porto do Recife / Suape', n: -7.9, s: -8.5, w: -35.0, e: -34.75 },
        '1000': { title: 'Porto de Maceió', n: -9.6, s: -9.75, w: -35.8, e: -35.6 },
        '1101': { title: 'Prox. Porto de Salvador', n: -12.8, s: -13.2, w: -38.7, e: -38.3 },
        '1110': { title: 'Baía de Todos os Santos', n: -12.6, s: -13.1, w: -38.8, e: -38.4 },
        '1201': { title: 'Porto de Ilhéus', n: -14.7, s: -14.9, w: -39.1, e: -38.9 },
        '1410': { title: 'Prox. Portos de Vitória e Tubarão', n: -20.2, s: -20.4, w: -40.4, e: -40.1 },
        '1506': { title: 'Prox. Baía de Guanabara (Rio)', n: -22.7, s: -23.1, w: -43.3, e: -42.9 },
        '1600': { title: 'Da Ilha Grande à Sepetiba', n: -22.9, s: -23.2, w: -44.1, e: -43.6 },
        '1644': { title: 'Canal de São Sebastião', n: -23.7, s: -23.9, w: -45.5, e: -45.3 },
        '1711': { title: 'Prox. Porto de Santos', n: -23.9, s: -24.1, w: -46.5, e: -46.2 },
        '1805': { title: 'Porto de Itajaí', n: -26.8, s: -27.0, w: -48.7, e: -48.55 },
        '1820': { title: 'Prox. Barra de Paranaguá', n: -25.4, s: -25.7, w: -48.6, e: -48.2 },
        '1902': { title: 'Prox. Ilha de Santa Catarina', n: -27.2, s: -27.9, w: -48.7, e: -48.3 },
        '1904': { title: 'Porto de Imbituba', n: -28.2, s: -28.3, w: -48.7, e: -48.6 },
        '2110': { title: 'Prox. Porto do Rio Grande', n: -31.9, s: -32.3, w: -52.2, e: -51.9 }
    },

    // Mapeamento Porto -> Carta de Aproximação Recomendada (Override Manual)
    portToChart: {
        'BR_VDC': ['301'],      // Vila do Conde
        'BR_BEL': ['301'],      // Belém
        'BR_ITA': ['410', '411'], // Itaqui
        'BR_FOR': ['710'],      // Mucuripe
        'BR_PEC': ['710'],      // Pecém
        'BR_NAT': ['810'],      // Natal
        'BR_CAB': ['830'],      // Cabedelo
        'BR_REC': ['930'],      // Recife
        'BR_SUA': ['930'],      // Suape
        'BR_MAC': ['1000'],     // Maceió
        'BR_SAL': ['1101', '1110'], // Salvador
        'BR_ILH': ['1201'],     // Ilhéus
        'BR_VIT': ['1410'],     // Vitória
        'BR_RIO': ['1506'],     // Rio
        'BR_ITG': ['1600'],     // Sepetiba
        'BR_ANG': ['1600'],     // Angra (Prox)
        'BR_SSB': ['1644'],     // São Sebastião
        'BR_STS': ['1711'],     // Santos
        'BR_PNG': ['1820'],     // Paranaguá
        'BR_ITJ': ['1805', '1902'], // Itajaí / SC
        'BR_RIG': ['2110'],     // Rio Grande
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

        // Pre-fetch Port Objects and Calculate Voyage Range
        const depPort = PortDatabase.find(p => p.id === depPortId);
        const arrPort = PortDatabase.find(p => p.id === arrPortId);
        let minLat = 90, maxLat = -90;

        if (depPort && arrPort) {
            minLat = Math.min(depPort.lat, arrPort.lat);
            maxLat = Math.max(depPort.lat, arrPort.lat);
        }

        Object.entries(this.chartGeoDB).forEach(([chartId, bbox]) => {
            // 1. Check Intersection with Route Points (if available)
            let match = false;

            if (samplePoints.length > 0) {
                match = samplePoints.some(p =>
                    p.lat <= bbox.n && p.lat >= bbox.s &&
                    p.lon >= bbox.w && p.lon <= bbox.e
                );
            }

            // 2. Latitude Overlap Check (For Coastal Charts & General Coverage)
            // If we have Dep/Arr ports, we check if the chart's Latitude Range overlaps with the Voyage Latitude Range
            // This ensures coastal charts are added even without GPX.
            if (!match && depPort && arrPort) {
                // Logic: range overlap
                // Chart Range: [bbox.s, bbox.n]
                // Voyage Range: [minLat, maxLat]
                // Overlap if: (Chart.S <= Voyage.Max) AND (Chart.N >= Voyage.Min)

                if (bbox.s <= maxLat && bbox.n >= minLat) {
                    // Filter only "Costeira" charts (ID stars with '2') explicitly to avoid adding disjoint approach charts?
                    // Usually approach charts are small, so they might not pass this check easily unless they really are in the range.
                    // But strictly speaking, chart 210xxx are coastal.
                    if (chartId.startsWith('2') && chartId.length === 5) {
                        match = true;
                        console.log(`AutoPlan: Carta Costeira (Lat-Overlap) detectada: ${chartId}`);
                    }
                }
            }

            if (match) {
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

        // Sugerir cartas de portos INTERMEDIÁRIOS dentro da Latitudes da Viagem
        // Regra: Listar TODOS os portos entre a Lat de Partida e Lat de Chegada
        // (Ignorando se a rota passa perto ou longe, garantindo cobertura total de abrigos possíveis)

        if (depPort && arrPort) {
            // Already calculated minLat/maxLat at top scope

            PortDatabase.forEach(port => {
                // Se já não é dep/arr
                if (port.id !== depPortId && port.id !== arrPortId && this.portToChart[port.id]) {
                    // Checar se latitude está dentro do range (com margem de segurança de 0.05 grau)
                    // buffer de margem para incluir portos "quase" no caminho
                    const margin = 0.05;
                    if (port.lat >= (minLat - margin) && port.lat <= (maxLat + margin)) {
                        this.portToChart[port.id].forEach(c => suggestions.charts.add(c));
                        console.log(`AutoPlan: Porto Intermediário (Lat-Range) detectado: ${port.name} -> Add Chart`);
                    }
                }
            });
        }

        // 3. ANÁLISE DE FARÓIS (Proximidade)
        // Filtra faróis num raio de X milhas da rota
        const LIGHTHOUSE_BUFFER = 15; // NM

        // Definir pontos de interesse (Rota + Portos)
        const interestPoints = [...samplePoints];

        // Se tivermos IDs de portos, buscar coordenadas e adicionar aos pontos de interesse
        if (depPortId) {
            const depPort = PortDatabase.find(p => p.id === depPortId);
            if (depPort) interestPoints.push({ lat: depPort.lat, lon: depPort.lon });
        }
        if (arrPortId) {
            const arrPort = PortDatabase.find(p => p.id === arrPortId);
            if (arrPort) interestPoints.push({ lat: arrPort.lat, lon: arrPort.lon });
        }

        if (availableLighthouses && availableLighthouses.length > 0) {
            availableLighthouses.forEach(lh => {
                // Pular se não tem coords
                if (!lh.latDec) return;

                let isRelevant = false;

                // 1. Proximity Check (Route + Dep/Arr Ports)
                if (interestPoints.length > 0) {
                    isRelevant = this.isLocationNearRoute(lh.latDec, lh.lonDec, interestPoints, LIGHTHOUSE_BUFFER);
                }

                // 2. Latitude Range Check (Voyage Coverage)
                // If minLat/maxLat are valid (Dep/Arr selected), include all lights in range
                if (!isRelevant && minLat !== 90 && maxLat !== -90) {
                    // Margin reduzido para 0.05
                    const margin = 0.05;
                    // Check Latitude Range
                    if (lh.latDec >= (minLat - margin) && lh.latDec <= (maxLat + margin)) {

                        // EXTRA CHECK: Longitude (Evitar Ilhas Oceânicas como Fernando de Noronha -32W)
                        // Se a viagem é Costeira (ex: Longitude ~ -34 a -50), ignorar coisas multo a Leste (tipo > -33)
                        // A Costa do NE é aprox -34.8. Noronha é -32.4 (Mais a leste/maior valor)
                        // Regra simples: Se todos os portos são "Mainland" (Oeste de -34.5), filtrar lon > -33.5
                        // Ou simplesmente checar se a Longitude também está "perto" do range de longitude da viagem.

                        const minLon = Math.min(depPort.lon, arrPort.lon);
                        const maxLon = Math.max(depPort.lon, arrPort.lon);
                        const lonMargin = 2.0; // Margem maior em Longitude (2 graus ~ 120 milhas variacao da costa)

                        if (lh.lonDec >= (minLon - lonMargin) && lh.lonDec <= (maxLon + lonMargin)) {
                            isRelevant = true;
                            // console.log(`AutoPlan: Farol (Lat-Range) detectado: ${lh.name}`);
                        }
                    }
                }

                if (isRelevant) {
                    suggestions.lighthouses.push(lh);
                }
            });
        }

        // --- PÓS-PROCESSAMENTO: DEDUPLICAÇÃO E ORDENAÇÃO ---

        // 1. Deduplicação (por Nome)
        const uniqueLighthouses = [];
        const seenNames = new Set();
        suggestions.lighthouses.forEach(lh => {
            if (!seenNames.has(lh.name)) {
                uniqueLighthouses.push(lh);
                seenNames.add(lh.name);
            }
        });

        // 2. Ordenação (Da Origem para o Destino)
        // Se houver porto de partida, ordena pela distância até ele
        if (depPort) {
            uniqueLighthouses.sort((a, b) => {
                const distA = NavMath.calcLeg(depPort.lat, depPort.lon, a.latDec, a.lonDec).dist;
                const distB = NavMath.calcLeg(depPort.lat, depPort.lon, b.latDec, b.lonDec).dist;
                return distA - distB;
            });
        }

        console.timeEnd("AutomatedPlanning");
        console.log(`AutoPlan: ${suggestions.charts.size} Cartas, ${uniqueLighthouses.length} Faróis sugeridos.`);

        return {
            charts: Array.from(suggestions.charts),
            lighthouses: uniqueLighthouses
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
            const leg = NavMath.calcLeg(lat, lon, p.lat, p.lon);
            return leg.dist <= bufferNM;
        });
    }
};

export default AutomatedPlanningService;
