/**
 * HelpService.js
 * Módulo de Ajuda e Onboarding Interativo
 */
import AuthService from './AuthService.js';

const HelpService = {

    // Configuração dos Passos do Tour (Por Perfil)
    tourSteps: {
        planning: [
            {
                element: '#tab-btn-appraisal',
                title: 'Planejamento de Viagem',
                text: 'Aqui você cria suas rotas, define waypoints e consulta marés.'
            },
            {
                element: '#map-container',
                title: 'Mapa Náutico',
                text: 'Interaja com o mapa: clique para criar pontos, arraste para navegar.'
            },
            {
                element: '#btn-save-plan',
                title: 'Salvar Plano',
                text: 'Não perca seu trabalho! Venha aqui para salvar seu progresso.'
            },
            {
                element: '#help-btn-float',
                title: 'Ajuda',
                text: 'Dúvidas? Clique aqui a qualquer momento para rever este guia ou abrir o manual.'
            }
        ],
        monitor: [
            {
                element: '#view-monitoring',
                title: 'Modo Monitoramento',
                text: 'Esta é a visão da ponte. Acompanhe a posição e telemetria em tempo real.'
            },
            {
                element: '#live-badge',
                title: 'Status Ao Vivo',
                text: 'Indica qual embarcação está sendo rastreada no momento.'
            },
            {
                element: '#map-container',
                title: 'Moving Map',
                text: 'O mapa seguirá a embarcação automaticamente.'
            }
        ]
    },

    init: function () {
        this.injectStyles();
        this.createHelpButton();

        // Auto-start tour if first time
        const session = AuthService.getSession();
        if (session && !localStorage.getItem('sisnav_tour_seen_' + session.type)) {
            this.startTour();
            localStorage.setItem('sisnav_tour_seen_' + session.type, 'true');
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

    startTour: function () {
        const session = AuthService.getSession();
        const type = session ? session.type : 'planning';
        const steps = this.tourSteps[type] || this.tourSteps['planning'];

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

            // Position Popover (Naive Bottom-Right)
            const rect = target.getBoundingClientRect();
            // Default: Below
            let top = rect.bottom + 15;
            let left = rect.left;

            // Boundary checks (Simple)
            if (top + 200 > window.innerHeight) top = rect.top - 200; // Flip UP
            if (left + 300 > window.innerWidth) left = window.innerWidth - 320; // Flip LEFT

            popover.style.top = top + window.scrollY + 'px';
            popover.style.left = left + window.scrollX + 'px';

            popover.innerHTML = `
                <h3>${step.title}</h3>
                <p>${step.text}</p>
                <div class="tour-actions">
                    <button class="tour-btn tour-btn-skip">Pular</button>
                    <button class="tour-btn tour-btn-next">${index === steps.length - 1 ? 'Concluir' : 'Próximo'}</button>
                </div>
            `;

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
