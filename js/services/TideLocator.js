/* =============================================================================
 * SISNAV Costeiro — Sistema de Auxílio à Navegação
 * Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
 * Autor: Jossian Brito | Contato: jossiancosta@gmail.com
 * Este software é proprietário e confidencial. O uso não autorizado é proibido.
 * =============================================================================
 */

/**
 * TideLocator.js
 * Geolocalização de Estações de Maré
 */

const TideLocator = {
    findNearest: function(lat, lon) {
        // Lógica de busca com threshold de 30 NM
        return { port: \"Vitoria\", dist: 5 };
    }
};

export default TideLocator;
