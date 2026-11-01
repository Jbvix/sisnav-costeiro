# Atualizações - 12 e 13 de Janeiro de 2026

## 1. Expansão do Plano de Viagem

Novos campos foram adicionados à tela de **Appraisal** para atender aos requisitos operacionais expandidos.

- **Configuração de Reboque**: Seção adicionada para especificar o arranjo de reboque e comprimento do cabo.
- **Comunicações Específicas**:
  - Adicionados campos para Estações Costeiras, Canal de Trabalho (VHF) e Contatos da Empresa.
  - Implementada lógica para salvar/carregar esses dados.
- **Gestão de Riscos (Simplificada)**:
  - Adicionada lista de verificação (checkboxes) para riscos comuns (Mau Tempo, Restrição de Visibilidade, Tráfego Intenso, Falha de Equipamento, Pirataria, Tráfego Entrada/Saída de Portos).

## 2. Melhorias na Tabela de Plano (Rota)

Aprimoramentos na visualização e sincronização da tabela "PLAN".

- **Coluna "REF. FAROL" Inteligente**:
  - **Alcance Visual**: Faróis dentro do alcance nominal continuam sendo exibidos com ícone amarelo e em destaque.
  - **Referências Não-Visuais**: Faróis fora do alcance visual, mas dentro de um raio de **50 NM**, agora são exibidos como referência geográfica (ícone cinza, texto discreto).
  - **Correção de Alcance**: Corrigido bug onde todos os faróis mostravam "10M" por padrão. Agora o sistema lê e exibe o alcance real (ex: 18M, 43M) do arquivo de dados.
- **Sincronização Total**:
  - A tabela agora é **recalculada automaticamente** em todas as situações:
    - Importação de arquivo GPX.
    - Adição manual de pontos.
    - Criação de pontos via "Modo Visual" (Snapping).
    - Alteração de Velocidade de Cruzeiro ou Data de Partida (ETD).

## 3. Integração de Dados Ambientais

- **Atualização Remota**: O botão de "Atualizar Clima" foi conectado ao backend (`/api/update-data`) para acionar o scraping de dados meteorológicos em tempo real.
- **Tábuas de Maré**:
  - Novo endpoint para listar arquivos PDF/DOCX da biblioteca.
  - Dropdowns na tela Appraisal para selecionar a Tábua de Maré de Saída e Chegada.

## 4. Refinamentos de Interface (UI/UX)

- **Tela Appraisal**:
  - **ETA (Data/Hora)**: O campo de data do ETA foi bloqueado para edição manual (ícone de calendário removido e fundo cinza), reforçando que é um valor calculado automaticamente pelo sistema.
- **Tela Plan**:
  - O rótulo "ETA Estimado" foi simplificado para apenas "**ETA**".
