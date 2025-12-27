/**
 * ARQUIVO: App.js
 * MÓDULO: Controlador Principal
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 3.4.0 (Fix Date Input & Error 400)
 */

import State from './core/State.js?v=7';
import NavMath from './core/NavMath.js?v=7';
import MapService from './services/MapService.js?v=7';
import WeatherAPI from './services/WeatherAPI.js?v=7';
import GPXParser from './utils/GPXParser.js?v=7';
import UIManager from './utils/UIManager.js?v=7';
import PortDatabase from './services/PortDatabase.js?v=7';
import PersistenceService from './services/PersistenceService.js?v=1';
import UpdateService from './services/UpdateService.js?v=1';
import TideCSVService from './services/TideCSVService.js?v=7';

const App = {
    init: function () {
        console.log("App: Inicializando v3.4.0...");

        // Expose Services for Global Access (UpdateService, HTML Buttons)
        window.TideCSVService = TideCSVService;
        window.TideCSVService = TideCSVService;
        window.ReportService = window.ReportService || null; // Already global in ReportService.js? check
        window.State = State; // Expose State for inline handlers or debug


        if (NavMath && typeof NavMath.calcLeg === 'function') {
            console.log("App: Módulo NavMath OK.");
        } else {
            console.error("App: ERRO CRÍTICO - NavMath falhou.", NavMath);
        }

        this.setupEventListeners();
        this.setDefaultTime(); // Define hora inicial

        if (MapService) {
            MapService.init('map-container');
            MapService.renderPorts(PortDatabase); // Renderiza âncoras na inicialização
        }

        this.populatePortDropdowns();
        this.populateVesselDropdown();
        this.populateChartsDropdown();
        this.populateContactsDropdown();
        this.populateLighthousesDropdown();
        this.populateSheltersDropdown();
        this.populateSheltersDropdown();
        this.populateTidePorts(); // New
        this.updateWeatherStatusUI();
    },

    setupEventListeners: function () {
        // Inicializa UI (Cover Screen etc)
        if (UIManager && typeof UIManager.init === 'function') {
            UIManager.init();
        }

        // Initialize Engine State if missing
        if (State.appraisal && !State.appraisal.engine) {
            State.appraisal.engine = {
                status: 'pending',
                checklist: {},
                observations: ''
            };
        }

        // Abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target');
                UIManager.switchTab(targetId);
                if (targetId === 'view-monitoring' && MapService) {
                    setTimeout(() => MapService.invalidateSize(), 100);
                }
            });
        });

        // GPX
        const gpxInput = document.getElementById('input-gpx');
        if (gpxInput) {
            gpxInput.removeEventListener('change', this.handleFileUpload);
            gpxInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Data (ETD) - Adicionado log de debug
        const etdInput = document.getElementById('input-etd');
        if (etdInput) {
            console.log("App: Listener de Data configurado.");
            etdInput.addEventListener('change', (e) => {
                console.log("App: Data alterada pelo usuário:", e.target.value);
                this.recalculateVoyage();
            });
            // Também recalcula ao perder o foco (blur), caso 'change' falhe em alguns browsers mobile
            etdInput.addEventListener('blur', () => this.recalculateVoyage());
        } else {
            console.error("App: Input ETD não encontrado!");
            console.error("App: Input ETD não encontrado!");
        }

        // Logic to refresh weather on date change
        const refreshWeatherLogic = () => {
            // Delay slightly to allow state to settle?
            // Since TideCSVService.reload is async but loads from file, we can just call it.
            if (window.TideCSVService && typeof window.TideCSVService.reload === 'function') {
                console.log("App: Auto-refreshing Weather Data...");
                window.TideCSVService.reload().then(() => {
                    this.updateWeatherStatusUI();
                    console.log("App: Weather Data Refreshed.");
                });
            } else {
                console.warn("App: TideCSVService missing for auto-refresh.");
            }
        };

        // Appraisal Inputs (ETD / ETA)
        const inpEtdAppraisal = document.getElementById('inp-etd');
        const inpEtaAppraisal = document.getElementById('inp-eta');

        if (inpEtdAppraisal) {
            inpEtdAppraisal.addEventListener('change', () => {
                refreshWeatherLogic();
                // Also trigger voyage recalc?
                // The sync logic usually handles value propagation, but explicit call is safer if needed.
            });
        }
        if (inpEtaAppraisal) {
            inpEtaAppraisal.addEventListener('change', () => {
                refreshWeatherLogic();
            });
        }

        const btnSimulate = document.getElementById('btn-simulate');
        if (btnSimulate) btnSimulate.addEventListener('click', () => this.startSimulation());

        // Refresh Weather Button
        const btnRefreshWeather = document.getElementById('btn-refresh-weather');
        if (btnRefreshWeather) {
            btnRefreshWeather.addEventListener('click', () => {
                if (window.TideCSVService) {
                    window.TideCSVService.reload().then(() => {
                        this.updateWeatherStatusUI();
                        alert("Dados atualizados com sucesso!");
                    });
                } else {
                    window.location.reload();
                }
            });
        }

        const btnPdf = document.getElementById('btn-export-pdf-plan');
        if (btnPdf) btnPdf.addEventListener('click', () => {
            if (window.ReportService) window.ReportService.generatePDF(State);
            else console.error("ReportService nao carregado");
        });

        // LISTENERS DADOS DA EMBARCAÇÃO (STAGE 1)
        const bindShipInput = (id, field, isNum = false) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    let val = e.target.value;
                    // Changed: Allow text for "N/A" support, parse later
                    // if (isNum) val = parseFloat(val) || 0; 
                    if (State.shipProfile) State.shipProfile[field] = val;
                    // console.log(`App: ${field} alterado para ${val}`);
                    this.recalculateVoyage();
                });
            }
        };
        // bindShipInput('inp-ship-name', 'name'); // Removido
        bindShipInput('inp-ship-commander', 'commander');
        bindShipInput('inp-ship-commander', 'commander');
        bindShipInput('inp-ship-branch', 'branch');
        bindShipInput('inp-ship-crew', 'crew', true);
        bindShipInput('inp-plan-date', 'date');

        bindShipInput('inp-ship-speed', 'speed', true);
        bindShipInput('inp-ship-tow-speed', 'towSpeed', true);
        bindShipInput('inp-ship-consumption', 'fuelRate', true);
        bindShipInput('inp-ship-stock', 'fuelStock', true);

        // Listeners de Calado
        const bindDraft = (id, field) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    if (State.shipProfile && State.shipProfile.draft) {
                        State.shipProfile.draft[field] = parseFloat(e.target.value) || 0;
                        console.log(`App: Draft ${field} updated: ${State.shipProfile.draft[field]}`);
                    }
                });
            }
        };
        bindDraft('inp-draft-aft', 'aft');
        bindDraft('inp-draft-fwd', 'fwd');
        bindDraft('inp-draft-tow-aft', 'towAft');
        bindDraft('inp-draft-tow-fwd', 'towFwd');

        // Listener do Dropdown de Navios
        const selShip = document.getElementById('select-ship-name');
        if (selShip) {
            selShip.addEventListener('change', (e) => {
                const imo = e.target.value;
                const name = e.target.options[e.target.selectedIndex].text;

                document.getElementById('inp-ship-imo').value = imo;

                if (State.shipProfile) {
                    State.shipProfile.name = name;
                    State.shipProfile.imo = imo;
                }
                console.log(`App: Navio selecionado: ${name} (IMO: ${imo})`);
            });
        }

        // Listeners Tábua de Marés (Restaurado)
        const bindTideFile = (id, field) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    const f = e.target.files[0];
                    if (State.appraisal && State.appraisal.files) {
                        State.appraisal.files[field] = f || null;
                        console.log(`App: Tide File ${field} updated.`);
                    }
                    this.validateAppraisalLogic();
                });
            }
        };
        bindTideFile('inp-file-tide-dep', 'tideDep');
        bindTideFile('inp-file-tide-arr', 'tideArr');

        const appraisalInputs = document.querySelectorAll('#view-appraisal input[type="checkbox"], #view-appraisal select');
        appraisalInputs.forEach(input => input.addEventListener('change', () => this.validateAppraisalLogic()));

        // Listeners para os Dropdowns de Porto
        const selDep = document.getElementById('select-dep');
        const selArr = document.getElementById('select-arr');

        if (selDep) selDep.addEventListener('change', () => this.handlePortSelection());
        if (selArr) selArr.addEventListener('change', () => this.handlePortSelection());

        if (selArr) selArr.addEventListener('change', () => this.handlePortSelection());

        // PERSISTENCE (SALVAR/CARREGAR)
        const btnSavePlan = document.getElementById('btn-save-plan');
        const btnLoadPlan = document.getElementById('btn-load-plan');
        const inpLoadState = document.getElementById('inp-load-state');

        if (btnSavePlan) {
            btnSavePlan.addEventListener('click', () => PersistenceService.saveState());
        }
        if (btnLoadPlan) {
            btnLoadPlan.addEventListener('click', () => inpLoadState.click());
        }
        if (inpLoadState) {
            inpLoadState.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    PersistenceService.loadState(file);
                    // Reset value to allow reloading same file if needed
                    e.target.value = '';
                }
            });
        }

        // --- ROUTE FEED (LIBRARY) ---
        const btnFeed = document.getElementById('btn-feed-route');
        const inpFeed = document.getElementById('inp-feed-route');
        const feedStatus = document.getElementById('feed-status');

        if (btnFeed && inpFeed) {
            btnFeed.addEventListener('click', () => inpFeed.click());

            inpFeed.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (feedStatus) {
                    feedStatus.innerText = "Enviando e Processando...";
                    feedStatus.classList.remove('hidden');
                }

                const formData = new FormData();
                formData.append('file', file);

                try {
                    const res = await fetch('/api/upload-gpx', {
                        method: 'POST',
                        body: formData
                    });
                    const json = await res.json();

                    if (res.ok) {
                        alert(`Sucesso: ${json.message}`);
                        if (feedStatus) feedStatus.innerText = "Rota Adicionada!";
                        // Clear input
                        e.target.value = '';
                    } else {
                        throw new Error(json.error || "Erro desconhecido");
                    }
                } catch (err) {
                    console.error("Feed Error:", err);
                    alert("Erro ao enviar rota: " + err.message);
                    if (feedStatus) feedStatus.innerText = "Falha no envio.";
                }

                setTimeout(() => {
                    if (feedStatus) feedStatus.classList.add('hidden');
                }, 3000);
            });
        }

        // UPDATE DATA (ON-DEMAND)
        const btnUpdateData = document.getElementById('btn-update-data');
        if (btnUpdateData) {
            btnUpdateData.addEventListener('click', () => {
                const modal = document.getElementById('modal-update');
                const bar = document.getElementById('bar-update-progress');
                const lblStatus = document.getElementById('lbl-update-status');
                const lblPercent = document.getElementById('lbl-update-percent');

                // Reset UI
                if (modal) {
                    modal.classList.remove('hidden');
                    if (bar) bar.style.width = '0%';
                    if (lblStatus) lblStatus.innerText = "Iniciando...";
                    if (lblPercent) lblPercent.innerText = "0%";
                }

                UpdateService.triggerUpdate(
                    (status, progress) => {
                        if (lblStatus) lblStatus.innerText = status;
                        if (lblPercent) lblPercent.innerText = progress + "%";
                        if (bar) bar.style.width = progress + "%";
                    },
                    (success) => {
                        if (success) {
                            if (lblStatus) lblStatus.innerText = "Concluído! Recarregando sistema...";
                            if (bar) bar.style.width = "100%";

                            setTimeout(async () => {
                                // Reload CSV Data
                                if (window.TideCSVService && window.TideCSVService.reload) {
                                    await window.TideCSVService.reload();
                                }
                                // Soft Reload UI (Recalculate Voyage)
                                this.recalculateVoyage();
                                alert("Dados atualizados com sucesso!");
                                if (modal) modal.classList.add('hidden');
                            }, 1000);
                        } else {
                            setTimeout(() => {
                                alert("Erro na atualização. Verifique o servidor.");
                                if (modal) modal.classList.add('hidden');
                            }, 500);
                        }
                    }
                );
            });
        }

        // MANUAL PLANNING
        const btnManual = document.getElementById('btn-manual-plan');
        const modal = document.getElementById('modal-manual-wp');
        const btnClose = document.getElementById('btn-close-modal');
        const btnCancel = document.getElementById('btn-cancel-wp');
        const btnSave = document.getElementById('btn-save-wp');

        if (btnManual) {
            btnManual.addEventListener('click', () => {
                modal.classList.remove('hidden');
                document.getElementById('inp-wp-name').focus();
            });
        }

        const closeModal = () => modal.classList.add('hidden');
        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (btnCancel) btnCancel.addEventListener('click', closeModal);

        if (btnSave) {
            btnSave.addEventListener('click', () => this.handleManualWaypoint());
        }

        // VISUAL PLANNING BUTTON (To be added in HTML or via console for now)
        // temporary hook
        window.startVisualPlanning = () => this.startVisualPlanningMode();
    },

    startVisualPlanningMode: function () {
        alert("Modo Visual Ativado! Carregando rotas...");

        // Carrega dados REAIS do backend (gerado pelo build_route_index.py)
        fetch('js/data/known_routes.json')
            .then(res => res.json())
            .then(data => {
                console.log(`App: ${data.length} rotas carregadas para Snapping.`);

                // Extrai arrays de pontos
                // O formato do JSON é [{id, points: [{lat,lon},...]}, ...]
                const routesForSnapping = data.map(r => r.points);

                // Ativa o snapping no mapa
                MapService.enableSnapping(routesForSnapping, (coords) => {
                    // Callback ao clicar no snap
                    document.getElementById('modal-manual-wp').classList.remove('hidden');
                    document.getElementById('inp-wp-lat').value = coords.lat.toFixed(5);
                    document.getElementById('inp-wp-lon').value = coords.lon.toFixed(5);
                    document.getElementById('inp-wp-name').value = "PONTO SNAP";
                    document.getElementById('inp-wp-name').focus();
                });

                // Opcional: Feedback visual de que carregou
                console.log("Visual Planning: Snapping active.");
            })
            .catch(err => {
                console.error("Erro ao carregar malha:", err);
                alert("Erro ao carregar índice de rotas. Rode 'python build_route_index.py' primeiro.");
            });
    },

    populatePortDropdowns: function () {
        const selDep = document.getElementById('select-dep');
        const selArr = document.getElementById('select-arr');

        // Populate specific Main Dropdowns (Sidebar)
        [selDep, selArr].forEach(sel => {
            if (sel) {
                sel.innerHTML = '<option value="">Selecione...</option>';
                // Sort alphabetically? Or by ID? Preserving DB order.
                PortDatabase.forEach(port => {
                    const opt = document.createElement('option');
                    opt.value = port.id;
                    opt.text = port.name; // Keep sidebar clean (Name only)
                    sel.appendChild(opt);
                });
            }
        });
    },

    populateVesselDropdown: function () {
        const select = document.getElementById('select-ship-name');
        if (!select) return;

        console.log("App: Carregando banco de Navios...");
        fetch('library/VESSELIMO.txt')
            .then(r => r.text())
            .then(text => {
                const lines = text.split('\n');
                select.innerHTML = '<option value="" disabled selected>SELECIONE...</option>';

                let count = 0;
                lines.forEach(line => {
                    if (!line || line.startsWith('VESSEL')) return; // Pula header

                    // Divide por TAB ou múltiplos espaços
                    const parts = line.trim().split(/\t+|\s{2,}/);

                    if (parts.length >= 2) {
                        const name = parts[0].trim();
                        const imo = parts[1].trim();

                        const opt = document.createElement('option');
                        opt.value = imo;
                        opt.text = name;

                        // Pré-selecionar o default se houver
                        if (State.shipProfile && State.shipProfile.imo === imo) {
                            opt.selected = true;
                            document.getElementById('inp-ship-imo').value = imo;
                        }

                        select.appendChild(opt);
                        count++;
                    }
                });
                console.log(`App: ${count} navios carregados.`);
            })
            .catch(e => {
                console.error("App: Erro ao carregar VESSELIMO.txt", e);
                select.innerHTML = '<option value="">Erro de carregamento</option>';
            });
    },

    populateContactsDropdown: function () {
        const select = document.getElementById('select-contact-add');
        if (!select) return;

        fetch('library/CONTACTS.txt')
            .then(r => r.text())
            .then(text => {
                const lines = text.split('\n');
                select.innerHTML = '<option value="" disabled selected>Selecionar Contato...</option>';

                // Armazena temporariamente para facilitar o Add
                this.availableContacts = [];

                // Lista Fixa que precisa estar na tela (Ordem Solicitada)
                const fixedNames = ["CCO", "JOSÉ AUGUSTO TIMM", "VLADIMIR OLIVEIRA"];

                lines.forEach(line => {
                    if (!line || line.startsWith('NAME')) return;
                    const parts = line.split('\t');
                    // NAME | PHONE | EMAIL | ROLE
                    if (parts.length >= 3) {
                        const contact = {
                            name: parts[0].trim(),
                            phone: parts[1].trim(),
                            email: parts[2].trim(),
                            role: parts[3] ? parts[3].trim() : '-'
                        };
                        this.availableContacts.push(contact);

                        const opt = document.createElement('option');
                        opt.value = contact.name;
                        opt.text = contact.name;
                        select.appendChild(opt);
                    }
                });

                // Enforce Fixed Contacts on Init
                if (!State.appraisal.shoreContacts || State.appraisal.shoreContacts.length === 0) {
                    State.appraisal.shoreContacts = [];
                    fixedNames.forEach(fixedName => {
                        const found = this.availableContacts.find(c => c.name.toUpperCase() === fixedName);
                        if (found) {
                            State.appraisal.shoreContacts.push(found);
                        }
                    });
                    this.renderContactsTable();
                }
            })
            .catch(e => console.error("App: Erro loading contacts", e));

        // Listener do botão Add
        const btnAdd = document.getElementById('btn-add-contact');
        if (btnAdd) {
            // Remove listeners antigos para evitar duplicação (embora init rode uma vez)
            const newBtn = btnAdd.cloneNode(true);
            btnAdd.parentNode.replaceChild(newBtn, btnAdd);

            newBtn.addEventListener('click', () => {
                const val = select.value;
                if (!val) return;

                const contact = this.availableContacts.find(c => c.name === val);

                // Verifica duplicidade
                if (!State.appraisal || !State.appraisal.shoreContacts) {
                    console.error("App: shoreContacts undefined. Reinicializando...");
                    if (State.appraisal) State.appraisal.shoreContacts = [];
                    else return;
                }

                const exists = State.appraisal.shoreContacts.some(c => c.name === val);

                if (contact && !exists) {
                    State.appraisal.shoreContacts.push(contact);
                    this.renderContactsTable();
                }
            });
        }
    },

    renderContactsTable: function () {
        const tbody = document.getElementById('tbody-contacts');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (State.appraisal.shoreContacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-2 text-center text-gray-400 italic">Nenhum contato adicionado.</td></tr>';
            return;
        }

        State.appraisal.shoreContacts.forEach((contact, index) => {
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50";
            tr.innerHTML = `
                <td class="p-1 font-bold text-gray-700">${contact.name}</td>
                <td class="p-1 text-gray-500 text-[10px] italic">${contact.role || '-'}</td>
                <td class="p-1 text-gray-600">${contact.phone}</td>
                <td class="p-1 text-blue-600 underline cursor-pointer" onclick="window.location.href='mailto:${contact.email}'">${contact.email}</td>
                <td class="p-1 text-center">
                    <button class="text-red-400 hover:text-red-600" onclick="window.App.removeContact(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    removeContact: function (index) {
        if (index >= 0 && index < State.appraisal.shoreContacts.length) {
            State.appraisal.shoreContacts.splice(index, 1);
            this.renderContactsTable();
        }
    },

    // --- MARÉS E VIAGEM ---
    populateTidePorts: function () {
        // Use PortDatabase (Source of Truth) instead of TideCSV strings
        const stations = PortDatabase;
        const selDep = document.getElementById('select-port-dep');
        const selArr = document.getElementById('select-port-arr');

        // Formato solicitado: "BR_RIG: Rio Grande-RS"
        [selDep, selArr].forEach(sel => {
            if (sel) {
                sel.innerHTML = '<option value="">Selecione...</option>';
                stations.forEach(port => {
                    const opt = document.createElement('option');
                    opt.value = port.id; // Correct ID
                    opt.text = `${port.id}: ${port.name}`; // Display Format
                    sel.appendChild(opt);
                });
            }
        });

        // Initialize State.voyage if missing
        if (!State.voyage) State.voyage = {};

        // Bind Listeners
        const bind = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = (key.includes('Time')) ? 'input' : 'change';
                el.addEventListener(eventType, (e) => {
                    State.voyage[key] = e.target.value;

                    // Sync ETD Sidebar
                    if (key === 'depTime') {
                        const mainEtd = document.getElementById('input-etd');
                        if (mainEtd) mainEtd.value = e.target.value;
                        this.recalculateVoyage();
                    }
                });
                if (key.includes('Time')) {
                    el.addEventListener('change', (e) => {
                        State.voyage[key] = e.target.value;
                        if (key === 'depTime') {
                            const mainEtd = document.getElementById('input-etd');
                            if (mainEtd) mainEtd.value = e.target.value;
                            this.recalculateVoyage();
                        }
                    });
                }
            }
        };

        bind('select-port-dep', 'depPort');
        bind('inp-etd', 'depTime');
        bind('select-port-arr', 'arrPort');
        bind('inp-eta', 'arrTime');

        // Sync Sidebar (Appraisal Dropdown -> Main Dropdown)
        const syncPort = (appraisalId, mainId) => {
            const appEl = document.getElementById(appraisalId);
            const mainEl = document.getElementById(mainId);

            if (appEl && mainEl) {
                appEl.addEventListener('change', () => {
                    const val = appEl.value; // Now returns ID like 'BR_RIG'
                    if (val) {
                        mainEl.value = val; // Direct ID Match

                        // Validar se Main Dropdown aceita esse valor (pode estar populado diferente?)
                        // Assumindo que Main Dropdown também usa IDs.
                        if (mainEl.value !== val) {
                            console.warn("App: Sync ID mismatch. Main dropdown may not have option:", val);
                            // Fallback: Try setting by Text matching?
                        }

                        console.log(`App: Sync '${val}' -> Main`);
                        mainEl.dispatchEvent(new Event('change'));
                    }
                });
            }
        };
        syncPort('select-port-dep', 'select-dep');
        syncPort('select-port-arr', 'select-arr');
    },

    // --- FARÓIS ---
    populateLighthousesDropdown: function () {
        const select = document.getElementById('select-lighthouse-add');
        if (!select) return;

        fetch('library/LIGHTHOUSES.txt')
            .then(r => r.text())
            .then(text => {
                const lines = text.split('\n');
                select.innerHTML = '<option value="" disabled selected>Selecionar Farol / Auxílio...</option>';
                this.availableLighthouses = [];

                lines.forEach(line => {
                    if (!line || line.startsWith('NAME')) return;
                    const parts = line.split('\t');
                    if (parts.length >= 3) {
                        const lh = {
                            name: parts[0].trim(),
                            lat: parts[1].trim(),
                            lon: parts[2].trim(),
                            char: parts[3] ? parts[3].trim() : '',
                            desc: parts[4] ? parts[4].trim() : '',
                            // Pre-parse for distance calc
                            latDec: NavMath.parseDMS(parts[1].trim()),
                            lonDec: NavMath.parseDMS(parts[2].trim())
                        };
                        this.availableLighthouses.push(lh);
                        const opt = document.createElement('option');
                        opt.value = lh.name;
                        opt.text = lh.name;
                        select.appendChild(opt);
                    }
                });
                // Plot on Map (Se MapService disponível)
                if (MapService && typeof MapService.renderLighthouses === 'function') {
                    MapService.renderLighthouses(this.availableLighthouses);
                }
            })
            .catch(e => console.error("App: Erro loading lighthouses", e));

        const btnAdd = document.getElementById('btn-add-lighthouse');
        if (btnAdd) {
            const newBtn = btnAdd.cloneNode(true);
            btnAdd.parentNode.replaceChild(newBtn, btnAdd);
            newBtn.addEventListener('click', () => {
                const val = select.value;
                if (!val) return;

                if (!State.appraisal || !State.appraisal.lighthouses) {
                    if (State.appraisal) State.appraisal.lighthouses = [];
                    else return;
                }

                const item = this.availableLighthouses.find(x => x.name === val);
                const exists = State.appraisal.lighthouses.some(x => x.name === val);

                if (item && !exists) {
                    State.appraisal.lighthouses.push(item);
                    this.renderLighthousesTable();
                }
            });
        }
    },

    renderLighthousesTable: function () {
        const tbody = document.getElementById('tbody-lighthouses');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!State.appraisal.lighthouses || State.appraisal.lighthouses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-2 text-center text-gray-400 italic">Nenhum farol selecionado.</td></tr>';
            return;
        }

        State.appraisal.lighthouses.forEach((lh, index) => {
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50";
            tr.innerHTML = `
                <td class="p-1 font-bold text-gray-700 text-[10px]">${lh.name}</td>
                <td class="p-1 text-gray-600 text-[9px]">${lh.lat}<br>${lh.lon}</td>
                <td class="p-1 text-gray-600 text-[9px]">${lh.char}</td>
                <td class="p-1 text-gray-600 text-[9px] italic leading-tight">${lh.desc || '-'}</td>
                <td class="p-1 text-center">
                    <button class="text-red-400 hover:text-red-600" onclick="window.App.removeLighthouse(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    removeLighthouse: function (index) {
        if (State.appraisal.lighthouses && index >= 0) {
            State.appraisal.lighthouses.splice(index, 1);
            this.renderLighthousesTable();
        }
    },

    /**
     * Finds the nearest lighthouse to a given point
     * @param {number} lat 
     * @param {number} lon 
     * @returns {object|null} { name, dist, desc } or null
     */
    getNearestLighthouse: function (lat, lon) {
        if (!this.availableLighthouses || this.availableLighthouses.length === 0) return null;

        let nearest = null;
        let minDist = Infinity;

        this.availableLighthouses.forEach(lh => {
            if (lh.latDec && lh.lonDec) {
                const leg = NavMath.calcLeg(lat, lon, lh.latDec, lh.lonDec);
                if (leg.dist < minDist) {
                    minDist = leg.dist;
                    nearest = {
                        name: lh.name,
                        dist: leg.dist,
                        desc: lh.desc,
                        lat: lh.lat,
                        lon: lh.lon
                    };
                }
            }
        });

        return nearest;
    },

    // --- ABRIGOS ---
    populateSheltersDropdown: function () {
        const select = document.getElementById('select-shelter-add');
        if (!select) return;

        fetch('library/SHELTERS.txt')
            .then(r => r.text())
            .then(text => {
                const lines = text.split('\n');
                select.innerHTML = '<option value="" disabled selected>Selecionar Abrigo...</option>';
                this.availableShelters = [];

                lines.forEach(line => {
                    if (!line || line.startsWith('NAME')) return;
                    const parts = line.split('\t');
                    if (parts.length >= 2) {
                        const sh = {
                            name: parts[0].trim(),
                            type: parts[1].trim(),
                            details: parts[2] ? parts[2].trim() : ''
                        };
                        this.availableShelters.push(sh);
                        const opt = document.createElement('option');
                        opt.value = sh.name;
                        opt.text = sh.name;
                        select.appendChild(opt);
                    }
                });
            })
            .catch(e => console.error("App: Erro loading shelters", e));

        const btnAdd = document.getElementById('btn-add-shelter');
        if (btnAdd) {
            const newBtn = btnAdd.cloneNode(true);
            btnAdd.parentNode.replaceChild(newBtn, btnAdd);
            newBtn.addEventListener('click', () => {
                const val = select.value;
                if (!val) return;

                if (!State.appraisal || !State.appraisal.shelters) {
                    if (State.appraisal) State.appraisal.shelters = [];
                    else return;
                }

                const item = this.availableShelters.find(x => x.name === val);
                const exists = State.appraisal.shelters.some(x => x.name === val);

                if (item && !exists) {
                    State.appraisal.shelters.push(item);
                    this.renderSheltersTable();
                }
            });
        }
    },

    renderSheltersTable: function () {
        const tbody = document.getElementById('tbody-shelters');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!State.appraisal.shelters || State.appraisal.shelters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-2 text-center text-gray-400 italic">Nenhuma área selecionada.</td></tr>';
            return;
        }

        State.appraisal.shelters.forEach((sh, index) => {
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50";
            tr.innerHTML = `
                <td class="p-1 font-bold text-gray-700 text-[10px]">${sh.name}</td>
                <td class="p-1 text-gray-600 text-[9px]">${sh.type}</td>
                <td class="p-1 text-gray-600 text-[9px] italic">${sh.details}</td>
                <td class="p-1 text-center">
                    <button class="text-red-400 hover:text-red-600" onclick="window.App.removeShelter(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    removeShelter: function (index) {
        if (State.appraisal.shelters && index >= 0) {
            State.appraisal.shelters.splice(index, 1);
            this.renderSheltersTable();
        }
    },



    populateChartsDropdown: function () {
        const select = document.getElementById('select-chart-add');
        if (!select) return;

        fetch('library/CHARTS_BRAZIL.txt')
            .then(r => r.text())
            .then(text => {
                const lines = text.split('\n');
                select.innerHTML = '<option value="" disabled selected>Selecionar Carta...</option>';

                this.availableCharts = []; // Cache for lookup

                const coastalGroup = document.createElement('optgroup');
                coastalGroup.label = "Cartas Costeiras (Gerais)";

                const approachGroup = document.createElement('optgroup');
                approachGroup.label = "Aproximação / Portos";

                lines.forEach(line => {
                    // Skip header or empty
                    if (!line || line.startsWith('CHART')) return;

                    const parts = line.split('\t');
                    if (parts.length >= 2) {
                        const id = parts[0].trim();
                        const title = parts[1].trim();
                        // Handle optional columns if file is mixed, but we just wrote it standard
                        const category = parts.length > 2 ? parts[2].trim() : (id.length === 4 ? 'Aproximação' : 'Costeira');
                        const scale = parts.length > 3 ? parts[3].trim() : '';

                        // Objeto completo para cache
                        const chartObj = { id, title, category, scale };
                        this.availableCharts.push(chartObj);

                        const val = `${id} - ${title}`; // Stored Value

                        const opt = document.createElement('option');
                        opt.value = val;
                        // Display: "21010 - Titulo (1:1.000.000)"
                        opt.text = `${id} - ${title} [${scale}]`;

                        if (category.toLowerCase().includes('aprox')) {
                            approachGroup.appendChild(opt);
                        } else {
                            coastalGroup.appendChild(opt);
                        }
                    }
                });

                select.appendChild(approachGroup);
                select.appendChild(coastalGroup);
            })
            .catch(e => console.error("App: Erro loading charts", e));

        // Listener do botão Add
        const btnAdd = document.getElementById('btn-add-chart');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const val = select.value;
                if (val && !State.appraisal.selectedCharts.includes(val)) {
                    State.appraisal.selectedCharts.push(val);
                    this.renderSelectedCharts();
                }
            });
        }

        // Listeners de Arquivos
        // Listeners de Arquivos (MODIFICADO: Lê TXT se textAreaId for passado)
        const bindFile = (id, key, statusId, textAreaId = null) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        State.appraisal.files[key] = file.name;
                        document.getElementById(statusId).classList.remove('hidden');
                        document.getElementById(statusId).innerText = "OK (" + file.name.slice(0, 10) + "...)";
                        console.log(`App: Arquivo ${key} carregado: ${file.name}`);

                        // Se for TXT para Meteo/Navarea logic
                        if (textAreaId && file.type === 'text/plain') {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                                const content = evt.target.result;
                                const txtEl = document.getElementById(textAreaId);
                                if (txtEl) {
                                    txtEl.value = content;
                                    txtEl.dispatchEvent(new Event('input')); // Updates State via bindLink
                                }
                            };
                            reader.readAsText(file);
                        }

                        this.validateAppraisalLogic();
                    }
                });
            }
        };
        // bindFile('file-meteo-upload', 'meteo', 'status-meteo-file', 'txt-meteo-content'); // Removed
        // bindFile('file-navarea-upload', 'navarea', 'status-navarea-file', 'txt-navarea-content'); // Removed


        // Inputs de Link
        const bindLink = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    State.appraisal[key] = e.target.value;
                    this.validateAppraisalLogic();
                });
            }
        }
        bindLink('txt-meteo-content', 'meteoText');
        bindLink('txt-navarea-content', 'navareaText');

        // Listeners Praça de Máquinas (Engine)
        // Listeners Praça de Máquinas (Engine)
        // MODIFICADO: Usa Checklist agora.

        const btnOpenChecklist = document.getElementById('btn-open-engine-checklist');
        const modalChecklist = document.getElementById('modal-engine-checklist');
        const btnCloseChecklist = document.getElementById('btn-close-engine-checklist');
        const btnCancelChecklist = document.getElementById('btn-cancel-checklist');
        const btnSaveChecklist = document.getElementById('btn-save-checklist');
        const txtObs = document.getElementById('txt-engine-obs');

        // Definição dos Itens do Checklist
        const checkItems = {
            safety: [
                { id: 'safety_estanque', label: 'Estanqueidade: Saídas de emergência aprovadas (teste giz)' },
                { id: 'safety_fire', label: 'Combate a Incêndio: Bombas, extintores e caixas íntegras' },
                { id: 'safety_pump', label: 'Equip. Emergência: Bomba Sand Piper e linha pneumatic.' },
                { id: 'safety_alarm', label: 'Alarmes: Painel sem falhas e boias de dalas operacionais' },
                { id: 'safety_comm', label: 'Comunicação: Tlf Autoexcitado, Fones e Intercomunicadores' },
                { id: 'safety_stop', label: 'Parada de Emergência: Botoeiras de bombas/ventilação' },
                { id: 'safety_sopep', label: 'SOPEP: Kit revisado, completo e íntegro' }
            ],
            propulsion: [
                { id: 'prop_protection', label: 'Proteções MCPs: Testar paradas emergência, temp/pressão' },
                { id: 'prop_inspection', label: 'Visual MCPs: Vazamentos e mangueiras diesel' },
                { id: 'prop_thermal', label: 'Isolamento Térmico: Turbinas e partes quentes' },
                { id: 'prop_azi_oil', label: 'Azimutal: Níveis óleo e bombas refrigeração auto' },
                { id: 'prop_steering', label: 'Testes de Governo: Emergência e NFU' },
                { id: 'prop_temp', label: 'Temperaturas: Trocadores e caixas de engrenagens' }
            ],
            power: [
                { id: 'pow_protection', label: 'Proteções MCAs: Baixa pressão, alta temp, overspeed' },
                { id: 'pow_maint', label: 'Manutenção: Óleo, filtros e Racor trocados' },
                { id: 'pow_batt', label: 'Baterias: Carregadores sem alarme, bornes íntegros' },
                { id: 'pow_light', label: 'Iluminação: Luzes de emergência operacionais' }
            ],
            aux: [
                { id: 'aux_diesel', label: 'Diesel: Purificador ok, válvulas corte testadas' },
                { id: 'aux_tanks', label: 'Tanques: Visores íntegros, suspiros, overflow vazio' },
                { id: 'aux_air', label: 'Ar Comprimido: Compressores, purgadoes e drenos' },
                { id: 'aux_waste', label: 'Resíduos: Tanques e dalas esgotados' },
                { id: 'aux_septic', label: 'Tanque Séptico: Estanqueidade e controle' }
            ],
            spares: [
                { id: 'spare_lube', label: 'Lubrificantes: Hidráulico (200L), Propulsão (200L), Motor (400L)' },
                { id: 'spare_filter', label: 'Filtros: Diesel (5 Racor, 3 Dif), Lube/Hidr (2/3 un)' },
                { id: 'spare_parts', label: 'Peças Críticas: Correias, mangotes, sensores, bomba água' }
            ]
        };

        const renderChecklist = () => {
            const createCheckbox = (item) => {
                const isChecked = State.appraisal.engine.checklist[item.id] === true;
                return `
                    <div class="flex items-start gap-2 p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200">
                        <input type="checkbox" id="${item.id}" class="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 engine-check" ${isChecked ? 'checked' : ''}>
                        <label for="${item.id}" class="text-xs text-slate-700 cursor-pointer select-none leading-tight">${item.label}</label>
                    </div>
                `;
            };

            const fillGroup = (groupId, items) => {
                const container = document.getElementById(groupId);
                if (container) container.innerHTML = items.map(createCheckbox).join('');
            };

            fillGroup('checklist-group-safety', checkItems.safety);
            fillGroup('checklist-group-propulsion', checkItems.propulsion);
            fillGroup('checklist-group-power', checkItems.power);
            fillGroup('checklist-group-aux', checkItems.aux);
            fillGroup('checklist-group-spares', checkItems.spares);
        };

        const saveChecklist = () => {
            // Coletar dados
            const checks = document.querySelectorAll('.engine-check');
            const stateChecks = {};
            let allSafetyOk = true;

            checks.forEach(chk => {
                stateChecks[chk.id] = chk.checked;
                // Check Critical (Safety group starts with 'safety_')
                if (chk.id.startsWith('safety_') && !chk.checked) allSafetyOk = false;
            });

            // Determinar Status
            // Regra: Se Safety (Zero) falhar = NO-GO
            // Se tudo selecionado = OK
            // Se falta algo não crítico = Restricted ? (Simplificado: Tudo check = OK, Safety fail = NO-GO, resto = Restricted)

            // Mas o usuário pode não ter marcado nada ainda.

            let status = 'restricted'; // Default se faltar itens não críticos

            // Verifica se TUDO está marcado
            const totalItems = checks.length;
            const checkedCount = Array.from(checks).filter(c => c.checked).length;

            if (!allSafetyOk) {
                status = 'no-go';
            } else if (checkedCount === totalItems) {
                status = 'ok';
            }

            // Atualizar State
            if (!State.appraisal.engine) State.appraisal.engine = {};
            State.appraisal.engine.checklist = stateChecks;
            State.appraisal.engine.status = status;

            // Atualizar UI Badge
            updateEngineBadge(status);

            // Fechar modal
            modalChecklist.classList.add('hidden');

            // Revalidar App geral
            this.validateAppraisalLogic();
            console.log(`App: Checklist salvo. Status: ${status}`);
        };

        const updateEngineBadge = (status) => {
            const badge = document.getElementById('badge-engine-status');
            if (!badge) return;

            const map = {
                'ok': { text: 'FULL POWER (OK)', class: 'bg-green-100 text-green-800' },
                'restricted': { text: 'RESTRITO', class: 'bg-yellow-100 text-yellow-800' },
                'no-go': { text: 'NO-GO / CRÍTICO', class: 'bg-red-100 text-red-800' },
                'pending': { text: 'PENDENTE', class: 'bg-gray-200 text-gray-600' }
            };

            const style = map[status] || map['pending'];
            badge.className = `text-xs font-bold px-2 py-1 rounded uppercase ${style.class}`;
            badge.innerText = style.text;
        };

        // Bind Events
        if (btnOpenChecklist) {
            btnOpenChecklist.addEventListener('click', () => {
                renderChecklist(); // Render current state
                modalChecklist.classList.remove('hidden');
            });
        }

        const closeFunc = () => modalChecklist.classList.add('hidden');
        if (btnCloseChecklist) btnCloseChecklist.addEventListener('click', closeFunc);
        if (btnCancelChecklist) btnCancelChecklist.addEventListener('click', closeFunc);
        if (btnSaveChecklist) btnSaveChecklist.addEventListener('click', saveChecklist);

        // Obs Listener
        if (txtObs) {
            txtObs.addEventListener('input', (e) => {
                if (!State.appraisal.engine) State.appraisal.engine = {};
                State.appraisal.engine.observations = e.target.value;
            });
        }


    },

    renderSelectedCharts: function () {
        const container = document.getElementById('list-selected-charts');
        container.innerHTML = "";

        if (State.appraisal.selectedCharts.length === 0) {
            container.innerHTML = '<span class="text-[10px] text-gray-400 italic p-1">Nenhuma carta selecionada.</span>';
            return;
        }

        State.appraisal.selectedCharts.forEach((chartStr, idx) => {
            const tag = document.createElement('span');

            // Extract ID to lookup metadata
            const id = chartStr.split(' - ')[0];

            // Lookup in availableCharts if loaded
            let meta = { scale: '', category: 'Costeira' };
            if (this.availableCharts) {
                const found = this.availableCharts.find(c => c.id === id);
                if (found) meta = found;
            }

            const isApproach = meta.category && meta.category.toLowerCase().includes('aprox');
            const badgeClass = isApproach
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-cyan-100 text-cyan-800 border-cyan-200";

            const badgeLabel = isApproach ? "APR" : "COST";

            tag.className = `${badgeClass} border text-[10px] px-2 py-1 rounded flex items-center gap-2 shadow-sm`;

            // Display: [TYPE] ID - Title (Scale)
            // chartStr already has "ID - Title"
            // We append scale

            tag.innerHTML = `
                <span class="font-bold text-[9px] opacity-70 border-r border-gray-300 pr-1 mr-1">${badgeLabel}</span>
                <span class="truncate max-w-[200px]">${chartStr}</span>
                <span class="font-mono text-[9px] text-gray-500 bg-white/50 px-1 rounded hidden md:inline-block">${meta.scale || '?'}</span>
                <i class="fas fa-times cursor-pointer hover:text-red-500 ml-1"></i>`;

            tag.querySelector('i').addEventListener('click', () => {
                State.appraisal.selectedCharts.splice(idx, 1);
                this.renderSelectedCharts();
            });
            container.appendChild(tag);
        });
    },

    handleManualWaypoint: function () {
        const name = document.getElementById('inp-wp-name').value;
        const latStr = document.getElementById('inp-wp-lat').value;
        const lonStr = document.getElementById('inp-wp-lon').value;
        const chart = document.getElementById('inp-wp-chart').value;

        if (!latStr || !lonStr) return alert("Latitude e Longitude são obrigatórias.");

        const parseCoord = (str) => {
            // Tenta decimal direto
            if (!isNaN(parseFloat(str)) && str.match(/^-?\d+(\.\d+)?$/)) return parseFloat(str);

            // Tenta formato náutico: 23 30 S ou 23º30'S
            const s = str.replace(',', '.').toUpperCase().trim();
            const match = s.match(/(\d+)[º°\s](\d+\.?\d*)[\'’]?\s*([NSEW])/);
            if (match) {
                let d = parseFloat(match[1]) + (parseFloat(match[2]) / 60);
                if (match[3] === 'S' || match[3] === 'W') d *= -1;
                return d;
            }
            return null;
        };

        const lat = parseCoord(latStr);
        const lon = parseCoord(lonStr);

        if (lat === null || lon === null) return alert("Formato de coordenada inválido.");

        // Adiciona ao State
        if (!State.routePoints) State.routePoints = [];

        State.routePoints.push({
            sequence: State.routePoints.length + 1,
            lat: lat,
            lon: lon,
            name: name || `WPT ${State.routePoints.length + 1}`,
            chart: chart,
            lat_raw: latStr,
            lon_raw: lonStr
        });

        // Atualiza UI e Mapa
        document.getElementById('modal-manual-wp').classList.add('hidden');

        // Limpa form
        document.getElementById('inp-wp-name').value = '';
        document.getElementById('inp-wp-lat').value = '';
        document.getElementById('inp-wp-lon').value = '';
        document.getElementById('inp-wp-chart').value = '';

        this.recalculateVoyage();
        MapService.plotRoute(State.routePoints);
        UIManager.renderRouteTable(State.routePoints);
        UIManager.unlockPlanningDashboard();
    },

    validateAppraisalLogic: function () {
        if (!State.appraisal) return;

        const engStatus = State.appraisal.engine ? State.appraisal.engine.status : 'pending';
        const isEngineOk = (engStatus === 'ok' || engStatus === 'restricted');

        // Validação dos novos campos ricos
        const hasCharts = State.appraisal.selectedCharts ? State.appraisal.selectedCharts.length > 0 : false;

        // Checklist Check (require status to not be pending or no-go)
        const isEngineValid = (engStatus === 'ok' || engStatus === 'restricted');

        // Meteo: Texto ou Arquivo
        const meteoVal = document.getElementById('txt-meteo-content') ? document.getElementById('txt-meteo-content').value : "";
        const hasMeteo = (meteoVal.length > 0 || State.appraisal.files.meteo !== null);

        // Navarea V: Texto ou Arquivo
        const navareaVal = document.getElementById('txt-navarea-content') ? document.getElementById('txt-navarea-content').value : "";
        const hasNavarea = (navareaVal.length > 0 || State.appraisal.files.navarea !== null);

        // Marés: Ambos arquivos (Dep/Arr) - REMOVED
        // const hasTides = (State.appraisal.files.tideDep !== null && State.appraisal.files.tideArr !== null);

        const isAllChecked = hasCharts && hasMeteo && hasNavarea; // removed hasTides

        if (State.appraisal) State.appraisal.isValid = (isAllChecked && isEngineValid);
        UIManager.updateAppraisalStatus(isAllChecked && isEngineValid);

        console.log(`App: Validacao - Charts: ${hasCharts}, Meteo: ${hasMeteo}, Navarea: ${hasNavarea}, Eng: ${isEngineValid}`);
    },

    handleFileUpload: function (event) {
        console.log("App: GPX Upload...");
        const file = event.target.files[0];
        if (!file) return;

        event.target.parentElement.classList.add('upload-active');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let points = GPXParser.parse(e.target.result);
                console.log(`App: ${points.length} pontos.`);

                // Check Reversal
                const chkReverse = document.getElementById('chk-reverse-gpx');
                if (chkReverse && chkReverse.checked) {
                    points.reverse();
                    console.log("App: Rota invertida conforme solicitado.");
                }

                State.routePoints = points;

                // Tenta auto-selecionar portos baseados na rota GPX
                this.autoSelectPortsFromGPX(points);

                this.recalculateVoyage();

                MapService.plotRoute(points);
                UIManager.renderRouteTable(points);
                UIManager.unlockPlanningDashboard();

                setTimeout(() => {
                    UIManager.switchTab('view-planning');
                    event.target.parentElement.classList.remove('upload-active');
                }, 500);

            } catch (error) {
                console.error("App: Erro GPX:", error);
                alert(`Erro GPX: ${error.message}`);
                event.target.parentElement.classList.remove('upload-active');
            }
        };
        reader.readAsText(file);
    },

    setDefaultTime: function () {
        const now = new Date();
        // Ajuste para timezone local correto no input datetime-local
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const el = document.getElementById('input-etd');
        if (el) {
            el.value = now.toISOString().slice(0, 16);
            console.log("App: Data inicial definida:", el.value);
        }
    },

    recalculateVoyage: function () {
        const inpEta = document.getElementById('inp-eta');

        if (!State.routePoints || State.routePoints.length < 2) {
            console.warn("App: Recalculate Voyage abortado - Sem rota definida.");
            if (inpEta) inpEta.title = "Defina a rota primeiro (Origem/Destino)";
            return;
        }

        if (typeof NavMath.calcLeg !== 'function') return;

        let totalDist = 0;
        for (let i = 0; i < State.routePoints.length - 1; i++) {
            totalDist += NavMath.calcLeg(
                State.routePoints[i].lat,
                State.routePoints[i].lon,
                State.routePoints[i + 1].lat,
                State.routePoints[i + 1].lon
            ).dist;
        }
        State.totalDistance = totalDist;

        const etdVal = document.getElementById('input-etd').value;
        if (etdVal) {
            const etdDate = new Date(etdVal);

            // Speed logic (Handle N/A or text)
            let speed = parseFloat(State.shipProfile?.speed);
            if (isNaN(speed) || speed <= 0) speed = 10.0; // Fallback to avoid division by zero

            const durationHours = totalDist / speed;
            const etaDate = new Date(etdDate.getTime() + (durationHours * 3600 * 1000));

            // Sync with New Sidebar Inputs
            const elEtaDisplay = document.getElementById('display-eta');
            const inpEtdSidebar = document.getElementById('input-etd');

            // Sync with Appraisal Inputs
            const inpEtdAppraisal = document.getElementById('inp-etd');
            const inpEtaAppraisal = document.getElementById('inp-eta');

            // Format for datetime-local (YYYY-MM-DDTHH:mm)
            const fmt = (d) => {
                const pad = n => n.toString().padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };

            // Format for Display (DD/MM HH:mm)
            const fmtDisplay = (d) => {
                const pad = n => n.toString().padStart(2, '0');
                return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };

            // Update Sidebar Display
            if (elEtaDisplay) {
                elEtaDisplay.innerText = fmtDisplay(etaDate);
            }

            // Update Appraisal Input
            if (inpEtaAppraisal) {
                inpEtaAppraisal.value = fmt(etaDate);
            }

            // Sync ETD (Sidebar -> Appraisal)
            // Note: The source of truth logic usually comes from the trigger. 
            // If Sidebar changed, sync Appraisal. If Appraisal changed, sync Sidebar.
            // Currently recalculateVoyage uses 'input-etd' (Sidebar) as source.
            if (inpEtdAppraisal && inpEtdAppraisal.value !== etdVal) {
                inpEtdAppraisal.value = etdVal;
            }

            // Also sync Sidebar if source was potentially different (redundant but safe)
            if (inpEtdSidebar && inpEtdSidebar.value !== etdVal) {
                inpEtdSidebar.value = etdVal;
            }

            // Update State (Redundant if listeners work, but safe)
            if (!State.voyage) State.voyage = {};
            State.voyage.depTime = etdVal;
            State.voyage.arrTime = fmt(etaDate);

            UIManager.updateDashboardStats(totalDist, etaDate, State.routePoints.length, speed);

            // Fuel Logic
            if (State.shipProfile) {
                const fuelRate = State.shipProfile.fuelRate || 0;
                const totalFuel = durationHours * fuelRate;
                const initialStock = State.shipProfile.fuelStock || 0;
                const rob = initialStock - totalFuel;

                const elReq = document.getElementById('stat-fuel-required');
                const elRob = document.getElementById('stat-fuel-rob');
                const elRate = document.getElementById('stat-fuel-rate-display');
                const elAuto = document.getElementById('stat-fuel-autonomy');

                if (elReq) elReq.innerText = `${Math.ceil(totalFuel).toLocaleString('pt-BR')} L`;
                if (elRob) elRob.innerText = `${Math.floor(rob).toLocaleString('pt-BR')} L`;
                if (elRate) elRate.innerText = `Base: ${fuelRate} L/h @ ${speed} kts`;

                if (elAuto) {
                    if (rob < 0) {
                        elAuto.innerText = "CRÍTICO";
                        elAuto.className = "text-red-600 font-bold blink";
                    } else if (rob < (initialStock * 0.1)) {
                        elAuto.innerText = "BAIXO (<10%)";
                        elAuto.className = "text-yellow-600 font-bold";
                    } else {
                        elAuto.innerText = "ADEQUADA";
                        elAuto.className = "text-green-600 font-bold";
                    }
                }
            }

            // Atualiza dados ambientais
            this.updateEnviroData(etdDate, etaDate);
        }
    },

    updateEnviroData: async function (etd, eta) {
        if (!State.routePoints.length) return;

        UIManager.renderWeatherCard('dep', null);
        UIManager.renderWeatherCard('arr', null);

        if (WeatherAPI) {
            // Busca dados. Se der erro 400 em um, o outro ainda funciona.
            if (WeatherAPI) {

                // Lógica: Se houver porto selecionado no dropdown, usa coord dele.
                // Se não, usa coord do GPX.

                const selDepVal = document.getElementById('select-dep').value;
                const selArrVal = document.getElementById('select-arr').value;

                let lat1 = State.routePoints[0].lat;
                let lon1 = State.routePoints[0].lon;
                let lat2 = State.routePoints[State.routePoints.length - 1].lat;
                let lon2 = State.routePoints[State.routePoints.length - 1].lon;

                if (selDepVal) {
                    const pDep = PortDatabase.find(p => p.id === selDepVal);
                    if (pDep) { lat1 = pDep.lat; lon1 = pDep.lon; }
                }

                if (selArrVal) {
                    const pArr = PortDatabase.find(p => p.id === selArrVal);
                    if (pArr) { lat2 = pArr.lat; lon2 = pArr.lon; }
                }

                // Busca dados
                const depPromise = WeatherAPI.fetchMetOcean(lat1, lon1, etd);
                const arrPromise = WeatherAPI.fetchMetOcean(lat2, lon2, eta);

                // Promise.allSettled é melhor aqui, pois se um falhar, o outro carrega
                // Mas para simplificar, usaremos o try/catch interno do WeatherAPI que já retorna objeto de erro
                try {
                    const [depData, arrData] = await Promise.all([depPromise, arrPromise]);
                    UIManager.renderWeatherCard('dep', depData);
                    UIManager.renderWeatherCard('arr', arrData);
                } catch (e) {
                    console.error("App: Erro crítico na atualização ambiental", e);
                }
            }
        }
    },

    updateWeatherStatusUI: function () {
        const spanStatus = document.getElementById('weather-status-display');
        if (!spanStatus) return;

        // Ensure service loaded
        // Use imported service or window object
        const svc = window.TideCSVService || TideCSVService;

        if (svc && svc.isLoaded) {
            const range = svc.getWeatherDateRange();
            if (range) {
                spanStatus.textContent = `Dados: ${range.min} a ${range.max}`;
                spanStatus.classList.remove('text-red-500', 'bg-red-50');
                spanStatus.classList.add('text-green-600', 'bg-green-50');
            } else {
                spanStatus.textContent = "Dados: Indisponíveis";
                spanStatus.classList.add('text-red-500', 'bg-red-50');
            }
        } else {
            // Maybe wait for load?
            if (svc) {
                // Check again in a bit
                setTimeout(() => this.updateWeatherStatusUI(), 1000);
            }
        }
    },

    populatePortDropdowns: function () {
        const fill = (id) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            PortDatabase.forEach(port => {
                const opt = document.createElement('option');
                opt.value = port.id;
                opt.innerText = port.name;
                sel.appendChild(opt);
            });
        };
        fill('select-dep');
        fill('select-arr');
    },

    handlePortSelection: function () {
        console.log("App: Porto alterado manualmente.");
        this.recalculateVoyage();

        // Tenta encontrar rota automática se ambos os portos estiverem selecionados
        const depId = document.getElementById('select-dep').value;
        const arrId = document.getElementById('select-arr').value;

        if (depId && arrId) {
            this.autoFindRoute(depId, arrId);
        }
    },

    autoFindRoute: function (depId, arrId) {
        const pDep = PortDatabase.find(p => p.id === depId);
        const pArr = PortDatabase.find(p => p.id === arrId);

        if (!pDep || !pArr) return;

        // Normaliza nomes para busca: "rio grande rs"
        const cleanName = (name) => name.toLowerCase().replace(/-..$/, '').replace(/[\u0300-\u036f]/g, "").trim();
        const originKey = cleanName(pDep.name);
        const destKey = cleanName(pArr.name);

        console.log(`App: Buscando rota auto de '${originKey}' para '${destKey}'...`);

        fetch('js/data/known_routes.json')
            .then(r => r.json())
            .then(routes => {
                // 1. Construir o Grafo
                // Nó = Port ID
                // Aresta = Rota (pode ser invertida)
                const graph = {};
                const THRESHOLD_NM = 30; // Tolerância Geo-Spatial

                // Helper para achar qual porto está perto de uma coordenada
                const findClosestPortId = (lat, lon) => {
                    let closestId = null;
                    let minD = 9999;
                    PortDatabase.forEach(p => {
                        const d = NavMath.calcLeg(lat, lon, p.lat, p.lon).dist;
                        if (d < minD) { minD = d; closestId = p.id; }
                    });
                    return minD < THRESHOLD_NM ? closestId : null;
                };

                routes.forEach(r => {
                    const startP = r.points[0];
                    const endP = r.points[r.points.length - 1];

                    const startNode = findClosestPortId(startP.lat, startP.lon);
                    const endNode = findClosestPortId(endP.lat, endP.lon);

                    if (startNode && endNode && startNode !== endNode) {
                        if (!graph[startNode]) graph[startNode] = [];
                        if (!graph[endNode]) graph[endNode] = [];

                        // Adiciona aresta direta
                        graph[startNode].push({ target: endNode, route: r, reverse: false, id: r.id });
                        // Adiciona aresta reversa
                        graph[endNode].push({ target: startNode, route: r, reverse: true, id: r.id });
                    }
                });

                // 2. Busca em Largura (BFS)
                const queue = [[depId]];
                const visited = new Set();
                const pathMap = {}; // { Node: { parent, edge } }

                let found = false;

                while (queue.length > 0) {
                    const path = queue.shift();
                    const node = path[path.length - 1];

                    if (node === arrId) {
                        found = true;
                        break;
                    }

                    if (visited.has(node)) continue;
                    visited.add(node);

                    const neighbors = graph[node] || [];
                    for (const edge of neighbors) {
                        if (!visited.has(edge.target)) {
                            if (!pathMap[edge.target]) {
                                pathMap[edge.target] = { parent: node, edge: edge };
                                queue.push([...path, edge.target]);
                            }
                        }
                    }
                }

                if (found) {
                    // 3. Reconstrói caminho
                    let curr = arrId;
                    const segments = [];
                    const routeNames = [];

                    while (curr !== depId) {
                        const info = pathMap[curr];
                        segments.unshift(info.edge);
                        routeNames.unshift(info.edge.id);
                        curr = info.parent;
                    }

                    const msg = segments.length === 1
                        ? `Rota Direta Encontrada:\n${routeNames[0]}`
                        : `Rota Composta Encontrada (${segments.length} trechos):\n${routeNames.join(' + ')}`;

                    if (confirm(`${msg}\n\nDeseja costurar e importar esta derrota?`)) {
                        console.log("App: Costurando rotas:", routeNames);
                        let finalPoints = [];
                        let seq = 1;

                        segments.forEach((seg) => {
                            let pts = JSON.parse(JSON.stringify(seg.route.points));
                            if (seg.reverse) pts.reverse();

                            pts.forEach(p => {
                                finalPoints.push({
                                    sequence: seq++,
                                    lat: p.lat,
                                    lon: p.lon,
                                    name: `WPT ${seq - 1}`,
                                    chart: ""
                                });
                            });
                        });

                        State.routePoints = finalPoints;
                        this.recalculateVoyage();
                        MapService.plotRoute(finalPoints);
                        UIManager.renderRouteTable(finalPoints);
                        UIManager.unlockPlanningDashboard();
                        alert(`Rota carregada: ${finalPoints.length} WPs via ${segments.length} arquivo(s).`);
                    }

                } else {
                    console.log("App: Nenhuma conexão encontrada no Grafo.");
                    // Feedback visual solicitado pelo usuário
                    alert(`Não foi possível calcular uma rota automática entre ${pDep.name} e ${pArr.name}.\n\nPossíveis causas:\n1. Não há arquivos GPX cobrindo este trecho.\n2. Os arquivos existentes não conectam os portos (distância > 30NM).`);
                }
            })
            .catch(e => console.error("App: Erro no auto-route", e));
    },

    autoSelectPortsFromGPX: function (points) {
        if (!points || points.length < 2) return;

        const start = points[0];
        const end = points[points.length - 1];

        const findClosest = (lat, lon) => {
            let closest = null;
            let minD = 9999;
            PortDatabase.forEach(port => {
                const d = NavMath.calcLeg(lat, lon, port.lat, port.lon).dist;
                if (d < minD) {
                    minD = d;
                    closest = port;
                }
            });
            return { port: closest, dist: minD };
        };

        const depMatch = findClosest(start.lat, start.lon);
        const arrMatch = findClosest(end.lat, end.lon);

        // Se estiver num raio de ~20NM, seleciona auto
        const THRESHOLD = 20;

        if (depMatch.port && depMatch.dist < THRESHOLD) {
            const sel = document.getElementById('select-dep');
            if (sel) {
                sel.value = depMatch.port.id;
                sel.dispatchEvent(new Event('change')); // Trigger fetch
            }
            console.log(`App: Auto-selecionado Partida: ${depMatch.port.name} (${depMatch.dist.toFixed(1)} NM)`);
        }

        if (arrMatch.port && arrMatch.dist < THRESHOLD) {
            const sel = document.getElementById('select-arr');
            if (sel) {
                sel.value = arrMatch.port.id;
                sel.dispatchEvent(new Event('change')); // Trigger fetch
            }
            console.log(`App: Auto-selecionado Chegada: ${arrMatch.port.name} (${arrMatch.dist.toFixed(1)} NM)`);
        }
    },

    checkBeamVisibility: function (lat, lon) {
        if (!this.availableLighthouses || this.availableLighthouses.length === 0) return;

        const DEFAULT_RANGE = 18; // NM (Standard visual range for major lights)
        const APPROACH_ZONE = DEFAULT_RANGE * 1.5;

        // Find closest
        let closest = null;
        let minD = Infinity;

        this.availableLighthouses.forEach(lh => {
            const d = NavMath.calcLeg(lat, lon, lh.latDec, lh.lonDec).dist;
            if (d < minD) {
                minD = d;
                closest = lh;
            }
        });

        const panel = document.getElementById('panel-beam-warning');
        if (!closest || minD > APPROACH_ZONE) {
            if (panel && !panel.classList.contains('hidden')) panel.classList.add('hidden');
            return;
        }

        // Show Panel
        if (panel) {
            panel.classList.remove('hidden');

            // Update Data
            document.getElementById('beam-lh-name').innerText = closest.name;
            const elDist = document.getElementById('beam-lh-dist');
            const elVis = document.getElementById('beam-lh-vis');

            if (elDist) elDist.innerText = minD.toFixed(1) + ' NM';

            if (minD <= DEFAULT_RANGE) {
                // Visible
                if (elVis) {
                    elVis.innerText = "VISÍVEL";
                    elVis.className = "font-bold text-sm text-green-400 blink";
                }
                panel.classList.add('border-green-500');
                panel.classList.remove('border-yellow-500');
            } else {
                // Approaches
                if (elVis) {
                    elVis.innerText = "OCULTO (APROX)";
                    elVis.className = "font-bold text-sm text-yellow-500";
                }
                panel.classList.remove('border-green-500');
                panel.classList.add('border-yellow-500');
            }
        }
    },

    startSimulation: function () {
        if (!State.routePoints.length) return alert("Carregue uma rota primeiro!");

        let i = 0;
        let progress = 0;
        const speedInput = document.getElementById('inp-sim-speed');
        const lblSpeed = document.getElementById('lbl-sim-speed');
        let speedMult = speedInput ? parseInt(speedInput.value) : 10;

        // Listener for dynamic speed change
        if (speedInput) {
            speedInput.addEventListener('input', (e) => {
                speedMult = parseInt(e.target.value);
                if (lblSpeed) lblSpeed.innerText = speedMult + 'x';
            });
        }

        // Setup UI
        UIManager.switchTab('view-monitoring');
        if (MapService) MapService.invalidateSize();

        if (this.simTimer) clearInterval(this.simTimer);

        // Simulation Loop
        const segmentTimeBase = 2000; // ms per segment at 1x

        this.simTimer = setInterval(() => {
            if (i >= State.routePoints.length - 1) {
                clearInterval(this.simTimer);
                alert("Viagem Concluída");
                return;
            }

            const p1 = State.routePoints[i];
            const p2 = State.routePoints[i + 1];

            // Advance progress
            progress += (speedMult / 100); // arbitrary step

            if (progress >= 1) {
                progress = 0;
                i++;
                return;
            }

            // Interpolate
            const curLat = p1.lat + (p2.lat - p1.lat) * progress;
            const curLon = p1.lon + (p2.lon - p1.lon) * progress;

            // Update Map
            MapService.updateShipPosition(curLat, curLon);

            // Check Beam Visibility
            this.checkBeamVisibility(curLat, curLon);

            // Update Dashboard Data (Fake SOG/COG for demo)
            // Calc COG
            const dLat = p2.lat - p1.lat;
            const dLon = p2.lon - p1.lon;
            const cog = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

            // Update UI Elements directly if they exist (hardcoded for speed)
            // (Ideally use UIManager, but traversing DOM is fast enough here)
            const elSog = document.querySelector('#view-monitoring .text-2xl'); // 1st one usually SOG
            const elCog = document.querySelectorAll('#view-monitoring .text-2xl')[1];

            if (elSog) elSog.innerHTML = (10 + (Math.random() * 1)).toFixed(1) + '<span class="text-xs font-sans font-normal text-gray-400">kts</span>';
            if (elCog) elCog.innerText = cog.toFixed(0) + '°';

        }, 50); // 20fps
    }
};

window.addEventListener('load', () => App.init());

window.State = State;
window.App = App;

export default App;