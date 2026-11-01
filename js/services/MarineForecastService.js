/**
 * =============================================================================
 * SISNAV COSTEIRO - js/services/MarineForecastService.js (previsão do mar por perna)
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-10-30 23:05 (UTC-3)   Versão: 1.0 (v3.10.0)
 * -----------------------------------------------------------------------------
 * HISTÓRICO DE MODIFICAÇÕES
 *  1.1 (v3.13.0, 2026-11-01) - render() dispara o evento 'sisnav-condicoes' (mapa).
 *  1.0 (v3.10.0, 2026-10-30) - Arquivo NOVO (Etapa B):
 *   [1] Monta as pernas da rota carregada (State.routePoints): ponto médio,
 *       rumo, distância e INSTANTE em que o navio passa pelo meio da perna.
 *   [2] Consulta POST /api/marine/legs (servidor -> Open-Meteo, com cache).
 *   [3] Desenha o painel "Previsão do mar por perna" no Planejamento e guarda
 *       o resultado em State.marineForecast (usado no relatório PDF).
 * -----------------------------------------------------------------------------
 * FÓRMULAS (lado do navegador):
 *   Ponto médio ≈ ((lat1+lat2)/2, (lon1+lon2)/2). Para pernas costeiras
 *   (< 60 NM) o erro é de poucas centenas de metros, bem menor que a grade
 *   do modelo (~8 km) -> não compensa o cálculo esférico exato.
 *   Hora no meio da perna i:  t_i = ETD + (Σ dist_anteriores + dist_i / 2) / V
 *     ex.: ETD 06:00, pernas anteriores 30 NM, perna atual 20 NM, V = 10 kn
 *          -> t = 06:00 + (30 + 10) / 10 h = 10:00.
 * O ETA OFICIAL do plano não muda: a SOG corrigida pela corrente é informativa.
 * =============================================================================
 */
import NavMath from '../core/NavMath.js?v=10';

const NIVEL = {
    normal: { txt: 'Normal', cls: 'bg-green-100 text-green-800' },
    atencao: { txt: 'Atenção', cls: 'bg-amber-100 text-amber-800' },
    restritivo: { txt: 'Restritivo', cls: 'bg-red-100 text-red-800' }
};

const fmt = {
    n: (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }),
    graus: (v) => (v === null || v === undefined) ? '—' : String(Math.round(v) % 360).padStart(3, '0') + '°',
    hora: (ms) => {
        const d = new Date(ms), p = (x) => String(x).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    // Rosa de 8 pontos para leitura rápida: 0°=N, 45°=NE ...  índice = round(graus/45) mod 8
    rosa: (v) => (v === null || v === undefined) ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(v / 45) % 8]
};

const MarineForecastService = {
    _state: null,
    _calculadoPara: null,

    init: function (state) {
        this._state = state;
        const btn = document.getElementById('btn-mar-prever');
        if (btn) btn.addEventListener('click', () => this.prever());
        // ETD ou velocidade mudaram -> a previsão anterior deixa de valer.
        ['input-etd', 'inp-etd', 'inp-ship-speed'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.marcarDesatualizada());
        });
    },

    /** [1] Pernas a partir da rota + ETD + velocidade de cruzeiro. */
    montarPernas: function () {
        const S = this._state || window.State;
        const pts = (S && S.routePoints) || [];
        if (pts.length < 2) throw new Error('Carregue uma rota (GPX ou planejamento) antes de pedir a previsão.');
        const etdVal = (document.getElementById('input-etd') || {}).value;
        if (!etdVal) throw new Error('Informe a data e hora de partida (ETD) no Planejamento.');
        const etd = new Date(etdVal).getTime();
        let vel = parseFloat(S.shipProfile && S.shipProfile.speed);
        if (isNaN(vel) || vel <= 0) vel = 10.0;

        const pernas = [];
        let acumulado = 0; // NM até o início da perna
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const leg = NavMath.calcLeg(a.lat, a.lon, b.lat, b.lon);
            const meio = acumulado + leg.dist / 2;
            pernas.push({
                lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2,
                t_ms: etd + (meio / vel) * 3600 * 1000,
                rumo: leg.crs, dist_nm: leg.dist, vel_kn: vel
            });
            acumulado += leg.dist;
        }
        return { pernas, etd, vel };
    },

    /** [2] Consulta o servidor e desenha o painel. */
    prever: async function () {
        const btn = document.getElementById('btn-mar-prever');
        const status = document.getElementById('sn-mar-status');
        let dados;
        try {
            dados = this.montarPernas();
        } catch (e) {
            if (status) status.textContent = e.message;
            return;
        }
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando…'; }
        if (status) status.textContent = `Consultando ${dados.pernas.length} pernas…`;
        try {
            const r = await fetch('api/marine/legs', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pernas: dados.pernas })
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.status !== 'ok') throw new Error(j.message || j.error || `Servidor respondeu ${r.status}`);
            j.etd_ms = dados.etd; j.vel_kn = dados.vel;
            j.pernas.forEach((p, i) => { p.dist_nm = dados.pernas[i].dist_nm; });
            const S = this._state || window.State;
            if (S) S.marineForecast = j;
            this._calculadoPara = dados.etd;
            this.render(j);
        } catch (e) {
            if (status) status.textContent = `Não foi possível obter a previsão: ${e.message}`;
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
        }
    },

    marcarDesatualizada: function () {
        const status = document.getElementById('sn-mar-status');
        const S = this._state || window.State;
        if (S && S.marineForecast && status) {
            status.textContent = 'ETD ou velocidade mudaram: clique em "Prever o mar por perna" para atualizar.';
            status.classList.add('text-amber-700');
        }
    },

    /** [3] Painel: resumo + uma linha por perna. */
    render: function (j) {
        const corpo = document.getElementById('sn-mar-corpo');
        const resumo = document.getElementById('sn-mar-resumo');
        const status = document.getElementById('sn-mar-status');
        if (!corpo) return;
        const rs = j.resumo || {};
        const pior = NIVEL[rs.pior] || NIVEL.normal;
        const dh = rs.delta_corrente_h || 0;
        const dhTxt = Math.abs(dh) < 0.05 ? 'efeito desprezível' :
            `${dh > 0 ? '+' : '−'}${fmt.n(Math.abs(dh), 1)} h ${dh > 0 ? '(corrente contra)' : '(corrente a favor)'}`;
        resumo.innerHTML = `
            <div class="sn-gauge"><span class="sn-lbl">Pior condição</span><span class="sn-gauge-v"><span class="text-base px-2 py-1 rounded ${pior.cls}">${pior.txt}</span></span></div>
            <div class="sn-gauge"><span class="sn-lbl">Onda máx. (Hs)</span><span class="sn-gauge-v">${fmt.n(rs.hs_max_m)} m</span></div>
            <div class="sn-gauge"><span class="sn-lbl">Vento máx.</span><span class="sn-gauge-v">${fmt.n(rs.vento_max_kn, 0)} kn</span></div>
            <div class="sn-gauge"><span class="sn-lbl">Tempo pela corrente</span><span class="sn-gauge-v text-xl">${dhTxt}</span></div>`;

        corpo.innerHTML = '';
        (j.pernas || []).forEach(p => {
            const tr = document.createElement('tr');
            if (p.status !== 'ok') {
                tr.innerHTML = `<td class="p-2 text-center">${p.n}</td><td class="p-2 font-mono">${fmt.hora(p.t_ms)}</td>
                    <td class="p-2 text-slate-500 italic" colspan="5">Fora do horizonte de previsão (até 8 dias). Use a Meteoromarinha mais próxima da data.</td>`;
                corpo.appendChild(tr); return;
            }
            const o = p.onda || {}, s = p.swell || {}, v = p.vento || {}, c = p.corrente || {};
            const nv = NIVEL[p.nivel] || NIVEL.normal;
            const proa = v.de_proa_kn > 0.5 ? `proa ${fmt.n(v.de_proa_kn, 0)}` : (v.de_proa_kn < -0.5 ? `popa ${fmt.n(-v.de_proa_kn, 0)}` : 'través');
            const longTxt = c.long_kn === undefined ? '' : (Math.abs(c.long_kn) < 0.05 ? 'longit. ≈ 0' : (c.long_kn > 0 ? `a favor ${fmt.n(c.long_kn)}` : `contra ${fmt.n(-c.long_kn)}`));
            tr.innerHTML = `
                <td class="p-2 text-center">${p.n}</td>
                <td class="p-2 font-mono whitespace-nowrap">${fmt.hora(p.t_ms)}<div class="text-xs text-slate-500">rumo ${fmt.graus(p.rumo)}</div></td>
                <td class="p-2 font-mono whitespace-nowrap">${fmt.n(o.hs_m)} m · ${fmt.n(o.periodo_s, 0)} s<div class="text-xs text-slate-500">de ${fmt.rosa(o.dir_de)} · ${o.setor || ''}</div></td>
                <td class="p-2 font-mono whitespace-nowrap">${fmt.n(s.h_m)} m · ${fmt.n(s.periodo_s, 0)} s<div class="text-xs text-slate-500">de ${fmt.rosa(s.dir_de)} · ${s.setor || ''}</div></td>
                <td class="p-2 font-mono whitespace-nowrap">${fmt.n(v.kn, 0)} kn <span class="text-slate-500">(raj. ${fmt.n(v.rajada_kn, 0)})</span><div class="text-xs text-slate-500">de ${fmt.rosa(v.dir_de)} · ${proa}</div></td>
                <td class="p-2 font-mono whitespace-nowrap">${fmt.n(c.kn)} kn → ${fmt.rosa(c.dir_para)}<div class="text-xs text-slate-500">${longTxt} · abat. ${fmt.n(Math.abs(c.abatimento_graus || 0))}° ${c.transv_kn >= 0 ? 'BE' : 'BB'} · SOG ${fmt.n(c.sog_kn)}</div></td>
                <td class="p-2 text-center"><span class="text-xs font-bold px-2 py-1 rounded ${nv.cls}">${nv.txt}</span></td>`;
            corpo.appendChild(tr);
        });

        const emit = j.emitido_utc ? new Date(j.emitido_utc) : new Date();
        if (status) {
            status.classList.remove('text-amber-700');
            status.textContent = `Calculada para ETD ${fmt.hora(j.etd_ms)} a ${fmt.n(j.vel_kn)} kn · consulta ${fmt.hora(emit.getTime())}` +
                (rs.fora_horizonte ? ` · ${rs.fora_horizonte} perna(s) além de 8 dias` : '') + (j.cache ? ' · (cache)' : '');
        }
        const fonte = document.getElementById('sn-mar-fonte');
        if (fonte) fonte.textContent = j.fonte || '';
        document.getElementById('sn-mar-resultado').classList.remove('hidden');
        // v3.13.0: avisa o mapa (MapConditionsService) que há dados novos
        window.dispatchEvent(new CustomEvent('sisnav-condicoes'));
    }
};

export default MarineForecastService;
