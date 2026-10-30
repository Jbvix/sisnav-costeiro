# CHANGELOG — SISNAV Costeiro

## [3.8.2] - 2026-10-30 21:20 (UTC-3) - Proxy pelo Netlify (login em redes que bloqueiam o Railway)
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Corrigido
- Login com "Erro de conexão com servidor" em redes que bloqueiam `*.up.railway.app` (Wi-Fi de bordo/empresa, antivírus, extensões), mesmo com o servidor no ar.

### Alterado
- O Netlify passa a repassar `/api/*` ao Railway (proxy). A regra é gerada em `dist/_redirects` por `scripts/build_netlify.sh` a partir de `SISNAV_API_BASE`.
- `js/config.js`: no domínio oficial e em `*.netlify.app`, as chamadas à API usam a própria origem; o navegador não fala mais com `railway.app` nem precisa de CORS.
- Exceções que continuam direto ao Railway (o proxy do Netlify corta respostas acima de ~26 s): KRATOS (`/api/kratos/chat`), "Atualizar Dados" (`/api/update-data`) e o botão CHM (`/api/chm/fetch`).
- Novo diagnóstico no console: `SISNAV_ROUTE_INFO`.
- Versão 3.8.2 em `version.py`, `index.html` e `js/App.js`.

## [3.8.1] - 2026-10-30 17:06 (UTC-3) - Correções pequenas (versão única e documentação)
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Corrigido
- `/api/health` informava a versão fixa `3.6.0-cloud`. Agora lê a constante `SISNAV_VERSION` do novo `version.py` (fonte única) e informa também `release` (data da versão).
- Textos de versão visíveis no front: título da aba e cabeçalho do `index.html` ("v3.1 Modular" → "v3.8.1") e mensagem de inicialização do `js/App.js` ("v3.4.0" → "v3.8.1").

### Documentação
- `.env.example` e `docs/DEPLOY_CLOUD.md`: removido `SEALAGOM_API_TOKEN` (Sealagom desligado desde a v3.7.0); documentadas as opcionais `DHN_AVRADIO_CACHE_S` e `DHN_AVRADIO_URL`.
- `docs/DEPLOY_CLOUD.md`: corrigido o passo do Railway — em serviços novos o `railway.json` não é lido; start command e healthcheck são definidos no painel (passo a passo). Nova seção 4, favorito "Enviar ao SISNAV": testes de bloqueio, criação no Chrome/Edge, uso diário e mensagens.
- Relatório de migração: nova seção "Avisos-Rádio DHN".

## [3.8.0] - 2026-10-30 (UTC-3) - Favorito "Enviar ao SISNAV" (Avisos-Rádio DHN)
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Contexto
- Testes de 30/10: o site da Marinha bloqueia a área de Avisos-Rádio para Railway (403), Cloudflare Worker (403), PowerShell no PC (403) e navegador headless (desafio "Um momento…"). Só um navegador real, aberto por uma pessoa, passa.

### Adicionado
- `POST /api/dhn/avradio-upload`: recebe o JSON oficial da DHN enviado pelo favorito, exige convite válido (ou chave admin), valida o formato, recusa versões mais antigas que a salva e grava em `sisnav_kv`.
- `tools/favorito_enviar_ao_sisnav.js`: favorito (bookmarklet) para clicar na página oficial de Avisos-Rádio; envia por formulário porque a CSP da Marinha bloqueia `fetch` para outros sites.
- Formulário avisa quando a cópia tem mais de 24 h.

### Corrigido
- Série "I" deixou de ser rotulada como NAVAREA V; NAVAREA V é reconhecido pelo número do aviso. Nomes das séries serão confirmados com os dados reais do primeiro envio.

## [3.7.1] - 2026-10-30 (UTC-3) - Avisos-rádio DHN: correção do 403 em produção
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Corrigido
- No Railway, a página de Avisos-Rádio do CHM respondeu 403 (WAF). `dhn_avradio.py` passa a usar os mesmos cabeçalhos de navegador da Meteoromarinha (que passa no WAF).
- Plano B no banco (`sisnav_kv`): o último endereço do JSON (`dhn_avradio_url`) e a última leitura boa (`dhn_avradio_last`) são usados quando a DHN recusa; o texto avisa "CÓPIA SALVA".

## [3.7.0] - 2026-10-30 (UTC-3) - Etapa A: NAVAREA V oficial da DHN
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Alterado
- **NAVAREA V, SAR e avisos-rádio costeiros** passam a vir da fonte oficial e gratuita da DHN/CHM (JSON público da página "Avisos-Rádio Náuticos e SAR"), no lugar da API paga Sealagom. Novo módulo `dhn_avradio.py`.
- Filtro pela derrota: entra todo aviso com qualquer ponto (marcador, polígono, linha, círculo ou coordenada escrita no texto) dentro da caixa da rota (portos ± 1°). Avisos NAVAREA V/SAR sem posição aparecem em lista separada para avaliação manual.
- O endereço do JSON é descoberto automaticamente (o nome muda a cada publicação); cache de 30 min (`DHN_AVRADIO_CACHE_S`); contingência: `DHN_AVRADIO_URL`.
- `SEALAGOM_API_TOKEN` deixa de ser necessário.

## [3.6.1] - 2026-10-30 (UTC-3) - Link de convite dinâmico
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Alterado
- Painel admin: o link do convite usa o endereço da página aberta (`window.location.origin`) em vez de `https://sisnav.tuglife.live` fixo no código. Convites gerados no Netlify apontam para o Netlify; após o corte de DNS, para o domínio oficial.

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
