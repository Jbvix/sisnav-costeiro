/**
 * ARQUIVO: CHMService.js
 * DESCRIÇÃO: Serviço para gerenciar a automação de dados do CHM (Meteo, Mau Tempo, Navarea)
 */

const CHMService = {

    // Regiões e seus estados/portos principais (simplificado para lógica de rota)
    regions: {
        norte: ['ITAQUI', 'SAO LUIS', 'SÃO LUÍS', 'TUTOIA', 'FORTALEZA', 'MUCURIPE', 'PECEM', 'AREIA BRANCA', 'MACAU', 'GUAMARE', 'NATAL', 'BELEM', 'VILA DO CONDE', 'MACAPA'],
        leste: ['NATAL', 'CABEDELO', 'RECIFE', 'SUAPE', 'MACEIO', 'MACEIÓ', 'ARACAJU', 'SALVADOR', 'ARATU', 'ILHEUS', 'VITORIA', 'VITÓRIA', 'TUBARAO', 'PORTOCEL'],
        sul: ['RIO DE JANEIRO', 'NITEROI', 'SEPETIBA', 'ANGRA', 'SANTOS', 'SAO SEBASTIAO', 'PARANAGUA', 'ANTONINA', 'SAO FRANCISCO', 'ITAJAI', 'NAVEGANTES', 'IMBITUBA', 'RIO GRANDE', 'PORTO ALEGRE', 'TRAMANDAI']
    },

    init: function () {
        const btnUpdate = document.getElementById('btn-update-chm');
        if (btnUpdate) {
            btnUpdate.addEventListener('click', () => this.fetchAndPopulate());
        }
    },

    fetchAndPopulate: async function () {
        const btn = document.getElementById('btn-update-chm');
        const originalText = btn.innerHTML;

        try {
            // UI Loading State
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando dados... (Aguarde)';
            btn.disabled = true;

            // Call Backend
            const response = await fetch('/api/chm/fetch', { method: 'POST' });
            const result = await response.json();

            if (result.status === 'success' && result.data) {
                this.populateFields(result.data);
                alert('✅ Dados CHM atualizados com sucesso!');
            } else {
                throw new Error(result.message || 'Erro desconhecido');
            }

        } catch (error) {
            console.error('CHM Error:', error);
            alert('Erro ao buscar dados CHM: ' + error.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    populateFields: function (data) {
        // 1. Meteomarinha (Direct Fill)
        const txtMeteo = document.getElementById('txt-meteo-content');
        if (txtMeteo && data.meteo) {
            txtMeteo.value = data.meteo;
            // Trigger change event if needed for state binding
            txtMeteo.dispatchEvent(new Event('input'));
        }

        // 2. Mau Tempo (Direct Fill)
        const txtMauTempo = document.getElementById('txt-bad-weather-content');
        if (txtMauTempo && data.mau_tempo) {
            txtMauTempo.value = data.mau_tempo;
            txtMauTempo.dispatchEvent(new Event('input')); // Changed to 'input' to trigger bindLink
        }

        // 3. Navarea (Smart Combination)
        const txtNavarea = document.getElementById('txt-navarea-content');
        if (txtNavarea && data.navarea) {
            const combinedText = this.combineNavareaText(data.navarea);
            txtNavarea.value = combinedText;
            txtNavarea.dispatchEvent(new Event('input'));
        }
    },

    combineNavareaText: function (navData) {
        // Get Ports from State (assuming global State object or DOM)
        const depPort = (window.State && window.State.voyage && window.State.voyage.depPort) ? window.State.voyage.depPort.toUpperCase() : '';
        const arrPort = (window.State && window.State.voyage && window.State.voyage.arrPort) ? window.State.voyage.arrPort.toUpperCase() : '';

        console.log(`CHM: Combinando Navarea para rota ${depPort} -> ${arrPort}`);

        const necessaryRegions = new Set();

        // Determine Regions for Departure
        this.getRegionsForPort(depPort).forEach(r => necessaryRegions.add(r));
        // Determine Regions for Arrival
        this.getRegionsForPort(arrPort).forEach(r => necessaryRegions.add(r));

        // Default to all if no ports defined or unknown
        if (necessaryRegions.size === 0) {
            necessaryRegions.add('norte');
            necessaryRegions.add('leste');
            necessaryRegions.add('sul');
        }

        let combined = "";
        const timestamp = new Date().toLocaleString('pt-BR');
        combined += `DADOS NAVAREA COMBINADOS - ${timestamp}\n`;
        combined += `ROTA CONSIDERADA: ${depPort || '?'} -> ${arrPort || '?'}\n`;
        combined += `=================================================\n\n`;

        // Order: Norte -> Leste -> Sul
        const order = ['norte', 'leste', 'sul'];

        order.forEach(region => {
            if (necessaryRegions.has(region) && navData[region]) {
                combined += `>>> AVISOS RÁDIO - REGIÃO ${region.toUpperCase()} <<<\n`;
                combined += `-------------------------------------------------\n`;
                combined += navData[region];
                combined += `\n\n`;
            }
        });

        return combined;
    },

    getRegionsForPort: function (portName) {
        if (!portName) return [];
        const matches = [];

        // Normalize
        const cleanName = portName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        for (const [region, ports] of Object.entries(this.regions)) {
            // Check if any port in list matches the input port string
            const found = ports.some(p => cleanName.includes(p));
            if (found) matches.push(region);
        }

        // Fallback Logic based on Latitude if possible (Requires coordinates which we might have in State)
        // For now, text matching is safer given the inputs.

        return matches;
    }
};

export default CHMService;
