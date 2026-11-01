# CHANGELOG — SISNAV Costeiro

## [3.13.0] - 2026-11-01 16:13 (UTC-3) - Condições previstas no mapa
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Adicionado
- **Monitoramento → botão "Condições no mapa"** e camada **"🌊 Condições previstas"** (`js/services/MapConditionsService.js`):
  - cada perna pintada pelo selo: verde = normal, âmbar = atenção, vermelho = restritivo, cinza tracejado = sem previsão; ao passar o mouse ou tocar, aparecem horário, onda, vento, corrente e SOG;
  - no meio de cada perna, seta de **vento** (para onde sopra) e de **corrente** (para onde corre), com a intensidade em nós;
  - marcadores nas **barras de saída e chegada**, com o selo e um resumo de maré, corrente, vento e onda;
  - legenda no canto do mapa, e o mapa enquadra a rota inteira.
- Reaproveita a previsão por perna e a janela da barra já consultadas no Planejamento; só consulta a Open-Meteo se faltar algum dado. Ao atualizar no Planejamento, o mapa redesenha sozinho.

### Corrigido
- `MapService.js` importa `State.js` sem `?v=8` (o App usa `?v=8`): para o navegador são dois módulos, com dois "States", e o mapa ficava invisível para os outros módulos. Nova função `MapService.getMapa()`; o comportamento atual do mapa não foi alterado.
- Endereços de módulo `MarineForecastService` e `BarraService` passam a `?v=2`, para os navegadores baixarem a versão nova.

## [3.12.0] - 2026-11-01 15:52 (UTC-3) - Janela da barra (saída e chegada)
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Adicionado
- **Planejamento → "Janela da barra":** um cartão para a **saída (ETD)** e outro para a **chegada (ETA)**, com:
  - **maré no horário:** altura, enchente/vazante/estofo (cm/h), preamar e baixa-mar anterior e próximas, curva de 24 h com a marca do horário;
  - **corrente** (a favor/contra no rumo da 1ª e da última perna), **vento** (médio, rajada, proa/popa), **onda e swell** (setor de chegada);
  - selo **Normal / Atenção / Restritivo** (mesmos limites da Etapa B) e botão **Tábua DHN**, que abre o PDF oficial do porto.
- `POST /api/marine/barra` (exige convite) e `marine_openmeteo.janela_barra()`: consulta a Open-Meteo na posição da **estação maregráfica da DHN mais próxima** do porto (até 50 km). Maré = nível do modelo + **nível médio (Z0) da DHN**, ou seja, referida ao zero da carta, como na tábua. Preamares e baixa-mares refinadas por parábola sobre a série horária.
- `tools/extrair_portos_dhn.py` → `dados/portos_dhn.json`: posição, nível médio, fuso e carta das **35 estações** das Tábuas das Marés DHN 2026 (lidos do cabeçalho dos PDFs).
- Mensagem clara quando a Open-Meteo recusa por **limite diário (HTTP 429)**, também na previsão por perna.

### Validação
- Comparação com a tábua DHN de Santos (01/01/2026): mesma forma da maré; alturas ~0,1–0,2 m acima; um horário de baixa-mar ~1h20 adiantado. O painel avisa "±20 cm e ±1 h; confira a tábua DHN".
- Lógica testada com maré sintética M2 (12,42 h): altura, tendência e extremos dentro de 1 minuto do cálculo à mão.

### Observações
- O limite diário gratuito da Open-Meteo é contado **por IP**, e o IP do servidor pode ser compartilhado com outros aplicativos. Avaliar uma chave paga se o 429 aparecer em produção.
- Defeito antigo registrado: em `js/services/PortDatabase.js`, Santos usa `csvName: 'Sepetiba'` no painel antigo de maré (CSV). A Janela da barra não usa esse campo.

## [3.11.0] - 2026-11-01 15:44 (UTC-3) - Rotas GPX enviadas ficam permanentes
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Corrigido
- **Rotas enviadas sumiam depois de um deploy:** o GPX ia só para o disco do Railway (que zera a cada deploy). Na próxima importação, o índice era refeito sem elas. Nenhuma rota tinha sido enviada pela nuvem até 01/11/2026, então nada se perdeu.
- GPX enviados apareciam com origem e destino "?": o nome saneado troca espaços por "_" (`santos_sp_x_suape_pe`), e o índice agora aceita o separador `_x_`.

### Adicionado
- Tabela `sisnav_gpx` no Supabase (migração `supabase/migrations/20261101_sisnav_gpx.sql`; RLS ligado, sem políticas, só o servidor acessa).
- `/api/upload-gpx`: valida extensão, tamanho (até 2 MB) e conteúdo (GPX legível com pelo menos 2 pontos); grava no banco e confere relendo; restaura os GPX do banco no disco e reconstrói o índice (repositório + enviados), publicado em `sisnav_kv` sem engolir erro.
- `sisnav_store.gpx_save()` / `gpx_list()`.

### Observação
- Os 10 GPX do repositório continuam vindo do próprio repositório (`gpx/`); não é preciso copiá-los para o banco.

## [3.10.3] - 2026-11-01 11:13 (UTC-3) - Arrumação do repositório
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Removido
- `deploy_sisnav_v3.4.0_20260113_1319.zip`, `debug.php` (expunha o caminho do servidor), `test_cgi.py`, `make_deploy_zip.py`, `contatos.txt` da raiz (dados pessoais; duplicava `library/CONTACTS.txt`) e a pasta `_arquivos_temporarios/` (38 arquivos).
- `library/`: 2 fotos de WhatsApp e 2 planos de viagem `.docx` de terceiros.
- Código morto da API Sealagom em `sealagom_chm.py` (8 funções e `SEALAGOM_BASE`) e a leitura de `SEALAGOM_API_TOKEN` em `/api/chm/fetch`. A Meteoromarinha e os Avisos de Mau Tempo do CHM continuam no mesmo módulo.

### Movido
- 21 scripts de depuração e uso único da raiz para `tools/legado/` (com `LEIAME.md`). O `parse_gpx.py` fica na raiz, porque é usado por `build_route_index.py`.
- Documentos antigos para `docs/historico/`: `proposta_atualizacao_v3_4_0.md`, `release_notes_2026_01_13.md`, `documentation.md`, `routing_strategy.md`.

### Observações
- Remover arquivos não apaga o histórico do git; a proteção dos dados pessoais vem do repositório privado.
- Mantidos até desligar o cPanel: `passenger_wsgi.py`, `.cpanel.yml`, `.htaccess`.
- Branches: a `main` passa a ser a cópia oficial; **Netlify e Railway seguem publicando a partir da `migracao-cloud-v3.6.0`** (a troca para a `main` não foi aplicada, conforme o diagnóstico do deploy de 01/11/2026). Regra adotada: cada versão avança `main` e `migracao-cloud-v3.6.0` para o mesmo commit.
- Repositório tornado **privado** em 01/11/2026 (informado pelo proprietário).

## [3.10.2] - 2026-10-30 23:36 (UTC-3) - Envio dos Avisos-Rádio confiável
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Corrigido
- **Favorito "Enviar ao SISNAV":** a aba do resultado abria só depois do download do JSON, e o bloqueador de pop-ups a barrava em silêncio ("nenhuma aba abriu"; nada chegava ao servidor). Agora abre no instante do clique; se o pop-up for negado, o envio acontece na própria aba. **É preciso refazer o favorito com a linha nova.**
- **Gravação confirmada:** `dhn_avradio.save_upload()` deixava de gravar sem avisar (o erro do banco era só registrado no log) e a página dizia "recebidos". Agora grava sem engolir erro, relê para conferir e, se falhar, mostra **"Não gravado"** com a causa. A confirmação informa quantos avisos foram gravados e a data da DHN.

### Diagnóstico (30/10/2026)
- Logs do Supabase: nenhuma tentativa de gravação em `sisnav_kv` no período do 1º envio. Com o relato "nenhuma aba abriu", a causa é o bloqueador de pop-ups.

## [3.10.1] - 2026-10-30 23:18 (UTC-3) - Favorito dos Avisos-Rádio pelo domínio oficial
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Corrigido
- `tools/favorito_enviar_ao_sisnav.js`: o envio vai para `https://sisnav.tuglife.live/api/dhn/avradio-upload` (o Netlify repassa ao Railway). Antes ia direto ao `*.up.railway.app`, bloqueado em algumas redes. Testado com um envio de 698 KB pelo repasse.
- **Ação:** quem já tem o favorito precisa trocar a URL pela linha nova.

## [3.10.0] - 2026-10-30 23:06 (UTC-3) - Etapa B: previsão do mar por perna (Open-Meteo)
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Adicionado
- `POST /api/marine/legs` (exige convite) + `marine_openmeteo.py`: onda (Hs, período, direção), swell, vento a 10 m (médio e rajada, em nós) e corrente no **ponto médio de cada perna**, na **hora prevista de passagem**. Todas as pernas numa única chamada à Marine e à Forecast; cache de 1 h; até 60 pernas; horizonte de 8 dias.
- Corrente decomposta no rumo: componente longitudinal (a favor/contra), transversal, **SOG estimada** e **abatimento** (graus, BE/BB); vento de proa/popa; setor da onda (proa/través/popa).
- Selo por perna: **normal / atenção** (Hs ≥ 2,0 m ou vento ≥ 20 kn) **/ restritivo** (Hs ≥ 3,0 m ou vento ≥ 28 kn). Limites em `marine_openmeteo.LIMITES`.
- Planejamento: painel **"Previsão do mar por perna"** com resumo (pior condição, Hs máx., vento máx., efeito da corrente no tempo) e tabela; aviso quando o ETD ou a velocidade mudam.
- Relatório PDF: seção **7.2 Condições do mar previstas por perna**, impressa quando a previsão foi consultada.

### Fontes e convenções (verificadas na documentação oficial)
- Onda e vento: direção "de onde vem"; corrente: "para onde vai". Corrente: MeteoFrance SMOC (Copernicus Marine), ~8 km, **inclui maré do modelo**; km/h convertido para nós (÷ 1,852).
- Licença CC BY 4.0, uso não comercial gratuito (limite: 10.000 chamadas/dia, 600/min). Uso comercial exige plano pago da Open-Meteo.
- **Complementar às fontes oficiais**: tábuas da DHN e Meteoromarinha do CHM continuam prevalecendo; o ETA oficial do plano não muda.

## [3.9.2] - 2026-10-30 22:40 (UTC-3) - Planejamento, Monitoramento e painel admin
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Alterado
- **Planejamento:** botões na regra única (Exportar PDF e Salvar = primários; Carregar = secundário; antes amarelo, vermelho, verde e laranja); área de importação de GPX neutra, com instrução; indicadores (distância, tempo, waypoints, combustível, ROB) no estilo de instrumento; tabela de pernas com cabeçalho condensado, linhas zebradas e dígitos alinhados.
- **Monitoramento:** SOG e COG maiores. Os botões Simular e GPS Real mantêm as cores, que indicam o estado do GPS (buscando, ativo, erro).
- **Painel admin:** redesenhado **claro** no Dia; Crepúsculo e Noite escurecem pela paleta, como o resto do sistema.

### Corrigido
- Horários nos cabeçalhos da v3.8.2 (18:14) e da v3.9.1 (22:36), que estavam diferentes da hora real dos commits.

## [3.9.1] - 2026-10-30 22:36 (UTC-3) - Avaliação no Padrão Passadiço
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Adicionado
- **Resumo da viagem** no topo da Avaliação: rebocador e IMO, rota (sem o código interno do porto), saída e ETA no formato brasileiro (dd/mm/aaaa hh:mm) e o selo **PRONTO · GO** / **PENDENTE · n itens**.
- **Prontidão**: os 4 itens obrigatórios (Cartas e NTM, Meteoromarinha, NAVAREA V, Checklist de máquinas), cada um com estado visível de longe.

### Alterado
- Selo do checklist e borda do cartão: **âmbar** = pendente, **verde** = pronto (vermelho fica para NO-GO real).
- Formulário unificado: um estilo de rótulo, caixas de grupo neutras (fim das caixas azul/laranja/verde), números em fonte de instrumento, campos com altura de toque e uma regra só de botões (primário = ação principal; secundário = apoio).
- `validateAppraisalLogic()` passa ao UIManager quais itens faltam. **Os critérios de liberação não mudaram.**

### Observação
- Os campos de data (calendário) seguem o idioma do navegador; num Chrome em inglês continuam mm/dd/aaaa. O resumo mostra sempre o formato brasileiro.

## [3.9.0] - 2026-10-30 22:26 (UTC-3) - Padrão Passadiço (visual e iluminação)
Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude

### Adicionado
- **Iluminação do passadiço** em todas as telas: **Dia**, **Crepúsculo** e **Noite** (IEC 62288). A Noite usa só vermelhos de baixa luz, para preservar a visão noturna. A escolha fica salva no navegador e vale para todas as páginas.
- `tools/gerar_paleta_passadico.py` → gera `css/passadico_paleta.css` (2.196 variáveis) a partir da paleta oficial do Tailwind v3.4.17 (`tools/tailwind_v3_cores.json`). O Dia mantém as cores originais.
- `js/passadico.js`: aplica a iluminação antes da página aparecer e faz o Tailwind ler as cores das variáveis (fundo, texto e borda separados).
- `css/passadico.css`: tipografia IBM Plex (Sans, Mono, Sans Condensed), cabeçalho, seletor de luz, capa, login e admin; mapa escurecido no Crepúsculo e avermelhado à Noite.
- `js/passadico_carta.js`: fundo de isobatimétricas (capa, login e admin).

### Alterado
- Marca **SISNAV · Costeiro by TugLife** em todas as telas; logo SAAM retirado da capa (a SAAM segue como frota).
- Fases em português: **Avaliação**, **Planejamento**, **Monitoramento** (IMO A.893).
- Login e admin redesenhados; erros aparecem na tela (antes: `alert`). Login mostra o convite mascarado e espera 0,3 s (antes 1,2 s).
- Painel admin e manual passam a seguir a iluminação.

### Corrigido
- Abas do app: o clique lia `e.target` (que passou a ser o texto dentro do botão). Agora usa `e.currentTarget`.
- Campos de formulário sem cor própria ficavam cinza no modo escuro do navegador.

## [3.8.2] - 2026-10-30 18:14 (UTC-3) - Proxy pelo Netlify (login em redes que bloqueiam o Railway)
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
