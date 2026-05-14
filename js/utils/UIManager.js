/**
 * ARQUIVO: UIManager.js
 * MÓDULO: Gerenciador de Interface de Usuário (View Controller)
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 2.0.0
 * DESCRIÇÃO: 
 * Responsável por toda manipulação direta do DOM (HTML).
 * Recebe dados brutos dos serviços e os formata para exibição humana.
 * Isola a lógica de apresentação da lógica de negócios.
 */

import NavMath from '../core/NavMath.js';
import HelpService from '../services/HelpService.js';

const UIManager = {

    // Cache de seletores para performance
    elements: {
        tabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-section'),
        appraisalCard: document.getElementById('card-appraisal'),
        appraisalStatus: document.getElementById('status-badge-appraisal'),
        tableBody: document.getElementById('table-route-body'),
        statDist: document.getElementById('stat-distance'),
        statTime: document.getElementById('stat-duration'),
        statWps: document.getElementById('stat-waypoints'),
        displayEta: document.getElementById('display-eta'),
        weatherDep: document.getElementById('card-weather-dep'),
        weatherArr: document.getElementById('card-weather-arr'),
        weatherArr: document.getElementById('card-weather-arr'),
        planningDashboard: document.getElementById('planning-dashboard'),
        planningDashboard: document.getElementById('planning-dashboard'),
        coverScreen: document.getElementById('view-cover')
        // btnStart loaded in init()
    },

    /**
     * Inicializa a UI (Listeners de Eventos)
     */
    init: function () {
        // Fetch button dynamically on init (to avoid null in module scope)
        this.elements.btnStart = document.getElementById('btn-start-app');
        this.elements.coverScreen = document.getElementById('view-cover'); // Ensure cover is also fresh

        if (this.elements.btnStart) {
            console.log("UIManager: Botão Iniciar encontrado e ativado.");
            this.elements.btnStart.addEventListener('click', () => {
                this.dismissCover();
            });
        } else {
            console.error("UIManager: Botão Iniciar NÃO encontrado!");
        }
    },

    /**
     * Remove a tela de capa e inicia o app
     */
    dismissCover: function () {
        if (this.elements.coverScreen) {
            this.elements.coverScreen.classList.add('transition', 'duration-500', 'opacity-0', 'pointer-events-none');
            setTimeout(() => {
                this.elements.coverScreen.style.display = 'none';

                // Trigger initial Tab (Appraisal) to start the first tour
                this.switchTab('view-appraisal');
            }, 500);
        }
    },

    /**
     * Alterna entre as abas do sistema (Appraisal, Plan, Monitor)
     * @param {string} targetViewId - ID da section alvo (ex: 'view-planning')
     */
    switchTab: function (targetViewId) {
        // 1. Esconde todas as views
        this.elements.views.forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('block');
        });

        // 2. Remove estado ativo dos botões
        this.elements.tabs.forEach(btn => {
            btn.classList.remove('bg-slate-700', 'text-blue-300');
            btn.classList.add('text-slate-300');
        });

        // 3. Mostra view alvo
        const targetEl = document.getElementById(targetViewId);
        if (targetEl) {
            targetEl.classList.remove('hidden');
            targetEl.classList.add('block');
        }

        // 4. Ativa botão correspondente
        const activeBtn = document.querySelector(`button[data-target="${targetViewId}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-slate-300');
            activeBtn.classList.add('bg-slate-700', 'text-blue-300');
        }

        // Trigger Tour Context Check
        if (HelpService && typeof HelpService.checkAndStartTour === 'function') {
            HelpService.checkAndStartTour(targetViewId);
        }
    },

    /**
     * Atualiza o visual do Card de Appraisal (Checklist)
     * @param {boolean} isValid - Se o checklist está aprovado
     */
    updateAppraisalStatus: function (isValid) {
        const card = this.elements.appraisalCard;
        const badge = this.elements.appraisalStatus;

        if (isValid) {
            // Estilo APROVADO (Verde)
            card.classList.remove('border-red-500');
            card.classList.add('border-green-500');

            badge.className = "text-xs px-2 py-1 bg-green-100 text-green-800 rounded font-bold uppercase";
            badge.innerText = "APROVADO / GO";
        } else {
            // Estilo PENDENTE (Vermelho)
            card.classList.remove('border-green-500');
            card.classList.add('border-red-500');

            badge.className = "text-xs px-2 py-1 bg-red-100 text-red-800 rounded font-bold uppercase";
            badge.innerText = "PENDENTE / NO-GO";
        }
    },

    /**
     * Renderiza a tabela de rota com os dados processados
     * @param {Array} routePoints - Lista de waypoints
     */
    renderRouteTable: function (routePoints) {
        const tbody = this.elements.tableBody;

        // Ensure header matches via JS as fallback (or if user didnt update HTML yet)
        const thead = document.getElementById('table-route-head');
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th class="p-2 text-center w-8">WP</th>
                    <th class="p-2 text-center">Carta</th>
                    <th class="p-2 text-left">Ref. Farol</th>
                    <th class="p-2 text-center">Posição (DDM)</th>
                    <th class="p-2 text-center">Rumo</th>
                    <th class="p-2 text-center">Dist.</th>
                    <th class="p-2 text-center">Tempo</th>
                    <th class="p-2 text-center">ETA</th>
                    <th class="p-2 text-center">Total</th>
                    <th class="p-2 text-center">Horas</th>
                </tr>
            `;
        }

        tbody.innerHTML = ""; // Limpa tabela anterior

        if (!routePoints || routePoints.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-gray-400 italic">Nenhuma rota carregada.</td></tr>`;
            return;
        }

        // INIT VARIABLES FOR CALCULATIONS
        let cumDist = 0;
        let cumTimeHours = 0;
        const speed = (window.State && window.State.shipProfile && window.State.shipProfile.speed) ? parseFloat(window.State.shipProfile.speed) : 10;

        let startDate = new Date();
        if (window.State && window.State.voyage && window.State.voyage.depTime) {
            startDate = new Date(window.State.voyage.depTime);
        }

        // Helper for HH:MM format
        const fmtHours = (h) => {
            if (isNaN(h)) return "00:00";
            const hh = Math.floor(h);
            const mm = Math.round((h % 1) * 60);
            return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
        };

        // Loop para criar as linhas
        for (let i = 0; i < routePoints.length; i++) {
            const pCurrent = routePoints[i];
            const pNext = routePoints[i + 1]; // Can be undefined for last point

            // CALC LEG DATA (Using this point to next point)
            let crs = 0;
            let legDist = 0;
            let legTime = 0;

            if (pNext) {
                const leg = NavMath.calcLeg(pCurrent.lat, pCurrent.lon, pNext.lat, pNext.lon);
                crs = leg.crs;
                legDist = leg.dist;
                legTime = (legDist / speed); // Hours
            }

            // ACCUMULATED DATA (At this point)
            // For the first point, total dist is 0, total time is 0.
            if (i > 0) {
                const pPrev = routePoints[i - 1];
                const legPrev = NavMath.calcLeg(pPrev.lat, pPrev.lon, pCurrent.lat, pCurrent.lon);
                cumDist += legPrev.dist;
                cumTimeHours += (legPrev.dist / speed);
            }

            // ETA Calculation
            const etaDate = new Date(startDate.getTime() + (cumTimeHours * 3600 * 1000));
            const etaStr = etaDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
                etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Determine Chart
            let chartId = '-';

            // LOGIC: First and Last WP must show Approximation Chart of Port
            const isFirst = (i === 0);
            const isLast = (i === routePoints.length - 1);

            if (isFirst || isLast) {
                // Helper to find approximation chart
                const getApproxChart = (portName) => {
                    if (!portName) return null;
                    const n = portName.toUpperCase();
                    if (n.includes("VITORIA") || n.includes("VITÓRIA") || n.includes("TUBARÃO")) return "1410";
                    if (n.includes("RIO") && n.includes("JANEIRO")) return "1506";
                    if (n.includes("GUANABARA")) return "1506";
                    if (n.includes("SANTOS")) return "1711";
                    if (n.includes("RECIFE")) return "930";
                    if (n.includes("SUAPE")) return "930"; // Close enough or specific? 21030 is coastal.
                    if (n.includes("MUCURIPE") || n.includes("FORTALEZA")) return "710";
                    if (n.includes("SALVADOR")) return "1101";
                    if (n.includes("ITAQUI") || n.includes("SAO LUIS")) return "411";
                    if (n.includes("PARANAGUA")) return "1820";
                    if (n.includes("ITATIAIA") || n.includes("ITAJAÍ")) return "1805";
                    if (n.includes("IMBITUBA")) return "1904";
                    if (n.includes("RIO GRANDE")) return "21080"; // Fallback or specific?
                    return null;
                };

                const targetPort = isFirst ? State.voyage.depPort : State.voyage.arrPort;
                const approx = getApproxChart(targetPort);
                if (approx) {
                    chartId = approx;
                } else {
                    // Fallback normal logic if unknown port
                    chartId = pCurrent.chart || (window.AutomatedPlanningService && window.AutomatedPlanningService.chartGeoDB && Object.entries(window.AutomatedPlanningService.chartGeoDB).find(([id, bbox]) => {
                        // Simple bbox check would be better, but for now fallback to known logic or existing
                        return pCurrent.lat <= bbox.n && pCurrent.lat >= bbox.s && pCurrent.lon >= bbox.w && pCurrent.lon <= bbox.e;
                    })?.[0]) || '-';

                    // Try to get from ChartService if available
                    if (chartId === '-' && window.ChartService) {
                        const c = window.ChartService.getChartForPosition(pCurrent.lat, pCurrent.lon);
                        if (c) chartId = c.id;
                    }
                }
            } else {
                // Intermediate Waypoints: Use assigned chart or lookup Coastal
                if (pCurrent.chart) {
                    chartId = pCurrent.chart;
                } else if (window.ChartService) {
                    const c = window.ChartService.getChartForPosition(pCurrent.lat, pCurrent.lon);
                    if (c) chartId = c.id;
                } else if (window.AutomatedPlanningService && window.AutomatedPlanningService.chartGeoDB) {
                    const db = window.AutomatedPlanningService.chartGeoDB;
                    for (const [id, bbox] of Object.entries(db)) {
                        if (pCurrent.lat <= bbox.n && pCurrent.lat >= bbox.s &&
                            pCurrent.lon >= bbox.w && pCurrent.lon <= bbox.e) {
                            chartId = id;
                            break;
                        }
                    }
                }
            }

            // LIGHTHOUSE INFO
            const lhHtml = this.renderLighthouseInfo(pCurrent.lat, pCurrent.lon);

            // RENDER ROW
            const row = document.createElement('tr');
            row.className = "hover:bg-blue-50 border-b border-gray-100 transition duration-150 text-[11px]";

            row.innerHTML = `
                <td class="p-2 font-bold text-gray-400 text-center">${i + 1}</td>
                
                <td class="p-2 text-center font-bold text-blue-800">${chartId}</td>
                
                <td class="p-2 text-left border-l border-gray-50 max-w-[150px] overflow-hidden">
                   ${lhHtml}
                </td>

                <td class="p-2 text-center font-mono text-gray-500 leading-tight">
                    ${NavMath.formatPos(pCurrent.lat, 'lat')}<br>
                    ${NavMath.formatPos(pCurrent.lon, 'lon')}
                </td>

                <td class="p-2 text-center">
                    <span class="font-mono font-bold text-blue-700 bg-blue-50 px-1 rounded text-[10px]">
                        ${pNext ? crs.toFixed(1) + '°' : '-'}
                    </span>
                </td>

                <td class="p-2 text-center font-mono text-slate-600">
                    ${pNext ? legDist.toFixed(1) : '-'}
                </td>
                
                <td class="p-2 text-center font-mono text-slate-700">
                    ${pNext ? fmtHours(legTime) : '-'}
                </td>

                <td class="p-2 text-center font-mono text-slate-500 bg-gray-50">
                    ${etaStr}
                </td>

                <td class="p-2 text-center font-mono text-slate-600">
                    ${cumDist.toFixed(1)}
                </td>

                <td class="p-2 text-center font-mono text-slate-600">
                    ${fmtHours(cumTimeHours)}
                </td>
            `;
            tbody.appendChild(row);
        }

        // ADD TOTALS ROW (SPRINT 5)
        const totalRow = document.createElement('tr');
        totalRow.className = "bg-slate-200 font-bold text-xs border-t-2 border-slate-300";
        totalRow.innerHTML = `
            <td colspan="8" class="p-2 text-right uppercase text-slate-600">Totais da Viagem:</td>
            <td class="p-2 text-center text-slate-800">${cumDist.toFixed(1)}</td>
            <td class="p-2 text-center text-slate-800">${fmtHours(cumTimeHours)}</td>
        `;
        tbody.appendChild(totalRow);
    },

    /**
     * Helper para renderizar a coluna FAROL
     */
    renderLighthouseInfo: function (lat, lon) {
        if (window.App && typeof window.App.getNearestLighthouse === 'function') {
            const lh = window.App.getNearestLighthouse(lat, lon);
            const range = lh ? (lh.range || 10) : 10;
            const MAX_REF_RADIUS = 50.0; // Show as reference if within this radius

            if (lh && lh.dist <= MAX_REF_RADIUS) {
                const isVisible = lh.dist <= range;

                // Style based on visibility
                let iconClass = isVisible ? "text-yellow-500 animate-pulse" : "text-gray-300";
                let textClass = isVisible ? "text-slate-700" : "text-gray-400";
                let distClass = isVisible ? "text-gray-500" : "text-gray-300";

                const icon = `<i class="fas fa-lightbulb ${iconClass}"></i>`;

                return `
                    <div class="flex flex-col items-center leading-tight">
                        <span class="font-bold ${textClass} text-[10px]">${lh.name}</span>
                        <span class="text-[9px] ${distClass} font-mono">${icon} ${lh.dist.toFixed(1)} NM (Alc: ${range}M)</span>
                    </div>
                `;
            } else {
                return '<span class="text-gray-200 text-[9px]">-</span>';
            }
        }
        return '<span class="text-gray-200">-</span>';
    },
    /**
     * Atualiza os cartões de estatística (Dashboard)
     * @param {number} totalDist - Distância total em NM
     * @param {Date} eta - Data estimada de chegada
     * @param {number} wpCount - Contagem de waypoints
     */
    updateDashboardStats: function (totalDist, eta, wpCount, speed = 10.0) {
        this.elements.statDist.innerText = totalDist.toFixed(1) + " NM";
        this.elements.statWps.innerText = wpCount;

        // Cálculo dinâmico de tempo
        const safeSpeed = speed > 0 ? speed : 0.1; // Evita div por zero
        const totalHours = totalDist / safeSpeed;
        const days = Math.floor(totalHours / 24);
        const hours = Math.floor(totalHours % 24);
        // const m = Math.round((totalHours - h) * 60); // Minutes Removed as per request

        this.elements.statTime.innerText = `${days}d ${hours}h`;

        return;
    },

    /**
     * Renderiza o card de Clima/Maré (Estado de Loading ou Dados Finais)
     * @param {string} type - 'dep' (Partida) ou 'arr' (Chegada)
     * @param {object|null} data - Dados da WeatherAPI ou null para loading
     */
    renderWeatherCard: function (type, data) {
        const container = type === 'dep' ? this.elements.weatherDep : this.elements.weatherArr;

        if (!data) {
            container.innerHTML = `<span class="text-xs text-blue-500 animate-pulse"><i class="fas fa-satellite-dish fa-spin mr-1"></i> Sincronizando...</span>`;
            return;
        }

        if (data.status === 'ERROR') {
            container.innerHTML = `<span class="text-xs text-red-500 font-bold"><i class="fas fa-exclamation-triangle"></i> Falha na API</span>`;
            return;
        }

        const isCosteiro = data.locationType === 'COSTEIRO' || data.locationType === 'PORT';
        const badgeColor = isCosteiro ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';

        // Exact Data passed from WeatherAPI (Interpolated)
        const windSpd = data.atmosphere.windSpd !== null ? data.atmosphere.windSpd + ' kn' : '--';
        const windDir = data.atmosphere.windDir || '';
        const temp = data.atmosphere.temp !== null ? data.atmosphere.temp + '°C' : '--';
        const waveH = data.marine.waveHeight !== null ? data.marine.waveHeight.toFixed(1) + 'm' : 'Flat';
        const waveD = data.marine.waveDir || '';

        // Tide Interpolation Display
        let tideDisplay = '';
        if (data.marine.exactTideHeight !== undefined && data.marine.exactTideHeight !== null) {

            // Trend Icon Logic
            let trendIcon = '';
            let trendClass = 'text-gray-400';

            if (data.marine.tideTrend === 'RISING') {
                trendIcon = '<i class="fas fa-arrow-up"></i>';
                trendClass = 'text-blue-600 animate-pulse'; // Rising = Blue
            } else if (data.marine.tideTrend === 'FALLING') {
                trendIcon = '<i class="fas fa-arrow-down"></i>';
                trendClass = 'text-orange-600 animate-pulse'; // Falling = Orange
            }

            tideDisplay = `
                <div class="mt-2 bg-purple-50 p-1.5 rounded border border-purple-100">
                    <div class="text-[10px] text-purple-900 font-bold mb-0.5 flex justify-between items-center">
                        <span><i class="fas fa-water"></i> Maré Estimada</span>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] ${trendClass}">${trendIcon}</span>
                            <span class="text-xs bg-purple-200 px-1 rounded text-purple-800">${data.marine.exactTideHeight}m</span>
                        </div>
                    </div>
                     <div class="text-[9px] text-purple-400 text-right italic">
                        Calculado para ${data.exactTime || 'horário'}
                    </div>
                </div>
             `;
        } else {
            // Fallback to table if no exact calculation
            tideDisplay = this.renderTideInfo(data.marine);
        }

        container.innerHTML = `
            <div class="flex flex-col gap-1 w-full bg-slate-50 p-2 rounded border border-slate-200">
                <!-- Header -->
                <div class="flex justify-between items-center border-b border-slate-200 pb-1 mb-1">
                    <span class="text-[10px] font-bold ${badgeColor} px-1 rounded uppercase">
                        ${data.locationType}
                    </span>
                    <span class="text-[9px] text-gray-400 truncate max-w-[100px]" title="${data.refStation}">
                        ${data.refStation ? data.refStation : 'Alto Mar'}
                    </span>
                </div>

                <!-- Data Grid -->
                <div class="grid grid-cols-2 gap-2 text-xs">
                    
                    <!-- Weather Column -->
                    <div class="text-left border-r border-slate-200 pr-1 flex flex-col justify-center gap-1">
                        <div class="text-slate-700 font-bold flex items-center gap-1" title="Vento: ${windDir}">
                            <i class="fas fa-wind text-blue-400"></i> 
                            <span>${windSpd} <span class="text-[9px] text-gray-400 font-normal">${windDir}</span></span>
                        </div>
                        <div class="text-gray-600 text-[11px]">
                            <i class="fas fa-thermometer-half text-orange-400"></i> ${temp}
                        </div>
                    </div>
                    
                    <!-- Sea Column -->
                    <div class="text-right pl-1">
                        <div class="text-slate-700 mb-1" title="Ondas: ${waveD}">
                            <i class="fas fa-water text-blue-600"></i> ${waveH} <span class="text-[9px] text-gray-400">${waveD}</span>
                        </div>
                        ${tideDisplay}
                    </div>
                </div>
                
                <!-- Expanded Tide Table (Optional, maybe accordion style later) -->
                ${data.marine.exactTideHeight !== undefined ? this.renderTideInfo(data.marine, true) : ''}
            </div>
        `;
    },

    renderTideInfo: function (marineData, minimized = false) {
        if (marineData.tideEvents && marineData.tideEvents.length > 0) {

            const displayEvents = minimized ? [] : marineData.tideEvents.slice(0, 4);
            if (minimized) return ''; // Hide table if exact showed

            let html = '<div class="flex flex-col gap-0.5 mt-1 border-t border-purple-100 pt-1 opacity-75">';
            html += '<div class="text-[8px] text-purple-900 font-bold mb-0.5 uppercase">Próximos Eventos:</div>';

            marineData.tideEvents.slice(0, 4).forEach(evt => {
                html += `<div class="flex justify-between text-[9px] text-purple-700">
                           <span class="font-mono">${evt.time}</span> 
                           <span class="font-bold">${evt.height.toFixed(2)}m</span>
                         </div>`;
            });
            html += '</div>';
            return html;
        }
        return '';
    },


    /**
     * Desbloqueia o dashboard de planejamento (remove opacity e pointer-events)
     */
    unlockPlanningDashboard: function () {
        const dashboard = document.getElementById('planning-dashboard');
        if (dashboard) {
            console.log("UIManager: Desbloqueando dashboard...");
            dashboard.classList.remove('opacity-50', 'pointer-events-none');
            dashboard.classList.add('opacity-100', 'pointer-events-auto');
        } else {
            console.error("UIManager: Elemento #planning-dashboard não encontrado!");
        }
    }
};

export default UIManager;