# 01 - Especificação de Requisitos: SISNAV Costeiro v3.0

## 1. Introdução e Objetivo
O **SISNAV Costeiro** é um sistema de suporte à decisão para Comandantes e Oficiais de Náutica envolvidos em navegação costeira de rebocadores. Seu objetivo principal é garantir a conformidade com as normas da IMO (Resolução A.893(21) - Voyage Planning) e otimizar a segurança da navegação através da automação de cálculos e centralização de informações.

---

## 2. Requisitos Funcionais (RF)

### 2.1. Planejamento da Viagem (Appraisal & Planning)
*   **RF-01 (Cálculo de Rota):** O sistema deve calcular automaticamente a distância total, rumos e pernas da viagem entre dois portos pré-definidos.
*   **RF-02 (Estimativa de ETA):** O sistema deve calcular a Data/Hora Estimada de Chegada (ETA) com base na velocidade média inserida e data de partida.
*   **RF-03 (Validação de Calado):** O usuário deve informar os calados de popa e proa.
*   **RF-04 (Tripulação e Contatos):** O sistema deve permitir o cadastro da tripulação e contatos de emergência/terra para inclusão no relatório.

### 2.2. Segurança e Dados Ambientais
*   **RF-05 (Análise de Marés):** O sistema deve apresentar gráficos de maré para os portos de origem e destino, cobrindo uma janela de segurança (+/- 3h).
*   **RF-06 (Interpolação de Maré):** O sistema deve calcular a altura exata da maré para o minuto específico da chegada/saída (Snapping).
*   **RF-07 (Meteorologia):** O sistema deve permitir a inserção (colar texto) ou carregar automaticamente os boletins Meteomarinha e Avisos-Rádio (Navarea V).

### 2.3. Monitoramento em Tempo Real (Monitoring)
*   **RF-08 (Transmissão de Posição):** A embarcação deve ser capaz de transmitir sua posição GPS, velocidade (SOG) e rumo (COG) para o servidor central via internet (4G/Satélite).
*   **RF-09 (Visualização de Frota):** O escritório em terra deve visualizar a posição de todos os rebocadores ativos em um mapa unificado.
*   **RF-10 (Painel de Bordo):** O sistema deve, durante a viagem, exibir um painel com velocidade, rumo e previsão de chegada em tempo real.

### 2.4. Relatórios e Exportação
*   **RF-11 (Voyage Plan PDF):** O sistema deve gerar um arquivo PDF contendo todo o plano de viagem, validado e pronto para assinatura/arquivamento.

---

## 3. Requisitos Não-Funcionais (RNF)

*   **RNF-01 (Offline First):** O sistema deve operar plenamente sem internet para consultas de rotas e marés (dados pré-carregados). A internet só é necessária para atualizar a base de dados ou transmitir posição.
*   **RNF-02 (Portabilidade):** O sistema deve ser responsivo e funcionar em tablets (iPad/Android) e Desktops.
*   **RNF-03 (Performance):** O carregamento do mapa e cálculos de rota devem ocorrer em menos de 2 segundos.
*   **RNF-04 (Persistência):** Em caso de falha do servidor, o último estado da frota deve ser recuperado automaticamente (persistência em disco).
