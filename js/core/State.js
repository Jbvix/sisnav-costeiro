/* =============================================================================
 * SISNAV Costeiro — Sistema de Auxílio à Navegação
 * Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
 * Autor: Jossian Brito | Contato: jossiancosta@gmail.com
 * Este software é proprietário e confidencial. O uso não autorizado é proibido.
 * =============================================================================
 */

/**
 * State.js
 * Gerenciador de estado global (Singleton)
 */

const State = {
    data: {
        route: [],
        vessel: null,
        weather: {}
    },
    init: function() {
        console.log(\"State: Inicializado.\");
    }
};

export default State;
