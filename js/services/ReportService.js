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

// Helper to extract global Date/Time/Validity from the top of the text
const extractMeteoHeader = (text) => {
    if (!text) return null;
    // Regex looking for Data: dd/mm/aaaa ... Hora: HHHHZ ... Validade: ...
    // Or similar variations.
    const dateMatch = text.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const timeMatch = text.match(/Hora:\s*(\d{4}Z?)/i);
    const validMatch = text.match(/Validade:\s*([^\n]+)/i);

    if (dateMatch || validMatch) {
        return {
            date: dateMatch ? dateMatch[1] : '-',
            time: timeMatch ? timeMatch[1] : '-',
            validity: validMatch ? validMatch[1].trim() : '-'
        };
    }
    return null;
};

const parseMeteoText = (text) => {
    if (!text) return [];

    // Normalize newlines
    const raw = text.replace(/\r\n/g, '\n');

    // Regex for Area Header: "ÁREA ALFA" or just "ALFA" or "SUL OESTE" etc
    const areaRegex = /(?:ÁREA\s+)?(ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL|SUL\s+OESTE|SUL\s+LESTE|30S–25S|N\s*>25S|NORTE\s+OCEÂNICA)/gi;

    const matches = [...raw.matchAll(areaRegex)];
    if (matches.length === 0) return [];

    const parsedData = [];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const areaName = match[1].toUpperCase();
        const startIdx = match.index;
        const endIdx = (i < matches.length - 1) ? matches[i + 1].index : raw.length;

        const block = raw.substring(startIdx, endIdx);

        // Lookup Region description
        // Use fuzzy match or exact ID match
        let regionDesc = '-';
        // Check METEO_AREAS for exact ID first
        const areaDef = METEO_AREAS.find(a => a.id === areaName);
        if (areaDef) {
            regionDesc = areaDef.limits; // Uses limits as Region
        } else {
            // Manual fallbacks for known oceanic areas if not in METEO_AREAS
            if (areaName.includes('SUL OESTE')) regionDesc = 'Sul 30S / Oest. 030W';
            else if (areaName.includes('SUL LESTE')) regionDesc = 'Sul 30S / Lest. 030W';
            else if (areaName.includes('30S–25S')) regionDesc = 'Oceânica';
            else if (areaName.includes('N >25S')) regionDesc = 'Oceânica';
            else if (areaName.includes('NORTE')) regionDesc = 'Norte de 02S';
        }

        // Extract fields using Regex
        // Supports "TEMPO:..." or lines like "TEMPO Pancadas"
        const getWeather = (key) => {
            const re = new RegExp(`(?:${key}[:\\.]?)\\s*([^\\n\\r.]+)`, 'i');
            const m = block.match(re);
            return m ? m[1].trim() : '-';
        };

        // Also support "Vento (Beaufort) NE/NW" style if user pastes table
        // But assuming user pastes Bulletins "VENTO: ...", we use that.
        // If raw string has no labels, it's harder.

        parsedData.push([
            areaName,
            regionDesc,
            getWeather('TEMPO|OBS'),
            getWeather('VENTO'), // Will need to manually add "(Beaufort)" in head
            getWeather('ONDAS|MAR'),
            getWeather('VISIBILIDADE|VIS')
        ]);
    }

    return parsedData;
};

const NAVAREA_CATEGORIES = {
    'NAV_TRAFFIC': "Navegação e tráfego",
    'STS_OPERATION': "Operação Ship-to-Ship",
    'TOWING_OPERATION': "Operação de reboque",
    'VESSEL_ADRIFT': "Embarcação à deriva",
    'SAR_RELATED': "Busca e salvamento",
    'WRECK_SUNKEN': "Naufrágio / Destroços",
    'DERELICT_FLOATING': "Objeto à deriva",
    'OBSTRUCTION': "Obstrução / Perigo",
    'HYDROGRAPHY_BATHY': "Hidrografia",
    'CHART_CORRECTION': "Correção cartográfica",
    'AtoN_LIGHTHOUSE': "Farol",
    'AtoN_BUOY': "Boias/Balizas",
    'AtoN_AIS_RACON': "AIS/RACON",
    'METOCEAN_BUOY': "Boias Meteo",
    'OFFSHORE_SEISMIC': "Sísmica",
    'OFFSHORE_SURVEY': "Sondagem",
    'OFFSHORE_DRILLING': "Perfuração",
    'OFFSHORE_PRODUCTION': "Produção Offshore",
    'SUBSEA_OPS': "Operações Subaquáticas",
    'PIPELINE_CABLE': "Dutos/Cabos",
    'DANGEROUS_OPERATIONS': "Operações Perigosas",
    'MILITARY_EXERCISE': "Exercício Militar",
    'ENV_POLLUTION': "Poluição",
    'NATURAL_HAZARD': "Fenômeno Natural",
    'ADMIN_CANCEL': "Administração"
};

const parseNavareaText = (text) => {
    if (!text) return [];

    const raw = text.replace(/\r\n/g, '\n');
    const lines = raw.split('\n');

    // Regex Definitions
    const idRegex = /^(\d{3,4}\/\d{2})/;
    const coordRegex = /(\d{2}-\d{2}(?:\.\d+)?[NS])\s+(\d{3}-\d{2}(?:\.\d+)?[EW])/;
    const dateRegex = /(\d{1,2}\/\d{2})\s*(?:a|até|-)\s*(\d{1,2}\/\d{2})/i;

    // Region Detection Keywords
    const regions = [
        'SUL DE SANTOS', 'RIO DE JANEIRO', 'CABO FRIO',
        'BACIA DE SANTOS', 'BACIA DE CAMPOS', 'ESPÍRITO SANTO',
        'PARANAGUÁ', 'SÃO FRANCISCO', 'RIO GRANDE', 'VITÓRIA',
        'SALVADOR', 'RECIFE', 'NATAL', 'FORTALEZA'
    ];

    // Category Parsing Map (Keyword -> Enum Key)
    const catMap = [
        { k: 'STS', v: 'STS_OPERATION' },
        { k: 'SHIP TO SHIP', v: 'STS_OPERATION' },
        { k: 'REBOQUE', v: 'TOWING_OPERATION' },
        { k: 'TOWING', v: 'TOWING_OPERATION' },
        { k: 'DERIVA', v: 'VESSEL_ADRIFT' },
        { k: 'ADRIFT', v: 'VESSEL_ADRIFT' },
        { k: 'SÍSMICA', v: 'OFFSHORE_SEISMIC' },
        { k: 'SEISMIC', v: 'OFFSHORE_SEISMIC' },
        { k: 'SONDAGEM', v: 'OFFSHORE_SURVEY' },
        { k: 'SURVEY', v: 'OFFSHORE_SURVEY' },
        { k: 'PERIGO', v: 'OBSTRUCTION' },
        { k: 'HAZARD', v: 'OBSTRUCTION' },
        { k: 'FAROL', v: 'AtoN_LIGHTHOUSE' },
        { k: 'LIGHTHOUSE', v: 'AtoN_LIGHTHOUSE' },
        { k: 'BOIA', v: 'AtoN_BUOY' },
        { k: 'BUOY', v: 'AtoN_BUOY' },
        { k: 'EXERCÍCIO', v: 'MILITARY_EXERCISE' },
        { k: 'MILITARY', v: 'MILITARY_EXERCISE' },
        { k: 'TIRO', v: 'MILITARY_EXERCISE' },
        { k: 'FOGUETE', v: 'ROCKET_LAUNCH' },
        { k: 'ROCKET', v: 'ROCKET_LAUNCH' },
        { k: 'CARTA', v: 'CHART_CORRECTION' },
        { k: 'CHART', v: 'CHART_CORRECTION' },
        { k: 'CANCEL', v: 'ADMIN_CANCEL' }
    ];

    const entries = [];
    let currentEntry = null;

    const processEntry = (entry) => {
        if (!entry) return;
        const fullText = entry.lines.join(' ');

        // 1. ID
        const id = entry.id;

        // 2. Region
        let region = '-';
        for (const r of regions) {
            if (fullText.toUpperCase().includes(r)) {
                region = r;
                break;
            }
        }

        // 3. Category & Type
        let catKey = 'NAV_TRAFFIC'; // Default
        let typeLabel = '-';

        for (const item of catMap) {
            if (fullText.toUpperCase().includes(item.k)) {
                catKey = item.v;
                typeLabel = item.k; // Use keyword as type hint initially
                break;
            }
        }
        const categoryLabel = NAVAREA_CATEGORIES[catKey] || catKey;

        // 4. Period
        let period = '-';
        const dMatch = fullText.match(dateRegex);
        if (dMatch) period = `${dMatch[1]} a ${dMatch[2]}`;

        // 5. Coords
        let coords = '-';
        const cMatch = fullText.match(coordRegex);
        if (cMatch) coords = `${cMatch[1]} ${cMatch[2]}`;

        // 6. Assets / Details
        // Remove known parts to isolate details
        let details = fullText
            .replace(id, '')
            .replace(cMatch ? cMatch[0] : '', '') // Remove coords
            .replace(dMatch ? dMatch[0] : '', '')
            .replace(/NAVAREA V/gi, '')
            .replace(/\s+/g, ' ').trim();

        // Truncate if too long?
        if (details.length > 80) details = details.substring(0, 80) + '...';

        entries.push([id, region, categoryLabel, typeLabel, details, period, coords]);
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const m = trimmed.match(idRegex);
        if (m) {
            if (currentEntry) processEntry(currentEntry);
            currentEntry = { id: m[1], lines: [trimmed] };
        } else {
            if (currentEntry) currentEntry.lines.push(trimmed);
        }
    });
    if (currentEntry) processEntry(currentEntry);

    return entries;
};

/* LEGACY CODE DISABLED
const parseNavareaText_OLD = (text) => {
    if (!text) return [];

    // Normalize text
    const raw = text.replace(/\r\n/g, '\n');
    const lines = raw.split('\n');

    // Heuristic: Check if user pasted tab-separated or structured lines
    // Example: "0778/25 STS ..."
    // We try to group by Header ID (XXXX/YY)

    const entries = [];
    let currentEntry = null;

    // Regex for ID: 0778/25 or 778/25
    const idRegex = /^(\d{3,4}\/\d{2})/;

    // Regex for Coords: 26-20.33S 046-23.42W (Standard nautical)
    const coordRegex = /(\d{2}-\d{2}(?:\.\d+)?[NS])\s+(\d{3}-\d{2}(?:\.\d+)?[EW])/;
    // Regex for Date Range: 27/12 a 03/01 or 27/12 - 03/01
    const dateRegex = /(\d{1,2}\/\d{2})\s*(?:a|até|-)\s*(\d{1,2}\/\d{2})/i;

    // Keywords for Category (Priority List)
    const catKeywords = ['STS', 'SHIP TO SHIP', 'PERIGO', 'HAZARD', 'SÍSMICA', 'SEISMIC', 'REBOQUE', 'TOWING', 'FOGUETE', 'ROCKET', 'EXERCÍCIO', 'MILITAR', 'FAROL', 'LIGHTHOUSE', 'BOIA', 'BUOY'];

    const processEntry = (entry) => {
        if (!entry) return;
        const fullText = entry.lines.join(' ');

        // 1. ID
        const id = entry.id;

        // 2. Category
        let category = '-';
        for (const k of catKeywords) {
            if (fullText.toUpperCase().includes(k)) {
                category = k;
                break;
            }
        }

        // 3. Coords
        let coords = '-';
        const cMatch = fullText.match(coordRegex);
        if (cMatch) {
            coords = `${cMatch[1]} ${cMatch[2]}`;
        }

        // 4. Period
        let period = '-';
        const dMatch = fullText.match(dateRegex);
        if (dMatch) {
            period = `${dMatch[1]} a ${dMatch[2]}`;
        }

        // 5. Local/Details splitting
        // This is fuzzy. We assume what remains is details.
        // Let's take the first line sans ID as potential "Local" if short?
        // Or just dump text into Details/Vessels.
        // User example: "Sul de Santos" was separate.
        // Let's try to extract Location via heuristics or just dump all in details.

        // Simplistic extraction: Remove ID, remove coords, try to present clean text
        let details = fullText.replace(id, '')
            .replace(coordRegex, '')
            .replace(dateRegex, '')
            .replace(/\s+/g, ' ').trim();

        // Try to identify "Local" if usually after Category? 
        // Hard to generalize. We will put everything else in "Detalhes/Embarcações" column
        // But separate Location if detected common names (Santos, Rio, etc)

        let local = '-';
        const commonLocs = ['SUL DE SANTOS', 'RIO DE JANEIRO', 'CABO FRIO', 'BACIA DE SANTOS', 'BACIA DE CAMPOS', 'ESPÍRITO SANTO', 'PARANAGUÁ', 'SÃO FRANCISCO', 'RIO GRANDE'];
        for (const l of commonLocs) {
            if (details.toUpperCase().includes(l)) {
                local = l; // Found a geographic match
                break;
            }
        }

        entries.push([id, category, local, period, details, coords]);
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const m = trimmed.match(idRegex);
        if (m) {
            // New Entry
            if (currentEntry) processEntry(currentEntry);
            currentEntry = { id: m[1], lines: [trimmed] };
        } else {
            // Continuation
            if (currentEntry) {
                currentEntry.lines.push(trimmed);
            } else {
                // Orphan line? Maybe unstructured text. Treat as new entry without ID?
                // Or append to previous if we want to be robust?
                // check if it looks like a table row without ID?
            }
        }
    });

    if (currentEntry) processEntry(currentEntry);

    return entries;
};
*/
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

                    // 1. Header Information (Date/Time/Validity)
                    const headerInfo = extractMeteoHeader(state.appraisal.meteoText);
                    if (headerInfo) {
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'bold');
                        doc.text(`Data: ${headerInfo.date} – Hora: ${headerInfo.time}`, 14, currentY + 4);
                        doc.text(`Validade: ${headerInfo.validity}`, 14, currentY + 9);
                        currentY += 15;
                    } else {
                        // Fallback default label
                        doc.setFontSize(8);
                        doc.text("TABELA DE PREVISÃO METEOMARINHA", 14, currentY + 5);
                        currentY += 10;
                    }

                    // 2. Tabela Consolidada (Área | Região | Dados)
                    const forecastData = parseMeteoText(state.appraisal.meteoText);

                    if (forecastData.length > 0) {
                        // Render Structured Table 6 Columns
                        doc.autoTable({
                            startY: currentY,
                            head: [['ÁREA', 'REGIÃO', 'TEMPO', 'VENTO (Beaufort)', 'ONDAS (m)', 'VISIBILIDADE']],
                            body: forecastData,
                            theme: 'grid',
                            headStyles: {
                                fillColor: [41, 128, 185],
                                valign: 'middle',
                                halign: 'center',
                                fontSize: 7
                            },
                            styles: { fontSize: 7, cellPadding: 2, valign: 'middle' },
                            columnStyles: {
                                0: { fontStyle: 'bold', cellWidth: 15 }, // Area
                                1: { cellWidth: 35 }, // Region
                                2: { cellWidth: 40 }, // Tempo
                                3: { cellWidth: 25 }, // Vento
                                4: { cellWidth: 25 }, // Waves
                                // Visibility auto
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
                    if (currentY > 230) { doc.addPage(); currentY = 20; }
                    currentY = addSectionTitle("ANEXO: AVISOS NAVAREA V", currentY);

                    const navareaData = parseNavareaText(state.appraisal.navareaText);

                    if (navareaData.length > 0) {
                        doc.autoTable({
                            startY: currentY,
                            head: [['Aviso', 'Região', 'Categoria', 'Tipo', 'Meios/Alvos', 'Período', 'Coord']],
                            body: navareaData,
                            theme: 'grid',
                            headStyles: { fillColor: [192, 57, 43], fontSize: 6 }, // Redish for Warnings
                            styles: { fontSize: 6, cellPadding: 1.5, valign: 'middle' },
                            columnStyles: {
                                0: { fontStyle: 'bold', cellWidth: 10 }, // ID
                                1: { cellWidth: 15 }, // Region
                                2: { cellWidth: 20 }, // Cat
                                3: { cellWidth: 15 }, // Type
                                4: { cellWidth: 35 }, // Assets
                                5: { cellWidth: 15 }, // Period
                                6: { cellWidth: 20, font: 'courier' }  // Coords
                            }
                        });
                        currentY = doc.lastAutoTable.finalY + 10;
                    } else {
                        // Fallback
                        doc.autoTable({
                            startY: currentY,
                            body: [[state.appraisal.navareaText]],
                            theme: 'plain',
                            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', font: 'courier' },
                        });
                        currentY = doc.lastAutoTable.finalY + 5;
                    }
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
export default ReportService;
