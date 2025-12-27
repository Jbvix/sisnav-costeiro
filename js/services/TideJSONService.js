
// TideJSONService.js - Source: maritimo_mare_meteo.json (TabuaDeMares Scraper)
import PortDatabase from './PortDatabase.js';

class TideJSONService {
    constructor() {
        this.data = null;
        this.jsonPath = "maritimo_mare_meteo.json?v=" + new Date().getTime(); // Cache busting
        this.isLoaded = false;
    }

    async load() {
        if (this.isLoaded) return true;
        try {
            const response = await fetch(this.jsonPath);
            if (!response.ok) throw new Error("Falha ao carregar maritimo_mare_meteo.json");
            this.data = await response.json();
            this.isLoaded = true;
            console.log("TideJSONService: Dados carregados com sucesso.", Object.keys(this.data.ports).length, "portos.");
            return true;
        } catch (error) {
            console.error("TideJSONService Error:", error);
            return false;
        }
    }

    // Helper: Map Internal Port Name to JSON Key
    _resolvePortKey(internalName) {
        if (!this.data || !this.data.ports) return null;

        // 0. ID Lookup (Fix for Report/App passing IDs)
        if (PortDatabase) {
            const portById = PortDatabase.find(p => p.id === internalName);
            if (portById) internalName = portById.name;
        }

        // 0.5 Explicit Patch Map for tricky names
        const PATCH_MAP = {
            "Rio Grande-RS": "Rio Grande-RS (Porto)",
            "Rio de Janeiro-RJ": "Rio de Janeiro-RJ",
            "Vila do Conde-PA": "Vila do Conde-PA (proxy Barcarena)",
            "S. Francisco do Sul-SC": "São Francisco do Sul-SC",
            "Sepetiba": "Sepetiba-RJ"
        };

        if (PATCH_MAP[internalName] && this.data.ports[PATCH_MAP[internalName]]) {
            return PATCH_MAP[internalName];
        }

        const keys = Object.keys(this.data.ports);

        // 1. Direct Match
        if (this.data.ports[internalName]) return internalName;

        // 2. Fuzzy / Substring Match (e.g. "Rio Grande" -> "Rio Grande-RS (Porto)")
        // Prioritize exact start match or containment
        const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const search = norm(internalName);

        const found = keys.find(k => norm(k).includes(search) || search.includes(norm(k)));

        if (!found) {
            console.warn(`TideJSONService: Port not found for '${internalName}' (Search: '${search}')`);
        }
        return found || null;
    }

    // --- Tide Methods ---

    /**
     * Get Raw Tide Events (High/Low) for a specific date
     * @param {string} portName 
     * @param {string} dateISO "YYYY-MM-DD"
     */
    getTides(portName, dateISO) {
        const key = this._resolvePortKey(portName);
        if (!key) return [];
        const dayEvents = this.data.ports[key].tides_7d.filter(e => e.date_iso === dateISO);
        // Robust Sort: Pad Hours
        return dayEvents.sort((a, b) => {
            const [hA, mA] = a.time_local.split(':').map(Number);
            const [hB, mB] = b.time_local.split(':').map(Number);
            return (hA * 60 + mA) - (hB * 60 + mB); // Minute-based compare
        });
    }

    /**
     * Calculate Tide Height at specific Date/Time using Cosine Interpolation
     * @param {string} portName 
     * @param {Date} targetDate JS Date Object
     * @returns {number|null} Estimated Height (m)
     */
    getHeightAt(portName, targetDate) {
        const key = this._resolvePortKey(portName);
        if (!key) return null;

        const portData = this.data.ports[key];
        const tides = portData.tides_7d;

        const parseEventTime = (e) => {
            // Handle single digit hours if present
            const [h, m] = e.time_local.split(':');
            const padH = h.padStart(2, '0');
            const padM = m.padStart(2, '0');
            return new Date(`${e.date_iso}T${padH}:${padM}:00`);
        };

        // Find events surrounding targetDate
        let prev = null;
        let next = null;

        // Robust linear scan
        for (const e of tides) {
            const t = parseEventTime(e);
            if (t <= targetDate) {
                if (!prev || t > parseEventTime(prev)) prev = e;
            } else {
                if (!next || t < parseEventTime(next)) next = e;
            }
        }

        if (!prev || !next) {
            console.warn(`TideJSONService: No surrounding tides for ${portName} at ${targetDate.toISOString()}`);
            return null; // Out of range
        }

        // Cosine Interpolation
        // formula: h(t) = (h1 + h2)/2 + (h1 - h2)/2 * cos(pi * (t - t1) / (t2 - t1))
        const t = targetDate.getTime();
        const t1 = parseEventTime(prev).getTime();
        const t2 = parseEventTime(next).getTime();

        // Robust Parse
        const parseH = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
            return NaN;
        };

        const h1 = parseH(prev.height_m);
        const h2 = parseH(next.height_m);

        if (isNaN(h1) || isNaN(h2)) {
            console.error(`TideJSONService: Invalid heights for ${portName}:`, prev.height_m, next.height_m);
            return null;
        }

        const phase = Math.PI * (t - t1) / (t2 - t1);
        const height = (h1 + h2) / 2 + (h1 - h2) / 2 * Math.cos(phase);

        return parseFloat(height.toFixed(2));
    }

    /**
     * Generate Prediction Curve for PDF (3h Window)
     * @param {string} portName 
     * @param {Date} centerDate 
     * @returns {Array} Array of { time: "HH:MM", height: 1.2 }
     */
    getCurve(portName, centerDate) {
        const curve = [];
        const start = new Date(centerDate.getTime() - 90 * 60000); // -1.5h

        for (let i = 0; i <= 6; i++) { // 0, 30, 60, 90, 120, 150, 180 mins from start
            const t = new Date(start.getTime() + i * 30 * 60000);
            const h = this.getHeightAt(portName, t);
            if (h !== null) {
                curve.push({
                    time: t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    height: h,
                    isCenter: i === 3 // The target time
                });
            }
        }
        return curve;
    }

    // --- Weather Methods ---

    getWeather(portName, targetDate) {
        const key = this._resolvePortKey(portName);
        if (!key) return null;

        const dateISO = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const hour = targetDate.getHours();

        // Find closest hour in weather_hourly / wind_hourly
        const findClosest = (list) => {
            return list.find(w => w.date_iso === dateISO && parseInt(w.hour_local.split(':')[0]) === hour);
        };

        const wx = findClosest(this.data.ports[key].weather_hourly);
        const wind = findClosest(this.data.ports[key].wind_hourly);

        return {
            condition: wx ? wx.value : "-",
            windSpeed: wind ? wind.value : "-", // "14 km/h" or "7.6 kn"
            windDir: (wind && wind.extra) ? wind.extra.direction : "-"
        };
    }
}

export const tideJSONService = new TideJSONService();
