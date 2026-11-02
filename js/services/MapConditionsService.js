/**
 * =============================================================================
 * SISNAV COSTEIRO - js/services/MapConditionsService.js ("Condições no mapa")
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-11-01 16:13 (UTC-3)   Versão: 1.1 (v3.15.0)
 * -----------------------------------------------------------------------------
 * HISTÓRICO DE MODIFICAÇÕES
 *  1.1 (v3.15.0, 2026-11-01 23:04) - importa MapService.js?v=17 (mesmo endereço do App).
 *  1.0 (v3.13.0, 2026-11-01) - Arquivo NOVO:
 *   [1] Camada "Condições previstas" no mapa do Monitoramento:
 *       - cada perna pintada pelo selo (normal / atenção / restritivo);
 *       - no meio da perna, seta de VENTO (para onde sopra) e de CORRENTE
 *         (para onde corre), com a intensidade em nós;
 *       - marcadores das barras de saída e chegada com o selo e a maré.
 *   [2] Usa os dados já consultados no Planejamento (State.marineForecast e
 *       State.barra). O botão "Condições no mapa" consulta se faltar algo.
 *   [3] Legenda no canto do mapa.
 * -----------------------------------------------------------------------------
 * SETAS: um SVG de seta apontando para o NORTE, girado pelo ângulo de destino.
 *   Vento vem "DE" θw -> a seta aponta para θw + 180° (para onde o ar vai).
 *   Corrente já é informada "PARA" θc -> a seta aponta para θc.
 *   Ex.: vento de 090° (leste) -> seta para 270° (oeste).
 * CORES: classes CSS (.sn-cond-*) que leem a paleta das três iluminações,
 *   em vez de cores fixas no JavaScript.
 * =============================================================================
 */
import MarineForecastService from './MarineForecastService.js?v=2';
import BarraService from './BarraService.js?v=2';
import MapService from './MapService.js?v=17';  // mesmo endereço do App -> mesmo módulo

const ROTULO = { normal: 'Normal', atencao: 'Atenção', restritivo: 'Restritivo', fora_horizonte: 'Sem previsão' };
const n = (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmm = (ms) => { const d = new Date(ms), p = (x) => String(x).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };

const MapConditionsService = {
    _state: null,
    _camada: null,
    _legenda: null,

    init: function (state) {
        this._state = state;
        const btn = document.getElementById('btn-mapa-condicoes');
        if (btn) btn.addEventListener('click', () => this.atualizar());
        // Planejamento atualizou previsão ou barra -> redesenha se o mapa já existe
        window.addEventListener('sisnav-condicoes', () => this.desenhar());
    },

    _status: function (txt) {
        const el = document.getElementById('sn-mapa-cond-status');
        if (el) el.textContent = txt;
    },

    /** [2] Consulta o que faltar e desenha. */
    atualizar: async function () {
        const S = this._state || window.State;
        const btn = document.getElementById('btn-mapa-condicoes');
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando…'; }
        try {
            if (!S.marineForecast) await MarineForecastService.prever();
            if (!S.barra) await BarraService.consultar();
            if (!S.marineForecast) {
                this._status('Sem previsão por perna: confira rota e ETD no Planejamento (mensagem no painel "Previsão do mar por perna").');
                return;
            }
            this.desenhar();
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
        }
    },

    _seta: function (graus, classe, texto) {
        // Seta para o norte (ponta em y=2), girada no centro (12,12)
        const svg = `<svg viewBox="0 0 24 24" width="26" height="26" style="transform: rotate(${Math.round(graus)}deg)"><path d="M12 2 L18 14 L13.5 12.5 L13.5 22 L10.5 22 L10.5 12.5 L6 14 Z"/></svg>`;
        return L.divIcon({ className: `sn-cond-seta ${classe}`, html: `${svg}<span>${texto}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    },

    /** [1] Desenha a camada a partir de State.marineForecast e State.barra. */
    desenhar: function () {
        const S = this._state || window.State;
        // O mapa vive no State do MapService (outro módulo): pedir a ele.
        const { map, control } = MapService.getMapa();
        if (!map || typeof L === 'undefined') {
            this._status('Abra o mapa (aba Monitoramento) para ver as condições.');
            return;
        }
        if (!this._camada) {
            this._camada = L.layerGroup().addTo(map);
            if (control) control.addOverlay(this._camada, '🌊 Condições previstas');
            this._legendaAdd(map);
        }
        this._camada.clearLayers();

        const pts = S.routePoints || [];
        const mf = S.marineForecast;
        let desenhadas = 0;
        if (mf && Array.isArray(mf.pernas)) {
            if (mf.pernas.length !== pts.length - 1) {
                this._status('A rota mudou depois da previsão: clique em "Condições no mapa" após prever de novo no Planejamento.');
            } else {
                mf.pernas.forEach((p, i) => {
                    const a = pts[i], b = pts[i + 1];
                    const nivel = p.status === 'ok' ? (p.nivel || 'normal') : 'fora_horizonte';
                    const linha = L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { className: `sn-cond-perna sn-cond-${nivel}`, weight: 7, opacity: 0.85 });
                    const v = p.vento || {}, c = p.corrente || {}, o = p.onda || {};
                    linha.bindTooltip(p.status === 'ok'
                        ? `<b>Perna ${p.n} · ${ROTULO[nivel]}</b><br>${hhmm(p.t_ms)}<br>Onda ${n(o.hs_m)} m · Vento ${n(v.kn, 0)} kn<br>Corrente ${n(c.kn)} kn · SOG ${n(c.sog_kn)} kn`
                        : `<b>Perna ${p.n}</b><br>Fora do horizonte de previsão`, { sticky: true });
                    linha.addTo(this._camada);
                    if (p.status === 'ok') {
                        const lat = (a.lat + b.lat) / 2, lon = (a.lon + b.lon) / 2;
                        if (v.dir_de !== null && v.dir_de !== undefined) {
                            L.marker([lat, lon], { icon: this._seta(v.dir_de + 180, 'sn-cond-vento', `${n(v.kn, 0)}`), interactive: false }).addTo(this._camada);
                        }
                        if (c.dir_para !== null && c.dir_para !== undefined && c.kn) {
                            // corrente desenhada um pouco ao lado (0,05° ≈ 3 NM) para não sobrepor a seta do vento
                            L.marker([lat - 0.05, lon + 0.05], { icon: this._seta(c.dir_para, 'sn-cond-corrente', `${n(c.kn)}`), interactive: false }).addTo(this._camada);
                        }
                    }
                    desenhadas++;
                });
            }
        }

        const barra = S.barra && Array.isArray(S.barra.pontos) ? S.barra.pontos : [];
        barra.filter(p => p.status === 'ok').forEach(p => {
            const est = p.estacao || {};
            const lat = est.lat ?? null, lon = est.lon ?? null;
            if (lat === null || lon === null) return;
            const m = p.mare || {};
            const nivel = p.nivel || 'normal';
            L.circleMarker([lat, lon], { radius: 11, className: `sn-cond-barra sn-cond-${nivel}`, weight: 3, fillOpacity: 0.35 })
                .bindPopup(`<b>${p.tipo === 'saida' ? 'Saída' : 'Chegada'} · ${p.porto}</b><br>${p.tipo === 'saida' ? 'ETD' : 'ETA'} ${hhmm(p.t_ms)} · ${ROTULO[nivel]}<br>`
                    + `Maré ${n(m.altura_m, 2)} m · ${m.tendencia || ''}<br>Corrente ${n((p.corrente || {}).kn)} kn · Vento ${n((p.vento || {}).kn, 0)} kn<br>Onda ${n((p.onda || {}).hs_m)} m`)
                .addTo(this._camada);
        });

        // Enquadra a rota inteira (com margem) para o oficial ver a derrota toda
        if (desenhadas && pts.length > 1) {
            map.fitBounds(pts.map(p => [p.lat, p.lon]), { padding: [40, 40] });
        }

        this._status(desenhadas || barra.length
            ? `Mapa com ${desenhadas} pernas coloridas${barra.length ? ' e as barras de saída/chegada' : ''}. Passe o mouse (ou toque) numa perna para ver os valores.`
            : 'Nada a desenhar ainda: carregue a rota e use "Condições no mapa".');
    },

    /** [3] Legenda (canto inferior direito do mapa). */
    _legendaAdd: function (map) {
        const Legenda = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function () {
                const div = L.DomUtil.create('div', 'sn-cond-legenda');
                div.innerHTML = '<b>Condições previstas</b>'
                    + '<span><i class="sn-cond-normal"></i>Normal</span>'
                    + '<span><i class="sn-cond-atencao"></i>Atenção (Hs ≥ 2 m ou vento ≥ 20 kn)</span>'
                    + '<span><i class="sn-cond-restritivo"></i>Restritivo (Hs ≥ 3 m ou vento ≥ 28 kn)</span>'
                    + '<span><i class="sn-cond-fora_horizonte"></i>Sem previsão</span>'
                    + '<span><b class="lv">➤</b> vento (para onde sopra) &nbsp;<b class="lc">➤</b> corrente (para onde corre)</span>';
                return div;
            }
        });
        this._legenda = new Legenda().addTo(map);
    }
};

export default MapConditionsService;
