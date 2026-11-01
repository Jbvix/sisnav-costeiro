/**
 * =============================================================================
 * SISNAV COSTEIRO - js/services/BarraService.js ("Janela da barra")
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-11-01 15:50 (UTC-3)   Versão: 1.0 (v3.12.0)
 * -----------------------------------------------------------------------------
 * HISTÓRICO DE MODIFICAÇÕES
 *  1.0 (v3.12.0, 2026-11-01) - Arquivo NOVO:
 *   [1] Monta SAÍDA (porto de partida, ETD, rumo da 1ª perna) e CHEGADA
 *       (porto de destino, ETA, rumo da última perna) e consulta
 *       POST /api/marine/barra.
 *   [2] Desenha dois cartões: maré no horário (altura, enchente/vazante,
 *       PM/BM anterior e próximas, curva de 24 h), corrente, vento, onda e
 *       selo Normal / Atenção / Restritivo. Botão para a tábua oficial da DHN.
 * -----------------------------------------------------------------------------
 * ETA usado aqui = ETD + distância total / velocidade de cruzeiro (o mesmo
 * cálculo do Planejamento). Rumo de saída = rumo da 1ª perna; de chegada =
 * rumo da última perna (o rumo com que o navio demanda a barra).
 * Analogia: é o "boletim do prático" da barra, para a hora em que você vai
 * passar por ela - não substitui a tábua da DHN nem a informação da praticagem.
 * =============================================================================
 */
import NavMath from '../core/NavMath.js?v=10';
import PortDatabase from './PortDatabase.js?v=7';

const NIVEL = {
    normal: { txt: 'Normal', cls: 'bg-green-100 text-green-800' },
    atencao: { txt: 'Atenção', cls: 'bg-amber-100 text-amber-800' },
    restritivo: { txt: 'Restritivo', cls: 'bg-red-100 text-red-800' }
};
const n = (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const rosa = (v) => (v === null || v === undefined) ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(v / 45) % 8];
const hora = (ms) => { const d = new Date(ms), p = (x) => String(x).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const hhmm = (ms) => { const d = new Date(ms), p = (x) => String(x).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const BarraService = {
    _state: null,

    init: function (state) {
        this._state = state;
        const btn = document.getElementById('btn-barra-consultar');
        if (btn) btn.addEventListener('click', () => this.consultar());
        ['input-etd', 'inp-etd', 'select-dep', 'select-arr', 'inp-ship-speed'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this._desatualizar());
        });
    },

    /** [1] Pontos de saída e chegada a partir do estado do plano. */
    montarPontos: function () {
        const S = this._state || window.State;
        const v = (S && S.voyage) || {};
        // Porto: o da Avaliação (State.voyage) ou, se vazio, o do seletor do Planejamento.
        const val = (id) => ((document.getElementById(id) || {}).value || '');
        const depId = v.depPort || val('select-dep') || val('select-port-dep');
        const arrId = v.arrPort || val('select-arr') || val('select-port-arr');
        const dep = PortDatabase.find(p => p.id === depId);
        const arr = PortDatabase.find(p => p.id === arrId);
        if (!dep && !arr) throw new Error('Selecione o porto de partida e o de chegada.');
        const etdVal = (document.getElementById('input-etd') || {}).value;
        if (!etdVal) throw new Error('Informe a partida (ETD) no Planejamento.');
        const etd = new Date(etdVal).getTime();
        let vel = parseFloat(S.shipProfile && S.shipProfile.speed);
        if (isNaN(vel) || vel <= 0) vel = 10.0;

        // Rumos da 1ª e da última perna e distância total (se houver rota)
        const pts = (S && S.routePoints) || [];
        let rumoSaida = null, rumoChegada = null, dist = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const leg = NavMath.calcLeg(pts[i].lat, pts[i].lon, pts[i + 1].lat, pts[i + 1].lon);
            if (i === 0) rumoSaida = leg.crs;
            rumoChegada = leg.crs;
            dist += leg.dist;
        }
        const pontos = [];
        if (dep) pontos.push({ tipo: 'saida', porto: dep.name, lat: dep.lat, lon: dep.lon, t_ms: etd, rumo: rumoSaida, vel_kn: vel });
        if (arr && dist > 0) {
            pontos.push({ tipo: 'chegada', porto: arr.name, lat: arr.lat, lon: arr.lon, t_ms: etd + (dist / vel) * 3600000, rumo: rumoChegada, vel_kn: vel });
        }
        return { pontos, semRota: !(dist > 0) };
    },

    consultar: async function () {
        const btn = document.getElementById('btn-barra-consultar');
        const status = document.getElementById('sn-barra-status');
        let dados;
        try { dados = this.montarPontos(); } catch (e) { if (status) status.textContent = e.message; return; }
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando…'; }
        if (status) status.textContent = 'Consultando a barra…';
        try {
            const r = await fetch('api/marine/barra', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pontos: dados.pontos })
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.status !== 'ok') throw new Error(j.message || j.error || `Servidor respondeu ${r.status}`);
            const S = this._state || window.State;
            if (S) S.barra = j;
            this.render(j.pontos || []);
            if (status) {
                status.classList.remove('text-amber-700');
                status.textContent = `Consulta às ${hhmm(Date.now())}` + (dados.semRota ? ' · chegada: carregue a rota para calcular o ETA.' : '');
            }
        } catch (e) {
            if (status) status.textContent = `Não foi possível consultar a barra: ${e.message}`;
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
        }
    },

    _desatualizar: function () {
        const status = document.getElementById('sn-barra-status');
        const S = this._state || window.State;
        if (S && S.barra && status) {
            status.textContent = 'Portos, ETD ou velocidade mudaram: clique em "Consultar a barra" para atualizar.';
            status.classList.add('text-amber-700');
        }
    },

    /** Curva da maré em SVG: x = tempo (24 h), y = altura; linha vertical = ETD/ETA.
     *  Escala: y = alto − (h − hmin)/(hmax − hmin) · (alto − 2·margem) − margem. */
    _curva: function (mare, t_ms) {
        const c = (mare.curva || []).filter(p => p.h !== null && p.h !== undefined);
        if (c.length < 2) return '';
        const W = 560, H = 100, M = 14;   // largura ~ a do cartão no computador (sem achatar)
        const t0 = c[0].t_ms, t1 = c[c.length - 1].t_ms;
        const hs = c.map(p => p.h), hmin = Math.min(...hs), hmax = Math.max(...hs), dh = (hmax - hmin) || 1;
        const x = (t) => M + (t - t0) / (t1 - t0) * (W - 2 * M);
        const y = (h) => H - M - (h - hmin) / dh * (H - 2 * M);
        const path = c.map((p, i) => `${i ? 'L' : 'M'}${x(p.t_ms).toFixed(1)},${y(p.h).toFixed(1)}`).join(' ');
        const marcas = [mare.anterior, ...(mare.proximos || [])].filter(e => e && e.t_ms >= t0 && e.t_ms <= t1)
            .map(e => `<text x="${x(e.t_ms).toFixed(1)}" y="${e.tipo === 'PM' ? y(e.altura_m) - 3 : y(e.altura_m) + 11}" font-size="12" text-anchor="middle" fill="currentColor" opacity=".75">${e.tipo} ${hhmm(e.t_ms)}</text>`).join('');
        return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto max-h-32 text-slate-600" role="img" aria-label="Curva da maré em 24 horas">
            <path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="${x(t_ms).toFixed(1)}" x2="${x(t_ms).toFixed(1)}" y1="${M / 2}" y2="${H - M / 2}" stroke="rgb(var(--c-blue-600))" stroke-width="2" stroke-dasharray="4 3"/>
            ${marcas}</svg>`;
    },

    /** [2] Cartões de saída e chegada. */
    render: function (pontos) {
        const caixa = document.getElementById('sn-barra-cartoes');
        if (!caixa) return;
        caixa.innerHTML = pontos.map(p => {
            const titulo = p.tipo === 'saida' ? 'Saída' : 'Chegada';
            const quando = p.tipo === 'saida' ? 'ETD' : 'ETA';
            if (p.status === 'erro') return `<div class="sn-gauge"><span class="sn-lbl">${titulo} · ${esc(p.porto)}</span><p class="text-sm text-amber-700">${esc(p.message)}</p></div>`;
            if (p.status !== 'ok') return `<div class="sn-gauge"><span class="sn-lbl">${titulo} · ${esc(p.porto)}</span><p class="text-sm text-slate-600">${quando} ${hora(p.t_ms)}: fora do horizonte da previsão (até 8 dias). Use a tábua da DHN.</p></div>`;
            const m = p.mare || {}, c = p.corrente || {}, v = p.vento || {}, o = p.onda || {}, s = p.swell || {};
            const nv = NIVEL[p.nivel] || NIVEL.normal;
            const est = p.estacao;
            const tend = m.tendencia === 'enchente' ? '↑ enchente' : (m.tendencia === 'vazante' ? '↓ vazante' : '≈ estofo');
            const prox = (m.proximos || []).map(e => `${e.tipo} ${hhmm(e.t_ms)} · ${n(e.altura_m, 2)} m`).join(' &nbsp;|&nbsp; ');
            const longi = c.long_kn === undefined ? '' : (Math.abs(c.long_kn) < 0.05 ? '' : (c.long_kn > 0 ? ` · a favor ${n(c.long_kn)}` : ` · contra ${n(-c.long_kn)}`));
            const proa = v.de_proa_kn === undefined ? '' : (v.de_proa_kn > 0.5 ? ` · proa ${n(v.de_proa_kn, 0)}` : (v.de_proa_kn < -0.5 ? ` · popa ${n(-v.de_proa_kn, 0)}` : ' · través'));
            const pdf = est && est.pdf ? `<a class="sn-btn" href="${encodeURI(est.pdf)}" target="_blank" rel="noopener"><i class="fas fa-file-pdf"></i> Tábua DHN</a>` : '';
            return `
            <div class="sn-gauge gap-2">
                <div class="flex items-start justify-between gap-2 flex-wrap">
                    <div><span class="sn-lbl">${titulo} · ${quando} ${hora(p.t_ms)}</span>
                        <div class="font-bold text-slate-800">${esc(p.porto)}</div>
                        <div class="text-xs text-slate-500">${est ? `Estação DHN: ${esc(est.nome)} (${n(est.dist_km)} km) · carta ${esc(est.carta || '—')}` : 'Sem estação DHN a menos de 50 km: maré em relação ao nível médio.'}</div></div>
                    <span class="text-xs font-bold px-2 py-1 rounded ${nv.cls}">${nv.txt}</span>
                </div>
                <div class="flex items-baseline gap-3 flex-wrap">
                    <span class="sn-gauge-v">${n(m.altura_m, 2)} m</span>
                    <span class="font-semibold ${m.tendencia === 'vazante' ? 'text-amber-700' : 'text-slate-700'}">${tend} ${m.taxa_cm_h !== null && m.taxa_cm_h !== undefined ? `(${n(Math.abs(m.taxa_cm_h), 0)} cm/h)` : ''}</span>
                </div>
                ${this._curva(m, p.t_ms)}
                <div class="text-xs font-mono text-slate-600">${m.anterior ? `antes: ${m.anterior.tipo} ${hhmm(m.anterior.t_ms)} · ${n(m.anterior.altura_m, 2)} m &nbsp;|&nbsp; ` : ''}${prox}</div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div><span class="sn-lbl">Corrente</span><div class="font-mono">${n(c.kn)} kn → ${rosa(c.dir_para)}${longi}</div></div>
                    <div><span class="sn-lbl">Vento 10 m</span><div class="font-mono">${n(v.kn, 0)} kn (raj. ${n(v.rajada_kn, 0)}) de ${rosa(v.dir_de)}${proa}</div></div>
                    <div><span class="sn-lbl">Onda / swell</span><div class="font-mono">${n(o.hs_m)} m · ${n(o.periodo_s, 0)} s de ${rosa(o.dir_de)}${o.setor ? ' · ' + o.setor : ''}<br>${n(s.h_m)} m · ${n(s.periodo_s, 0)} s de ${rosa(s.dir_de)}</div></div>
                </div>
                <div class="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
                    <span>Maré estimada por modelo: ±20 cm e ±1 h. Referência: ${esc(m.referencia || '')}.</span>${pdf}
                </div>
            </div>`;
        }).join('');
        document.getElementById('sn-barra-resultado').classList.remove('hidden');
    }
};

export default BarraService;
