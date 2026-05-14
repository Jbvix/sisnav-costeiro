/**
 * CHM / Sealagom — preenche Meteomarinha, Avisos de Mau Tempo e NAVAREA V
 * via POST /api/chm/fetch (token só no servidor).
 */

const CHMService = {

    init: function () {
        const btn = document.getElementById('btn-update-chm');
        if (btn) {
            btn.addEventListener('click', () => this.fetchAndPopulate({ silent: false }));
        }
    },

    /**
     * @param {{ silent?: boolean }} options — silent: sem alertas (preenchimento automático)
     */
    fetchAndPopulate: async function (options = {}) {
        const silent = options.silent === true;
        const btn = document.getElementById('btn-update-chm');
        const originalHtml = btn ? btn.innerHTML : '';

        try {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
                btn.disabled = true;
            }

            const dep = (window.State && window.State.voyage && window.State.voyage.depPort) || '';
            const arr = (window.State && window.State.voyage && window.State.voyage.arrPort) || '';

            const response = await fetch('/api/chm/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ depPort: dep, arrPort: arr })
            });

            const result = await response.json().catch(() => ({}));

            if (result.status === 'success' && result.data) {
                this.populateFields(result.data);
                if (!silent) {
                    alert('Dados atualizados (CHM + Sealagom).');
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
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
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
