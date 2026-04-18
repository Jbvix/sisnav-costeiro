/* =============================================================================
 * SISNAV Costeiro — Sistema de Auxílio à Navegação
 * Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
 * Autor: Jossian Brito | Contato: jossiancosta@gmail.com
 * Este software é proprietário e confidencial. O uso não autorizado é proibido.
 * =============================================================================
 */

/**
 * NavMath.js
 * Biblioteca de cálculos náuticos
 */

const NavMath = {
    // Haversine para distância
    haversine: function(lat1, lon1, lat2, lon2) {
        const R = 3440.06479; // Raio da Terra em Milhas Náuticas
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    toRad: (deg) => deg * Math.PI / 180
};

export default NavMath;
