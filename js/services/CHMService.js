/**
 * CHM / Sealagom — preenche Meteomarinha, Avisos de Mau Tempo e NAVAREA V
 * via POST /api/chm/fetch (token só no servidor).
 */

import ProgressOverlay from '../utils/ProgressOverlay.js?v=1';

const CHMService = {

    init: function () {
        const handler = () => this.fetchAndPopulate({ silent: false });
        document.querySelectorAll('.btn-chm-autofill').forEach((btn) => {
            btn.addEventListener('click', handler);
        });
    },

    /**
     * @param {{ silent?: boolean }} options — silent: sem alertas (preenchimento automático)
     */
    fetchAndPopulate: async function (options = {}) {
        const silent = options.silent === true;
        const buttons = Array.from(document.querySelectorAll('.btn-chm-autofill'));
        const originals = buttons.map((b) => b.innerHTML);

        try {
            buttons.forEach((b) => {
                b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
                b.disabled = true;
            });

            if (!silent) {
                ProgressOverlay.show(
                    'CHM e Sealagom',
                    'A preparar pedido ao servidor…',
                    5
                );
            }

            const dep = (window.State && window.State.voyage && window.State.voyage.depPort) || '';
            const arr = (window.State && window.State.voyage && window.State.voyage.arrPort) || '';

            if (!silent) {
                ProgressOverlay.setProgress(18, 'CHM e Sealagom', 'A obter Meteomarinha, avisos e NAVAREA (pode demorar)…');
            }

            const response = await fetch('/api/chm/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ depPort: dep, arrPort: arr })
            });

            if (!silent) {
                ProgressOverlay.setProgress(72, 'CHM e Sealagom', 'A processar resposta do servidor…');
            }

            const result = await response.json().catch(() => ({}));

            if (!silent) {
                ProgressOverlay.setProgress(88, 'CHM e Sealagom', 'A preencher campos no formulário…');
            }

            if ((result.status === 'success' || result.status === 'partial') && result.data) {
                this.populateFields(result.data);
                if (result.status === 'partial' && result.warnings && result.warnings.length) {
                    if (silent) {
                        console.warn('CHM/Sealagom (parcial):', result.warnings.join(' | '));
                    }
                }
                if (!silent) {
                    const extra = (result.warnings && result.warnings.length)
                        ? '\n\nAvisos:\n' + result.warnings.join('\n')
                        : '';
                    alert(
                        result.status === 'partial'
                            ? ('Dados atualizados com ressalvas (CHM + Sealagom).' + extra)
                            : ('Dados atualizados (CHM + Sealagom).' + extra)
                    );
                }
            } else {
                const msg = result.message || result.error || `HTTP ${response.status}`;
                throw new Error(msg);
            }
        } catch (error) {
            console.error('CHM/Sealagom:', error);
            if (!silent) {
                alert('Erro ao buscar dados: ' + error.message);
            }
        } finally {
            if (!silent) {
                ProgressOverlay.setProgress(100, 'CHM e Sealagom', 'Concluído.');
                ProgressOverlay.hide(420);
            }
            buttons.forEach((b, i) => {
                b.innerHTML = originals[i] || b.innerHTML;
                b.disabled = false;
            });
        }
    },

    populateFields: function (data) {
        const txtMeteo = document.getElementById('txt-meteo-content');
        if (txtMeteo && data.meteo) {
            txtMeteo.value = data.meteo;
            txtMeteo.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const txtMauTempo = document.getElementById('txt-bad-weather-content');
        if (txtMauTempo && data.mau_tempo) {
            txtMauTempo.value = data.mau_tempo;
            txtMauTempo.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const txtNavarea = document.getElementById('txt-navarea-content');
        if (txtNavarea && data.navarea) {
            const combined = typeof data.navarea === 'string'
                ? data.navarea
                : this.combineNavareaText(data.navarea);
            txtNavarea.value = combined;
            txtNavarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    /** Compatibilidade com respostas antigas em formato objeto regional */
    combineNavareaText: function (navData) {
        if (!navData || typeof navData !== 'object') return '';
        const depPort = (window.State && window.State.voyage && window.State.voyage.depPort)
            ? window.State.voyage.depPort.toUpperCase() : '';
        const arrPort = (window.State && window.State.voyage && window.State.voyage.arrPort)
            ? window.State.voyage.arrPort.toUpperCase() : '';

        let combined = '';
        const timestamp = new Date().toLocaleString('pt-BR');
        combined += `DADOS NAVAREA — ${timestamp}\n`;
        combined += `ROTA: ${depPort || '?'} -> ${arrPort || '?'}\n`;
        combined += `${'='.repeat(50)}\n\n`;

        ['norte', 'leste', 'sul'].forEach((region) => {
            if (navData[region]) {
                combined += `>>> ${region.toUpperCase()} <<<\n${navData[region]}\n\n`;
            }
        });
        return combined.trim();
    }
};

export default CHMService;
