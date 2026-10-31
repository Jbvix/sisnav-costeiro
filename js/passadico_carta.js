/**
 * =============================================================================
 * SISNAV COSTEIRO - js/passadico_carta.js (fundo "carta náutica" do Padrão Passadiço)
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-10-30 22:26 (UTC-3)   Versão: 1.0 (v3.9.0)
 * -----------------------------------------------------------------------------
 * HISTÓRICO DE MODIFICAÇÕES
 *  1.0 (v3.9.0, 2026-10-30) - Arquivo NOVO: desenha isobatimétricas (linhas de
 *      mesma profundidade) em todo <canvas class="sn-isobatas"> (capa, login,
 *      admin). Redesenha ao mudar o tamanho da janela ou a iluminação.
 * -----------------------------------------------------------------------------
 * FÓRMULA de cada curva i (uma profundidade: 5 m, 10 m, 20 m...):
 *     y(x) = base_i + A_i · sen(k_i · x + fase_i) + 6 · sen(0,021 · x + i)
 *   base_i = 30 + i · (altura / 15)    -> curvas espaçadas de cima para baixo
 *   A_i    = 10 + 3,2 · i              -> amplitude cresce "ao largo"
 *   k_i    = 0,008 + 0,0004 · i        -> ondulação um pouco mais curta a cada curva
 *   O 2º seno (pequeno) quebra a regularidade, como a costa real.
 * Uma em cada quatro curvas sai na cor de destaque (curva "mestra").
 * =============================================================================
 */
(function () {
    'use strict';

    function cor(nome, reserva) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
        return v ? 'rgb(' + v + ')' : reserva;
    }

    function desenhar(cv) {
        var r = cv.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var dpr = window.devicePixelRatio || 1;
        cv.width = Math.round(r.width * dpr);
        cv.height = Math.round(r.height * dpr);
        var g = cv.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, r.width, r.height);

        var linha = cor('--t-slate-400', '#94a3b8');
        var mestra = cor('--c-blue-500', '#3b82f6');
        for (var i = 0; i < 14; i++) {
            var A = 10 + i * 3.2, base = 30 + i * (r.height / 15), k = 0.008 + i * 0.0004, fase = i * 0.7;
            g.beginPath();
            for (var x = 0; x <= r.width; x += 6) {
                var y = base + A * Math.sin(k * x + fase) + 6 * Math.sin(0.021 * x + i);
                if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            var eMestra = i % 4 === 0;
            g.strokeStyle = eMestra ? mestra : linha;
            g.globalAlpha = eMestra ? 0.5 : 0.18;
            g.lineWidth = eMestra ? 1.4 : 1;
            g.stroke();
        }
        // Cotas das curvas mestras (profundidade em metros)
        g.globalAlpha = 0.45;
        g.fillStyle = linha;
        g.font = '11px "IBM Plex Mono", monospace';
        [[0.18, 5], [0.42, 10], [0.66, 20], [0.86, 50]].forEach(function (p) {
            g.fillText(p[1] + ' m', r.width * 0.72, r.height * p[0]);
        });
        g.globalAlpha = 1;
    }

    function todos() {
        var cvs = document.querySelectorAll('canvas.sn-isobatas');
        for (var i = 0; i < cvs.length; i++) desenhar(cvs[i]);
    }

    window.addEventListener('resize', todos);
    window.addEventListener('sisnav-luz', function () { requestAnimationFrame(todos); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(todos);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', todos); else todos();
})();
