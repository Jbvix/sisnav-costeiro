
const fs = require('fs');

// Mock TideCSVService Logic
const TideCSVService = {
    weatherCache: new Map(),
    isLoaded: false,

    _getDateKey: function (dateObj) {
        const y = dateObj.getFullYear();
        const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const d = dateObj.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    parseWeatherCSV: function (csvText) {
        const lines = csvText.split('\n');
        // header: station_id, station_name, date, time, wind_speed, wind_dir, wave_height, wave_dir, temp
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 9) continue;

            const stationName = parts[1].trim(); // Key for cache
            const dateStrRaw = parts[2].trim();
            const timeStr = parts[3].trim();

            const windSpeed = parseFloat(parts[4]) || 0;
            const windDir = parts[5].trim();
            const waveHeight = parseFloat(parts[6]) || 0;
            const waveDir = parts[7].trim();
            const temp = parseFloat(parts[8]) || 0;

            const [day, month, year] = dateStrRaw.split('/');
            const dateISO = `${year}-${month}-${day}`;

            if (!this.weatherCache.has(stationName)) {
                this.weatherCache.set(stationName, new Map());
                // DEBUG SPECIFIC STATION
                if (stationName === 'Suape') console.log("TideCSV: [DEBUG] 'Suape' found in CSV and cache initialized.");
            }
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

    getWeatherAt: function (csvStationName, dateObj) {
        // Copied from latest implementation
        const stationMap = this.weatherCache.get(csvStationName);

        // DEBUG LOGGING
        if (csvStationName === 'Suape') {
            const k = this._getDateKey(dateObj);
            console.log(`TideCSV: [DEBUG] Request Suape @ ${dateObj.toLocaleString()} (Key: ${k})`);
            console.log(`TideCSV: [DEBUG] Has Suape Cache? ${!!stationMap}`);
            if (stationMap) {
                console.log(`TideCSV: [DEBUG] Has Date Key? ${stationMap.has(k)}`);
                // Dump available keys if missing
                if (!stationMap.has(k)) {
                    console.log("Available keys:", Array.from(stationMap.keys()).slice(0, 5));
                }
            }
        }

        if (!stationMap) return null;

        const candidates = [];
        const d = new Date(dateObj);

        const addRecords = (offset) => {
            const tempDate = new Date(d);
            tempDate.setDate(tempDate.getDate() + offset);
            const key = this._getDateKey(tempDate);

            if (stationMap.has(key)) {
                stationMap.get(key).forEach(w => {
                    const [h, m] = w.time.split(':').map(Number);
                    const recDate = new Date(tempDate);
                    recDate.setHours(h, m, 0, 0);
                    candidates.push({
                        record: w,
                        diff: Math.abs(dateObj.getTime() - recDate.getTime())
                    });
                });
            }
        };

        addRecords(-1); // Yesterday
        addRecords(0);  // Today
        addRecords(1);  // Tomorrow

        if (candidates.length === 0) return null;
        candidates.sort((a, b) => a.diff - b.diff);
        return candidates[0].record;
    }
};

// Run Test
try {
    const csvContent = fs.readFileSync('weather_scraped.csv', 'utf8');
    TideCSVService.parseWeatherCSV(csvContent);
    console.log("Parsed CSV successfully.");

    // Test Suape on 29/12/2025 at 20:20
    // Note: Month in JS Date is 0-indexed. Dec = 11.
    const targetDate = new Date(2025, 11, 29, 20, 20); // Dec 29, 2025 20:20

    console.log("--- Testing Retrieval ---");
    const res = TideCSVService.getWeatherAt('Suape', targetDate);

    if (res) {
        console.log("SUCCESS! Got Data:", res);
    } else {
        console.log("FAILURE! No data returned.");
    }

} catch (e) {
    console.log("Error:", e);
}
