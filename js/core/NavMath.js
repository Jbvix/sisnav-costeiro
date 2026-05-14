/* =============================================================================
 * SISNAV Costeiro — Sistema de Auxílio à Navegação
 * Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
 * Autor: Jossian Brito | Contato: jossiancosta@gmail.com
 * Este software é proprietário e confidencial. O uso não autorizado é proibido.
 * =============================================================================
 */

/**
 * NavMath.js — Núcleo matemático de navegação (loxodromia, DMS, distância).
 * VERSÃO: 3.2.1 (restaura calcLeg / parseDMS / formatPos; mantém haversine)
 */

const NavMath = {
    toRad: function (deg) {
        return deg * Math.PI / 180;
    },

    /**
     * Distância em milhas náuticas (grande círculo / Haversine).
     */
    haversine: function (lat1, lon1, lat2, lon2) {
        const R = 3440.06479;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    /**
     * @param {number} val
     * @param {'lat'|'lon'} type
     */
    formatPos: function (val, type) {
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
     * Converte string DMS (ex: "04°25.86' N") para graus decimais.
     * @param {string} dmsStr
     */
    parseDMS: function (dmsStr) {
        if (!dmsStr) return 0;
        try {
            let clean = dmsStr.replace(/°|'|"/g, ' ').trim().toUpperCase();
            let factor = 1;
            if (clean.includes('S') || clean.includes('W')) {
                factor = -1;
            }
            clean = clean.replace(/[NSEW]/g, '').trim();
            const parts = clean.split(/\s+/);
            let deg = 0;
            let min = 0;
            let sec = 0;
            if (parts.length >= 1) deg = parseFloat(parts[0]);
            if (parts.length >= 2) min = parseFloat(parts[1]);
            if (parts.length >= 3) sec = parseFloat(parts[2]);
            return factor * (deg + min / 60 + sec / 3600);
        } catch (e) {
            console.error('NavMath: Erro ao parsear DMS', dmsStr, e);
            return 0;
        }
    },

    /**
     * Rumo e distância (loxodromia) entre dois pontos; dist em MN.
     * @returns {{ crs: number, dist: number }}
     */
    calcLeg: function (lat1, lon1, lat2, lon2) {
        const R = 3440.065;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const dPhi = Math.log(Math.tan(Math.PI / 4 + phi2 / 2) / Math.tan(Math.PI / 4 + phi1 / 2));
        let q = Math.atan2(dLon, dPhi) * 180 / Math.PI;
        if (q < 0) q += 360;
        let dist = 0;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        if (Math.abs(dLat) < 1e-10) {
            dist = Math.abs(dLon) * Math.cos(phi1) * R;
        } else {
            dist = Math.abs(dLat / Math.cos(q * Math.PI / 180)) * R;
        }
        return { crs: q, dist: dist };
    }
};

export default NavMath;
