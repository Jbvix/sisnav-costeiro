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

        const eventSource = new EventSource('/api/update-data', {
            method: 'POST' // EventSource is usually GET, check browser support. 
            // Native EventSource is GET only. 
            // For POST, we might need 'fetch' with reader, 
            // BUT server.py implements GET for SSE usually? 
            // Flask route is POST. Wait. EventSource doesn't support POST.
            // I will change server.py to GET or use fetch stream.
        });

        // ERROR: EventSource DOES NOT support POST args in standard API.
        // Changing strategy: Use FETCH with ReadableStream

        this.runFetchStream(onProgress, onComplete);
    },

    runFetchStream: async function (onProgress, onComplete) {
        try {
            const response = await fetch('/api/update-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
