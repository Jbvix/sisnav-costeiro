
const fs = require('fs');
const path = require('path');

// MOCK IMPORTS
// Simulating PortDatabase
const PortDatabase = [
    { id: 'BR_STN', name: 'Santana-AP', lat: -0.058, lon: -51.170, csvName: 'Belém' },
    { id: 'BR_VDC', name: 'Vila do Conde-PA', lat: -1.533, lon: -48.750, csvName: 'Belém' },
    { id: 'BR_BEL', name: 'Belém-PA', lat: -1.450, lon: -48.500, csvName: 'Belém' },
    { id: 'BR_ITQ', name: 'Itaqui-MA', lat: -2.566, lon: -44.366, csvName: 'Itaqui' },
    { id: 'BR_PEC', name: 'Pecém-CE', lat: -3.550, lon: -38.800, csvName: 'Fortaleza' },
    { id: 'BR_FOR', name: 'Mucuripe-CE', lat: -3.716, lon: -38.466, csvName: 'Fortaleza' },
    { id: 'BR_NAT', name: 'Natal-RN', lat: -5.755, lon: -35.192, csvName: 'Natal' },
    { id: 'BR_CAB', name: 'Cabedelo-PB', lat: -6.971, lon: -34.838, csvName: 'Cabedelo' },
    { id: 'BR_SUA', name: 'Suape-PE', lat: -8.397, lon: -34.959, csvName: 'Recife' },
    { id: 'BR_REC', name: 'Recife-PE', lat: -8.050, lon: -34.866, csvName: 'Recife' },
    { id: 'BR_MAC', name: 'Maceió-AL', lat: -9.673, lon: -35.725, csvName: 'Maceió' },
    { id: 'BR_SAL', name: 'Salvador-BA', lat: -12.966, lon: -38.516, csvName: 'Salvador' },
    { id: 'BR_ILH', name: 'Ilhéus-BA', lat: -14.793, lon: -39.032, csvName: 'Ilhéus' },
    { id: 'BR_VIT', name: 'Vitória-ES', lat: -20.316, lon: -40.283, csvName: 'Vitória' },
    { id: 'BR_RIO', name: 'Rio de Janeiro-RJ', lat: -22.896, lon: -43.165, csvName: 'Rio de Janeiro' },
    { id: 'BR_ITG', name: 'Sepetiba', lat: -22.930, lon: -43.840, csvName: 'Sepetiba' },
    { id: 'BR_ANG', name: 'Angra dos Reis-RJ', lat: -23.000, lon: -44.316, csvName: 'Sepetiba' },
    { id: 'BR_SSB', name: 'São Sebastião-SP', lat: -23.815, lon: -45.416, csvName: 'São Sebastião' },
    { id: 'BR_STS', name: 'Santos-SP', lat: -23.960, lon: -46.310, csvName: 'Sepetiba' },
    { id: 'BR_PNG', name: 'Paranaguá-PR', lat: -25.583, lon: -48.316, csvName: 'Paranaguá' },
    { id: 'BR_SFS', name: 'S. Francisco do Sul-SC', lat: -26.233, lon: -48.633, csvName: 'São Francisco do Sul' },
    { id: 'BR_ITJ', name: 'Itajaí-SC', lat: -26.916, lon: -48.650, csvName: 'Itajaí' },
    { id: 'BR_IMB', name: 'Imbituba-SC', lat: -28.233, lon: -48.650, csvName: 'Imbituba' },
    { id: 'BR_RIG', name: 'Rio Grande-RS', lat: -32.180, lon: -52.080, csvName: 'Rio Grande' }
];

// NavMath Logic
const NavMath = {
    calcLeg: (lat1, lon1, lat2, lon2) => {
        const R = 3440.065;
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;
        const lat1Rad = lat1 * rad;
        const lat2Rad = lat2 * rad;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        return { dist };
    }
};

// Start logic
const routesPath = path.join(__dirname, 'js/data/known_routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

const graph = {}; // Restore graph declaration
const THRESHOLD_NM = 90; // Increased to 90NM for offshore routes

const findPortsOnRoute = (points) => {
    const foundPorts = [];
    PortDatabase.forEach(p => {
        let minD = 9999;
        let bestIdx = -1;
        points.forEach((pt, idx) => {
            const d = NavMath.calcLeg(p.lat, p.lon, pt.lat, pt.lon).dist;
            if (d < minD) {
                minD = d;
                bestIdx = idx;
            }
        });

        if (minD <= THRESHOLD_NM) {
            foundPorts.push({ id: p.id, index: bestIdx, dist: minD, name: p.name });
        }
    });
    return foundPorts.sort((a, b) => a.index - b.index);
};

console.log("---------------------------------------------------");
console.log("Analyzing Routes...");

routes.forEach(r => {
    const portsOnRoute = findPortsOnRoute(r.points);

    // Filter debug for specific routes
    // Log ALL routes to see where RIO is detected
    if (true) {
        console.log(`Route: ${r.id}`);
        // Compact log
        console.log(`  Ports: ${portsOnRoute.map(p => p.id).join(' -> ')}`);

        // DEBUG: Find closest distance to RIO explicitly
        const rio = PortDatabase.find(p => p.id === 'BR_RIO');
        let minRioD = 9999;
        r.points.forEach(pt => {
            const d = NavMath.calcLeg(rio.lat, rio.lon, pt.lat, pt.lon).dist;
            if (d < minRioD) minRioD = d;
        });
        console.log(`  [DEBUG] Closest approach to BR_RIO: ${minRioD.toFixed(1)} NM`);

        const rioDetected = portsOnRoute.find(p => p.id === 'BR_RIO');
        if (!rioDetected) console.log("  [WARN] BR_RIO NOT DETECTED on this route!");
    }

    if (portsOnRoute.length >= 2) {
        for (let i = 0; i < portsOnRoute.length - 1; i++) {
            const p1 = portsOnRoute[i];
            const p2 = portsOnRoute[i + 1];

            if (!graph[p1.id]) graph[p1.id] = [];
            if (!graph[p2.id]) graph[p2.id] = [];

            graph[p1.id].push({ target: p2.id, route: r.id });
            graph[p2.id].push({ target: p1.id, route: r.id });
        }
    }
});

console.log("---------------------------------------------------");
console.log("Graph Connectivity Check:");
const start = 'BR_ITQ'; // Itaqui
const end = 'BR_RIO'; // Rio de Janeiro

console.log(`Looking for path ${start} -> ${end}`);

// BFS
const queue = [[start]];
const visited = new Set();
let found = false;
let pathFound = [];

while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === end) {
        found = true;
        pathFound = path;
        break;
    }

    if (visited.has(node)) continue;
    visited.add(node);

    const neighbors = graph[node] || [];
    for (const edge of neighbors) {
        if (!visited.has(edge.target)) {
            queue.push([...path, edge.target]);
        }
    }
}

if (found) {
    console.log("SUCCESS! Path found:", pathFound.join(' -> '));
} else {
    console.log("FAILED. No path found.");
    // print neighbors of start
    console.log(`Neighbors of ${start}:`, graph[start] ? graph[start].map(e => e.target) : 'None');
    console.log(`Neighbors of ${end}:`, graph[end] ? graph[end].map(e => e.target) : 'None');
}
