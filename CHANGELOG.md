# CHANGELOG — SISNAV Costeiro

## [3.6.0-cloud] - 2026-10-29 21:30 (UTC-3) - Migração para nuvem (Netlify + Railway + Supabase)
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Arquitetura
- **Front-end → Netlify** (`netlify.toml`, `scripts/build_netlify.sh`): publica só `dist/` (HTML/JS/CSS/biblioteca pública). Código Python, scripts de debug, `.docx` de viagens, fotos e planilhas ficam fora.
- **Back-end Flask → Railway** (`Procfile`, `railway.json`, `.python-version`, `gunicorn`): healthcheck em `/api/health`, porta via `$PORT`.
- **Banco → Supabase** (projeto *tuglife-core*, tabelas `sisnav_invites`, `sisnav_fleet`, `sisnav_kv`, RLS ligado sem políticas = só o servidor acessa). Migração em `supabase/migrations/20261029_sisnav_init.sql`.
- **Novo** `sisnav_store.py`: camada de persistência (Supabase se `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` existirem; senão JSON em `data/` — cPanel/local continuam funcionando).
- **Novo** `js/config.js`: roteia `api/...` para o Railway (`SISNAV_API_BASE`) e anexa `X-Invite-Token`/`X-Admin-Key` da sessão; marés/meteo/índice de rotas lidos de `/api/data/<arquivo>`.

### Segurança
- Senhas de convite com hash **PBKDF2-SHA256 (200.000 iterações + sal)**; senhas antigas em texto puro são convertidas no primeiro login. Os 2 convites de produção foram migrados já com hash (as senhas atuais continuam valendo).
- `/api/invites/list` não devolve mais senhas.
- `/api/fleet`, `/api/position` e `/api/contacts` agora exigem convite (antes abertas).
- `library/CONTACTS.txt` (telefones/e-mails reais) sai da área pública: servido por `/api/library/contacts.txt` com convite.
- CORS restrito a `ALLOWED_ORIGINS`.

### Corrigido
- `/api/update-data` emitia `\n\n` literal no fluxo SSE → a barra de progresso nunca atualizava.
- `/api/contacts` separava colunas por `\t` literal → lista de contatos sempre vazia.
- `UpdateService.js` abria um `EventSource` GET órfão (erro 405 a cada atualização).

### Alterado
- Painel admin: "Reenviar"/"WhatsApp" geram **nova senha** (o servidor não guarda mais a senha legível).

## [3.5.0-sec] - 2026-10-13 18:45 (UTC-3) - Hardening de segurança
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Segurança
- **Servidor decide o acesso**: rotas `/api/invites/create|list|update|delete` e `/api/system-info` exigem o cabeçalho `X-Admin-Key` (chave em `~/.sisnav_admin_key` ou variável `SISNAV_ADMIN_KEY`), comparada em tempo constante.
- **Convite obrigatório** em `/api/update-data` e `/api/upload-gpx` (cabeçalho `X-Invite-Token`).
- **Novo** `/api/admin/login`: login de admin validado no servidor (antes: localStorage do navegador).
- **Upload GPX**: nome saneado com `secure_filename` (bloqueia `../`).
- **Arquivos estáticos**: lista de permissões; `server.py`, `data/`, scripts, ocultos e `.txt/.csv` da raiz retornam 404.
- **Front-end**: removidos convites e senha de admin escritos em `DatabaseService.js`; os 2 convites foram migrados para `data/sisnav_invites_db.json` (substituir!).
- **Apache (.htaccess)**: CGI desligado; bloqueio de .py/.zip/.bak/.php/.md/ocultos e das pastas internas.

### Ações pendentes
- Gerar novos convites pelo painel admin e revogar os 2 migrados (senhas eram públicas).

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
