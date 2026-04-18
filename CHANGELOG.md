# CHANGELOG — SISNAV Costeiro

> Histórico oficial de versões do sistema.  
> Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).  
> Versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [3.1.0] — 2026-01 (Atual)

### Adicionado
- Sistema de autenticação por convites com backend Flask (`/api/invites/*`)
- Persistência de posições de frota em tempo real (`/api/fleet`, `/api/position`)
- Módulo `protected_route.js` para controle de acesso ao frontend
- Dashboard administrativo (`admin_dashboard.html`) com gestão de tokens
- Painel de checklist de máquinas com 5 categorias operacionais
- Upload e armazenamento de print screens de cartas náuticas no relatório PDF
- Seleção visual de faróis e áreas de abrigo com base em lista dinâmica
- Suporte a Planejamento Visual com snapping em mapa Leaflet
- Importação de rotas GPX com opção de inversão automática
- Exportação completa do plano de viagem em PDF (jsPDF + AutoTable)

### Alterado
- Migração do servidor estático Python para Flask com API REST
- Tábua de marés agora usa interpolação cosseno entre eventos discretos
- Layout atualizado para Mobile-First com Tailwind CSS via CDN
- `TideLocator` com threshold de 30 NM para classificação COSTEIRO/OCEÂNICO

### Corrigido
- Correção de cálculo de ETA quando rota possui múltiplas pernas com velocidades distintas
- Renderização do mapa Leaflet ao alternar abas (redimensionamento lazy)

---

## [3.0.0] — Dezembro/2025

### Adicionado
- Arquitetura modular ES6 completa (`import/export`)
- Módulo `NavMath.js`: Haversine, Loxodromia (Rhumb Line), cálculo de rumo
- Módulo `State.js`: Singleton de estado global da aplicação
- Serviço `WeatherAPI.js`: Fachada unificada (Facade) para dados ambientais
- Serviço `TideCSVService.js`: Leitura e cache de arquivos CSV de marés
- Serviço `TideLocator.js`: Georreferenciamento para estação mais próxima
- Pipeline Python: `rebuild_csv.py` + `scraping_tide.py` + `scraping_weather.py`
- Suporte a arquivos GPX (Navionics/Garmin) via `GPXParser.js`
- Checklist pré-viagem com lógica GO/NO-GO (Appraisal)
- Calculadora de consumo de combustível e ROB estimado
- Visualização de rota em mapa com XTE visual (Monitoramento)
- Painel de instrumentos simulado com simulação de posicionamento GPS

### Arquitetura
- Separação de responsabilidades: `core/`, `services/`, `utils/`
- Compatibilidade com IMO A.893(21) — padrão de planejamento de viagem
- Mobile-First: interface otimizada para tablets de passadiço

---

## [2.x] — 2025 (Legado)

- Versão monolítica em arquivo único `app.js`
- Integração direta com Open-Meteo API (online-only)
- Sem suporte a dados offline de marés
- Autenticação não implementada

---

## [1.0] — Início do Projeto

- Prova de conceito: plano de viagem em HTML estático
- Calculadora básica de distância entre coordenadas

---

*Copyright (c) 2025 Jossian Brito. Todos os direitos reservados.*
