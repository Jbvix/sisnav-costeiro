SISNAV Costeiro - Módulo de Planejamento (v3.0)

Sistema de auxílio à navegação costeira compatível com IMO A.893(21), desenvolvido com arquitetura modular ES6 Mobile-First.

📋 Funcionalidades

Appraisal (Avaliação): Checklist interativo de segurança e praça de máquinas com validação lógica (GO/NO-GO).

Planning (Planejamento): Importação de rotas GPX (Navionics/Garmin), cálculo de pernas (Loxodromia) e estimativa de ETA.

Monitoring (Monitoramento): Visualização em mapa (Leaflet), plotagem de rota, XTE visual e painel de instrumentos simulado.

Tide Snapping (Correção de Maré): Algoritmo inteligente que decide se usa dados de maré da posição do navio (Oceânico) ou "atrai" para a estação maregráfica mais próxima (Costeiro).

🚀 Como Rodar (Crítico)

Este projeto utiliza Módulos ES6 (import/export) para manter o código limpo e separado. Devido a políticas de segurança de navegadores modernos (CORS), ele não funciona se aberto diretamente clicando no arquivo (protocolo file://).

Você deve simular um ambiente de produção utilizando um servidor HTTP local.

Opção A: Python (Nativo no Windows/Linux/Mac)

Abra o terminal na pasta raiz do projeto (/SISNAV).

Execute o comando:

python -m http.server


O terminal indicará a porta (geralmente 8000).

Abra o navegador e acesse: http://localhost:8000

Opção B: VS Code (Live Server)

Instale a extensão Live Server (Ritwick Dey).

Clique com botão direito no index.html > Open with Live Server.

📂 Arquitetura de Pastas (Hierárquica)

O projeto segue o padrão de separação de responsabilidades (SoC):

/SISNAV
├── index.html            # Entry point (Semântico e limpo)
├── README.md             # Documentação
│
├── css/
│   └── main.css          # Estilos globais e animações
│
└── js/
    ├── App.js            # CONTROLADOR: Orquestra todo o sistema.
    │
    ├── core/             # NÚCLEO: Lógica pura e estado.
    │   ├── NavMath.js    # Cálculos matemáticos (Haversine, Rhumb Line).
    │   ├── State.js      # Singleton de memória (Dados da viagem).
    │
    ├── services/         # SERVIÇOS: Comunicação externa.
    │   ├── MapService.js # Wrapper do Leaflet (Renderização).
    │   ├── WeatherAPI.js # Cliente HTTP (Open-Meteo).
    │   └── TideLocator.js# Lógica de busca de estações (Snapping).
    │
    └── utils/            # UTILITÁRIOS: Ferramentas auxiliares.
        ├── GPXParser.js  # Leitura e conversão de XML/GPX.
        └── UIManager.js  # Manipulação do DOM (HTML).


🛠️ Tecnologias e Dependências

Frontend: HTML5 Semântico, Vanilla JavaScript (ES6+).

Estilização: Tailwind CSS (CDN) + CSS Customizado (main.css).

Mapas: Leaflet.js (OpenStreetMap Tiles).

Dados: Open-Meteo API (Forecast & Marine).

👨‍💻 Notas do Desenvolvedor

Mobile-First: A interface foi desenhada pensando primeiramente em tablets e celulares usados no passadiço.

Endentação: Todo o código segue indentação estrita de 4 espaços para legibilidade.

Performance: O mapa só é renderizado/redimensionado quando a aba é ativada para economizar memória.

Autor: Jossian Brito (TugLife)
Versão: 3.0.0 Modular
Data: Dezembro/2025