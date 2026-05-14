# MANUAL DO USUÁRIO - SISNAV COSTEIRO v3.4.0

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

## 5. Relatórios

Geração de documentos para arquivo ou inspeção (Port State Control).

- Exportação do Plano de Viagem em **PDF** ou **Excel**.
- Inclui todas as seções configuradas no Appraisal e a tabela de rota detalhada.

---
**Suporte Técnico**: Em caso de dúvdas, contate o administrador do sistema.
