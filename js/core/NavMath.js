/**
 * ARQUIVO: NavMath.js
 * MÓDULO: Núcleo Matemático de Navegação
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 3.2.0 (Export Robustness Fix)
 * DESCRIÇÃO: Biblioteca de funções estáticas para cálculos de navegação (Loxodromia).
 */

const NavMath = {
    /**
     * Converte Graus para Radianos
     * @param {number} deg 
     * @returns {number}
     */
    toRad: function(deg) {
        return deg * Math.PI / 180;
    },

    /**
     * Formata coordenadas decimais para String (DMS)
     * @param {number} val 
     * @param {string} type 'lat' | 'lon'
     * @returns {string}
     */
    formatPos: function(val, type) {
        const absVal = Math.abs(val);
        const deg = Math.floor(absVal);
        const min = ((absVal - deg) * 60).toFixed(3);
        
        let suffix = '';
        if (type === 'lat') {
            suffix = val >= 0 ? 'N' : 'S';
        } else {
            suffix = val >= 0 ? 'E' : 'W';
        }
        
        return `${deg}° ${min}' ${suffix}`;
    },

    /**
     * Calcula Rumo e Distância entre dois pontos (Loxodromia/Rhumb Line)
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {{crs: number, dist: number}}
     */
    calcLeg: function(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Raio da Terra em Milhas Náuticas
        
        // Uso direto de Math.PI e funções internas
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;

        // Mercator sailing calculation
        // Evita log de zero ou infinito se phi1/phi2 forem exatamente +/- 90
        const dPhi = Math.log(Math.tan(Math.PI/4 + phi2/2) / Math.tan(Math.PI/4 + phi1/2));

        // Rumo (q)
        let q = Math.atan2(dLon, dPhi) * 180 / Math.PI;
        if (q < 0) q += 360;

        // Distância
        let dist = 0;
        const dLat = (lat2 - lat1) * Math.PI / 180;

        // Tratamento para rumos E/W (dLat próximo de zero)
        if (Math.abs(dLat) < 1e-10) {
            // Distância no paralelo = dLon * cos(lat)
            dist = Math.abs(dLon) * Math.cos(phi1) * R;
        } else {
            // Fórmula geral Loxodrômica
            // Usa cosseno do rumo em radianos
            dist = Math.abs(dLat / Math.cos(q * Math.PI / 180)) * R;
        }

        return { 
            crs: q, 
            dist: dist 
        };
    }
};

export default NavMath;