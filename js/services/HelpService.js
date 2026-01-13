/**
 * HelpService.js
 * Módulo de Ajuda e Onboarding Interativo
 */
import AuthService from './AuthService.js';

const HelpService = {

    // Configuração dos Passos do Tour (Por Perfil)
    // Configuração dos Passos do Tour (Por View ID)
    tourSteps: {
        'view-appraisal': [
            {
                element: '#card-appraisal',
                title: 'Fase 1: Appraisal (Avaliação)',
                text: 'Aqui começa o planejamento. Preencha os dados da embarcação, portos e verifique os checklists iniciais.'
            },
            {
                element: '#btn-tab-planning',
                title: 'Próxima Fase',
                text: 'Após concluir a avaliação, avance para a aba PLAN para traçar a rota.'
            }
        ],
        'view-planning': [
            {
                element: '#btn-manual-plan',
                title: 'Fase 2: Planning (Planejamento)',
                text: 'Crie sua rota inserindo waypoints manualmente ou importando um arquivo GPX.'
            },
            {
                element: '#input-gpx', // Pointer to the box
                title: 'Importar Rota',
                text: 'Arraste seu arquivo GPX aqui para carregar uma rota automaticamente.'
            },
            {
                element: '#planning-dashboard',
                title: 'Dashboard da Viagem',
                text: 'Revise distâncias, tempos e consumo estimado antes de salvar.'
            },
            {
                element: '#btn-save-plan',
                title: 'Salvar Viagem',
                text: 'Ao finalizar, salve o plano para disponibilizá-lo para a frota.'
            }
        ],
        'view-monitoring': [
            {
                element: '#view-monitoring',
                title: 'Fase 3: Monitoring (Monitoramento)',
                text: 'Visão da Ponte de Comando. Acompanhe a execução da viagem em tempo real.'
            },
            {
                element: '#map-container',
                title: 'Carta Digital',
                text: 'O mapa exibe a posição real, tráfego AIS e alertas de proximidade.'
            },
            {
                element: '#stat-live-sog',
                title: 'Telemetria',
                text: 'Dados de velocidade (SOG) e curso (COG) atualizados ao vivo.'
            }
        ]
    },

    init: function () {
        this.injectStyles();
        this.createHelpButton();
        console.log("HelpService: Inicializado.");
    },

    /**
     * Verifica e inicia o tour para uma View específica se for a primeira vez
     * @param {string} viewId - ID da aba (ex: 'view-appraisal')
     */
    checkAndStartTour: function (viewId) {
        const session = AuthService.getSession();
        // Storage key unique per view + user type
        const key = `sisnav_tour_${viewId}_${session ? session.type : 'guest'}`;

        if (!localStorage.getItem(key)) {
            // Delay slightly to allow UI transition
            setTimeout(() => {
                this.startTour(viewId);
                localStorage.setItem(key, 'true');
            }, 800);
        }
    },

    injectStyles: function () {
        const style = document.createElement('style');
        style.textContent = `
            /* Help Button */
            #help-btn-float {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: #0ea5e9;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                cursor: pointer;
                z-index: 9999;
                transition: transform 0.2s;
                font-size: 24px;
            }
            #help-btn-float:hover { transform: scale(1.1); background: #0284c7; }

            /* Tour Overlay */
            .tour-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 10000;
                pointer-events: none; /* Let clicks pass only to highlighted? implementation details */
            }
            .tour-highlight {
                position: relative;
                z-index: 10001; /* Above overlay */
                box-shadow: 0 0 0 4px #0ea5e9, 0 0 0 5000px rgba(0,0,0,0.6); /* Trick for spotlight */
                border-radius: 4px;
                pointer-events: auto;
            }
            .tour-popover {
                position: absolute;
                background: white;
                width: 300px;
                max-width: 90vw;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                z-index: 10002;
                color: #334155;
            }
            .tour-popover h3 { font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #0ea5e9; }
            .tour-popover p { font-size: 14px; margin-bottom: 16px; line-height: 1.5; }
            .tour-actions { display: flex; justify-content: flex-end; gap: 8px; }
            .tour-btn { padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; }
            .tour-btn-next { background: #0ea5e9; color: white; }
            .tour-btn-skip { background: transparent; color: #94a3b8; }
        `;
        document.head.appendChild(style);
    },

    createHelpButton: function () {
        if (document.getElementById('help-btn-float')) return;

        const btn = document.createElement('div');
        btn.id = 'help-btn-float';
        btn.innerHTML = '<i class="fas fa-question"></i>';
        btn.title = "Ajuda & Manual";

        btn.addEventListener('click', () => {
            // Simple Menu
            const action = confirm("Escolha uma opção:\n\n[OK] para iniciar o Guia Interativo\n[CANCELAR] para abrir o Manual Completo (PDF)");
            if (action) {
                this.startTour();
            } else {
                window.open('manual.html', '_blank');
            }
        });

        document.body.appendChild(btn);
    },

    startTour: function (viewId) {
        const steps = this.tourSteps[viewId];

        if (!steps || steps.length === 0) {
            console.log(`HelpService: Nenhum tour configurado para ${viewId}`);
            return;
        }

        console.log(`HelpService: Iniciando tour para ${viewId}`);

        let currentStep = 0;

        // Cleanup prev tour
        this.endTour();

        const showStep = (index) => {
            if (index >= steps.length) {
                this.endTour();
                return;
            }

            const step = steps[index];
            const target = document.querySelector(step.element);

            if (!target) {
                // If element missing (e.g. hidden mode), skip
                console.warn("Tour element missing:", step.element);
                showStep(index + 1);
                return;
            }

            // Create Popover
            let popover = document.getElementById('tour-popover');
            if (!popover) {
                popover = document.createElement('div');
                popover.id = 'tour-popover';
                popover.className = 'tour-popover';
                document.body.appendChild(popover);
            }

            // Highlight Logic (using CSS class toggling on target)
            document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
            target.classList.add('tour-highlight');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 1. Set Content (Required for sizing)
            popover.innerHTML = `
                <h3>${step.title}</h3>
                <p>${step.text}</p>
                <div class="tour-actions">
                    <button class="tour-btn tour-btn-skip">Pular</button>
                    <button class="tour-btn tour-btn-next">${index === steps.length - 1 ? 'Concluir' : 'Próximo'}</button>
                </div>
            `;

            // 2. Measure Dimensions
            const rect = target.getBoundingClientRect();
            const popRect = popover.getBoundingClientRect();
            const popWidth = popRect.width;
            const popHeight = popRect.height;
            const portW = window.innerWidth;
            const portH = window.innerHeight;

            // 3. Smart Positioning
            let top, left;

            // Mobile (< 768px): Force Centered for best experience
            if (portW < 768) {
                top = (portH / 2) - (popHeight / 2);
                left = (portW / 2) - (popWidth / 2);
            } else {
                // Desktop Logic
                // Vertical: Prefer Bottom, Flip if needed
                top = rect.bottom + 15;
                if (top + popHeight > portH - 10) {
                    top = rect.top - popHeight - 15; // Flip Up
                }
                // Fallback to center if still bad
                if (top < 10) top = (portH / 2) - (popHeight / 2);

                // Horizontal: Center on target, Clamp to Viewport
                left = rect.left + (rect.width / 2) - (popWidth / 2);
                if (left < 10) left = 10;
                if (left + popWidth > portW - 10) left = portW - popWidth - 10;
            }

            // 4. Apply Coordinates
            popover.style.top = (top + window.scrollY) + 'px';
            popover.style.left = (left + window.scrollX) + 'px';

            // Bind Events
            popover.querySelector('.tour-btn-next').onclick = (e) => { e.stopPropagation(); showStep(index + 1); };
            popover.querySelector('.tour-btn-skip').onclick = (e) => { e.stopPropagation(); this.endTour(); };
        };

        // Create Overlay
        /* Note: The 'box-shadow' trick on .tour-highlight handles the overlay visual. 
           But we need a click blocker for standard interaction if strict mode.
           For this user-friendly tour, we just use visual highlight. */

        showStep(0);
    },

    endTour: function () {
        const pop = document.getElementById('tour-popover');
        if (pop) pop.remove();
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    }
};

export default HelpService;
