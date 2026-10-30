/**
 * =============================================================================
 * SISNAV COSTEIRO - js/config.js (Roteador de chamadas Front -> API)
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-10-29 21:30 (UTC-3)   Versão: 3.6.0-cloud
 * -----------------------------------------------------------------------------
 * HISTÓRICO DE MODIFICAÇÕES
 *  v3.6.0-cloud (2026-10-29) - Arquivo NOVO (migração para Netlify + Railway):
 *   [1] SISNAV_API_BASE: endereço do back-end Flask no Railway. Vazio = mesma
 *       origem (modo cPanel ou servidor local "python server.py").
 *   [2] "Desvio de rota" do fetch: toda chamada 'api/...' ou '/api/...' é
 *       enviada ao Railway, sem precisar alterar as ~20 chamadas do App.js.
 *   [3] Credenciais automáticas: se a chamada à API não trouxer os cabeçalhos
 *       X-Invite-Token / X-Admin-Key, eles são anexados a partir da sessão
 *       da aba (sessionStorage) - necessário porque /api/fleet e
 *       /api/position passaram a exigir convite.
 *   [5] library/CONTACTS.txt (dados pessoais) é servido pela API com convite.
 *   [4] Arquivos dinâmicos (marés, meteo, índice de rotas) são lidos de
 *       /api/data/<arquivo>, que sempre tem a versão mais recente no banco.
 * -----------------------------------------------------------------------------
 * ANALOGIA NÁUTICA: este arquivo é o piloto da barra. O navio (App.js) segue
 * o mesmo rumo de sempre ("api/fleet"); o piloto é quem sabe que o canal
 * agora leva a outro cais (o Railway) e corrige o rumo na entrada.
 *
 * IMPORTANTE: carregar como <script> CLÁSSICO e ANTES de qualquer módulo,
 * para que o desvio já esteja ativo quando o App.js fizer o primeiro fetch.
 * =============================================================================
 */
(function () {
    'use strict';

    // [1] Preenchido no build do Netlify (scripts/build_netlify.sh) a partir
    //     da variável SISNAV_API_BASE. Sem barra no final.
    var API_BASE = (window.SISNAV_API_BASE !== undefined)
        ? window.SISNAV_API_BASE
        : '__SISNAV_API_BASE__';
    if (API_BASE.indexOf('__') === 0) API_BASE = ''; // placeholder não substituído
    API_BASE = API_BASE.replace(/\/+$/, '');
    window.SISNAV_API_BASE = API_BASE;

    // [4] arquivo estático -> rota da API
    var DATA_FILES = {
        'tides_scraped.csv': 'tides_scraped.csv',
        'weather_scraped.csv': 'weather_scraped.csv',
        'js/data/known_routes.json': 'known_routes.json'
    };

    function sessionHeaders() {
        var h = {};
        try {
            var s = JSON.parse(sessionStorage.getItem('sisnav_session_v1') || '{}');
            if (s && s.token) h['X-Invite-Token'] = s.token;
            var k = sessionStorage.getItem('sisnav_admin_key');
            if (k) h['X-Admin-Key'] = k;
        } catch (e) { /* aba anônima/sem storage: segue sem credencial */ }
        return h;
    }

    /** Converte a URL pedida pelo app na URL real. Retorna null se não mexe. */
    function reroute(url) {
        if (typeof url !== 'string') return null;
        if (/^[a-z]+:\/\//i.test(url) || url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) return null;

        var clean = url.replace(/^\.\//, '').replace(/^\//, '');
        var path = clean.split('?')[0];

        if (path.indexOf('api/') === 0) {
            return { url: API_BASE + '/' + clean, api: true };
        }
        if (API_BASE && path === 'library/CONTACTS.txt') {
            return { url: API_BASE + '/api/library/contacts.txt', api: true };
        }
        if (API_BASE && DATA_FILES[path]) {
            return { url: API_BASE + '/api/data/' + DATA_FILES[path], api: true };
        }
        return null;
    }

    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        var r = reroute(typeof input === 'string' ? input : null);
        if (!r) return nativeFetch(input, init);

        init = Object.assign({}, init || {});
        var headers = new Headers(init.headers || {});
        var extra = sessionHeaders();
        Object.keys(extra).forEach(function (k) {
            if (!headers.get(k)) headers.set(k, extra[k]);
        });
        init.headers = headers;
        if (API_BASE) init.mode = 'cors';
        return nativeFetch(r.url, init);
    };

    window.SISNAV_REROUTE = reroute; // exposto para testes/diagnóstico no console
})();
