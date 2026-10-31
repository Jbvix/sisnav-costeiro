# MANUAL DO USUÁRIO - SISNAV COSTEIRO v3.9.2

> Atualizado em 2026-10-29 21:30 (UTC-3) — Jossian Brito (Charlie Bravo). Novidades da v3.6.0 no fim do manual.

## 1. Visão Geral

O **SISNAV Costeiro** é uma ferramenta de auxílio ao planejamento e monitoramento de viagens costeiras, projetada para facilitar a elaboração de planos de viagem, cálculos de ETA, análises de marés e gestão de riscos.

O sistema é dividido em três módulos principais:

1. **APPRAISAL (Avaliação)**: Configuração inicial da viagem.
2. **PLAN (Planejamento)**: Detalhamento da rota, waypoints e referências.
3. **MONITOR (Monitoramento)**: Acompanhamento em tempo real (quando conectado).

---

## 2. Módulo Appraisal (Avaliação)

Nesta tela, você define os parâmetros fundamentais da viagem.

### 2.1. Configuração da Viagem

- **Portos**: Selecione o Porto de Origem e Destino.
- **Datas**:
  - **ETD (Partida)**: Selecione a data e hora de saída.
  - **ETA (Chegada)**: Calculado automaticamente com base na distância e velocidade. *Campo bloqueado para edição manual.*
- **Navio**:
  - **Velocidade de Cruzeiro**: Velocidade média planejada.
  - **Consumo/Estoque**: Dados para cálculo de autonomia.

### 2.2. Novas Funcionalidades (v3.4)

- **Configuração de Reboque**:
  - Defina o arranjo (Reboque Simples, Duplo, Empurrador).
  - Informe o comprimento do cabo de reboque.
- **Comunicações**:
  - Lista de Estações Costeiras monitoradas.
  - Canal de Trabalho (VHF principal).
  - **Contatos da Empresa**: Lista de contatos de emergência e suporte em terra.
- **Gestão de Riscos**:
  - Checklist simplificado para riscos operacionais (Mau tempo, Pirataria, Tráfego, etc.).
- **Tábuas de Marés**:
  - Seleção de arquivos da biblioteca digital para os portos de saída e chegada.

---

## 3. Módulo Plan (Planejamento)

O coração do sistema, onde a rota é visualizada e ajustada.

### 3.1. Mapa Interativo

- **Visualização**: Cartas náuticas, linhas de costa e batimetria.
- **Interação**: Arraste waypoints para ajustar a rota. O quadro de cronograma é atualizado instantaneamente.
- **Modo Visual (Snapper)**: Ferramenta para traçar rotas clicando em rotas conhecidas pré-mapeadas.

### 3.2. Tabela de Rota

A tabela detalha cada pernada (leg) da viagem:

- **WP / Posição**: Coordenadas do ponto.
- **Rumo / Distância**: Vetor para o próximo ponto.
- **ETA**: Previsão de passagem pelo ponto.
- **REF. FAROL (Novidade)**:
  - **Ícone Amarelo**: Farol visível (dentro do alcance nominal).
  - **Ícone Cinza**: Farol de referência (fora de alcance visual, mas próximo - até 50 NM).
  - **Alcance**: Exibe o alcance luminoso real (ex: "Alc: 18M").

### 3.3. Dados Ambientais

- **Meteo-Oceanografia**: Previsão de vento, onda e tempo para cada ponto da rota (via integração API).
- **Atualização**: Utilize o botão de "Atualizar" no cabeçalho para buscar dados recentes.

---

## 4. Módulo Monitor (Monitoramento)

Modo de execução da viagem.

- Exibe o progresso do navio sobre a rota planejada.
- Alertas de desvio de rota (XTE).
- Monitoramento de combustível e autonomia em tempo real.

## 5. Assistente Inteligente KRATOS (xAI)

O SISNAV Costeiro conta com o assistente náutico KRATOS, alimentado por Inteligência Artificial (xAI Grok).

- **Double-Check Operacional:** O KRATOS analisa em tempo real os dados preenchidos no Appraisal e no Planejamento de Rota, alertando sobre discrepâncias de combustível, ETA e perigos à navegação cruzados com avisos NAVAREA.
- **Consultas Rápidas:** Pode responder dúvidas operacionais utilizando a documentação da biblioteca (arquivos PDF) e cruzando informações de forma inteligente.
- **Importante:** O assistente atua de forma consultiva e colaborativa, a decisão e responsabilidade finais são sempre do Comandante.

## 6. Relatórios

Geração de documentos para arquivo ou inspeção (Port State Control).

- Exportação do Plano de Viagem em **PDF** ou **Excel**.
- Inclui todas as seções configuradas no Appraisal e a tabela de rota detalhada.

---
**Suporte Técnico**: Em caso de dúvdas, contate o administrador do sistema.


---
## Acesso Administrativo (v3.5.0-sec - 2026-10-13)
1. Abra `https://sisnav.tuglife.live/admin.html`.
2. **Usuário**: qualquer identificação (registro). **Senha**: a *chave de administrador* guardada no servidor em `~/.sisnav_admin_key` (cPanel > Gerenciador de Arquivos > pasta inicial, com "mostrar arquivos ocultos").
3. A chave fica apenas na aba aberta e some ao sair/fechar. Para trocar a chave, edite o arquivo e salve - vale imediatamente.
4. Convites agora existem **somente no servidor**. Usuários comuns entram por `login.html` com token + senha; o app envia o convite em cada operação sensível (upload de GPX, atualização de dados).


## Versão 3.6.0-cloud — Nuvem (2026-10-29)

### O que muda para o usuário
1. **Endereço**: o app passa a ser servido pelo Netlify (o endereço oficial continua `https://sisnav.tuglife.live` depois que o DNS for apontado). O assistente KRATOS, marés, frota e convites rodam no servidor Railway — você não precisa fazer nada diferente.
2. **Login**: igual (token + senha). Os convites existentes continuam válidos.
3. **Frota e contatos**: só aparecem para quem está logado com convite válido.
4. **Atualizar Dados (marés/meteo)**: a barra de progresso agora mostra cada etapa (antes ficava parada).

### Para o administrador
1. Login em `/admin.html` com a chave de administrador — agora definida na variável `SISNAV_ADMIN_KEY` do Railway (Variables), não mais em arquivo do cPanel.
2. **Reenviar convite / WhatsApp**: como o servidor guarda só o *hash* da senha, o botão gera uma **senha nova** e a anterior deixa de valer. Analogia: perdeu a chave do paiol, troca-se o segredo — não se faz cópia.
3. Os dados ficam no Supabase (projeto *tuglife-core*, tabelas `sisnav_*`). Backup: Supabase > Database > Backups.

### Problemas comuns
| Sintoma | Causa provável | Ação |
|---|---|---|
| "Convite inválido ou ausente" ao abrir a frota | Sessão expirada | Sair e entrar de novo em `login.html` |
| KRATOS "não configurado" | Falta `XAI_API_KEY` no Railway | Railway > serviço > Variables |
| Erro de CORS no console | `ALLOWED_ORIGINS` sem o domínio do Netlify | Incluir `https://<site>.netlify.app,https://sisnav.tuglife.live` |

### v3.6.1 (2026-10-30) — Link do convite
- O link enviado no convite (WhatsApp ou "olho") usa o endereço onde o painel admin está aberto. Depois do corte de DNS, gere convites sempre por `https://sisnav.tuglife.live/admin.html`.

### v3.7.0 (2026-10-30) — NAVAREA V oficial (DHN)
1. No Appraisal, informe **porto de saída** e **porto de chegada**.
2. Clique no botão de preenchimento automático **CHM** (ícone de nuvem/onda ao lado dos campos de Meteomarinha).
3. O sistema preenche: **Meteoromarinha** (CHM), **Avisos de Mau Tempo** (CHM) + **avisos-rádio costeiros** da rota, e **NAVAREA V / SAR** da rota — todos da DHN.
4. O cabeçalho de cada bloco mostra a hora de atualização da DHN e quantos avisos caem na área da rota. Avisos sem posição ficam numa lista "avaliar manualmente".
5. Pode ser usado a qualquer momento; o servidor guarda a consulta por até 30 minutos.

### v3.8.0 (2026-10-30) — Atualizar os Avisos-Rádio da DHN (favorito "Enviar ao SISNAV")
O site da Marinha só entrega os avisos-rádio a navegadores abertos por pessoas. Por isso a atualização é feita por um favorito:
1. Crie o favorito uma vez: nome "Enviar ao SISNAV", URL = linha que começa com `javascript:` em `tools/favorito_enviar_ao_sisnav.js`. Passo a passo clique a clique (Chrome e Edge) e tabela de mensagens em `docs/DEPLOY_CLOUD.md`, seção 4.
2. Abra a página oficial: Avisos-Rádio Náuticos e SAR (CHM).
3. Clique no favorito. Na 1ª vez, cole o token do seu convite (o código depois de `token=` no link).
4. Abre uma aba com "Avisos-Rádio recebidos". Pronto: o botão CHM do formulário já usa os dados novos.
5. Se o formulário mostrar "ATENÇÃO: cópia com N h", repita os passos 2 e 3.

### v3.8.1 (2026-10-30) — Conferir a versão em produção
1. O número da versão aparece no cabeçalho do app (abaixo de "PLANO DE VIAGEM") e no título da aba.
2. Para conferir a versão do servidor, abra `https://sisnav-costeiro-production.up.railway.app/api/health`. A resposta mostra `"version"` (ex.: `3.8.1`), `"release"` (data) e `"storage": "supabase"`.
3. Se a versão do cabeçalho e a do servidor forem diferentes logo após uma atualização, aguarde 2 a 3 minutos (o deploy ainda está em andamento) e recarregue a página com `Ctrl+F5`.

### v3.8.2 (2026-10-30) — Login em qualquer rede
1. O navegador agora conversa só com `https://sisnav.tuglife.live`; o próprio site repassa os pedidos ao servidor. Redes que bloqueavam o servidor (Wi-Fi de bordo ou da empresa) deixam de causar "Erro de conexão com servidor" no login.
2. Para conferir a versão em produção, use `https://sisnav.tuglife.live/api/health` (mesma resposta do endereço do Railway).
3. **Exceções:** o assistente KRATOS, o botão "Atualizar Dados" e o botão CHM continuam falando direto com o servidor (são consultas longas). Se apenas esses três falharem na sua rede, a causa é bloqueio do domínio `railway.app`: teste pelo 4G do celular ou peça liberação de `*.up.railway.app` ao TI.
4. Diagnóstico (para o suporte): aperte `F12` > aba **Console** > digite `SISNAV_ROUTE_INFO` > `Enter`. Deve aparecer `proxy: true`.

### v3.9.0 (2026-10-30) — Padrão Passadiço: iluminação Dia, Crepúsculo e Noite
1. No canto superior direito de qualquer tela (capa, login, app, admin) há três botões: **Dia**, **Crepúsculo** e **Noite**. No celular eles aparecem como ☀, ◐ e ☾.
   - **Dia:** luz do sol, cores originais.
   - **Crepúsculo:** cabine com pouca luz; fundo escuro azulado.
   - **Noite:** quarto noturno; só vermelhos de baixa luz, sem branco nem azul, para não ofuscar a visão noturna. O mapa também fica avermelhado.
2. A escolha fica salva neste navegador e vale para todas as páginas do SISNAV. Na primeira vez, o SISNAV segue o modo claro/escuro do aparelho.
3. As abas agora se chamam **1 Avaliação**, **2 Planejamento** e **3 Monitoramento** (as fases da IMO A.893). No celular, só a aba aberta mostra o nome.
4. Login: confira o código do convite mostrado no topo do formulário (ex.: `tl43••••`). Se a senha ou a conexão falharem, a mensagem aparece na própria tela, com a orientação do que fazer.
5. Recomendação de passadiço: à noite, use **Noite** e baixe também o brilho do tablet. O olho leva de 20 a 30 minutos para se readaptar ao escuro depois de um clarão branco.

### v3.9.1 (2026-10-30) — Avaliação: resumo e prontidão
1. No topo da aba **1 Avaliação** fica o **resumo da viagem**: rebocador e IMO, rota, saída e ETA (dd/mm/aaaa hh:mm). Ele se atualiza sozinho conforme você preenche o formulário.
2. O selo à direita mostra **PENDENTE · n itens** (âmbar) até a viagem estar liberada, e **PRONTO · GO** (verde) quando tudo estiver completo.
3. Logo abaixo, os **4 itens obrigatórios**. Cada um fica marcado em verde quando está pronto:
   - **Cartas e NTM:** pelo menos uma carta selecionada (mostra quantas).
   - **Meteoromarinha:** boletim colado ou carregado (botão "Buscar pela rota" ou "Colar").
   - **NAVAREA V:** avisos colados ou carregados pelo botão de rota.
   - **Checklist de máquinas:** aprovado ou restrito. NO-GO mantém a viagem pendente.
4. Os campos de data usam o calendário do navegador. Se o seu Chrome estiver em inglês, eles aparecem como mês/dia/ano; confira a data no resumo, que está sempre no formato brasileiro. Para mudar o calendário: Chrome > ⋮ > Configurações > Idiomas > coloque **Português (Brasil)** no topo e reinicie o navegador.

### v3.9.2 (2026-10-30) — Planejamento, Monitoramento e painel admin
1. **Planejamento:** o botão azul é sempre a ação principal (**Exportar PDF**, **Salvar**); os de contorno são de apoio (**Carregar**).
2. Para importar a rota, arraste o arquivo **.gpx** para a área tracejada ou clique nela. Marque **Inverter a rota ao importar** antes, se o GPX estiver no sentido contrário.
3. Os indicadores (distância, tempo de viagem, waypoints, combustível requerido e ROB na chegada) usam números grandes, em fonte de instrumento. A autonomia continua colorida: verde = adequada, âmbar = baixa (<10 %), vermelho = crítica.
4. **Monitoramento:** SOG e COG maiores no painel "Tempo real". As cores do botão GPS indicam o estado: verde = pronto, laranja = buscando sinal, vermelho = ativo/erro.
5. **Painel admin:** claro no modo Dia; segue Crepúsculo e Noite como as demais telas.
