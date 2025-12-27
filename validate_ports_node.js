
const fs = require('fs');

// 1. Load PortDatabase (Mocked/Copied to avoid ES Module issues in simple Node script)
const PortDatabase = [
    { id: 'BR_STN', name: 'Santana-AP', lat: -0.058, lon: -51.170, csvName: 'Belém' },
    { id: 'BR_VDC', name: 'Vila do Conde-PA', lat: -1.533, lon: -48.750, csvName: 'Belém' },
    { id: 'BR_BEL', name: 'Belém-PA', lat: -1.450, lon: -48.500, csvName: 'Belém' },
    { id: 'BR_ITQ', name: 'Itaqui-MA', lat: -2.566, lon: -44.366, csvName: 'Itaqui' },
    { id: 'BR_PEC', name: 'Pecém-CE', lat: -3.550, lon: -38.800, csvName: 'Fortaleza' },
    { id: 'BR_FOR', name: 'Mucuripe-CE', lat: -3.716, lon: -38.466, csvName: 'Fortaleza' },
    { id: 'BR_SUA', name: 'Suape-PE', lat: -8.397, lon: -34.959, csvName: 'Recife' },
    { id: 'BR_REC', name: 'Recife-PE', lat: -8.050, lon: -34.866, csvName: 'Recife' },
    { id: 'BR_SAL', name: 'Salvador-BA', lat: -12.966, lon: -38.516, csvName: 'Salvador' },
    { id: 'BR_VIT', name: 'Vitória-ES', lat: -20.316, lon: -40.283, csvName: 'Vitória' },
    { id: 'BR_RIO', name: 'Rio de Janeiro-RJ', lat: -22.896, lon: -43.165, csvName: 'Rio de Janeiro' },
    { id: 'BR_ITG', name: 'Sepetiba', lat: -22.930, lon: -43.840, csvName: 'Sepetiba' },
    { id: 'BR_ANG', name: 'Angra dos Reis-RJ', lat: -23.000, lon: -44.316, csvName: 'Sepetiba' },
    { id: 'BR_STS', name: 'Santos-SP', lat: -23.960, lon: -46.310, csvName: 'Sepetiba' },
    { id: 'BR_PNG', name: 'Paranaguá-PR', lat: -25.583, lon: -48.316, csvName: 'Paranaguá' },
    { id: 'BR_SFS', name: 'S. Francisco do Sul-SC', lat: -26.233, lon: -48.633, csvName: 'São Francisco do Sul' },
    { id: 'BR_ITJ', name: 'Itajaí-SC', lat: -26.916, lon: -48.650, csvName: 'Itajaí' },
    { id: 'BR_RIG', name: 'Rio Grande-RS', lat: -32.180, lon: -52.080, csvName: 'Rio Grande' }
];

// 2. Load JSON
try {
    const raw = fs.readFileSync('maritimo_mare_meteo.json', 'utf8');
    const data = JSON.parse(raw);
    const keys = Object.keys(data.ports);

    // 3. Logic from TideJSONService (Replicated)
    const PATCH_MAP = {
        "Rio Grande-RS": "Rio Grande-RS (Porto)",
        "Rio de Janeiro-RJ": "Rio de Janeiro-RJ",
        "Vila do Conde-PA": "Vila do Conde-PA (proxy Barcarena)",
        "Chibatão-AM": "Manaus (Chibatão)-AM",
        "Santana-AP": "Santana-AP (Porto)",
        "Belém-PA": "Belém-PA (Porto)",
        "Recife-PE": "Recife-PE (Porto)",
        "Santos-SP": "Santos-SP (Porto)",
        "S. Francisco do Sul-SC": "São Francisco do Sul-SC (Porto)"
    };

    const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const resolve = (internalName) => {
        if (PATCH_MAP[internalName] && data.ports[PATCH_MAP[internalName]]) {
            return { found: true, method: 'PATCH', key: PATCH_MAP[internalName] };
        }
        if (data.ports[internalName]) return { found: true, method: 'DIRECT', key: internalName };

        const search = norm(internalName);
        const foundKey = keys.find(k => norm(k).includes(search) || search.includes(norm(k)));

        if (foundKey) return { found: true, method: 'FUZZY', key: foundKey };
        return { found: false };
    };

    console.log("--- VALIDATION REPORT ---");
    let failures = 0;
    PortDatabase.forEach(p => {
        const res = resolve(p.name);
        if (res.found) {
            console.log(`[OK] ${p.name} -> ${res.key} (${res.method})`);
        } else {
            console.log(`[FAIL] ${p.name} -> NOT FOUND`);
            failures++;
        }
    });

    console.log("-------------------------");
    console.log(`Total: ${PortDatabase.length}, Failures: ${failures}`);

} catch (e) {
    console.error("Error reading JSON:", e.message);
}
