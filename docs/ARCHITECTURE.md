# Arquitetura e Design - SISNAV Costeiro v3.1

## 1. Visão Geral da Arquitetura

O SISNAV Costeiro é uma aplicação web **Híbrida (Monólito Modular)** projetada para hospedagem em cPanel.

* **Frontend:** Single Page Application (SPA) construída com Vanilla JS, HTML5 e Tailwind CSS.
* **Backend:** Python (Flask) servindo como API REST e servidor de arquivos estáticos.
* **Banco de Dados:** Arquivos JSON locais (Flatfile Database) para portabilidade extrema.

```mermaid
graph TD
    User[Navegador do Usuário] -->|HTTPS| CPanel[Servidor cPanel / Passenger]
    CPanel -->|WSGI| Flask[App Python (Flask)]
    Flask -->|Leitura/Escrita| JSON[(Banco de Dados JSON)]
    Flask -->|Servir| Static[HTML/JS/CSS]
    Static --> User
```

## 2. Estrutura de Pastas

```
sisnav_app/
├── admin.html          # Painel de Administração (Privado)
├── index.html          # SPA Principal (Appraisal/Plan/Monitor)
├── login.html          # Tela de Login (Token-based)
├── server.py           # Backend Flask
├── passenger_wsgi.py   # Entry point cPanel
├── requirements.txt    # Dependências Python
├── docs/               # Documentação do Projeto
├── data/               # Dados Persistentes
│   ├── sisnav_invites_db.json # Convites e Usuários
│   └── sisnav_routes_db.json  # Rotas Salvas
├── js/
│   ├── App.js          # Controlador Principal
│   ├── core/           # Lógica de Negócios (NavMath, State)
│   ├── services/       # Comunicação (API, MapService, AuthService)
│   └── utils/          # Auxiliares (UIManager, GPXParser)
└── library/            # Arquivos Estáticos (Cartas, JSONs de Faróis)
    ├── CHARTS_BRAZIL.txt
    └── maritimo_mare_meteo.json
```

## 3. Padrões de Design (Frontend)

O Frontend segue uma arquitetura baseada em **Serviços** e **Estado Centralizado**:

* **State.js (Singleton):** Mantém o estado global da aplicação (rota atual, navio selecionado, perfil de usuário).
* **Service Pattern:** Cada responsabilidade externa (Mapa, Clima, Maré, Auth) é isolada em uma classe Service dedicada em `js/services/`.
* **UI Manager:** Toda manipulação de DOM é centralizada em `UIManager.js` para desacoplar a lógica da visualização.

## 4. Fluxo de Dados (Data Flow)

### Autenticação

1. Usuário acessa link com Token (`?token=XYZ`).
2. `AuthService.js` valida o token via API `/api/invites/validate`.
3. Servidor verifica e retorna o perfil (Admin/User) e ID da sessão.

### Sincronização de Marés

1. `TideJSONService.js` carrega `maritimo_mare_meteo.json` (Scraped Data) no boot.
2. Interpolação Cosseno é usada localmente (Client-side) para calcular a maré exata em qualquer hora.
