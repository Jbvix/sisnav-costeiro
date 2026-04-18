/* =============================================================================
 * SISNAV Costeiro — Sistema de Auxílio à Navegação
 * Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
 * Autor: Jossian Brito | Contato: jossiancosta@gmail.com
 * Este software é proprietário e confidencial. O uso não autorizado é proibido.
 * =============================================================================
 */

/**
 * ARQUIVO: App.js
 * FUNÇÃO: Ponto de entrada da aplicação (SPA)
 */

import State from './core/State.js';
import MapService from './services/MapService.js';
import UIController from './UIController.js';

const App = {
    init: async function() {
        console.log(\"App: Inicializando SISNAV Costeiro V3.1...\");
        
        // 1. Inicializa Estado Global
        State.init();

        // 2. Registra Event Listeners
        this.bindEvents();

        // 3. Inicializa componentes UI
        UIController.init();
        
        console.log(\"App: Sistema pronto.\");
    },

    bindEvents: function() {
        // Eventos globais de navegação
        document.addEventListener('nav-change', (e) => {
            console.log(`App: Navegando para ${e.detail.page}`);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

export default App;
