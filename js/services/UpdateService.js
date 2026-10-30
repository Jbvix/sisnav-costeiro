/**
 * ARQUIVO: UpdateService.js
 * MÓDULO: Serviço de Atualização On-Demand
 * DESCRIÇÃO: Comunica com backend Python (Flask) para renovar dados CSV.
 */

const UpdateService = {

    isUpdating: false,

    /**
     * Inicia o processo de atualização
     * @param {Function} onProgress - Callback (text, percent)
     * @param {Function} onComplete - Callback (success)
     */
    triggerUpdate: function (onProgress, onComplete) {
        if (this.isUpdating) return;
        this.isUpdating = true;

        console.log("UpdateService: Conectando ao servidor...");
        onProgress("Conectando...", 0);

        // v3.6.0-cloud (2026-10-29): removido o EventSource órfão (GET) que era
        // aberto aqui e nunca usado - gerava requisição inútil com erro 405.
        // O progresso vem do fetch em streaming abaixo (POST + ReadableStream).
        this.runFetchStream(onProgress, onComplete);
    },

    runFetchStream: async function (onProgress, onComplete) {
        try {
            const response = await fetch('/api/update-data', {
                method: 'POST',
                headers: { // v3.5.0-sec: envia o convite da sessão (validado no servidor)
                    'Content-Type': 'application/json',
                    'X-Invite-Token': ((JSON.parse(sessionStorage.getItem('sisnav_session_v1') || '{}')).token || ''),
                    'X-Admin-Key': (sessionStorage.getItem('sisnav_admin_key') || '')
                },
                body: JSON.stringify({ mode: 'full' })
            });

            if (!response.ok) throw new Error("Erro na conexão com servidor");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Parse "data: {...}" lines
                const lines = chunk.split('\n\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.replace('data: ', ''));
                            if (json.status) onProgress(json.status, json.progress);
                            if (json.error) throw new Error(json.status);
                            if (json.progress === 100) {
                                this.isUpdating = false;
                                onComplete(true);
                                return;
                            }
                        } catch (e) {
                            // Ignore parse errors on partial chunks
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Update Failed:", error);
            onProgress(`Erro: ${error.message}`, 0);
            this.isUpdating = false;
            onComplete(false);
        }
    }
};

export default UpdateService;
