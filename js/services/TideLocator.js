/**
 * ARQUIVO: TideLocator.js
 * MÓDULO: Serviço de Localização de Estações Maregráficas
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 3.1.0 (Fix Coordenadas Rio Grande)
 * DESCRIÇÃO: Ajuste fino de coordenadas para evitar erro 400 (Land) na API Marine.
 */

const TideLocator = {

    MAX_RADIUS_NM: 30.0,

    // Banco de Dados interno ajustado para pontos "na água"
    // Banco de Dados interno ajustado para pontos "na água"
    // csvName: Chave exata para busca no TideCSVService
    stationsDB: [
        { id: 'BR_RIG', name: 'Rio Grande (Barra)', lat: -32.180, lon: -52.080, csvName: 'Rio Grande' },
        { id: 'BR_PNG', name: 'Paranaguá (Galheta)', lat: -25.583, lon: -48.316, csvName: 'Paranaguá' },
        { id: 'BR_SFS', name: 'São Francisco do Sul', lat: -26.233, lon: -48.633, csvName: 'São Francisco do Sul' },
        { id: 'BR_ITJ', name: 'Itajaí', lat: -26.916, lon: -48.650, csvName: 'Itajaí' },
        { id: 'BR_IMB', name: 'Imbituba', lat: -28.233, lon: -48.650, csvName: 'Imbituba' },
        { id: 'BR_STS', name: 'Santos (Ponta da Praia)', lat: -23.960, lon: -46.310, csvName: 'Paranaguá' }, // Proxy: Paranaguá (Santos missing)
        { id: 'BR_SSB', name: 'São Sebastião', lat: -23.816, lon: -45.400, csvName: 'Paranaguá' }, // Proxy: Paranaguá
        { id: 'BR_RIO', name: 'Rio de Janeiro (Ilha Fiscal)', lat: -22.896, lon: -43.165, csvName: 'Rio de Janeiro' },
        { id: 'BR_SEP', name: 'Sepetiba', lat: -23.016, lon: -44.033, csvName: 'Sepetiba' },
        { id: 'BR_VIT', name: 'Vitória', lat: -20.316, lon: -40.283, csvName: 'Vitória' },
        { id: 'BR_SAL', name: 'Salvador', lat: -12.966, lon: -38.516, csvName: 'Salvador' },
        { id: 'BR_REC', name: 'Recife', lat: -8.050, lon: -34.866, csvName: 'Recife' },
        { id: 'BR_SUA', name: 'Suape', lat: -8.397, lon: -34.959, csvName: 'Recife' }, // Proxy: Recife (Suape missing)
        { id: 'BR_FOR', name: 'Fortaleza (Mucuripe)', lat: -3.716, lon: -38.466, csvName: 'Fortaleza' },
        { id: 'BR_BEL', name: 'Belém', lat: -1.450, lon: -48.500, csvName: 'Belém' },
        { id: 'BR_VDC', 'name': 'Vila do Conde', lat: -1.533, lon: -48.750, csvName: 'Belém' }, // Proxy: Belém (Vila do Conde missing)
        { id: 'BR_ITQ', 'name': 'Itaqui', lat: -2.566, lon: -44.366, csvName: 'Itaqui' }
    ],

    _getDistance: function (lat1, lon1, lat2, lon2) {
        const R = 3440.065;
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    findNearest: function (lat, lon) {
        let nearest = null;
        let minDist = Infinity;

        for (const station of this.stationsDB) {
            const dist = this._getDistance(lat, lon, station.lat, station.lon);
            if (dist < minDist) {
                minDist = dist;
                nearest = station;
            }
        }

        if (nearest && minDist <= this.MAX_RADIUS_NM) {
            return {
                found: true,
                type: 'COSTEIRO',
                station: nearest,
                distance: minDist,
                message: `Referência: ${nearest.name} (${minDist.toFixed(1)} NM)`
            };
        } else {
            return {
                found: false,
                type: 'OCEÂNICO',
                station: null,
                distance: minDist,
                message: 'Águas Profundas / Oceânico'
            };
        }
    }
};

export default TideLocator;