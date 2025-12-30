# Planejamento: Novo Layout do Relatório (V2)

Este documento detalha as alterações necessárias no código para atender ao modelo "IMO A.893(21) Simplificado" solicitado.

## 1. Alterações Estruturais (Layout PDF)
Refatoração de `js/services/ReportService.js`.

### 1.1. Capa (Cover Page)

*   **Novos Campos**:
    *   De / Para (Portos)
    *   Distância Total (MN)
    *   Tempo de Viagem (HH e DD:HH

### 1.2. Tabela de Rota (Waypoints)
A tabela será expandida de 5 para 9 colunas.
*   **Novas Colunas Calculadas**:
    *   `REF FAROL/DIST`: Requer busca geoespacial (`TideLocator` ou `Lighthouses`).
    *   `Tempo Naveg LEG`: Distância Leg / Velocidade.
    *   `ETA WPT`: Data de Partida + Tempo Acumulado.
    *   `Dist Total`: Soma acumulada das pernas.
    *   `Horas Total`: Soma acumulada do tempo.
*   **Input Existente**:
    *   `Carta N°`: Já existe no modal manual, mas precisa ser exposto na tabela de importação GPX (talvez uma coluna editável ou auto-preenchimento).

### 1.3. Seção "Print Screens Viagem" (NOVA FEATURE)
O usuário solicitou incluir imagens de trechos da carta.
*   **UI (`index.html`)**: Adicionar área de upload múltiplo na aba **Planning**.
*   **Logic (`App.js`)**: Armazenar as imagens (Base64 ou Blob URL) no `State`.
*   **PDF**: Iterar sobre as imagens e adicionar páginas ou seção específica no relatório.

### 1.4. Reorganização de Seções
1.  Capa
2.  Dados Embarcação
3.  Rota (+ Prints)
4.  Auxílios (Faróis, Cartas, Abrigos)
5.  Segurança (Contatos)
6.  Documentação/Referências (Marés, Metoc - Apenas menção de anexo)
7.  Análise de Maré (Gráficos)
8.  Anexos Reais ( Manter Mesma Tabela Estruturada - Landscape)
9.  Assinaturas

---

## 2. Plano de Execução

### Passo 1: UI de Upload de Prints
*   Adicionar container em `index.html` (Abaixo de "Cartas Náuticas" na aba Appraisal).
*   Permitir adicionar Título + Arquivo de Imagem.

### Passo 2: Atualização do `ReportService.js`
*   Reescrever a função `generatePDF` para seguir a nova ordem.
*   Implementar o loop de cálculo acumulativo para a tabela de rotas.

### Passo 3: Validação
*   Gerar um relatório de teste e verificar se as colunas de "Tempo" e "ETA" batem com a realidade.
