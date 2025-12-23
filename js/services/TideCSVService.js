/**
 * ARQUIVO: TideCSVService.js
 * MÓDULO: Leitor de Tábua de Marés (CSV Local)
 * DESCRIÇÃO: Processa o arquivo consolidado de marés da Marinha/DHN convertido de PDF.
 */

const TideCSVService = {

    csvPath: './tides_scraped.csv',
    weatherCsvPath: './weather_scraped.csv',

    // Cache: Map<StationName, Map<DateString, tideObject>>
    tideCache: new Map(),
    // Cache: Map<StationName, Map<DateString, Array<weatherObject>>>
    weatherCache: new Map(),

    isLoaded: false,

    _getDateKey: function (dateObj) {
        const y = dateObj.getFullYear();
        const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const d = dateObj.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    init: async function () {
        if (this.isLoaded) return;

        try {
            console.log("TideCSV: Carregando arquivos...");

            // Load Tides
            const tideRes = await fetch(this.csvPath);
            if (tideRes.ok) {
                this.parseTideCSV(await tideRes.text());
            } else {
                console.warn("TideCSV: tides_scraped.csv não encontrado.");
            }

            // Load Weather
            const weatherRes = await fetch(this.weatherCsvPath);
            if (weatherRes.ok) {
                this.parseWeatherCSV(await weatherRes.text());
            } else {
                console.warn("TideCSV: weather_scraped.csv não encontrado.");
            }

            this.isLoaded = true;
            console.log(`TideCSV: Carregado! Tides: ${this.tideCache.size} st, Weather: ${this.weatherCache.size} st.`);

        } catch (error) {
            console.error("TideCSV: Falha ao carregar.", error);
        }
    },

    parseTideCSV: function (csvText) {
        const lines = csvText.split('\n');
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 5) continue;

            const stationName = parts[1].trim();
            const dateStrRaw = parts[2].trim();
            const timeStr = parts[3].trim();
            const height = parseFloat(parts[4]);
            const typeRaw = parts[5] ? parts[5].trim().toLowerCase() : '';

            const [day, month, year] = dateStrRaw.split('/');
            const dateISO = `${year}-${month}-${day}`;

            if (!this.tideCache.has(stationName)) this.tideCache.set(stationName, new Map());
            const stationMap = this.tideCache.get(stationName);

            if (!stationMap.has(dateISO)) stationMap.set(dateISO, []);
            stationMap.get(dateISO).push({
                time: timeStr,
                height: height,
                type: typeRaw.includes('preia') ? 'HIGH' : 'LOW'
            });
        }
    },

    parseWeatherCSV: function (csvText) {
        const lines = csvText.split('\n');
        // header: station_id, station_name, date, time, wind_speed, wind_dir, wave_height, wave_dir, temp
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 9) continue;

            const stationName = parts[1].trim();
            const dateStrRaw = parts[2].trim();
            const timeStr = parts[3].trim();

            // Clean units handled by rebuild_csv but parse floats here
            const windSpeed = parseFloat(parts[4]) || 0;
            const windDir = parts[5].trim();
            const waveHeight = parseFloat(parts[6]) || 0;
            const waveDir = parts[7].trim();
            const temp = parseFloat(parts[8]) || 0;

            const [day, month, year] = dateStrRaw.split('/');
            const dateISO = `${year}-${month}-${day}`;

            if (!this.weatherCache.has(stationName)) this.weatherCache.set(stationName, new Map());
            const stationMap = this.weatherCache.get(stationName);

            if (!stationMap.has(dateISO)) stationMap.set(dateISO, []);
            stationMap.get(dateISO).push({
                time: timeStr,
                windSpeed: windSpeed,
                windDir: windDir,
                waveHeight: waveHeight,
                waveDir: waveDir,
                temp: temp
            });
        }
    },

    getStations: function () {
        if (!this.tideCache) return [];
        return Array.from(this.tideCache.keys()).sort();
    },

    getTide: function (csvStationName, dateObj) {
        if (!this.isLoaded) return null;
        const dateStr = this._getDateKey(dateObj);
        const stationMap = this.tideCache.get(csvStationName);
        if (!stationMap) return null;
        const tides = stationMap.get(dateStr);
        if (!tides) return null;

        return {
            source: 'TabuaDeMares/Scraped',
            date: dateStr,
            events: tides.sort((a, b) => a.time.localeCompare(b.time))
        };
    },

    getWeatherAt: function (csvStationName, dateObj) {
        if (!this.isLoaded) return null;
        const dateStr = this._getDateKey(dateObj);
        const stationMap = this.weatherCache.get(csvStationName);
        if (!stationMap) return null;

        const dayData = stationMap.get(dateStr);
        if (!dayData) return null;

        // Find closest hour
        // time matches HH:MM. Weather is usually hourly or 3-hourly
        const targetMin = dateObj.getHours() * 60 + dateObj.getMinutes();

        let closest = null;
        let minDiff = 9999;

        for (const w of dayData) {
            const [h, m] = w.time.split(':').map(Number);
            const wMinutes = h * 60 + m;
            const diff = Math.abs(targetMin - wMinutes);
            if (diff < minDiff) {
                minDiff = diff;
                closest = w;
            }
        }
        return closest;
    },

    // Interpolation Logic
    getInterpolatedTide: function (csvStationName, fullDateObj) {
        // We need previous and next tide events to interpolate
        // Strategy: Get events for Today and Yesterday/Tomorrow if needed

        const dateStr = this._getDateKey(fullDateObj);
        const stationMap = this.tideCache.get(csvStationName);
        if (!stationMap) return null;

        // Collect events from surrounding days to handle edge transitions
        let allEvents = [];

        // Generate keys for Prev, Curr, Next days using Local Time math
        const d = new Date(fullDateObj);
        d.setDate(d.getDate() - 1);
        const prevStr = this._getDateKey(d);

        const d2 = new Date(fullDateObj);
        d2.setDate(d2.getDate() + 1);
        const nextStr = this._getDateKey(d2);

        [prevStr, dateStr, nextStr].forEach(ds => {
            if (stationMap.has(ds)) {
                // Add timestamp to events for simpler math
                stationMap.get(ds).forEach(ev => {
                    const [h, m] = ev.time.split(':').map(Number);
                    // Parse Date Key (YYYY-MM-DD) to Local Date
                    const [yy, mm, dd] = ds.split('-').map(Number);
                    const evDate = new Date(yy, mm - 1, dd, h, m);
                    allEvents.push({ ...ev, timestamp: evDate.getTime() });
                });
            }
        });

        allEvents.sort((a, b) => a.timestamp - b.timestamp);

        const nowStamp = fullDateObj.getTime();

        // Find previous and next event
        let prevEvent = null;
        let nextEvent = null;

        for (let i = 0; i < allEvents.length; i++) {
            if (allEvents[i].timestamp <= nowStamp) {
                prevEvent = allEvents[i];
            } else {
                nextEvent = allEvents[i];
                break;
            }
        }

        if (prevEvent && nextEvent) {
            const val = this.cosineInterpolation(nowStamp, prevEvent, nextEvent);
            // Trend logic: If next event is HIGH, tide is Rising. If LOW, tide is Falling.
            // But wait, if next event is HIGH, we are going UP towards it -> Rising. Correct.
            const trend = nextEvent.type === 'HIGH' ? 'RISING' : 'FALLING';
            return { height: val, trend: trend };
        } else if (prevEvent) {
            return { height: prevEvent.height.toFixed(2), trend: 'STABLE' }; // Clamp
        }

        return null;
    },

    cosineInterpolation: function (targetTime, ev1, ev2) {
        // Formula: h(t) = (h1 + h2)/2 + (h1 - h2)/2 * cos( PI * (t - t1) / (t2 - t1) )
        // Assuming sinusoidal tide wave

        const t = targetTime;
        const t1 = ev1.timestamp;
        const t2 = ev2.timestamp;
        const h1 = ev1.height;
        const h2 = ev2.height;

        // If span is too large (> 8 hours), linear might be safer or data missing
        if ((t2 - t1) > 8 * 3600 * 1000) return h1;

        // Cosine implementation
        // Argument for cos should go from 0 to PI
        const fraction = (t - t1) / (t2 - t1);
        const angle = fraction * Math.PI;

        // Correct cosine formula for High->Low transition
        // Height = Avg + Amplitude * cos(some_phase)
        // Let's use simpler blending:
        // y(t) = (h1 * (1 + cos(pi*frac))/2) + (h2 * (1 - cos(pi*frac))/2)  <-- classic easy blend

        const w1 = (1 + Math.cos(angle)) / 2;
        const w2 = (1 - Math.cos(angle)) / 2;

        // Wait, standard cosine interpolation:
        // mu2 = (1 - cos(p * pi)) / 2
        // y = y1 * (1 - mu2) + y2 * mu2

        const mu2 = (1 - Math.cos(fraction * Math.PI)) / 2;
        const height = (h1 * (1 - mu2) + h2 * mu2);

        return height.toFixed(2);
    }

};

window.TideCSVService = TideCSVService;
export default TideCSVService;
