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
        planningDashboard: document.getElementById('planning-dashboard')
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
        tbody.innerHTML = ""; // Limpa tabela anterior

        if (!routePoints || routePoints.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400 italic">Nenhuma rota carregada.</td></tr>`;
            return;
        }

        // Loop para criar as linhas
        for (let i = 0; i < routePoints.length - 1; i++) {
            const p1 = routePoints[i];
            const p2 = routePoints[i + 1];

            // Calcula perna individual
            const leg = NavMath.calcLeg(p1.lat, p1.lon, p2.lat, p2.lon);

            const row = document.createElement('tr');
            row.className = "hover:bg-blue-50 border-b border-gray-100 transition duration-150";

            row.innerHTML = `
                <td class="p-3 font-bold text-gray-400 text-center">${i + 1}</td>
                <td class="p-3">
                    <div class="font-bold text-slate-700 text-sm">${p1.name}</div>
                    <div class="text-[10px] text-gray-400 uppercase tracking-wide">to ${p2.name}</div>
                </td>
                <td class="p-3 text-center">
                    <span class="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs">
                        ${leg.crs.toFixed(1)}°
                    </span>
                </td>
                <td class="p-3 text-center font-mono text-sm text-slate-600">
                    ${leg.dist.toFixed(1)}
                </td>
                <td class="p-3 text-center text-[10px] font-mono text-gray-400 hidden md:table-cell">
                    ${NavMath.formatPos(p2.lat, 'lat')}<br>
                    ${NavMath.formatPos(p2.lon, 'lon')}
                </td>
            `;
            tbody.appendChild(row);
        }
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
        const h = Math.floor(totalHours);
        const m = Math.round((totalHours - h) * 60);

        this.elements.statTime.innerText = `${h}h ${m}m`;

        if (eta && !isNaN(eta)) {
            const options = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
            this.elements.displayEta.innerText = eta.toLocaleDateString('pt-BR', options);
        } else {
            this.elements.displayEta.innerText = "--/-- --:--";
        }
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