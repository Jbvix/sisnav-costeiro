import NavMath from '../core/NavMath.js';
import TideCSVService from './TideCSVService.js';

const METEO_AREAS = [
    { id: 'ALFA', limits: 'Arroio Chuí (RS) até Farol de Santa Marta (SC)', states: 'RS e Sul de SC' },
    { id: 'BRAVO', limits: 'Laguna (SC) até Arraial do Cabo (RJ) - Oceânica', states: 'SC, PR, SP, RJ (Águas Profundas)' },
    { id: 'CHARLIE', limits: 'Laguna (SC) até Arraial do Cabo (RJ) - Costeira', states: 'Norte de SC, PR, SP, Sul do RJ' },
    { id: 'DELTA', limits: 'Arraial do Cabo (RJ) até Caravelas (BA)', states: 'Norte do RJ, ES, Sul da BA' },
    { id: 'ECHO', limits: 'Caravelas (BA) até Salvador (BA)', states: 'Bahia (Litoral Sul e Recôncavo)' },
    { id: 'FOXTROT', limits: 'Salvador (BA) até Natal (RN)', states: 'BA(N), SE, AL, PE, PB, RN(Leste)' },
    { id: 'GOLF', limits: 'Natal (RN) até São Luís (MA)', states: 'RN(Norte), CE, PI, MA(Leste)' },
    { id: 'HOTEL', limits: 'São Luís (MA) até Oiapoque (AP)', states: 'MA(Oeste), PA, AP' }
];

const parseMeteoText = (text) => {
    if (!text) return [];

    // Normalize newlines
    const raw = text.replace(/\r\n/g, '\n');

    // Regex for Area Header: "ÁREA ALFA" or just "ALFA" at start of line
    const areaRegex = /(?:ÁREA\s+)?(ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL)/g;

    // Split by Areas, but keep the delimiter
    // This logic is tricky with Regex split. 
    // Alternative: Find all indices of Areas and slice.

    const matches = [...raw.matchAll(areaRegex)];
    if (matches.length === 0) return [];

    const parsedData = [];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const areaName = match[1];
        const startIdx = match.index;
        const endIdx = (i < matches.length - 1) ? matches[i + 1].index : raw.length;

        const block = raw.substring(startIdx, endIdx);

        // Extract fields using Regex
        // "TEMPO:..." or "TEMPO ..."
        const getWeather = (key) => {
            const re = new RegExp(`(?:${key}[:\\.]?)\\s*([^\\n\\r.]+)`, 'i');
            const m = block.match(re);
            return m ? m[1].trim() : '-';
        };

        parsedData.push([
            areaName,
            getWeather('TEMPO|OBS'),
            getWeather('VENTO'),
            getWeather('ONDAS|MAR'),
            getWeather('VISIBILIDADE|VIS')
        ]);
    }

    return parsedData;
};

const ReportService = {
    generatePDF: async function (state) {
        if (!state) {
            alert("Erro: Estado da aplicação vazio (State is null).");
            return;
        }

        // Dynamic Import of NavMath
        let NavMath = window.NavMath;
        if (!NavMath) {
            try {
                const module = await import('../core/NavMath.js');
                NavMath = module.default;
            } catch (e) {
                console.error("ReportService: Failed to load NavMath", e);
            }
        }

        try {
            console.log("ReportService: Iniciando geração do PDF...");

            // Instanciação Segura do jsPDF
            const { jsPDF } = window.jspdf;
            if (!jsPDF) throw new Error("Biblioteca jsPDF não carregada (window.jspdf indefinido).");

            const doc = new jsPDF();
            console.log("ReportService: Doc criado.");

            // --- LOAD ASSETS ---
            const loadImage = (src) => new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = (e) => {
                    console.warn(`Falha ao carregar imagem: ${src}`, e);
                    resolve(null); // Resolve null to not block PDF generation
                };
            });

            console.log("ReportService: Carregando imagens...");
            // Use path relative to index.html
            const [bgImg, logoImg] = await Promise.all([
                loadImage('./library/img/chart_bg.png'),
                loadImage('./library/img/saam_logo.png')
            ]);
            console.log("ReportService: Imagens carregadas:", bgImg ? "Fundo OK" : "Fundo FALHOU", logoImg ? "Logo OK" : "Logo FALHOU");

            // --- COVER PAGE ---
            // 1. Background (Faint chart)
            if (bgImg) {
                // Tenta aplicar transparência se suportado (GState)
                try {
                    // Check if GState exists in this version of jsPDF
                    if (doc.GState) {
                        doc.saveGraphicsState();
                        doc.setGState(new doc.GState({ opacity: 0.15 })); // Very faint (15%)
                        doc.addImage(bgImg, 'PNG', 0, 0, 210, 297);
                        doc.restoreGraphicsState();
                    } else {
                        // Se não tiver GState, adiciona normal (espero que a imagem já seja clara ou aceitamos assim)
                        // Alternativa: desenhar um retângulo branco semi-transparente por cima?
                        // jsPDF não suporta rgba fill com alpha facil em versoes antigas.
                        // Imagem direta:
                        doc.addImage(bgImg, 'PNG', 0, 0, 210, 297);
                    }
                } catch (e) {
                    console.warn("Erro ao desenhar background:", e);
                }
            }

            // 2. Logo (Top Left)
            if (logoImg) {
                // Width 40mm, maintain aspect
                const logoW = 50;
                const logoH = logoW * (logoImg.height / logoImg.width);
                doc.addImage(logoImg, 'PNG', 10, 10, logoW, logoH);
            }

            // 3. Title (Centered)
            doc.setFontSize(28);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 51, 102); // Dark Blue (SAAM color-ish)
            doc.text("PLANO DE PASSAGEM", 105, 140, { align: "center" });

            doc.setFontSize(14);
            doc.setTextColor(100);
            doc.text(`${new Date().getFullYear()}`, 105, 150, { align: "center" });

            // Add Start Page
            doc.addPage();
            doc.setTextColor(0); // Reset color

            // HELPERS
            const addSectionTitle = (text, y) => {
                doc.setFontSize(10);
                doc.setFillColor(41, 128, 185);
                doc.setTextColor(255);
                doc.rect(14, y, 182, 6, 'F');
                doc.setFont(undefined, 'bold');
                doc.text(text, 16, y + 4.5);
                doc.setTextColor(0);
                doc.setFont(undefined, 'normal');
                return y + 10;
            };

            const checkBool = (val) => val ? "OK" : "PENDENTE";

            // --- HEADER ---
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text("PLANO DE VIAGEM - SISNAV COSTEIRO", 105, 15, { align: "center" });
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 20, { align: "center" });

            let currentY = 30;

            // --- 1. DADOS DA EMBARCAÇÃO & MÁQUINAS ---
            currentY = addSectionTitle("1. DADOS DA EMBARCAÇÃO E MÁQUINAS", currentY);

            const ship = state.shipProfile || {};
            const engine = ship.engine || {};
            const drafts = ship.draft || {};

            // Fuel Autonomy Calc
            const stock = parseFloat(ship.fuelStock) || 0;
            const rate = parseFloat(ship.fuelRate) || 1;
            const autonomyHours = (stock / rate).toFixed(1);
            const engineStatusMap = { 'ok': 'Full Power', 'restricted': 'Restrito', 'no-go': 'NO-GO' };

            const vesselData = [
                ["Navio:", ship.name, "IMO:", ship.imo],
                ["Comandante:", ship.commander || "-", "Tripulação:", ship.crew],
                ["Calado (Popa/Proa):", `${drafts.aft}m / ${drafts.fwd}m`, "Rebocado:", `${drafts.towAft || 0}m`],
                ["Status Máquinas:", engineStatusMap[engine.status] || "N/A", "", ""],
                ["Estoque Combustível:", `${stock} L`, "Consumo:", `${rate} L/h`],
                ["Autonomia Est.:", `${autonomyHours} horas`, "Vel. Cruzeiro:", `${ship.speed} kn`]
            ];

            doc.autoTable({
                startY: currentY,
                body: vesselData,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1 },
                columnStyles: { 0: { fontStyle: 'bold', width: 35 }, 2: { fontStyle: 'bold', width: 35 } }
            });
            currentY = doc.lastAutoTable.finalY + 5;

            // --- 1.1 CHECKLIST PRAÇA DE MÁQUINAS ---
            currentY = addSectionTitle("PRAÇA DE MÁQUINAS - STATUS OPERACIONAL", currentY);

            // Re-definition of items for report mapping
            const checkItems = {
                safety: [
                    { id: 'safety_estanque', label: 'Estanqueidade (Saídas)' },
                    { id: 'safety_fire', label: 'Combate a Incêndio' },
                    { id: 'safety_pump', label: 'Bomba Emergência' },
                    { id: 'safety_alarm', label: 'Alarmes / Painel' },
                    { id: 'safety_comm', label: 'Comunicação' },
                    { id: 'safety_stop', label: 'Parada Emergência' },
                    { id: 'safety_sopep', label: 'SOPEP' }
                ],
                propulsion: [
                    { id: 'prop_protection', label: 'Proteções MCPs' },
                    { id: 'prop_inspection', label: 'Visual MCPs' },
                    { id: 'prop_thermal', label: 'Isolamento Térmico' },
                    { id: 'prop_azi_oil', label: 'Azimutal (Óleo/Refrig)' },
                    { id: 'prop_steering', label: 'Testes de Governo' },
                    { id: 'prop_temp', label: 'Temps. (Trocadores)' }
                ],
                power: [
                    { id: 'pow_protection', label: 'Proteções MCAs' },
                    { id: 'pow_maint', label: 'Manutenção (Óleo/Filtro)' },
                    { id: 'pow_batt', label: 'Baterias (Carregadores)' },
                    { id: 'pow_light', label: 'Iluminação Emergência' }
                ],
                aux: [
                    { id: 'aux_diesel', label: 'Purificador Diesel' },
                    { id: 'aux_tanks', label: 'Tanques (Visores)' },
                    { id: 'aux_air', label: 'Ar Comprimido' },
                    { id: 'aux_waste', label: 'Resíduos/Dalas' },
                    { id: 'aux_septic', label: 'Tanque Séptico' }
                ],
                spares: [
                    { id: 'spare_lube', label: 'Lubrificantes (Estoque)' },
                    { id: 'spare_filter', label: 'Filtros (Estoque)' },
                    { id: 'spare_parts', label: 'Peças Críticas' }
                ]
            };

            const checklistData = [];
            const checklistState = (state.appraisal.engine && state.appraisal.engine.checklist) ? state.appraisal.engine.checklist : {};

            // Helper to format group
            const formatGroup = (title, items) => {
                const lines = items.map(item => {
                    const status = checklistState[item.id] ? "OK" : "PENDENTE";
                    return `${status} - ${item.label}`;
                });
                return [title, lines.join("\n")];
            };

            checklistData.push(formatGroup("SEGURANÇA (CRÍTICO)", checkItems.safety));
            checklistData.push(formatGroup("PROPULSÃO", checkItems.propulsion));
            checklistData.push(formatGroup("GERAÇÃO DE ENERGIA", checkItems.power));
            checklistData.push(formatGroup("AUXILIARES", checkItems.aux));
            checklistData.push(formatGroup("SOBRESSALENTES", checkItems.spares));

            doc.autoTable({
                startY: currentY,
                body: checklistData,
                theme: 'grid',
                head: [['Grupo', 'Itens Verificados']],
                headStyles: { fillColor: [70, 70, 70] },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: { 0: { fontStyle: 'bold', width: 60 } }
            });
            currentY = doc.lastAutoTable.finalY + 5;

            // OBSERVAÇÕES
            const obs = (state.appraisal.engine && state.appraisal.engine.obs) ? state.appraisal.engine.obs : "Sem observações registradas.";
            doc.setFont(undefined, 'bold');
            doc.text("Observações da Praça de Máquinas:", 14, currentY + 4);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);

            const splitObs = doc.splitTextToSize(obs, 180);
            doc.text(splitObs, 14, currentY + 9);
            currentY += 10 + (splitObs.length * 4);
            currentY = addSectionTitle("2. DOCUMENTAÇÃO E REFERÊNCIAS", currentY);

            const files = state.appraisal.files || {};
            const pdfData = [
                ["Meteomarinha:", files.meteo || "N/A"],
                ["Avisos Navarea V:", files.navarea || "N/A"],
                ["Tábua Maré (Partida):", (files.tideDep && files.tideDep.name) ? files.tideDep.name : (files.tideDep || "N/A")],
                ["Tábua Maré (Chegada):", (files.tideArr && files.tideArr.name) ? files.tideArr.name : (files.tideArr || "N/A")]
            ];

            doc.autoTable({
                startY: currentY,
                body: pdfData,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1 },
                columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
            });
            currentY = doc.lastAutoTable.finalY + 4;

            // Cartas
            if (state.appraisal.selectedCharts && state.appraisal.selectedCharts.length > 0) {
                doc.setFont(undefined, 'bold');
                doc.text("Cartas Náuticas Utilizadas:", 14, currentY + 4);
                doc.setFont(undefined, 'normal');

                const chartsStr = state.appraisal.selectedCharts.join(", ");
                const splitCharts = doc.splitTextToSize(chartsStr, 180);
                doc.text(splitCharts, 14, currentY + 9);
                currentY += 10 + (splitCharts.length * 4);
            } else {
                doc.text("Nenhuma carta náutica selecionada.", 14, currentY + 5);
                currentY += 10;
            }

            // --- MARÉ DINÂMICA (GRÁFICOS) ---
            // Função auxiliar de desenho
            const drawTideGraph = (doc, x, y, width, height, station, dateStr, title) => {
                if (!station || !dateStr) return;

                // Parse Time
                const centerDate = new Date(dateStr);
                if (isNaN(centerDate.getTime())) return;

                const startDate = new Date(centerDate.getTime() - 3 * 3600 * 1000);
                const endDate = new Date(centerDate.getTime() + 3 * 3600 * 1000);

                // Setup Box
                doc.setDrawColor(0);
                doc.rect(x, y, width, height); // Border
                doc.setFontSize(8);
                doc.setFont(undefined, 'bold');
                doc.text(title, x + 2, y + 5);
                doc.setFontSize(7);
                doc.setFont(undefined, 'normal');
                doc.text(`${station} - Ref: ${centerDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, x + 2, y + 9);

                // Collect Points
                const points = [];
                let minH = 99, maxH = -99;

                const step = 900 * 1000; // 15 min in ms
                for (let t = startDate.getTime(); t <= endDate.getTime(); t += step) {
                    const d = new Date(t);
                    const res = window.TideCSVService.getInterpolatedTide(station, d);
                    if (res) {
                        const h = parseFloat(res.height);
                        if (h < minH) minH = h;
                        if (h > maxH) maxH = h;
                        points.push({ t: t, h: h, label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
                    }
                }

                if (points.length < 2) {
                    doc.text("Dados de maré não disponíveis.", x + width / 2, y + height / 2, { align: 'center' });
                    return;
                }

                // Scale (Add margin)
                minH -= 0.2; maxH += 0.2;
                const rangeH = maxH - minH;
                const timeSpan = endDate.getTime() - startDate.getTime();

                const getX = (t) => x + 10 + ((t - startDate.getTime()) / timeSpan) * (width - 20);
                const getY = (h) => y + height - 10 - ((h - minH) / rangeH) * (height - 20);

                // Draw Axis
                doc.setDrawColor(150);
                doc.line(x + 10, y + height - 10, x + width - 10, y + height - 10); // X Axis
                doc.line(x + 10, y + 10, x + 10, y + height - 10); // Y Axis

                // Draw Curve
                doc.setLineWidth(0.5);
                doc.setDrawColor(0, 100, 200);

                for (let i = 0; i < points.length - 1; i++) {
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    doc.line(getX(p1.t), getY(p1.h), getX(p2.t), getY(p2.h));
                }

                // Draw Center Line (Event)
                const cx = getX(centerDate.getTime());
                doc.setDrawColor(255, 0, 0);
                doc.setLineWidth(0.2);
                doc.line(cx, y + 10, cx, y + height - 10);

                // Annotate Center Height
                const centerRes = window.TideCSVService.getInterpolatedTide(station, centerDate);
                if (centerRes) {
                    doc.setTextColor(255, 0, 0);
                    doc.text(`${centerRes.height}m`, cx + 1, y + 15);
                    doc.setTextColor(0);
                }

                // Labels (Start, Middle, End) for Time
                doc.text(points[0].label, x + 10, y + height - 6);
                doc.text(points[points.length - 1].label, x + width - 20, y + height - 6);

                doc.setDrawColor(0); // Reset
            };

            const voyage = state.voyage || {};
            const showDep = voyage.depPort && voyage.depTime;
            const showArr = voyage.arrPort && voyage.arrTime;

            if (showDep || showArr) {
                currentY = addSectionTitle("3. ANÁLISE DE MARÉ (JANELA +/- 3h)", currentY);
                if (currentY + 50 > 280) { doc.addPage(); currentY = 20; }

                const graphY = currentY + 5;
                if (showDep) {
                    drawTideGraph(doc, 14, graphY, 85, 50, voyage.depPort, voyage.depTime, "MARÉ DE SAÍDA");
                }
                if (showArr) {
                    const x = showDep ? 110 : 14;
                    drawTideGraph(doc, x, graphY, 85, 50, voyage.arrPort, voyage.arrTime, "MARÉ DE CHEGADA");
                }
                currentY += 60;
            }

            // --- ANEXOS DE TEXTO (METEO/NAVAREA) ---


            // --- 3. CONTATOS E ABRIGOS ---
            currentY = addSectionTitle("3. APOIO E CONTINGÊNCIA", currentY);

            // Contatos
            const contacts = state.appraisal.shoreContacts || [];
            if (contacts.length > 0) {
                const contactBody = contacts.map(c => [c.name, c.role || '-', c.phone, c.email]);
                doc.autoTable({
                    startY: currentY,
                    head: [['Contato', 'Função', 'Telefone', 'Email']],
                    body: contactBody,
                    theme: 'striped',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [100, 100, 100] }
                });
                currentY = doc.lastAutoTable.finalY + 5;
            } else {
                doc.text("- Nenhum contato de terra cadastrado.", 14, currentY + 5);
                currentY += 10;
            }

            // Abrigos
            const shelters = state.appraisal.shelters || [];
            if (shelters.length > 0) {
                doc.text("Áreas de Abrigo / Fundeio:", 14, currentY);
                const shelterBody = shelters.map(s => [s.name, s.type, s.details]);
                doc.autoTable({
                    startY: currentY + 2,
                    head: [['Local', 'Tipo', 'Detalhes']],
                    body: shelterBody,
                    theme: 'striped',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [100, 100, 100] }
                });
                currentY = doc.lastAutoTable.finalY + 5;
            }

            // --- 4. ROTA PLANEJADA ---
            // New Page if low on space
            if (currentY > 200) {
                doc.addPage();
                currentY = 20;
            }

            currentY = addSectionTitle("4. ROTA PLANEJADA", currentY);
            const totalDistNm = (state.totalDistance / 1852).toFixed(1);
            doc.text(`Distância Total: ${totalDistNm} NM  |  Pernas: ${(state.routePoints.length > 0 ? state.routePoints.length - 1 : 0)}`, 14, currentY + 5);

            // Build Route Data matching Plan Screen (Legs)
            const routeData = [];
            if (state.routePoints && state.routePoints.length > 1) {
                for (let i = 0; i < state.routePoints.length - 1; i++) {
                    const p1 = state.routePoints[i];
                    const p2 = state.routePoints[i + 1];

                    // Calc Leg
                    let crs = 0, legDist = 0;
                    if (NavMath) {
                        const leg = NavMath.calcLeg(p1.lat, p1.lon, p2.lat, p2.lon);
                        crs = leg.crs;
                        legDist = leg.dist;
                    }

                    // Lighthouse Info (Near p2, matching UI)
                    let farolTxt = "-";
                    if (window.App && typeof window.App.getNearestLighthouse === 'function') {
                        const lh = window.App.getNearestLighthouse(p2.lat, p2.lon);
                        if (lh && lh.dist < 50) {
                            farolTxt = `${lh.name}\n(${lh.dist.toFixed(1)} NM)`;
                        }
                    }

                    routeData.push([
                        (i + 1).toString(),
                        `${p1.name}\n(to ${p2.name})`,
                        `${p1.lat.toFixed(4)}\n${p1.lon.toFixed(4)}`, // Lat/Long stacked
                        `${crs.toFixed(1)}°`,
                        legDist.toFixed(1),
                        farolTxt
                    ]);
                }
            }

            doc.autoTable({
                startY: currentY + 8,
                head: [['#', 'Waypoint', 'Lat / Long', 'Rumo', 'Dist.', 'Farol']],
                body: routeData,
                theme: 'grid',
                headStyles: { fillColor: [52, 152, 219], halign: 'center' },
                styles: { fontSize: 8, valign: 'middle', halign: 'center' },
                columnStyles: {
                    1: { halign: 'left' }, // Waypoint name left aligned
                    5: { fontSize: 7 }     // Lighthouse smaller
                }
            });

            // --- 5. AUXÍLIOS À NAVEGAÇÃO (FARÓIS) ---
            if (state.appraisal.lighthouses.length > 0) {
                doc.addPage();
                addSectionTitle("5. FARÓIS E AUXÍLIOS VISUAIS", 20);

                const lhData = state.appraisal.lighthouses.map(lh => [
                    lh.name,
                    lh.lat + '\n' + lh.lon,
                    lh.char,
                    doc.splitTextToSize(lh.desc || '-', 90)
                ]);

                doc.autoTable({
                    startY: 30,
                    head: [['Nome', 'Coord', 'Carac.', 'Descrição Visual']],
                    body: lhData,
                    theme: 'grid',
                    headStyles: { fillColor: [230, 126, 34] },
                    styles: { fontSize: 8, valign: 'middle' },
                    columnStyles: { 3: { fontSize: 7 } } // Smaller font for desc
                });
            }
            if (state.appraisal.meteoText || state.appraisal.navareaText) {
                doc.addPage(); // Start attachments on a new page? Or just flow? User said "Before signatures". 
                // Let's check space. Or just always add page for cleanliness if it's an "Annex"?
                // The previous logic checked `currentY > 250`.
                // Since we are at the end, `currentY` might be high from Lighthouses.
                // Let's use the same logic.

                // Reset Y if just added a page? No, we just trust flow.
                // Actually, Lighthouses creates a table. `doc.lastAutoTable.finalY` is reliable?
                // `doc.autoTable` tracks Y.

                currentY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 30;

                if (state.appraisal.meteoText) {
                    if (currentY > 230) { doc.addPage(); currentY = 20; }
                    currentY = addSectionTitle("ANEXO: PREVISÃO METEOMARINHA", currentY);

                    // 1. Tabela de Referência (Definições)
                    doc.setFontSize(8);
                    doc.text("TABELA 1: DEFINIÇÃO DAS ÁREAS METEOMARINHAS", 14, currentY + 5);

                    doc.autoTable({
                        startY: currentY + 7,
                        head: [['ÁREA', 'LIMITES (PONTOS COSTEIROS)', 'ESTADOS ABRANGIDOS']],
                        body: METEO_AREAS.map(a => [a.id, a.limits, a.states]),
                        theme: 'striped',
                        headStyles: { fillColor: [70, 70, 70] },
                        styles: { fontSize: 7, cellPadding: 1.5 },
                        columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } }
                    });

                    currentY = doc.lastAutoTable.finalY + 10;

                    // 2. Tabela de Previsão (Dinâmica)
                    const forecastData = parseMeteoText(state.appraisal.meteoText);

                    doc.text("TABELA 2: PREVISÃO DIÁRIA (Extraída do Boletim)", 14, currentY - 2);

                    if (forecastData.length > 0) {
                        // Render Structured Table
                        doc.autoTable({
                            startY: currentY,
                            head: [['ÁREA', 'TEMPO / OBS', 'VENTO', 'ONDAS', 'VISIBILIDADE']],
                            body: forecastData,
                            theme: 'grid',
                            headStyles: { fillColor: [41, 128, 185] },
                            styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                            columnStyles: {
                                0: { fontStyle: 'bold', cellWidth: 20 },
                                1: { cellWidth: 60 } // Weather definition wider
                            }
                        });
                        currentY = doc.lastAutoTable.finalY + 10;
                    } else {
                        // Fallback: Raw Text if regex fails
                        doc.setFontSize(8);
                        doc.setTextColor(150, 0, 0); // Warning color
                        doc.text("(Formato não reconhecido - Exibindo texto original)", 14, currentY - 2, { align: 'right' });
                        doc.setTextColor(0);

                        doc.autoTable({
                            startY: currentY,
                            body: [[state.appraisal.meteoText]],
                            theme: 'plain',
                            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', font: 'courier' },
                        });
                        currentY = doc.lastAutoTable.finalY + 5;
                    }
                }

                if (state.appraisal.navareaText) {
                    if (currentY > 250) { doc.addPage(); currentY = 20; }
                    currentY = addSectionTitle("ANEXO: AVISOS NAVAREA V", currentY);

                    doc.autoTable({
                        startY: currentY,
                        body: [[state.appraisal.navareaText]],
                        theme: 'plain',
                        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                        columnStyles: { 0: { cellWidth: 180 } }
                    });
                    currentY = doc.lastAutoTable.finalY + 5;
                }
            }

            // --- ASSINATURAS ---
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);

                if (i === pageCount) {
                    const y = 260;
                    doc.setDrawColor(0);

                    // Signature Lines
                    // Signature Lines
                    // doc.line(20, y, 90, y); // Left (Removed Chief)

                    // Centering Commander? Or keeping right?
                    // User said "Only Commander".
                    // Let's Center it for better look.
                    doc.line(75, y, 135, y); // Center (Width 60)

                    doc.setFontSize(10);
                    doc.setFont(undefined, 'bold');
                    // doc.text("Chefe de Máquinas", 55, y + 5, { align: "center" });
                    doc.text("Comandante", 105, y + 5, { align: "center" });

                    doc.setFontSize(8);
                    doc.setFont(undefined, 'normal');
                    // doc.text("Visto / Carimbo", 55, y + 10, { align: "center" });
                    doc.text("Visto / Carimbo", 105, y + 10, { align: "center" });
                }

                doc.setFontSize(8);
                doc.text(`SISNAV Costeiro - Pág ${i}/${pageCount}`, 105, 290, { align: "center" });
            }

            doc.save(`Plano_Viagem_${ship.name || 'Export'}.pdf`);
        } catch (error) {
            console.error("ReportService Error:", error);
            alert("Falha ao gerar PDF:\n" + error.message);
        }
    }
};

window.ReportService = ReportService;
