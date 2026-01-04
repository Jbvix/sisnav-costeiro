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
        '21070': { title: 'Do Cabo Frio ao Cabo de Santa Marta', n: -23.0, s: -29.0, w: -49.0, e: -41.0 }, // Fix: Start at Cabo Frio (-23)
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
        '1600': { title: 'Da Ilha Grande à Sepetiba', n: -23.05, s: -23.2, w: -44.1, e: -43.6 }, // Fix: Exclude Rio
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
    /**
     * Executa a análise completa
     * @param {Array} routePoints - Array de {lat, lon}
     * @param {Array} availableLighthouses - Lista completa de faróis carregados
     * @param {String} depPortId - ID do Porto de Partida (ex: 'BR_FOR')
     * @param {String} arrPortId - ID do Porto de Chegada
     * @param {Array} visitedPortIds - Lista de IDs de portos visitados pela rota (Opcional)
     */
    analyzeRoute: function (routePoints, availableLighthouses, depPortId, arrPortId, visitedPortIds = []) {
        console.time("AutomatedPlanning");

        const suggestions = {
            charts: new Set(),
            lighthouses: []
        };

        // 1. ANÁLISE DE CARTAS (Bounding Box Intersection)
        // Amostragem da rota para performance (a cada 10 pontos ou 20 milhas)
        const sampleRate = Math.max(1, Math.floor(routePoints.length / 50));
        const samplePoints = routePoints.filter((_, i) => i % sampleRate === 0);

        // Pre-fetch Port Objects and Calculate Voyage Range
        // Pre-fetch Port Objects and Calculate Voyage Range
        let depPort = PortDatabase.find(p => p.id === depPortId);
        let arrPort = PortDatabase.find(p => p.id === arrPortId);

        // FALLBACK: Infer keys from GPX if not provided (Resilience)
        if ((!depPort || !arrPort) && routePoints.length > 0) {
            const startPt = routePoints[0];
            const endPt = routePoints[routePoints.length - 1];

            if (!depPort) {
                // Find closest port to start
                let minD = 9999;
                PortDatabase.forEach(p => {
                    const d = NavMath.calcLeg(p.lat, p.lon, startPt.lat, startPt.lon).dist;
                    if (d < minD) { minD = d; depPort = p; }
                });
                if (depPort) console.log(`AutoPlan: Inferred DepPort from GPX: ${depPort.name}`);
            }

            if (!arrPort) {
                // Find closest port to end
                let minD = 9999;
                PortDatabase.forEach(p => {
                    const d = NavMath.calcLeg(p.lat, p.lon, endPt.lat, endPt.lon).dist;
                    if (d < minD) { minD = d; arrPort = p; }
                });
                if (arrPort) console.log(`AutoPlan: Inferred ArrPort from GPX: ${arrPort.name}`);
            }
        }

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

            // 2. Latitude Overlap Check (For Coastal Charts 21xxx)
            // This ensures coastal charts are added even without GPX.
            if (!match && depPort && arrPort) {
                if (bbox.s <= maxLat && bbox.n >= minLat) {
                    if (chartId.startsWith('2') && chartId.length === 5) {
                        match = true;
                    }
                }
            }

            if (match) {
                suggestions.charts.add(chartId);
            }
        });

        // 2. FORÇAR PORTOS (Partida/Chegada/Intermediários/Visitados)
        const portsToForce = new Set([depPortId, arrPortId, ...visitedPortIds]);

        portsToForce.forEach(pId => {
            if (pId && this.portToChart[pId]) {
                this.portToChart[pId].forEach(c => suggestions.charts.add(c));
                console.log(`AutoPlan: Porto (Visitado) detectado: ${pId} -> Add Chart`);
            }
        });

        // Sugerir cartas de portos INTERMEDIÁRIOS dentro da Latitudes da Viagem (Fallback)
        if (depPort && arrPort) {
            PortDatabase.forEach(port => {
                // Se já não foi forçado acima
                if (!portsToForce.has(port.id) && this.portToChart[port.id]) {
                    // Checar se latitude está dentro do range (com margem de segurança)
                    const margin = 0.05;
                    if (port.lat >= (minLat - margin) && port.lat <= (maxLat + margin)) {
                        // EXTRA CHECK: Longitude removida para evitar problemas em rotas L-shape
                        // Apenas aceitamos se a latitude bater.
                        // Mas para evitar ports no outro lado do mundo (teórico), usar margem larga de Lon?
                        // Brasil é aprox W 034 a W 054. Safe range.

                        this.portToChart[port.id].forEach(c => suggestions.charts.add(c));
                        console.log(`AutoPlan: Porto Intermediário (Lat-Range) detectado: ${port.name} -> Add Chart`);
                    }
                }
            });
        }

        // 3. ANÁLISE DE FARÓIS (Proximidade)
        const LIGHTHOUSE_BUFFER = 25; // NM (Increased to 25 to catch all coastal lights per user request)

        // Definir pontos de interesse (Rota + Portos)
        const interestPoints = [...samplePoints];

        // Se tivermos IDs de portos, buscar coordenadas
        if (depPort) interestPoints.push({ lat: depPort.lat, lon: depPort.lon });
        if (arrPort) interestPoints.push({ lat: arrPort.lat, lon: arrPort.lon });

        if (availableLighthouses && availableLighthouses.length > 0) {
            availableLighthouses.forEach(lh => {
                if (!lh.latDec) return;

                let isRelevant = false;

                // 1. Proximity Check
                if (interestPoints.length > 0) {
                    // Reuse functionality for route proximity
                    isRelevant = this.isLocationNearRoute(lh.latDec, lh.lonDec, interestPoints, LIGHTHOUSE_BUFFER);
                }

                // 2. Latitude Range Check (Fallback)
                if (!isRelevant && minLat !== 90 && maxLat !== -90) {
                    const margin = 0.05;
                    if (lh.latDec >= (minLat - margin) && lh.latDec <= (maxLat + margin)) {
                        const minLon = Math.min(depPort.lon, arrPort.lon);
                        const maxLon = Math.max(depPort.lon, arrPort.lon);
                        const lonMargin = 2.0;

                        // Check Lon Range (important for offshore islands vs coast)
                        // If Route is Itaqui->Rio, range covers Northeast.
                        if (lh.lonDec >= (minLon - lonMargin) && lh.lonDec <= (maxLon + lonMargin)) {
                            // isRelevant = true; // Disabled pure box check to prefer route proximity now that route is better
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

        // 2. Ordenação (Along-Track Distance)
        if (routePoints && routePoints.length > 0) {
            // Assign a "Route Index" to each lighthouse (closest point index)
            uniqueLighthouses.forEach(lh => {
                let minDist = 9999;
                let bestIdx = 0;
                // Sampling is enough for sorting order
                for (let i = 0; i < routePoints.length; i += 10) {
                    const p = routePoints[i];
                    const d = NavMath.calcLeg(p.lat, p.lon, lh.latDec, lh.lonDec).dist;
                    if (d < minDist) {
                        minDist = d;
                        bestIdx = i;
                    }
                }
                lh._sortIdx = bestIdx;
            });

            uniqueLighthouses.sort((a, b) => a._sortIdx - b._sortIdx);

        } else if (depPort) {
            // Fallback: Distance from DepPort
            uniqueLighthouses.sort((a, b) => {
                const distA = NavMath.calcLeg(depPort.lat, depPort.lon, a.latDec, a.lonDec).dist;
                const distB = NavMath.calcLeg(depPort.lat, depPort.lon, b.latDec, b.lonDec).dist;
                return distA - distB;
            });
        }

        // 3. Ordenação das Cartas (Também da Origem para o Destino)
        let sortedCharts = Array.from(suggestions.charts);
        if (depPort) {
            sortedCharts.sort((aId, bId) => {
                // Get Charts Info
                const chartA = this.chartGeoDB[aId];
                const chartB = this.chartGeoDB[bId];

                // Se não achar (port maps talvez usem IDs não no DB? Não, todos devem estar), fallback
                if (!chartA || !chartB) return 0;

                // Calculate Center Point of Chart
                const latA = (chartA.n + chartA.s) / 2;
                const lonA = (chartA.w + chartA.e) / 2;

                const latB = (chartB.n + chartB.s) / 2;
                const lonB = (chartB.w + chartB.e) / 2;

                const distA = NavMath.calcLeg(depPort.lat, depPort.lon, latA, lonA).dist;
                const distB = NavMath.calcLeg(depPort.lat, depPort.lon, latB, lonB).dist;

                return distA - distB;
            });
        }

        console.timeEnd("AutomatedPlanning");
        console.log(`AutoPlan: ${sortedCharts.length} Cartas, ${uniqueLighthouses.length} Faróis sugeridos.`);

        return {
            charts: sortedCharts,
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
