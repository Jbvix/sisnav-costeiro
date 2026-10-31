/**
 * =============================================================================
 * SISNAV COSTEIRO - js/passadico.js (Iluminação do passadiço + paleta Tailwind)
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-10-30 22:26 (UTC-3)   Versão: 1.0 (v3.9.0)
 * -----------------------------------------------------------------------------
 * HISTÓRICO DE MODIFICAÇÕES
 *  1.0 (v3.9.0, 2026-10-30) - Arquivo NOVO - "Padrão Passadiço":
 *   [1] Aplica a iluminação salva (Dia, Crepúsculo, Noite) ANTES da página
 *       aparecer, para não "piscar" branco à noite.
 *   [2] Ensina o Tailwind a ler as cores das variáveis CSS geradas em
 *       css/passadico_paleta.css (fundo --c-*, texto --t-*, borda --b-*).
 *   [3] Botões com o atributo data-luz-set="dia|crepusculo|noite" trocam a
 *       iluminação; a escolha vale para todas as páginas do SISNAV.
 * -----------------------------------------------------------------------------
 * ONDE CARREGAR: no <head>, LOGO DEPOIS do <script src="cdn.tailwindcss.com">
 * (o Tailwind precisa existir para receber a configuração).
 * ANALOGIA: é o dimmer do console. O painel é o mesmo; muda a luz que emite.
 * =============================================================================
 */
(function () {
    'use strict';

    var CHAVE = 'sisnav_luz';
    var LUZES = ['dia', 'crepusculo', 'noite'];
    var root = document.documentElement;

    // [1] Iluminação salva -> atributo data-luz no <html>.
    //     Sem escolha salva: segue o sistema (escuro => Crepúsculo).
    function lida() {
        var v = null;
        try { v = localStorage.getItem(CHAVE); } catch (e) { /* navegador sem storage */ }
        if (LUZES.indexOf(v) < 0) {
            v = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'crepusculo' : 'dia';
        }
        return v;
    }

    function aplicar(v) {
        if (LUZES.indexOf(v) < 0) v = 'dia';
        root.setAttribute('data-luz', v);
        try { localStorage.setItem(CHAVE, v); } catch (e) { /* ignora */ }
        var botoes = document.querySelectorAll('[data-luz-set]');
        for (var i = 0; i < botoes.length; i++) {
            botoes[i].setAttribute('aria-pressed', String(botoes[i].getAttribute('data-luz-set') === v));
        }
        // Avisa quem desenha em canvas/mapa (ex.: capa, Leaflet) para redesenhar.
        try { window.dispatchEvent(new CustomEvent('sisnav-luz', { detail: v })); } catch (e) { /* IE */ }
    }
    root.setAttribute('data-luz', lida());

    // [2] Paleta do Tailwind -> variáveis CSS.
    //     Para cada família (slate, blue...) e tom (50...950):
    //       cor de fundo   = rgb(var(--c-blue-600) / alfa)
    //       cor de texto   = rgb(var(--t-blue-600) / alfa)
    //       cor de borda   = rgb(var(--b-blue-600) / alfa)
    //     <alpha-value> é trocado pelo Tailwind pela opacidade da classe
    //     (ex.: bg-blue-600/20 -> alfa 0.2).
    var FAMILIAS = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime',
        'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
    var TONS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

    function paleta(prefixo) {
        var p = { transparent: 'transparent', current: 'currentColor', inherit: 'inherit' };
        p.white = 'rgb(var(--' + prefixo + '-white) / <alpha-value>)';
        p.black = 'rgb(var(--' + prefixo + '-black) / <alpha-value>)';
        FAMILIAS.forEach(function (f) {
            p[f] = {};
            TONS.forEach(function (t) { p[f][t] = 'rgb(var(--' + prefixo + '-' + f + '-' + t + ') / <alpha-value>)'; });
        });
        return p;
    }

    var fontes = {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
        rotulo: ['"IBM Plex Sans Condensed"', '"Arial Narrow"', 'system-ui', 'sans-serif']
    };

    if (window.tailwind) {
        window.tailwind.config = {
            theme: {
                colors: paleta('c'),
                textColor: paleta('t'),
                placeholderColor: paleta('t'),
                borderColor: Object.assign(paleta('b'), { DEFAULT: 'rgb(var(--b-gray-200) / <alpha-value>)' }),
                divideColor: Object.assign(paleta('b'), { DEFAULT: 'rgb(var(--b-gray-200) / <alpha-value>)' }),
                extend: { fontFamily: fontes }
            }
        };
    }

    // [3] API pública + ligação automática dos botões.
    window.SISNAV_LUZ = { aplicar: aplicar, atual: function () { return root.getAttribute('data-luz'); } };
    document.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-luz-set]') : null;
        if (b) aplicar(b.getAttribute('data-luz-set'));
    });
    document.addEventListener('DOMContentLoaded', function () { aplicar(root.getAttribute('data-luz')); });
})();
