import NavMath from '../core/NavMath.js';
import TideCSVService from './TideCSVService.js';
import ChartService from './ChartService.js';

// --- CONSTANTS & PARSERS ---

// Helper to extract global Date/Time/Validity from the top of the text
const extractMeteoHeader = (text) => {
    if (!text) return null;
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

// Meteo Parser
const parseMeteoText = (text) => {
    if (!text) return [];
    const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const areas = [];
    let zoneOrder = 1;
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

    // Find Validity Line index
    const valMatch = raw.match(/PREVIS[ÃA]O DO TEMPO V[ÁA]LIDA/i);
    const startIndex = valMatch ? valMatch.index : 0;
    const bodyText = raw.substring(startIndex);

    // Coastal Areas
    const coastalRegex = /(?:ÁREA\s+)(ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL)\s*\((.*?)\)\s*([\s\S]*?)(?=(?:ÁREA\s+(?:ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL)\s*\(|ÁREA\s+SUL\s+OCE[ÂA]NICA|$))/gi;
    let match;
    while ((match = coastalRegex.exec(bodyText)) !== null) {
        const zoneId = match[1].toUpperCase();
        const zoneName = clean(match[2]);
        const blockBody = clean(match[3]);

        let wx = "", wind = "", waves = "", vis = "";
        const ventoIdx = blockBody.toUpperCase().indexOf("VENTO");
        if (ventoIdx !== -1) {
            wx = clean(blockBody.substring(0, ventoIdx));
            const remainder = blockBody.substring(ventoIdx);
            const ondasIdx = remainder.toUpperCase().indexOf("ONDAS");
            const visIdx = remainder.toUpperCase().indexOf("VISIBILIDADE");
            const endWind = (ondasIdx !== -1) ? ondasIdx : (visIdx !== -1 ? visIdx : remainder.length);
            wind = clean(remainder.substring(5, endWind).replace(/^[.:-]/, ''));
            if (ondasIdx !== -1) {
                const rw = remainder.substring(ondasIdx);
                const vi2 = rw.toUpperCase().indexOf("VISIBILIDADE");
                waves = clean(rw.substring(5, vi2 !== -1 ? vi2 : rw.length).replace(/^[.:-]/, ''));
            }
            if (visIdx !== -1) vis = clean(remainder.substring(visIdx + 12).replace(/^[.:-]/, ''));
        } else { wx = blockBody; }

        areas.push({ group: "Costeira", zone_id: zoneId, zone_name: zoneName, wx_short: wx || "-", wind_short: wind || "-", sea_short: waves || "-", vis_short: vis || "-", zone_order: zoneOrder++ });
    }

    // South Oceanic
    const sulStart = bodyText.match(/ÁREA\s+SUL\s+OCE[ÂA]NICA([\s\S]*?)(?=ÁREA\s+NORTE\s+OCE[ÂA]NICA|$)/i);
    if (sulStart) {
        const sulBlock = sulStart[1];
        const subZones = [
            { title: "SUL DE 30S - OESTE DE 030W", id: "SUL_OCEANICA_30S_W030W" },
            { title: "SUL DE 30S - LESTE DE 030W", id: "SUL_OCEANICA_30S_E030W" },
            { title: "ENTRE 30S E 25S", id: "SUL_OCEANICA_30S_25S" },
            { title: "NORTE DE 25S", id: "SUL_OCEANICA_N25S" }
        ];
        subZones.forEach(sz => {
            const idx = sulBlock.toUpperCase().indexOf(sz.title);
            if (idx !== -1) {
                let nextIdx = sulBlock.length;
                subZones.forEach(other => {
                    if (other.title !== sz.title) {
                        const oIdx = sulBlock.toUpperCase().indexOf(other.title);
                        if (oIdx > idx && oIdx < nextIdx) nextIdx = oIdx;
                    }
                });
                const blockBody = clean(sulBlock.substring(idx + sz.title.length, nextIdx));
                let wx = "", wind = "", waves = "", vis = "";
                const ventoIdx = blockBody.toUpperCase().indexOf("VENTO");
                if (ventoIdx !== -1) {
                    wx = clean(blockBody.substring(0, ventoIdx));
                    const remainder = blockBody.substring(ventoIdx);
                    const ondasIdx = remainder.toUpperCase().indexOf("ONDAS");
                    const visIdx = remainder.toUpperCase().indexOf("VISIBILIDADE");
                    const endWind = (ondasIdx !== -1) ? ondasIdx : (visIdx !== -1 ? visIdx : remainder.length);
                    wind = clean(remainder.substring(5, endWind).replace(/^[.:-]/, ''));
                    if (ondasIdx !== -1) {
                        const rw = remainder.substring(ondasIdx);
                        const vi2 = rw.toUpperCase().indexOf("VISIBILIDADE");
                        waves = clean(rw.substring(5, vi2 !== -1 ? vi2 : rw.length).replace(/^[.:-]/, ''));
                    }
                    if (visIdx !== -1) vis = clean(remainder.substring(visIdx + 12).replace(/^[.:-]/, ''));
                } else { wx = blockBody; }

                areas.push({ group: "Oceânica Sul", zone_id: sz.id, zone_name: sz.title, wx_short: wx || "-", wind_short: wind || "-", sea_short: waves || "-", vis_short: vis || "-", zone_order: 100 + zoneOrder++ });
            }
        });
    }

    // North Oceanic
    const norteStart = bodyText.match(/ÁREA\s+NORTE\s+OCE[ÂA]NICA([\s\S]*)$/i);
    if (norteStart) {
        const norteBody = clean(norteStart[1]);
        let wx = "", wind = "", waves = "", vis = "";
        const ventoIdx = norteBody.toUpperCase().indexOf("VENTO");
        if (ventoIdx !== -1) {
            wx = clean(norteBody.substring(0, ventoIdx));
            const remainder = norteBody.substring(ventoIdx);
            const ondasIdx = remainder.toUpperCase().indexOf("ONDAS");
            const visIdx = remainder.toUpperCase().indexOf("VISIBILIDADE");
            const endWind = (ondasIdx !== -1) ? ondasIdx : (visIdx !== -1 ? visIdx : remainder.length);
            wind = clean(remainder.substring(5, endWind).replace(/^[.:-]/, ''));
            if (ondasIdx !== -1) {
                const rw = remainder.substring(ondasIdx);
                const vi2 = rw.toUpperCase().indexOf("VISIBILIDADE");
                waves = clean(rw.substring(5, vi2 !== -1 ? vi2 : rw.length).replace(/^[.:-]/, ''));
            }
            if (visIdx !== -1) vis = clean(remainder.substring(visIdx + 12).replace(/^[.:-]/, ''));
        } else { wx = norteBody; }
        areas.push({ group: "Oceânica Norte", zone_id: "NORTE_OCEANICA", zone_name: "Norte Oceânica", wx_short: wx || "-", wind_short: wind || "-", sea_short: waves || "-", vis_short: vis || "-", zone_order: 200 });
    }
    return areas;
};

// Navarea Parser
const parseNavareaText = (text) => {
    if (!text) return [];
    const norm = (s) => (s || "").trim().toUpperCase();

    // Helpers
    const isIdLine = (line) => /^\d{3,4}\/\d{2}$/.test(norm(line));
    const isCartaLine = (line) => norm(line).startsWith("CARTA ");
    const isNoiseHeader = (line) => ["OUTROS", "NAVAREA", "AVISOS-RADIO", ""].includes(norm(line));
    const isCancelLine = (line) => norm(line).startsWith("CANCELAR ESTE AVISO") || norm(line).startsWith("CANCELAR NAVAREA");
    const containsCoord = (line) => /\d{1,2}-\d{1,2}(?:\.\d+)?[NS]\s+\d{1,3}-\d{1,2}(?:\.\d+)?[WE]/.test(norm(line));
    const isPeriodLike = (line) => {
        const t = norm(line);
        return t.includes(" UTC ") || (/\bA\b/.test(t) && /(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/.test(t));
    };

    const RULES = [
        { pat: /LEVANTAMENTO SISMICO/, cat: "LEVANTAMENTO SISMICO", typ: "LEVANTAMENTO SISMICO" },
        { pat: /OPERACAO SHIP TO SHIP|SHIP TO SHIP/, cat: "OPERACAO", typ: "SHIP TO SHIP" },
        { pat: /OPERACOES SUBAQUATICAS/, cat: "OPERACAO", typ: "OPERACOES SUBAQUATICAS" },
        { pat: /SERVICO DE SONDAGEM/, cat: "OPERACAO", typ: "SERVICO DE SONDAGEM" },
        { pat: /LANCAMENTO DE BOIA|BOIA ONDOGRAFO|BOIA ODAS|BOIA/, cat: "SINALIZACAO", typ: "BOIA/BALIZA" },
        { pat: /DERRELITO/, cat: "PERIGO", typ: "DERRELITO" },
        { pat: /\bAUV\b|VEICULO AUTONOMO SUBMARINO/, cat: "PERIGO", typ: "DERRELITO (AUV)" },
        { pat: /\bA DERIVA\b|EMBARCACAO .* A DERIVA|\bDERIVA\b/, cat: "PERIGO", typ: "EMBARCACAO A DERIVA" },
        { pat: /OPERACOES PERIGOSAS|LANCAMENTO DE FOGUETE/, cat: "PERIGO", typ: "OPERACOES PERIGOSAS" },
        { pat: /\bREBOQUE\b|REBOCANDO/, cat: "OPERACAO", typ: "REBOQUE" },
        { pat: /\bINSERIR\b|\bRETIRAR\b|\bCORRIGIR\b|\bATUALIZAR\b|\bSUBSTITUIR\b|\bPROFUNDIDADE/, cat: "CORRECAO CARTOGRAFICA", typ: "CARTA" }
    ];

    const classify = (blockText) => {
        const t = norm(blockText);
        for (const rule of RULES) {
            if (rule.pat.test(t)) return { cat: rule.cat, typ: rule.typ };
        }
        return { cat: "OUTROS", typ: "INFORMACAO" };
    };

    const extractPeriod = (blockLines) => {
        for (const ln of blockLines) if (isPeriodLike(ln) && !isCancelLine(ln)) return ln.trim();
        for (const ln of blockLines) if (isCancelLine(ln)) {
            const match = ln.match(/CANCELAR .*? (\d{6} UTC [A-Z]{3} \d{2})/i);
            if (match) return `ATE ${match[1]}`;
            return ln.trim();
        }
        return '-';
    };

    const extractRegiao = (blockLines, idIdx) => {
        for (let j = idIdx + 1; j < Math.min(idIdx + 10, blockLines.length); j++) {
            const ln = blockLines[j].trim();
            const t = norm(ln);
            if (!t || isNoiseHeader(ln) || isCartaLine(ln) || isCancelLine(ln) || containsCoord(ln) || isPeriodLike(ln)) continue;
            if (/LEVANTAMENTO SISMICO|OPERACAO|REBOQUE|DERRELITO|PERIGO|BOIA|SERVICO DE SONDAGEM/.test(t)) continue;
            return ln;
        }
        return '-';
    };

    const extractMeiosAlvos = (blockLines) => {
        const take = [];
        const seen = new Set();
        for (const ln of blockLines) {
            const t = norm(ln);
            if (!t || isIdLine(ln) || isNoiseHeader(ln) || isCartaLine(ln) || isCancelLine(ln) || containsCoord(ln)) continue;
            if (t.startsWith("NA AREA") || t.startsWith("AREA ") || (t.startsWith("ENTRE ") && containsCoord(ln))) continue;

            let keep = false;
            if (t.startsWith("POR ") || t.startsWith("REBOCANDO ") || t.includes("REBOCADOR") || t.includes("USV") || t.includes("AUV")) keep = true;
            else if (/\bKNUTSEN\b|\bSPIRIT\b|\bCHOUEST\b/.test(t) && !t.includes("UTC")) keep = true;

            if (keep && !seen.has(t)) { take.push(ln.trim()); seen.add(t); }
        }
        if (take.length === 0) {
            for (const ln of blockLines) {
                const t = norm(ln);
                if (!t || isIdLine(ln) || isNoiseHeader(ln) || isCartaLine(ln) || isCancelLine(ln) || containsCoord(ln) || isPeriodLike(ln)) continue;
                if (t === extractRegiao(blockLines, -1).toUpperCase()) continue;
                if (!seen.has(t)) { take.push(ln.trim()); seen.add(t); }
            }
        }
        let result = take.join(" | ");
        return (result.length > 100 ? result.substring(0, 100) + '...' : result) || '-';
    };

    const extractCoords = (blockText) => {
        const matches = blockText.matchAll(/(\d{1,2}-\d{1,2}(?:\.\d+)?[NS])\s+(\d{1,3}-\d{1,2}(?:\.\d+)?[WE])/g);
        const coords = [];
        for (const m of matches) coords.push(`${m[1]} ${m[2]}`);
        return coords.join("; ") || '-';
    };

    const rawLines = text.replace(/\r/g, '').split('\n');
    const blocks = [];
    let currentBlock = [];
    for (const ln of rawLines) {
        if (isIdLine(ln)) {
            if (currentBlock.length > 0) blocks.push(currentBlock);
            currentBlock = [ln];
        } else { if (currentBlock.length > 0) currentBlock.push(ln); }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock);

    const items = [];
    for (const block of blocks) {
        const blockLines = block.filter(l => l.trim().length > 0);
        const rawBlock = block.join("\n");
        const blockText = norm(rawBlock);

        const idLine = blockLines.find(l => isIdLine(l));
        const aviso = idLine ? norm(idLine) : "?";
        const idIdx = blockLines.indexOf(idLine);
        const regiao = extractRegiao(blockLines, idIdx);
        let { cat, typ } = classify(blockText);
        if (blockText.includes("LEVANTAMENTO SISMICO")) { cat = "LEVANTAMENTO SISMICO"; typ = "LEVANTAMENTO SISMICO"; }

        items.push([aviso, regiao, cat, typ, extractMeiosAlvos(blockLines), extractPeriod(blockLines), extractCoords(rawBlock)]);
    }
    return items;
};

// --- RENDER HELPERS ---

const addSectionTitle = (doc, text, y) => {
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

const formatDuration = (hrs) => {
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const drawTideGraph = (doc, x, y, width, height, station, dateStr, title) => {
    if (!station || !dateStr) return;

    const proxyMap = { 'BR_SUA': 'Recife', 'BR_FOR': 'Fortaleza', 'BR_REC': 'Recife', 'BR_SAL': 'Salvador', 'BR_VIT': 'Vitória', 'BR_RIO': 'Rio de Janeiro', 'BR_PNG': 'Paranaguá', 'BR_RIG': 'Rio Grande', 'BR_ITQ': 'Itaqui', 'BR_BEL': 'Belém', 'BR_VDC': 'Belém' };
    let queryStation = proxyMap[station] || station;

    const centerDate = new Date(dateStr);
    if (isNaN(centerDate.getTime())) return;
    const startDate = new Date(centerDate.getTime() - 6 * 3600 * 1000);
    const endDate = new Date(centerDate.getTime() + 6 * 3600 * 1000);

    doc.setDrawColor(0);
    doc.rect(x, y, width, height);
    doc.setFontSize(8); doc.setFont(undefined, 'bold');
    doc.text(title, x + 2, y + 5);
    doc.setFontSize(7); doc.setFont(undefined, 'normal');
    doc.text(`${station} - Ref: ${centerDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, x + 2, y + 9);

    const points = [];
    let minH = 99, maxH = -99;
    const step = 15 * 60 * 1000;

    for (let t = startDate.getTime(); t <= endDate.getTime(); t += step) {
        const d = new Date(t);
        let h = null;
        if (window.TideJSONService && window.TideJSONService.isLoaded) h = window.TideJSONService.getHeightAt(queryStation, d);
        if (h === null && TideCSVService && typeof TideCSVService.getInterpolatedTide === 'function') {
            const res = TideCSVService.getInterpolatedTide(queryStation, d);
            if (res) h = parseFloat(res.height);
        }
        if (h === null) {
            const phase = (queryStation.length * 300000);
            const period = 12.42 * 3600 * 1000;
            const time = d.getTime() + phase;
            const angle = (time % period) / period * 2 * Math.PI;
            h = parseFloat((1.3 + 0.8 * Math.cos(angle)).toFixed(2));
        }
        if (h !== null) {
            if (h < minH) minH = h;
            if (h > maxH) maxH = h;
            points.push({ t: t, h: h, label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        }
    }

    if (points.length < 2) {
        doc.text("Dados de maré não disponíveis.", x + width / 2, y + height / 2, { align: 'center' });
        return;
    }

    minH -= 0.2; maxH += 0.2;
    const rangeH = maxH - minH;
    const timeSpan = endDate.getTime() - startDate.getTime();
    const getX = (t) => x + 10 + ((t - startDate.getTime()) / timeSpan) * (width - 20);
    const getY = (h) => y + height - 10 - ((h - minH) / rangeH) * (height - 20);

    doc.setDrawColor(150);
    doc.line(x + 10, y + height - 10, x + width - 10, y + height - 10);
    doc.line(x + 10, y + 10, x + 10, y + height - 10);
    doc.setLineWidth(0.5); doc.setDrawColor(0, 100, 200);

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        doc.line(getX(p1.t), getY(p1.h), getX(p2.t), getY(p2.h));
    }

    const cx = getX(centerDate.getTime());
    doc.setDrawColor(255, 0, 0); doc.setLineWidth(0.2);
    doc.line(cx, y + 10, cx, y + height - 10);

    let centerH = null;
    if (window.TideJSONService && window.TideJSONService.isLoaded) centerH = window.TideJSONService.getHeightAt(queryStation, centerDate);
    if (centerH === null && TideCSVService && typeof TideCSVService.getInterpolatedTide === 'function') {
        const res = TideCSVService.getInterpolatedTide(queryStation, centerDate);
        if (res) centerH = parseFloat(res.height);
    }
    if (centerH === null) {
        const phase = (queryStation.length * 300000);
        const period = 12.42 * 3600 * 1000;
        const time = centerDate.getTime() + phase;
        const angle = (time % period) / period * 2 * Math.PI;
        centerH = parseFloat((1.3 + 0.8 * Math.cos(angle)).toFixed(2));
    }
    if (centerH !== null) {
        doc.setTextColor(255, 0, 0); doc.text(`${centerH.toFixed(2)}m`, cx + 1, y + 15); doc.setTextColor(0);
    }
    doc.text(points[0].label, x + 10, y + height - 6);
    doc.text(points[points.length - 1].label, x + width - 20, y + height - 6);
    doc.setDrawColor(0);
};

// --- SECTION RENDERERS ---

const renderVesselInfo = (doc, y, state) => {
    y = addSectionTitle(doc, "1. DADOS DA EMBARCAÇÃO", y);
    const ship = state.shipProfile || {};
    const drafts = ship.draft || {};

    const vesselData = [
        ["Navio:", ship.name, "IMO:", ship.imo],
        ["Comandante:", ship.commander || "-", "Tripulação:", ship.crew],
        ["Calado (Popa/Proa):", `${drafts.aft}m / ${drafts.fwd}m`, "Rebocado:", "N/A"]
    ];

    doc.autoTable({
        startY: y,
        body: vesselData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1 },
        columnStyles: { 0: { fontStyle: 'bold', width: 35 }, 2: { fontStyle: 'bold', width: 35 } }
    });
    return doc.lastAutoTable.finalY + 5;
};

const renderRouteAndDistances = (doc, y, state) => {
    // Check page space
    if (y > 180) { doc.addPage(); y = 20; }
    y = addSectionTitle(doc, "2. ROTA PLANEJADA E DISTÂNCIAS", y);

    const voyage = state.voyage || {};
    const speed = parseFloat(state.shipProfile.speed) || 10;
    let cumulativeDist = 0;
    let cumulativeHours = 0;
    let currentEta = new Date(); // Default
    if (voyage.depTime) { currentEta = new Date(voyage.depTime); }
    else if (state.shipProfile.date) { currentEta = new Date(state.shipProfile.date + "T08:00:00"); }

    const routeData = [];
    const safePoints = state.routePoints || [];
    // Use imported NavMath or window.NavMath if imported is missing (legacy)
    const Calc = window.NavMath || NavMath;

    if (safePoints.length > 0) {
        // Start
        const p0 = safePoints[0];
        const pos0 = (Calc && typeof Calc.formatPos === 'function')
            ? `${Calc.formatPos(p0.lat, 'lat')}\n${Calc.formatPos(p0.lon || p0.lng, 'lon')}`
            : `${p0.lat.toFixed(4)}\n${(p0.lon || p0.lng).toFixed(4)}`;

        routeData.push(["1", "-", "-", pos0, "-", "-", "-", currentEta.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), "0.0", "00:00"]);

        for (let i = 0; i < safePoints.length - 1; i++) {
            const p1 = safePoints[i];
            const p2 = safePoints[i + 1];

            // Normalize Coordinates (Handle .lon vs .lng)
            const lat1 = p1.lat;
            const lon1 = (p1.lon !== undefined) ? p1.lon : p1.lng;
            const lat2 = p2.lat;
            const lon2 = (p2.lon !== undefined) ? p2.lon : p2.lng;

            // Calc
            let crs = 0, legDist = 0;
            if (Calc && typeof Calc.calcLeg === 'function') {
                const leg = Calc.calcLeg(lat1, lon1, lat2, lon2);
                crs = leg.crs; legDist = leg.dist;
            } else {
                console.warn("ReportService: NavMath not available for route calculation.");
            }
            cumulativeDist += legDist;
            const legHours = (speed > 0) ? (legDist / speed) : 0;
            cumulativeHours += legHours;
            currentEta = new Date(currentEta.getTime() + (legHours * 3600 * 1000));

            // LH Ref
            let refTxt = "-";
            if (window.App && typeof window.App.getNearestLighthouse === 'function') {
                try {
                    const lh = window.App.getNearestLighthouse(p2.lat, p2.lon);
                    // Use range from object or default 10
                    const range = lh.range || 10;
                    if (lh && lh.dist <= range) refTxt = `${lh.name}\n(${lh.dist.toFixed(1)}mn)`;
                    else refTxt = "-";
                } catch (e) { }
            }
            // Chart
            let chartId = "-";
            // Chart Logic (Mirror UIManager)

            // LOGIC: First and Last WP must show Approximation Chart of Port
            const isFirst = (i === 0);
            const isLast = (i === safePoints.length - 1);

            if (isFirst || isLast) {
                const getApproxChart = (portName) => {
                    if (!portName) return null;
                    const n = portName.toUpperCase();
                    if (n.includes("VITORIA") || n.includes("VITÓRIA") || n.includes("TUBARÃO")) return "1410";
                    if (n.includes("RIO") && n.includes("JANEIRO")) return "1506";
                    if (n.includes("GUANABARA")) return "1506";
                    if (n.includes("SANTOS")) return "1711";
                    if (n.includes("RECIFE")) return "930";
                    if (n.includes("SUAPE")) return "930";
                    if (n.includes("MUCURIPE") || n.includes("FORTALEZA")) return "710";
                    if (n.includes("SALVADOR")) return "1101";
                    if (n.includes("ITAQUI") || n.includes("SAO LUIS")) return "411";
                    if (n.includes("PARANAGUA")) return "1820";
                    if (n.includes("ITATIAIA") || n.includes("ITAJAÍ")) return "1805";
                    if (n.includes("IMBITUBA")) return "1904";
                    if (n.includes("RIO GRANDE")) return "21080";
                    return null;
                };
                const targetPort = isFirst ? state.voyage.depPort : state.voyage.arrPort;
                const approx = getApproxChart(targetPort);
                if (approx) chartId = approx;
                else {
                    // Fallback
                    if (p2.chart) chartId = p2.chart;
                    else if (window.ChartService) {
                        const c = window.ChartService.getChartForPosition(p2.lat, p2.lon);
                        if (c) chartId = c.id;
                    }
                }
            } else {
                if (p2.chart) chartId = p2.chart;
                else if (window.ChartService) {
                    const c = window.ChartService.getChartForPosition(p2.lat, p2.lon);
                    if (c) chartId = c.id;
                }
            }

            const pos2 = (Calc && typeof Calc.formatPos === 'function')
                ? `${Calc.formatPos(p2.lat, 'lat')}\n${Calc.formatPos(p2.lon, 'lon')}`
                : `${p2.lat.toFixed(4)}\n${p2.lon.toFixed(4)}`;

            routeData.push([
                p2.name || (i + 2).toString(),
                chartId,
                refTxt,
                pos2,
                `${crs.toFixed(1)}°`,
                legDist.toFixed(1),
                formatDuration(legHours),
                currentEta.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                cumulativeDist.toFixed(1),
                formatDuration(cumulativeHours)
            ]);
        }
    }

    doc.autoTable({
        startY: y + 5,
        head: [['WP', 'Carta', 'Ref. Farol', 'Posição', 'Rumo', 'Dist.', 'Tempo', 'ETA', 'Total', 'Horas']],
        body: routeData,
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219], fontSize: 7, halign: 'center' },
        styles: { fontSize: 7, valign: 'middle', halign: 'center', cellPadding: 1 },
        columnStyles: { 2: { fontSize: 6, cellWidth: 25 }, 3: { font: 'courier' }, 7: { fontStyle: 'bold' } }
    });
    return doc.lastAutoTable.finalY + 10;
};

const renderPrints = (doc, y, state) => {
    const safePrints = (state.appraisal && state.appraisal.prints) ? state.appraisal.prints : [];
    if (safePrints.length > 0) {
        doc.setFont(undefined, 'bold'); doc.setFontSize(10);
        doc.text("2.1. REGISTROS DA CARTA NÁUTICA (PRINTS)", 14, y);
        y += 5;

        safePrints.forEach((printItem, idx) => {
            if (y + 80 > 280) { doc.addPage(); y = 20; }
            doc.setFontSize(9); doc.setFont(undefined, 'bold');
            doc.text(`Imagem ${idx + 1}: ${printItem.title}`, 14, y + 5);
            try {
                const imgProps = doc.getImageProperties(printItem.dataUrl);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(printItem.dataUrl, 'PNG', 14, y + 7, pdfWidth, pdfHeight);
                y += pdfHeight + 15;
            } catch (e) {
                console.warn("Erro ao add imagem PDF:", e);
                doc.text("(Erro ao renderizar imagem)", 14, y + 10);
                y += 20;
            }
        });
    }
    return y;
};

const renderLighthousesSection = (doc, y, state) => {
    const safeLighthouses = (state.appraisal && state.appraisal.lighthouses) ? state.appraisal.lighthouses : [];
    if (safeLighthouses.length > 0) {
        doc.addPage();
        y = addSectionTitle(doc, "3. FARÓIS E AUXÍLIOS VISUAIS", 20); // New Page
        const lhData = safeLighthouses.map(lh => [lh.name, lh.lat + '\n' + lh.lon, lh.char, doc.splitTextToSize(lh.desc || '-', 90)]);
        doc.autoTable({
            startY: y,
            head: [['Nome', 'Coord', 'Carac.', 'Descrição Visual']],
            body: lhData,
            theme: 'grid',
            headStyles: { fillColor: [230, 126, 34] },
            styles: { fontSize: 8, valign: 'middle' },
            columnStyles: { 3: { fontSize: 7 } }
        });
        return doc.lastAutoTable.finalY + 10;
    }
    return y;
};

const renderSecurityContacts = (doc, y, state) => {
    y = addSectionTitle(doc, "4. SEGURANÇA (CONTATOS E ABRIGOS)", y);
    const contacts = state.appraisal.shoreContacts || [];
    if (contacts.length > 0) {
        const contactBody = contacts.map(c => [c.name, c.role || '-', c.phone, c.email]);
        doc.autoTable({
            startY: y,
            head: [['Contato', 'Função', 'Telefone', 'Email']],
            body: contactBody,
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [100, 100, 100] }
        });
        y = doc.lastAutoTable.finalY + 5;
    } else {
        doc.text("- Nenhum contato de terra cadastrado.", 14, y + 5);
        y += 10;
    }
    const shelters = state.appraisal.shelters || [];
    if (shelters.length > 0) {
        doc.text("Áreas de Abrigo / Fundeio:", 14, y);
        const shelterBody = shelters.map(s => [s.name, s.type, s.details]);
        doc.autoTable({
            startY: y + 2,
            head: [['Local', 'Tipo', 'Detalhes']],
            body: shelterBody,
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [100, 100, 100] }
        });
        y = doc.lastAutoTable.finalY + 5;
    }
    return y;
};

const renderDocsReference = (doc, y, state) => {
    y = addSectionTitle(doc, "5. DOCUMENTAÇÃO E REFERÊNCIAS", y);
    const files = state.appraisal.files || {};
    const pdfData = [
        ["Meteomarinha:", files.meteo || "N/A"],
        ["Avisos Navarea V:", files.navarea || "N/A"],
        ["Tábua Maré (Partida):", (files.tideDep && files.tideDep.name) ? files.tideDep.name : (files.tideDep || "N/A")],
        ["Tábua Maré (Chegada):", (files.tideArr && files.tideArr.name) ? files.tideArr.name : (files.tideArr || "N/A")]
    ];
    doc.autoTable({
        startY: y,
        body: pdfData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1 },
        columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
    });
    return doc.lastAutoTable.finalY + 4;
};

const renderTidesSection = (doc, y, state) => {
    const voyage = state.voyage || {};
    const showDep = voyage.depPort && voyage.depTime;
    const showArr = voyage.arrPort && voyage.arrTime;

    if (showDep || showArr) {
        y = addSectionTitle(doc, "6. ANÁLISE DE MARÉ (JANELA +/- 3h)", y);
        if (y + 50 > 280) { doc.addPage(); y = 20; }
        const graphY = y + 5;
        if (showDep) drawTideGraph(doc, 14, graphY, 85, 50, voyage.depPort, voyage.depTime, "MARÉ DE SAÍDA");
        if (showArr) {
            const x = showDep ? 110 : 14;
            drawTideGraph(doc, x, graphY, 85, 50, voyage.arrPort, voyage.arrTime, "MARÉ DE CHEGADA");
        }
        y += 60;
    }
    return y;
};

const renderMachineInfo = (doc, y, state) => {
    y = addSectionTitle(doc, "7. DADOS DE MÁQUINAS E COMBUSTÍVEL", y);
    const ship = state.shipProfile || {};
    const engine = ship.engine || {};

    const stock = parseFloat(ship.fuelStock) || 0;
    const rate = parseFloat(ship.fuelRate) || 1;
    const autonomyHoursVal = (stock / rate);
    const autoDays = Math.floor(autonomyHoursVal / 24);
    const autoRemHrs = Math.round(autonomyHoursVal % 24);
    const autonomyStr = `${autonomyHoursVal.toFixed(0)}h (${autoDays}d ${autoRemHrs}h)`;
    const engineStatusMap = { 'ok': 'Full Power', 'restricted': 'Restrito', 'no-go': 'NO-GO' };
    const appEngine = (state.appraisal && state.appraisal.engine) ? state.appraisal.engine : {};
    const currentStatus = engineStatusMap[appEngine.status] || "N/A";

    const machineData = [
        ["Status Máquinas:", currentStatus, "Vel. Cruzeiro:", `${ship.speed} kn`],
        ["Estoque Combustível:", `${stock} L`, "Consumo:", `${rate} L/h`],
        ["Raio de Alcance:", autonomyStr, "", ""]
    ];

    doc.autoTable({
        startY: y,
        body: machineData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1 },
        columnStyles: { 0: { fontStyle: 'bold', width: 35 }, 2: { fontStyle: 'bold', width: 35 } }
    });
    return doc.lastAutoTable.finalY + 5;
};

const renderMachineryChecklist = (doc, y, state) => {
    y = addSectionTitle(doc, "7.1. STATUS OPERACIONAL (MÁQUINAS)", y);

    const checkItems = {
        safety: [
            { id: 'safety_estanque', label: 'Estanqueidade (Saídas)' }, { id: 'safety_fire', label: 'Combate a Incêndio' },
            { id: 'safety_pump', label: 'Bomba Emergência' }, { id: 'safety_alarm', label: 'Alarmes / Painel' },
            { id: 'safety_comm', label: 'Comunicação' }, { id: 'safety_stop', label: 'Parada Emergência' }, { id: 'safety_sopep', label: 'SOPEP' }
        ],
        propulsion: [
            { id: 'prop_protection', label: 'Proteções MCPs' }, { id: 'prop_inspection', label: 'Visual MCPs' },
            { id: 'prop_thermal', label: 'Isolamento Térmico' }, { id: 'prop_azi_oil', label: 'Azimutal (Óleo/Refrig)' },
            { id: 'prop_steering', label: 'Testes de Governo' }, { id: 'prop_temp', label: 'Temps. (Trocadores)' }
        ],
        power: [
            { id: 'pow_protection', label: 'Proteções MCAs' }, { id: 'pow_maint', label: 'Manutenção (Óleo/Filtro)' },
            { id: 'pow_batt', label: 'Baterias (Carregadores)' }, { id: 'pow_light', label: 'Iluminação Emergência' }
        ],
        aux: [
            { id: 'aux_diesel', label: 'Purificador Diesel' }, { id: 'aux_tanks', label: 'Tanques (Visores)' },
            { id: 'aux_air', label: 'Ar Comprimido' }, { id: 'aux_waste', label: 'Resíduos/Dalas' }, { id: 'aux_septic', label: 'Tanque Séptico' }
        ],
        spares: [
            { id: 'spare_lube', label: 'Lubrificantes (Estoque)' }, { id: 'spare_filter', label: 'Filtros (Estoque)' }, { id: 'spare_parts', label: 'Peças Críticas' }
        ]
    };

    const checklistData = [];
    const checklistState = (state.appraisal.engine && state.appraisal.engine.checklist) ? state.appraisal.engine.checklist : {};

    const formatGroup = (title, items) => {
        const lines = items.map(item => {
            const status = checklistState[item.id] ? "OK" : "PENDENTE";
            return `${status} - ${item.label}`;
        });
        return [title, lines.join("\n")];
    };
    checklistData.push(formatGroup("SEGURANÇA", checkItems.safety));
    checklistData.push(formatGroup("PROPULSÃO", checkItems.propulsion));
    checklistData.push(formatGroup("ENERGIA", checkItems.power));
    checklistData.push(formatGroup("AUXILIARES", checkItems.aux));
    checklistData.push(formatGroup("SOBRESSALENTES", checkItems.spares));

    doc.autoTable({
        startY: y,
        body: checklistData,
        theme: 'grid',
        head: [['Grupo', 'Itens Verificados']],
        headStyles: { fillColor: [70, 70, 70] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', width: 60 } }
    });
    y = doc.lastAutoTable.finalY + 5;

    const obs = (state.appraisal.engine && state.appraisal.engine.obs) ? state.appraisal.engine.obs : "Sem observações registradas.";
    doc.setFont(undefined, 'bold');
    doc.text("Observações da Praça de Máquinas:", 14, y + 4);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const splitObs = doc.splitTextToSize(obs, 180);
    doc.text(splitObs, 14, y + 9);
    return y + 10 + (splitObs.length * 4);
};

const renderSignatures = (doc) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();

        if (i === pageCount) {
            const y = pageHeight - 40;
            doc.setDrawColor(0);
            const lineW = 60;
            const lineX = (pageWidth - lineW) / 2;
            doc.line(lineX, y, lineX + lineW, y);
            doc.setFontSize(10); doc.setFont(undefined, 'bold');
            doc.text("Comandante", pageWidth / 2, y + 5, { align: "center" });
            doc.setFontSize(8); doc.setFont(undefined, 'normal');
            doc.text("Visto / Carimbo", pageWidth / 2, y + 10, { align: "center" });
        }
        doc.setFontSize(8);
        doc.text(`SISNAV Costeiro - Pág ${i}/${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }
};

const ReportService = {
    generatePDF: async function (state) {
        if (!state) { alert("Erro: Estado da aplicação vazio (State is null)."); return; }

        let NavMath = window.NavMath;
        if (!NavMath) {
            try { const module = await import('../core/NavMath.js'); NavMath = module.default; }
            catch (e) { console.error("ReportService: Failed to load NavMath", e); }
        }

        try {
            console.log("ReportService: Iniciando geração do PDF (Modular)...");
            const { jsPDF } = window.jspdf;
            if (!jsPDF) throw new Error("Biblioteca jsPDF não carregada.");
            const doc = new jsPDF();

            // Load Assets
            const loadImage = (src) => new Promise((resolve) => {
                const img = new Image(); img.src = src;
                img.onload = () => resolve(img); img.onerror = () => resolve(null);
            });
            const [bgImg, logoImg] = await Promise.all([loadImage('./library/img/chart_bg.png'), loadImage('./library/img/saam_logo.png')]);

            // --- COVER PAGE ---
            if (bgImg) {
                try {
                    if (doc.GState) {
                        doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.15 }));
                        doc.addImage(bgImg, 'PNG', 0, 0, 210, 297); doc.restoreGraphicsState();
                    } else doc.addImage(bgImg, 'PNG', 0, 0, 210, 297);
                } catch (e) { console.warn("Erro bg", e); }
            }
            if (logoImg) {
                const logoW = 50; const logoH = logoW * (logoImg.height / logoImg.width);
                doc.addImage(logoImg, 'PNG', 10, 10, logoW, logoH);
            }

            doc.setFontSize(28); doc.setFont(undefined, 'bold'); doc.setTextColor(0, 51, 102);
            doc.text("PLANO DE VIAGEM", 105, 140, { align: "center" });
            doc.setFontSize(14); doc.setTextColor(100);
            doc.text(`${new Date().getFullYear()}`, 105, 150, { align: "center" });

            // Stats
            const voyage = state.voyage || {};
            const totalDist = parseFloat(state.totalDistance) || 0;
            const speed = parseFloat(state.shipProfile.speed) || 10;
            const totalHours = (speed > 0) ? (totalDist / speed) : 0;
            const days = Math.floor(totalHours / 24); const remHrs = Math.floor(totalHours % 24);
            const durationStr = `${Math.floor(totalHours)}h (${days}d ${remHrs}h)`;

            const depDate = voyage.depTime ? new Date(voyage.depTime) : new Date();
            const arrDate = new Date(depDate.getTime() + (totalHours * 3600 * 1000));

            const summaryData = [
                ["REBOCADOR:", (state.shipProfile.name || "SAAM CHILE").toUpperCase()],
                ["DE:", (voyage.depPort || "MUCURIPE").toUpperCase()],
                ["PARA:", (voyage.arrPort || "SUAPE").toUpperCase()],
                ["SAÍDA:", depDate.toLocaleString('pt-BR')],
                ["CHEGADA:", arrDate.toLocaleString('pt-BR')],
                ["DISTÂNCIA (MN):", totalDist.toFixed(1)],
                ["TEMPO ESTIMADO:", durationStr]
            ];
            doc.autoTable({ startY: 230, body: summaryData, theme: 'striped', headStyles: { fillColor: [41, 128, 185] }, styles: { fontSize: 11, cellPadding: 2 }, columnStyles: { 0: { fontStyle: 'bold', width: 50, halign: 'right' }, 1: { width: 80 } }, margin: { left: 40 } });

            // --- PAGE 2 ONWARDS (THE PIPELINE) ---
            doc.addPage();
            doc.setTextColor(0);

            // Header for Page 2
            doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text("PLANO DE VIAGEM", 105, 15, { align: "center" });
            doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 105, 20, { align: "center" });
            doc.autoTable({ startY: 25, body: summaryData, theme: 'plain', styles: { fontSize: 10, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold', width: 40, halign: 'right', fillColor: [240, 240, 240] }, 1: { fontStyle: 'bold', width: 60 } }, margin: { left: 55 } });

            let currentY = doc.lastAutoTable.finalY + 10;

            // --------------------------------------------------------------------------
            // 🏗️ ORDEM DE IMPRESSÃO (MODULAR v3 - REORDENADO)
            // --------------------------------------------------------------------------

            // 1. DADOS DA EMBARCAÇÃO
            currentY = renderVesselInfo(doc, currentY, state);

            // 2. ROTA PLANEJADA
            currentY = renderRouteAndDistances(doc, currentY, state);

            // 2.1 PRINTS
            currentY = renderPrints(doc, currentY, state);

            // 3. FARÓIS
            currentY = renderLighthousesSection(doc, currentY, state);

            // 4. SEGURANÇA (CONTATOS)
            currentY = renderSecurityContacts(doc, currentY, state);

            // 5. DOCUMENTAÇÃO
            currentY = renderDocsReference(doc, currentY, state);

            // 6. ANÁLISE DE MARÉ
            currentY = renderTidesSection(doc, currentY, state);

            // 7. DADOS DE MÁQUINAS
            currentY = renderMachineInfo(doc, currentY, state);

            // 7.1 CHECKLIST (REMOVED AS PER USER REQUEST)
            // currentY = renderMachineryChecklist(doc, currentY, state);

            // 8. ANEXOS (Meteo e Navarea)
            if (state.appraisal.meteoText) {
                doc.addPage();
                addSectionTitle(doc, "ANEXO I - METEOMARINHA", 20);
                doc.setFontSize(8);
                doc.setFont("courier", "normal"); // Monospaced for preserved formatting

                const splitText = doc.splitTextToSize(state.appraisal.meteoText, 180);
                doc.text(splitText, 15, 30);
            }

            if (state.appraisal.badWeatherText) {
                doc.addPage();
                addSectionTitle(doc, "ANEXO 1A - AVISOS DE MAU TEMPO", 20);
                doc.setFontSize(8);
                doc.setFont("courier", "normal");

                const splitText = doc.splitTextToSize(state.appraisal.badWeatherText, 180);
                doc.text(splitText, 15, 30);
            }

            if (state.appraisal.navareaText) {
                doc.addPage();
                addSectionTitle(doc, "ANEXO II - NAVAREA V", 20);
                doc.setFontSize(8);
                doc.setFont("courier", "normal");

                const splitText = doc.splitTextToSize(state.appraisal.navareaText, 180);
                doc.text(splitText, 15, 30);
            }

            // ASSINATURAS FINAL
            renderSignatures(doc);

            doc.save(`Plano_Viagem_${state.shipProfile.name || 'Export'}.pdf`);

        } catch (error) {
            console.error("ReportService Error:", error);
            alert("Falha ao gerar PDF:\n" + error.message);
        }
    }
};

window.ReportService = ReportService;
export default ReportService;
