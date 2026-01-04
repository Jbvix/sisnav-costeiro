const fs = require('fs');
const path = require('path');

// 1. Load Lighthouses
const lhPath = path.join(__dirname, 'library/LIGHTHOUSES.txt');
const rawData = fs.readFileSync(lhPath, 'utf8');
const lines = rawData.split('\n');

const lighthouses = [];

const parseCoord = (coordStr) => {
    // Format: 04°25.86' N
    const parts = coordStr.trim().split(/\s+/);
    if (parts.length < 2) return null;

    // 04°25.86' -> 04 + 25.86/60
    const valParts = parts[0].split('°');
    const deg = parseFloat(valParts[0]);
    const min = parseFloat(valParts[1].replace("'", ""));

    let dec = deg + (min / 60);
    const hemi = parts[1].toUpperCase();
    if (hemi === 'S' || hemi === 'W') dec = -dec;

    return dec;
};

lines.forEach((line, idx) => {
    if (idx === 0) return; // Header
    const cols = line.split('\t');
    if (cols.length < 3) return;

    const name = cols[0];
    const latStr = cols[1];
    const lonStr = cols[2];

    const lat = parseCoord(latStr);
    const lon = parseCoord(lonStr);

    if (lat !== null && lon !== null) {
        lighthouses.push({ name, lat, lon, raw: line });
    }
});

// 2. Define Range (Itaqui -> Rio Grande)
// Itaqui: Lat -2.566, Lon -44.366
// Rio Grande: Lat -32.180, Lon -52.080

// We want everything strictly between these latitudes.
// And generally along the coast.

const startLat = -2.566; // Itaqui
const endLat = -32.180; // Rio Grande

// Sort North to South (descending latitude value, but since negative, it's descending from -2 to -32)
// Actually -2 > -32. So strictly descending.

const relevant = lighthouses.filter(lh => {
    // Latitude check: Between Start and End
    // Start (-2) is "Higher" (Less Negative) than End (-32)
    return lh.lat <= startLat && lh.lat >= endLat;
});

// Sort by Latitude (North -> South)
relevant.sort((a, b) => b.lat - a.lat);

console.log(`Lighthouses between Itaqui (MA) and Rio Grande (RS):`);
console.log(`Total: ${relevant.length}\n`);

relevant.forEach((lh, i) => {
    console.log(`${i + 1}. ${lh.name} (${lh.lat.toFixed(4)}, ${lh.lon.toFixed(4)})`);
});
