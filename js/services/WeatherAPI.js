/**
 * ARQUIVO: WeatherAPI.js
 * MÓDULO: Cliente de Dados Ambientais
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 3.2.0 (Error Handling 400)
 */

import TideLocator from './TideLocator.js?v=5';
import TideCSVService from '/js/services/TideCSVService.js?v=6';

const WeatherAPI = {

    // Removed External APIs as per requirement

    degToCard: (deg) => {
        if (typeof deg !== 'number') return '';
        const val = Math.floor((deg / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        return arr[(val % 16)];
    },

    cleanVal: (val) => {
        if (!val) return null;
        if (typeof val === 'number') return val;
        // Handle "13 kn" etc
        return parseFloat(val.toString().replace(/[^\d.-]/g, ''));
    },

    fetchMetOcean: async function (lat, lon, dateObj) {

        // 0. Init CSV Service
        await TideCSVService.init();

        // 1. Locate Nearest Station
        const tideCheck = TideLocator.findNearest(lat, lon);

        // 2. Default Result Structure
        const result = {
            status: 'OK',
            timestamp: dateObj,
            locationType: tideCheck.type,
            refStation: tideCheck.found ? tideCheck.station.name : 'Desconhecido',
            exactTime: dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),

            atmosphere: {
                temp: null,
                windSpd: null,
                windDir: null,
                windCard: "-"
            },

            marine: {
                waveHeight: null,
                waveDir: null,
                tideHeight: null,
                exactTideHeight: null,
                tideTrend: null, // NEW: RISING/FALLING
                tideEvents: [],
                isTideReliable: false
            }
        };

        if (!tideCheck.found || !tideCheck.station.csvName) {
            // Cannot scrape without a known station mapping
            // Return empty/null data gently
            return result;
        }

        try {
            // 3. Get Interpolated Tide
            const calcData = TideCSVService.getInterpolatedTide(tideCheck.station.csvName, dateObj);

            if (calcData) {
                // Handle object return { height, trend } or legacy string (safety)
                if (typeof calcData === 'object') {
                    result.marine.exactTideHeight = parseFloat(calcData.height);
                    result.marine.tideHeight = parseFloat(calcData.height);
                    result.marine.tideTrend = calcData.trend;
                } else {
                    result.marine.exactTideHeight = parseFloat(calcData);
                    result.marine.tideHeight = parseFloat(calcData);
                }
                result.marine.isTideReliable = true;
            }

            // 4. Get Weather (Wind/Wave/Temp)
            // Use dateObj (full date needed for day matching)
            const weather = TideCSVService.getWeatherAt(tideCheck.station.csvName, dateObj);

            if (weather) {
                // Parse Weather Data
                // Expected: windSpeed (km/h usually from site, or kn?), windDir (str), waveHeight (m), temp (C)

                // Note: The python scraper extracts "13 km/h". The CSV cleaner makes it "13". 
                // We need to know unit. TabuaDeMares usually is km/h for wind.
                // Navigation uses Knots. 1 km/h = 0.539957 kn.

                const windKmh = weather.windSpeed;
                if (windKmh) {
                    const kn = windKmh * 0.539957;
                    result.atmosphere.windSpd = kn.toFixed(1);
                }

                result.atmosphere.windDir = weather.windDir;
                // Try parse calc card from string direction? Usually string is "NE", "SSE" already.
                // If it is degrees, convert.

                result.atmosphere.temp = weather.temp;

                result.marine.waveHeight = weather.waveHeight;
                result.marine.waveDir = weather.waveDir;
            }

            // 5. Get Tide Table Events (for context display)
            const table = TideCSVService.getTide(tideCheck.station.csvName, dateObj);
            if (table && table.events) {
                result.marine.tideEvents = table.events;
            }

            // Append Source Info
            if (!result.refStation.includes("Tabua")) {
                result.refStation += " (TabuaDeMares)";
            }

            return result;

        } catch (error) {
            console.error("WeatherAPI Fail:", error);
            return {
                status: 'ERROR',
                message: error.message
            };
        }
    }
};

export default WeatherAPI;