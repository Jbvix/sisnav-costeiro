/**
 * ARQUIVO: PersistenceService.js
 * MÓDULO: Serviço de Persistência (Salvar/Carregar Viagem)
 * AUTOR: Jossian Brito
 * DATA: 2025-12-25
 * VERSÃO: 1.0.0
 */

import State from '../core/State.js?v=2';
import UIManager from '../utils/UIManager.js?v=11';
import MapService from '../core/MapService.js?v=1';

const PersistenceService = {

    /**
     * Converte um objeto File para Base64 (Promise)
     */
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                content: reader.result
            });
            reader.onerror = error => reject(error);
        });
    },

    /**
     * Salvar Estado Atual para Arquivo .sisnav (JSON)
     */
    saveState: async function () {
        try {
            console.log("Persistence: Iniciando backup...");

            // 1. Clonar Estado (exceto objetos complexos como maps e layers)
            const backup = {
                metadata: {
                    version: "1.0",
                    timestamp: new Date().toISOString(),
                    type: "SISNAV_TRIP_PLAN"
                },
                voyage: State.voyage,         // Calculados
                shipProfile: State.shipProfile, // Inputs
                routePoints: State.routePoints, // GPX Data
                appraisal: { ...State.appraisal }, // Deep Copy needed for files handling
                weatherData: State.weatherData
            };

            // 2. Processar Arquivos (Converter para Base64)
            // State.appraisal.files = { meteo: File, navarea: File, tideDep: File, ... }
            const filesToProcess = [];
            const fileKeys = ['meteo', 'navarea', 'tideDep', 'tideArr'];

            // Preparar objeto serializável
            backup.appraisal.files = {};

            for (const key of fileKeys) {
                const fileObj = State.appraisal.files[key];
                if (fileObj instanceof File) {
                    // Adiciona na fila de processamento
                    filesToProcess.push(
                        this.fileToBase64(fileObj).then(base64 => {
                            backup.appraisal.files[key] = base64;
                        })
                    );
                } else {
                    backup.appraisal.files[key] = null;
                }
            }

            // Aguarda conversão
            await Promise.all(filesToProcess);

            // 3. Gerar Blob e Baixar
            const jsonString = JSON.stringify(backup, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            // Criar nome do arquivo: Viagem_Destino_Data.sisnav
            let filename = "Plano_Viagem.sisnav";
            if (State.shipProfile && State.shipProfile.date) {
                filename = `Plano_${State.shipProfile.date}.sisnav`;
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log("Persistence: Arquivo salvo com sucesso!");
            alert("Plano de Viagem salvo com sucesso!");

        } catch (error) {
            console.error("Persistence Error:", error);
            alert("Erro ao salvar o plano: " + error.message);
        }
    },

    /**
     * Carregar Estado de Arquivo .sisnav
     */
    loadState: function (file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);

                // Validação Básica
                if (!json.metadata || json.metadata.type !== "SISNAV_TRIP_PLAN") {
                    throw new Error("Arquivo inválido ou corrompido.");
                }

                console.log("Persistence: Carregando dados...", json);

                // 1. Restaurar Estado Simples
                State.shipProfile = json.shipProfile || State.shipProfile;
                State.routePoints = json.routePoints || [];
                State.voyage = json.voyage || {};
                State.weatherData = json.weatherData || {};

                // 2. Restaurar Appraisal e Arquivos
                State.appraisal = { ...State.appraisal, ...json.appraisal };

                // Converter Base64 de volta para File Objects (para ser compatível com lógica existente)
                // Nota: Criar 'File' a partir de base64 requer conversão para Blob
                State.appraisal.files = { meteo: null, navarea: null, tideDep: null, tideArr: null };

                if (json.appraisal.files) {
                    for (const [key, b64Obj] of Object.entries(json.appraisal.files)) {
                        if (b64Obj && b64Obj.content) {
                            const res = await fetch(b64Obj.content);
                            const blob = await res.blob();
                            const restoredFile = new File([blob], b64Obj.name, { type: b64Obj.type });
                            State.appraisal.files[key] = restoredFile;
                            console.log(`Persistence: Arquivo restaurado [${key}]: ${restoredFile.name}`);
                        }
                    }
                }

                // 3. Atualizar UI (Critical: Preencher Inputs)
                this.refreshUI();

                // 4. Re-plotar Mapa
                if (State.routePoints.length > 0 && MapService) {
                    MapService.plotRoute(State.routePoints);
                }

                alert("Planejamento carregado com sucesso!");

            } catch (error) {
                console.error("Persistence Load Error:", error);
                alert("Falha ao ler arquivo: " + error.message);
            }
        };
        reader.readAsText(file);
    },

    refreshUI: function () {
        // Atualiza inputs baseado no State
        // Helper interno ou chamada ao UIManager (se ele tivesse 'syncFromState')
        // Como UIManager não tem 'syncFromState' completo, fazemos manual aqui para os principais

        // Ship Profile
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        const prof = State.shipProfile;
        setVal('inp-ship-name', prof.name); // Hidden or dropdown?
        setVal('inp-ship-commander', prof.commander);
        setVal('inp-ship-tripulacao', prof.crew); // ID mismatch check?
        // Check IDs in index.html
        setVal('inp-ship-crew', prof.crew);
        setVal('inp-ship-speed', prof.speed);
        setVal('inp-ship-tow-speed', prof.towSpeed);
        setVal('inp-ship-consumption', prof.fuelRate);
        setVal('inp-ship-stock', prof.fuelStock);

        // Drafts
        if (prof.draft) {
            setVal('inp-draft-aft', prof.draft.aft);
            setVal('inp-draft-fwd', prof.draft.fwd);
            setVal('inp-draft-tow-aft', prof.draft.towAft);
            setVal('inp-draft-tow-fwd', prof.draft.towFwd);
        }

        // Branch
        setVal('inp-ship-branch', prof.branch);

        // Dates
        // Appraisal Date
        setVal('inp-plan-date', prof.date);

        // Voyage Dates (ETD/ETA)
        // State.voyage.depTime is string "YYYY-MM-DDTHH:mm"
        if (State.voyage && State.voyage.depTime) {
            setVal('input-etd', State.voyage.depTime);
            setVal('inp-etd', State.voyage.depTime);
            // ETA is calculated, but saved in State.voyage.arrTime
            // Display needs update
            const elEta = document.getElementById('display-eta');
            const inpEta = document.getElementById('inp-eta');
            if (elEta) elEta.innerText = this.formatDisplayDate(State.voyage.arrTime); // Format check
            if (inpEta) inpEta.value = State.voyage.arrTime;
        }

        // Files - Visual Feedback
        // Cannot set input[type=file].value programmatically.
        // But we can show text indicating file is present?
        // Current UI doesn't have "Label" for selected file beside input.
        // Validation logic will see State.appraisal.files, so it's valid internally.

        // Trigger validations to update styles
        // Call UIManager logic if possible?
        // App.validateAppraisalLogic() is internal to App.
        // We might trigger a change event on an input to force update?
    },

    formatDisplayDate: (isoStr) => {
        if (!isoStr) return "--/--";
        try {
            const d = new Date(isoStr);
            const pad = n => n.toString().padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch { return "--/--"; }
    }
};

export default PersistenceService;
