# Changelog - SISNAV Costeiro

## [v3.1.0] - 2026-01-03

### Adicionado

- **Deploy cPanel:** Suporte completo a hospedagem via Passenger/Python.
- **Painel Administrativo:** Nova tela `/admin.html` para gestão de convites.
- **Ajuda Contextual:** Tour guiado inteligente (`HelpService.js`) que detecta a aba ativa.
- **Botão Iniciar:** Fluxo de entrada corrigido com `UIManager.js` dinâmico.

### Corrigido

- **Race Condition:** Erro onde o botão "INICIAR" não respondia no carregamento da página.
- **Segurança:** Bloqueio de rotas API sem autenticação.
- **Dependências:** Inclusão de `flask-cors` e `requests` no build do servidor.

## [v3.0.0] - 2025-12-28

### Alterado

- **Refatoração Modular:** Migração de JS monolítico para módulos ES6 (`core/`, `services/`, `utils/`).
- **Novo Design:** UI atualizada com Tailwind CSS e paleta de cores "Ocean Blue".

## [v2.0.0] - 2025-12-15

### Adicionado

- **Previsão do Tempo:** Integração com OpenMeteo e interpolação de marés local.
- **Checklists:** Módulo de Appraisal com validação de segurança.

## [v1.0.0] - 2025-11-10

### Lançamento Inicial

- Mapa básico com Leaflet.
- Plotagem de rotas manuais.
- Lista de Faróis (CSV estático).
