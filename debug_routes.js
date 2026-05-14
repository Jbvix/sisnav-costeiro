
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
console.log("---------------------------------------------------");
console.log("Graph Connectivity Check:");
const start = 'BR_ITQ'; // Itaqui
const end = 'BR_RIG'; // Rio Grande

console.log(`Looking for path ${start} -> ${end}`);

// BFS
// DIJKSTRA instead of BFS to penalize route switching
const PriorityQueue = [];
// State: { id, cost, path, routeId, edges }
const startNode = { id: start, cost: 0, path: [start], routeId: null, edges: [] };
PriorityQueue.push(startNode);

// minCosts tracks minimal cost to reach a (Node, RouteID) tuple
// This is critical because arriving at B via Route 1 (cost 10) might be better than via Route 2 (cost 9)
// if the next hop is Route 1 (cost 10+1 = 11 vs 9+1+5 = 15).
const minCosts = {}; // Key: `${nodeId}_${routeId}`

let found = false;
let finalNode = null;

while (PriorityQueue.length > 0) {
    // Sort logic (Simple Min-Heap simulation)
    PriorityQueue.sort((a, b) => a.cost - b.cost);
    const curr = PriorityQueue.shift();

    if (curr.id === end) {
        found = true;
        finalNode = curr;
        break;
    }

    // State Check
    // If routeId is null (start), use 'null'
    const rId = curr.routeId || 'null';
    const stateKey = `${curr.id}_${rId}`;

    if (minCosts[stateKey] !== undefined && minCosts[stateKey] <= curr.cost) {
        continue;
    }
    minCosts[stateKey] = curr.cost;

    const neighbors = graph[curr.id] || [];
    for (const edge of neighbors) {
        // Calculate penalty
        // Penalty if we are already on a route (curr.routeId != null) AND we switch.
        // If curr.routeId is null (start), no penalty.
        const penalty = (curr.routeId !== null && edge.route !== curr.routeId) ? 5 : 0;
        const newCost = curr.cost + 1 + penalty;

        PriorityQueue.push({
            id: edge.target,
            cost: newCost,
            path: [...curr.path, edge.target],
            routeId: edge.route,
            edges: [...curr.edges, edge]
        });
    }
}

if (found) {
    pathFound = finalNode.path;
    // Populate parentMap for display logic below (mocking the structure expected)
    // Actually, we can just print directly from edges
    console.log(`SUCCESS! Path found with Cost ${finalNode.cost}:`, pathFound.join(' -> '));
    console.log("Detailed Segments (Inertia Optimized):");
    finalNode.edges.forEach(e => {
        console.log(` -> ${e.target} [via ${e.route}]`);
    });

    // Skip the old loop printing
    found = false; // Disable old block
} else {
    // Fallback to old block if not found (found is already false)
}

if (found) {
    console.log("SUCCESS! Path found:", pathFound.join(' -> '));
    // Print Route IDs for each leg to debug "which file is doing this?"
    for (let i = 0; i < pathFound.length - 1; i++) {
        const from = pathFound[i];
        const to = pathFound[i + 1];
        const info = parentMap[to]; // Valid because BFS tree property
        // Note: parentMap[to] might not be from 'from' in general graph, but in BFS tree construction logic above it should be roughly right 
        // strictly we should reconstruct from end to start using parent pointers.
    }

    // Better reconstruction
    let curr = end;
    const legs = [];
    while (curr !== start) {
        const info = parentMap[curr];
        legs.unshift(`${info.p} -> ${curr} [via ${info.routeId}]`);
        curr = info.p;
    }
    console.log("Detailed Segments:");
    legs.forEach(l => console.log(l));

} else {
    console.log("FAILED. No path found.");
}
