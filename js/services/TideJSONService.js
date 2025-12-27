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

        const keys = Object.keys(this.data.ports);

        // 1. Direct Match
        if (this.data.ports[internalName]) return internalName;

        // 2. Fuzzy / Substring Match (e.g. "Rio Grande" -> "Rio Grande-RS (Porto)")
        const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const search = norm(internalName);

        const found = keys.find(k => norm(k).includes(search));
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
        return dayEvents.sort((a, b) => a.time_local.localeCompare(b.time_local));
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
        const tides = portData.tides_7d; // Sorted by date/time?

        // Flatten all events into a comparable timeline
        // Need to parse date_iso + time_local -> Date Object
        const parseEventTime = (e) => new Date(`${e.date_iso}T${e.time_local}:00`);

        // Find events surrounding targetDate
        let prev = null;
        let next = null;

        // Optimize: narrow down? Scan all for now (7 days is small)
        for (const e of tides) {
            const t = parseEventTime(e);
            if (t <= targetDate) {
                if (!prev || t > parseEventTime(prev)) prev = e;
            } else {
                if (!next || t < parseEventTime(next)) next = e;
            }
        }

        if (!prev || !next) return null; // Out of range

        // Cosine Interpolation
        // formula: h(t) = (h1 + h2)/2 + (h1 - h2)/2 * cos(pi * (t - t1) / (t2 - t1))
        const t = targetDate.getTime();
        const t1 = parseEventTime(prev).getTime();
        const t2 = parseEventTime(next).getTime();
        const h1 = prev.height_m;
        const h2 = next.height_m;

        if (h1 === null || h2 === null) return null;

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
        // Generate points: Center - 90min to Center + 90min, step 15min?
        // Or specific T-1.5, T, T+1.5 as requested
        // Let's do step 30 min for smoothness in valid window

        const start = new Date(centerDate.getTime() - 90 * 60000); // -1.5h
        // const end = new Date(centerDate.getTime() + 90 * 60000);   // +1.5h

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
