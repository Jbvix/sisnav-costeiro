# Proposta de Atualização v3.4.0 - SISNAV Costeiro

## 1. Contexto e Objetivo

Esta proposta visa oficializar e aplicar no ambiente de produção (Cpanel/Nuvem) as melhorias desenvolvidas e validadas no ambiente local nos dias 12 e 13 de Janeiro de 2026.
O foco da atualização é a expansão das capacidades de planejamento (Appraisal), correção de informações críticas (Alcance de Faróis) e melhoria da infraestrutura de acesso (Rede Local e Remota).

---

## 2. Resumo das Alterações (Changelog)

### 2.1. Funcionalidades (Appraisal & Plan)

- **Expansão do Plano de Viagem**:
  - Adicionado suporte para **Configuração de Reboque** (Arranjo e Comprimento do Cabo).
  - Nova seção de **Comunicações Específicas** e **Gestão de Riscos Simplificada**.
  - Integração com **Tábuas de Marés** (Seleção de arquivos PDF/DOCX da biblioteca).
- **Correções Críticas**:
  - **Alcance dos Faróis**: Corrigido bug onde todos os faróis exibiam "10M". O sistema agora exibe o alcance real.
  - **Sincronização**: A tabela de rota ("PLAN") agora atualiza automaticamente ao alterar velocidade, ETD ou importar rotas.
- **Usabilidade**:
  - Campo **ETA** bloqueado para edição manual (cálculo automático).
  - Rótulo simplificado de "ETA Estimado" para "ETA".
  - Indicação visual de faróis "não visíveis" (referências geográficas) na tabela.

### 2.2. Infraestrutura e Acesso

- **Habilitação de Acesso em Rede Local (LAN)**:
  - O servidor (`server.py`) foi reconfigurado para aceitar conexões externas (`host='0.0.0.0'`).
  - O painel administrativo (`admin_dashboard.html`) foi atualizado para **detectar automaticamente o IP da máquina**.
  - **Benefício**: Permite que usuários na mesma rede (navio ou escritório) acessem o sistema via IP (ex: `192.168.0.x`) sem precisar de internet ou links "localhost".

---

## 3. Impacto Operacional

- **Acesso Remoto**:
  - No servidor local (Navio): Os links gerados serão do tipo `http://192.168.x.x:5000/...`.
  - No servidor nuvem (Cpanel): Os links continuarão sendo `https://tuglife.live/...`, garantindo funcionamento híbrido.
- **Performance**: Nenhuma alteração significativa de performance esperada.
- **Segurança**: A abertura para rede local exige que a rede Wi-Fi/Cabo seja segura (uso interno).

---

## 4. Plano de Implantação (Deployment)

Para aplicar esta atualização no servidor de produção (CPANEL), os seguintes passos são necessários:

1. **Backup**: Realizar backup dos arquivos atuais no servidor (`public_html/sisnav`).
2. **Upload de Arquivos**: Substituir os seguintes arquivos pelas versões v3.4.0:
    - `index.html` (Interface Principal)
    - `admin_dashboard.html` (Painel Admin)
    - `js/App.js` (Lógica Principal)
    - `js/utils/UIManager.js` (Renderização de Tabelas)
    - `server.py` (Backend Python)
    - `MANUAL_DO_USUARIO.md` (Documentação Atualizada)
3. **Reinicialização**: Reiniciar o processo Python no Painel de Controle (Setup Python App > Restart).
4. **Validação**:
    - Acessar `tuglife.live` e verificar se a versão exibida no console/rodapé é v3.4.0.
    - Gerar um novo convite e testar o acesso.

---

**Status da Proposta**: ✅ Pronta para Implantação.
