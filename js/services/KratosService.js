/**
 * KRATOS — assistente náutico (xAI via servidor).
 * Contexto: State, derrota, faróis, combustível, textos CHM/Sealagom do Appraisal.
 */

import State from '../core/State.js?v=8';
import NavMath from '../core/NavMath.js?v=10';
import AuthService from './AuthService.js?v=Hotfix4';

const KratosService = {
    _messages: [],
    _panelOpen: false,

    _esc: function (s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    _formatAssistantHtml: function (text) {
        return this._esc(text).replace(/\n/g, '<br>');
    },

    _truncate: function (s, max) {
        if (!s || typeof s !== 'string') return '';
        return s.length <= max ? s : s.slice(0, max) + '\n… (truncado)';
    },

    /**
     * Dados de formulário (Appraisal / planeamento) alinhados às competências do assistente.
     */
    _buildFormularioAssistencia: function () {
        const appraisal = State.appraisal || {};
        const ship = State.shipProfile || {};
        const voyage = State.voyage || {};
        const eng = appraisal.engine || {};
        const engObs = String(eng.observations || eng.obs || '').trim();
        const comm = appraisal.communications || {};

        let chkDomTotal = 0;
        let chkDomOk = 0;
        try {
            document.querySelectorAll('.engine-check').forEach((el) => {
                chkDomTotal++;
                if (el.checked) chkDomOk++;
            });
        } catch (_) { /* ignore */ }

        const towSel = document.getElementById('select-tow-config');
        const towLabel = towSel && towSel.selectedOptions[0]
            ? towSel.selectedOptions[0].text.trim()
            : '';

        const contacts = (appraisal.shoreContacts || []).slice(0, 12).map((c) => ({
            nome: (c && c.name) ? String(c.name).slice(0, 80) : '',
            telefone: (c && c.phone) ? String(c.phone).slice(0, 40) : '',
            email: (c && c.email) ? String(c.email).slice(0, 80) : ''
        }));

        return {
            checklistAppraisalAprovado: appraisal.isValid === true,
            portosPlaneamentoIds: {
                partidaAppraisalOuPlaneamento: voyage.depPort || null,
                chegadaAppraisalOuPlaneamento: voyage.arrPort || null
            },
            embarcacaoFormulario: {
                comandante: ship.commander || '',
                filial: ship.branch || '',
                tripulacaoPlaneada: ship.crew != null ? Number(ship.crew) : null,
                caladoPopaM: ship.draft?.aft,
                caladoProaM: ship.draft?.fwd,
                velocidadeRebocoKn: ship.towSpeed != null ? Number(ship.towSpeed) : null,
                configuracaoRebocadorTexto: towLabel || null
            },
            praçaMaquinas: {
                statusMotor: eng.status || 'pending',
                checklistMarcadosNoDom: chkDomOk,
                checklistItensNoDom: chkDomTotal,
                observacoes: this._truncate(engObs, 2000)
            },
            comunicacoesCosteiras: {
                estacaoOuFrequencia: comm.station || '',
                canal: comm.channel || ''
            },
            impressoesAppraisal: Array.isArray(appraisal.prints) ? appraisal.prints.length : 0,
            contactosCosta: contacts
        };
    },

    /**
     * Observações em PT sobre o preenchimento (para o modelo comentar de forma consistente).
     */
    _buildFormComments: function (ctx) {
        const lines = [];
        const app = ctx.appraisal || {};
        const form = ctx.formularioAssistencia || {};
        const der = ctx.derrota || {};
        const comb = ctx.combustivelResumo || {};
        const port = ctx.portos || {};
        const cron = ctx.cronograma || {};

        if (form.checklistAppraisalAprovado) {
            lines.push('Checklist de Appraisal marcado como aprovado no sistema.');
        } else {
            lines.push('Checklist de Appraisal ainda não está aprovado — rever itens obrigatórios no SISNAV.');
        }

        const nCharts = (app.cartasSelecionadas && app.cartasSelecionadas.length) || 0;
        if (nCharts === 0) {
            lines.push('Nenhuma carta náutica selecionada no Appraisal.');
        } else {
            lines.push(`Cartas náuticas selecionadas: ${nCharts} (ver lista no JSON).`);
        }

        const nLh = (app.faroisSelecionados && app.faroisSelecionados.length) || 0;
        if (nLh === 0) {
            lines.push('Nenhum farol/auxílio listado no Appraisal — pode ser relevante para derrota costeira.');
        } else {
            lines.push(`Faróis/auxílios no Appraisal: ${nLh}.`);
        }

        const nSh = (app.abrigos && app.abrigos.length) || 0;
        lines.push(nSh === 0
            ? 'Nenhum abrigo/emergência listado no Appraisal.'
            : `Abrigos listados: ${nSh}.`);

        const st = (form.praçaMaquinas && form.praçaMaquinas.statusMotor) || 'pending';
        const chkT = form.praçaMaquinas?.checklistItensNoDom || 0;
        const chkOk = form.praçaMaquinas?.checklistMarcadosNoDom || 0;
        if (st === 'no-go') {
            lines.push('Motor / praça de máquinas: status NO-GO — itens críticos de segurança não conformes.');
        } else if (st === 'restricted') {
            lines.push('Motor / praça de máquinas: status RESTRITO — checklist incompleto ou itens pendentes.');
        } else if (st === 'ok') {
            lines.push('Motor / praça de máquinas: status OK (checklist completo conforme regras do app).');
        } else if (chkT === 0) {
            lines.push('Checklist de máquinas ainda não gravado na UI (modal).');
        } else {
            lines.push(`Checklist de máquinas: ${chkOk}/${chkT} itens marcados no formulário; rever antes de navegar.`);
        }

        if ((der.numeroWps || 0) === 0) {
            lines.push('Sem waypoints na derrota — importar GPX ou gerar rota.');
        } else {
            lines.push(`Derrota com ${der.numeroWps} waypoint(s).`);
        }

        if (!cron.etd) {
            lines.push('ETD não definido — ETAs por perna ficam só relativas (sem âncora temporal).');
        }

        if (!port.partidaId || !port.chegadaId) {
            lines.push('Portos de partida e/ou chegada (planeamento principal) ainda não selecionados.');
        }

        const saldo = comb.saldoChegadaEstimadoL;
        if (typeof saldo === 'number' && saldo < 0) {
            lines.push('Saldo estimado de combustível à chegada é negativo — rever velocidade, consumo ou stock.');
        }

        const meteoChars = (app.meteomarinhaTexto || '').length;
        const navChars = (app.navareaTexto || '').length;
        if (meteoChars === 0) {
            lines.push('Área Meteomarinha / texto de meteorologia vazio — preencher ou colar boletim.');
        } else {
            lines.push(`Texto Meteomarinha presente (~${meteoChars} caracteres no contexto).`);
        }
        if (navChars === 0) {
            lines.push('Texto NAVAREA / avisos (área Sealagom) vazio — integrar CHM quando aplicável.');
        } else {
            lines.push(`Texto NAVAREA/avisos presente (~${navChars} caracteres no contexto).`);
        }

        const mauLen = (app.mauTempoTexto || '').length;
        if (mauLen === 0 && (der.numeroWps || 0) > 0) {
            lines.push('Campo «mau tempo / contingência» (texto) vazio — útil documentar decisão.');
        } else if (mauLen > 0) {
            lines.push('Texto de mau tempo / contingência preenchido (ver appraisal no JSON).');
        }

        if (!(app.meteoLink || '').trim() && !(app.navareaLink || '').trim()) {
            lines.push('Links externos Meteo/NAVAREA opcionais ainda vazios.');
        }

        const nCont = (form.contactosCosta && form.contactosCosta.length) || 0;
        lines.push(nCont === 0
            ? 'Sem contactos de praia/porto cadastrados no Appraisal.'
            : `Contactos costeiros cadastrados: ${nCont}.`);

        const est = (form.comunicacoesCosteiras && form.comunicacoesCosteiras.estacaoOuFrequencia) || '';
        if (!String(est).trim()) {
            lines.push('Estação costeira de trabalho ainda não indicada no planeamento.');
        } else {
            lines.push('Estação costeira de trabalho indicada (ver JSON).');
        }

        if (!(form.embarcacaoFormulario && String(form.embarcacaoFormulario.comandante || '').trim())) {
            lines.push('Nome do comandante em branco no perfil da embarcação.');
        }

        return lines.slice(0, 22);
    },

    /**
     * Resumo da derrota, ETAs por WP, combustível por perna, referência de farol.
     */
    buildVoyageContext: function () {
        const depSel = document.getElementById('select-dep');
        const arrSel = document.getElementById('select-arr');
        const depLabel = depSel && depSel.selectedOptions[0] ? depSel.selectedOptions[0].text : '';
        const arrLabel = arrSel && arrSel.selectedOptions[0] ? arrSel.selectedOptions[0].text : '';

        const sogEl = document.getElementById('stat-live-sog');
        const cogEl = document.getElementById('stat-live-cog');
        const liveSog = sogEl ? sogEl.innerText.replace(/\s+/g, ' ').trim() : '';
        const liveCog = cogEl ? cogEl.innerText.trim() : '';

        const fr = document.getElementById('stat-fuel-required');
        const rob = document.getElementById('stat-fuel-rob');
        const wx = document.getElementById('weather-status-display');

        const pts = State.routePoints || [];
        const speed = parseFloat(State.shipProfile?.speed) || 10;
        const fuelRate = parseFloat(State.shipProfile?.fuelRate) || 0;
        const fuelStock = parseFloat(State.shipProfile?.fuelStock) || 0;

        const depMs = State.voyage?.depTime ? new Date(State.voyage.depTime).getTime() : NaN;
        const hasEtd = !isNaN(depMs);

        let cumNm = 0;
        let cumH = 0;
        const waypoints = [];

        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            let legNm = null;
            let fuelLegL = null;
            if (i > 0) {
                const prev = pts[i - 1];
                const leg = NavMath.calcLeg(prev.lat, prev.lon, p.lat, p.lon);
                legNm = Math.round(leg.dist * 100) / 100;
                cumNm += leg.dist;
                cumH += leg.dist / speed;
                fuelLegL = (leg.dist / speed) * fuelRate;
            }

            let etaIso = null;
            if (hasEtd) {
                etaIso = new Date(depMs + cumH * 3600000).toISOString();
            }

            let refFarol = null;
            if (window.App && typeof window.App.getNearestLighthouse === 'function') {
                const lh = window.App.getNearestLighthouse(p.lat, p.lon);
                if (lh) {
                    const rng = lh.range != null ? Number(lh.range) : null;
                    let nota = 'indeterminado';
                    if (rng != null && !isNaN(rng) && rng > 0) {
                        if (lh.dist <= rng) nota = 'distância ≤ alcance declarado (geométrico; meteorologia não modelada)';
                        else if (lh.dist <= rng * 1.25) nota = 'marginal vs alcance declarado';
                        else nota = 'fora do alcance declarado (geométrico)';
                    }
                    refFarol = {
                        nome: lh.name,
                        distanciaNm: Math.round(lh.dist * 10) / 10,
                        alcanceNmDeclarado: rng,
                        notaVisibilidade: nota
                    };
                }
            }

            waypoints.push({
                wp: i + 1,
                nomeGpxOuRota: p.name || '',
                lat: p.lat,
                lon: p.lon,
                pernaMilhas: legNm,
                distanciaAcumuladaNm: Math.round(cumNm * 10) / 10,
                tempoAcumuladoHoras: Math.round(cumH * 1000) / 1000,
                etaUtc: etaIso,
                combustivelPernaLitros: fuelLegL != null ? Math.round(fuelLegL) : null
            });
            if (refFarol) {
                waypoints[waypoints.length - 1].referenciaFarolMaisProximo = refFarol;
            }
        }

        const totalFuelL = cumH * fuelRate;

        const appraisal = State.appraisal || {};
        const ctx = {
            geradoEm: new Date().toISOString(),
            sealagomDocumentacao: 'https://www.sealagom.com/api/docs/',
            notaFontes: 'NAVAREA V e avisos costeiros costumam ser integrados via botão CHM/Sealagom no Appraisal (token no servidor).',
            portos: { partidaId: depSel?.value || null, partidaNome: depLabel, chegadaId: arrSel?.value || null, chegadaNome: arrLabel },
            embarcacao: {
                nome: State.shipProfile?.name,
                imo: State.shipProfile?.imo,
                velocidadePlaneadaKn: speed,
                consumoLPorH: fuelRate,
                stockInicialL: fuelStock
            },
            navegacaoAoVivo: { sogDisplay: liveSog || null, cogDisplay: liveCog || null },
            cronograma: {
                etd: State.voyage?.depTime || null,
                etaPlaneada: State.voyage?.arrTime || null
            },
            derrota: {
                origemGeometria: State.routeSource || null,
                numeroWps: pts.length,
                waypoints
            },
            combustivelResumo: {
                consumoTotalEstimadoL: Math.round(totalFuelL),
                saldoChegadaEstimadoL: Math.round(fuelStock - totalFuelL),
                textoDashboardNecessario: fr ? fr.innerText.trim() : null,
                textoDashboardRob: rob ? rob.innerText.trim() : null
            },
            appraisal: {
                cartasSelecionadas: (appraisal.selectedCharts || []).slice(0, 40),
                faroisSelecionados: (appraisal.lighthouses || []).slice(0, 40),
                abrigos: (appraisal.shelters || []).slice(0, 30),
                meteoLink: appraisal.meteoLink || '',
                navareaLink: appraisal.navareaLink || '',
                meteomarinhaTexto: this._truncate(appraisal.meteoText || '', 6000),
                navareaTexto: this._truncate(appraisal.navareaText || '', 6000),
                mauTempoTexto: this._truncate(appraisal.badWeatherText || '', 8000)
            },
            indicadorCsvClima: wx ? wx.innerText.trim() : null
        };
        ctx.formularioAssistencia = this._buildFormularioAssistencia();
        ctx.comentariosSobreFormulario = this._buildFormComments(ctx);
        return ctx;
    },

    _appendBubble: function (role, htmlBody) {
        const box = document.getElementById('kratos-messages');
        if (!box) return;
        const wrap = document.createElement('div');
        wrap.className = role === 'user'
            ? 'ml-8 rounded-lg px-3 py-2 bg-slate-800 text-slate-100 border border-slate-600'
            : 'mr-6 rounded-lg px-3 py-2 bg-slate-900 text-slate-100 border border-cyan-900';
        const label = document.createElement('div');
        label.className = 'text-[9px] uppercase font-bold mb-1 ' + (role === 'user' ? 'text-slate-400' : 'text-cyan-500');
        label.textContent = role === 'user' ? 'Você' : 'KRATOS';
        const body = document.createElement('div');
        body.className = 'text-[13px] leading-relaxed text-slate-100';
        body.innerHTML = htmlBody;
        wrap.appendChild(label);
        wrap.appendChild(body);
        box.appendChild(wrap);
        box.scrollTop = box.scrollHeight;
    },

    _setLoading: function (on) {
        const btn = document.getElementById('kratos-send');
        const ta = document.getElementById('kratos-input');
        if (btn) {
            btn.disabled = on;
            btn.innerHTML = on ? '<i class="fas fa-circle-notch fa-spin"></i>' : 'Enviar';
        }
        if (ta) ta.disabled = on;
    },

    _showThinking: function () {
        const ind = document.getElementById('kratos-dock-thinking');
        if (ind) {
            ind.classList.remove('hidden');
            ind.classList.add('inline-flex');
        }
        const rob = document.getElementById('kratos-robot-icon');
        if (rob) {
            rob.classList.add('animate-pulse', 'text-cyan-200');
        }
        const box = document.getElementById('kratos-messages');
        if (!box || document.getElementById('kratos-thinking-row')) return;
        const wrap = document.createElement('div');
        wrap.id = 'kratos-thinking-row';
        wrap.className = 'mr-6 rounded-lg px-3 py-3 bg-slate-900/90 text-slate-200 border border-cyan-800/40 flex items-center gap-3';
        wrap.innerHTML = `
            <span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-950 border border-cyan-700/50">
                <i class="fas fa-brain text-lg text-cyan-300 animate-pulse"></i>
                <i class="fas fa-circle-notch fa-spin absolute text-cyan-500/80 text-xs -bottom-0.5 -right-0.5"></i>
            </span>
            <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-[10px] uppercase font-bold text-cyan-500 tracking-wide">KRATOS</span>
                <span class="text-xs text-slate-300">A processar a base local${document.getElementById('kratos-web-validate')?.checked ? ' e validação Web' : ''}…</span>
            </div>`;
        box.appendChild(wrap);
        box.scrollTop = box.scrollHeight;
    },

    _hideThinking: function () {
        const ind = document.getElementById('kratos-dock-thinking');
        if (ind) {
            ind.classList.add('hidden');
            ind.classList.remove('inline-flex');
        }
        const rob = document.getElementById('kratos-robot-icon');
        if (rob) {
            rob.classList.remove('animate-pulse', 'text-cyan-200');
        }
        document.getElementById('kratos-thinking-row')?.remove();
    },

    refreshStatus: async function () {
        const line = document.getElementById('kratos-status-line');
        if (!line) return;
        try {
            const r = await fetch('/api/kratos/status');
            const j = await r.json();
            if (j.configured) {
                const pdf = typeof j.libraryPdfCount === 'number' ? `${j.libraryPdfCount} PDF(s) em library/` : '';
                const py = j.pypdfInstalled === false ? ' · sem pypdf' : '';
                line.textContent = `Modelo: ${j.model || 'grok'} · Chave OK${pdf ? ' · ' + pdf : ''}${py}`;
                line.className = 'px-3 py-1 text-[10px] text-emerald-600/90 border-b border-slate-800 font-mono';
            } else {
                line.textContent = 'Servidor sem XAI_API_KEY — respostas desativadas até configurar o ambiente.';
                line.className = 'px-3 py-1 text-[10px] text-amber-400 border-b border-slate-800 font-mono';
            }
        } catch {
            line.textContent = 'Não foi possível contactar /api/kratos/status (servidor Flask ativo?)';
            line.className = 'px-3 py-1 text-[10px] text-red-400 border-b border-slate-800 font-mono';
        }
    },

    send: async function () {
        const ta = document.getElementById('kratos-input');
        if (!ta) return;
        const text = ta.value.trim();
        if (!text) return;

        ta.value = '';
        this._messages.push({ role: 'user', content: text });
        this._appendBubble('user', this._formatAssistantHtml(text));
        this._setLoading(true);
        this._showThinking();

        try {
            const voyageContext = this.buildVoyageContext();
            const webVal = !!document.getElementById('kratos-web-validate')?.checked;
            const r = await fetch('/api/kratos/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: this._messages,
                    voyageContext,
                    webValidation: webVal
                })
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
                const err = j.error || r.statusText;
                this._appendBubble('assistant', this._formatAssistantHtml('Erro: ' + err + (j.detail ? '\n' + j.detail : '')));
                this._messages.pop();
                return;
            }
            const reply = j.reply || '';
            this._messages.push({ role: 'assistant', content: reply });
            this._appendBubble('assistant', this._formatAssistantHtml(reply));
        } catch (e) {
            this._appendBubble('assistant', this._formatAssistantHtml('Falha de rede: ' + (e.message || String(e))));
            this._messages.pop();
        } finally {
            this._hideThinking();
            this._setLoading(false);
        }
    },

    togglePanel: function () {
        const panel = document.getElementById('kratos-panel');
        const chev = document.getElementById('kratos-chevron');
        if (!panel) return;
        this._panelOpen = !this._panelOpen;
        panel.classList.toggle('hidden', !this._panelOpen);
        if (chev) {
            chev.innerHTML = this._panelOpen
                ? '<i class="fas fa-chevron-down"></i>'
                : '<i class="fas fa-chevron-up"></i>';
        }
        if (this._panelOpen) this.refreshStatus();
    },

    showDock: function () {
        const dock = document.getElementById('kratos-dock');
        if (dock) dock.classList.remove('hidden');
    },

    init: function () {
        const dock = document.getElementById('kratos-dock');
        const toggle = document.getElementById('kratos-toggle');
        const send = document.getElementById('kratos-send');
        const ta = document.getElementById('kratos-input');
        const btnStart = document.getElementById('btn-start-app');

        if (btnStart && dock) {
            btnStart.addEventListener('click', () => {
                setTimeout(() => this.showDock(), 650);
            });
        }
        if (!this._coverDismissListenerRegistered) {
            this._coverDismissListenerRegistered = true;
            window.addEventListener('sisnav-cover-dismissed', () => this.showDock());
        }

        const urlParams = new URLSearchParams(window.location.search);
        const monitorUrl = urlParams.get('mode') === 'monitor';
        let monitorSession = false;
        try {
            const sess = AuthService.getSession && AuthService.getSession();
            if (sess && sess.type === 'monitor') monitorSession = true;
        } catch (_) { /* ignore */ }

        const cover = document.getElementById('view-cover');
        let coverAlreadyGone = false;
        if (cover) {
            coverAlreadyGone = cover.style.display === 'none'
                || window.getComputedStyle(cover).display === 'none';
        }

        if (monitorUrl || monitorSession || coverAlreadyGone) {
            this.showDock();
        }

        if (toggle) {
            toggle.addEventListener('click', () => this.togglePanel());
        }
        if (send) {
            send.addEventListener('click', () => this.send());
        }
        if (ta) {
            ta.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault();
                    this.send();
                }
            });
        }

        const box = document.getElementById('kratos-messages');
        if (box && !box.dataset.seeded) {
            box.dataset.seeded = '1';
            this._appendBubble('assistant', this._formatAssistantHtml(
                'Olá. Sou KRATOS, assistente náutico (xAI). Tenho acesso ao contexto da sua derrota no SISNAV, '
                + 'aos dados que preencher no Appraisal e no planeamento (enviados em cada mensagem), '
                + 'à documentação em library/docs/kratos_instructions.md, aos PDF em library/ (texto extraído no servidor) '
                + 'e, se ativar «Base + validação Web», a um resumo DuckDuckGo para cruzar factos gerais. '
                + 'Nas respostas, comento o que estiver preenchido e o que faltar, nas áreas da minha competência. '
                + 'Enquanto processa, verá o ícone dinâmico na barra. A decisão final é sempre do comandante.'
            ));
        }
    }
};

export default KratosService;
