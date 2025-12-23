# Manual do Usuário - SISNAV Costeiro P-14

**Versão:** 3.0 (Dezembro 2025)
**Destinatário:** Comandantes e Oficiais de Navegação

---

## 1. Introdução
O **SISNAV Costeiro** é uma ferramenta de auxílio ao planejamento de viagens costeiras para rebocadores. Ele automatiza o cálculo de distâncias, estimativa de chegada (ETA), análise de marés e gera o **Relatório de Planejamento de Viagem (Appraisal)** em conformidade com as normas de segurança.

---

## 2. Roteiro Passo a Passo

O sistema é dividido em abas lógicas que seguem o fluxo de planejamento da IMO A.893(21).

### Passo 1: Configuração da Viagem (Dashboard)
Ao abrir o sistema, a aba "Planning" é exibida.
1.  **Dados do Navio**: Preencha (ou verifique) o nome do Comandante, Tripulação e calados (Popa/Proa).
2.  **Portos e Datas** (Barra Lateral Esquerda):
    *   **Porto de Saída**: Selecione na lista.
    *   **Porto de Chegada**: Selecione na lista.
    *   **ETD (Partida)**: Defina a data e hora de saída.
    *   *Nota*: Ao selecionar os portos, o sistema traçará automaticamente a rota se ela existir no banco de dados e calculará o **ETA** (Chegada Estimada) com base na velocidade média.

### Passo 2: Definição da Rota
Caso a rota não seja automática, você pode:
*   **Importar GPX**: Clicar em "Carregar Rota (GPX)" e selecionar um arquivo exportado do ECDIS ou OpenCPN.
*   **Planejamento Manual**: Clicar no botão "+" no mapa para plotar waypoints manualmente.

### Passo 3: Segurança e Documentação (Aba Appraisal)
Nesta seção, você valida a segurança da viagem.
*   **Cartas Náuticas**: Selecione as cartas que serão utilizadas na viagem.
*   **Meteomarinha**: Copie o texto completo do boletim meteorológico vigente e cole na caixa de texto.
*   **Navarea V**: Copie o texto dos avisos-rádio e cole na caixa de texto correspondente.
*   **Marés**: O sistema carrega automaticamente os dados de maré dos portos. Você pode anexar tábuas adicionais (PDF) se necessário.

### Passo 4: Contatos e Tripulação
Adicione os contatos de terra (Agência, Praticagem, Terminal) e a lista da tripulação para constar no relatório.

---

## 3. Análise Automática de Marés

O sistema possui uma inteligência integrada para marés:
*   **Gráfico de Maré**: Ao definir Data/Hora e Porto, o sistema gera automaticamente um gráfico da maré para uma janela de +/- 3 horas em relação à chegada/saída.
*   **Cálculo de Altura**: A altura da maré no momento exato da manobra é calculada e exibida no relatório.

---

## 4. Geração do Relatório (PDF)

Ao finalizar o preenchimento:
1.  Verifique se todas as luzes de status na barra lateral estão "Verdes" (OK).
2.  Clique no botão **"Exportar PDF"** na barra lateral.
3.  O sistema irá gerar um arquivo contendo:
    *   Dados da Embarcação e Viagem.
    *   Plano de Viagem detalhado (Waypoints, Rumos, Distâncias).
    *   Tabela de Distâncias Perna-a-Perna.
    *   Análise de Marés (Gráficos).
    *   Anexos completos de Meteomarinha e Navarea.
    *   Contatos e Tripulação.

Salve o arquivo PDF digitalmente ou imprima para assinatura.

---

## 5. Perguntas Frequentes (FAQ)

**P: O ETA não aparece.**
R: Certifique-se de que selecionou **ambos** os portos (Origem e Destino). O sistema precisa da rota para calcular a distância e o tempo.

**P: Como atualizo os dados de maré?**
R: Os dados de maré são atualizados via script Python (`rebuild_csv.py`) quando há conexão com internet. A bordo (offline), o sistema utiliza a última base de dados carregada.

**P: Posso colar texto formatado do Meteomarinha?**
R: Sim, o sistema aceita texto simples. Copie do site da Marinha ou email e cole diretamente. O formato será ajustado no relatório final.
