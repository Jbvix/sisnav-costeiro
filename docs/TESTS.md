# Plano de Testes (QA) - SISNAV Costeiro v3.1

## Casos de Teste Manuais

### TC01: Login e Autenticação

* **Pré-condição:** Ter um Token/Senha válido.
* **Ação:** Acessar `login.html`, inserir credenciais incorretas, depois corretas.
* **Resultado Esperado:**
  * Credenciais erradas -> Msg "Acesso Negado".
  * Credenciais certas -> Redirecionar para `index.html` (com botão INICIAR).

### TC02: Fluxo "Start Journey"

* **Pré-condição:** Estar logado na `index.html`.
* **Ação:** Clicar no botão "INICIAR".
* **Resultado Esperado:** O Overlay (capa) deve desaparecer suavemente. A aba "Appraisal" deve abrir. O Tour deve iniciar (se for o primeiro acesso).

### TC03: Criação de Rota Manual

* **Pré-condição:** Aba "PLANN" ativa.
* **Ação:** Clicar no mapa 3 vezes para criar Waypoints. Clicar em um WP e arrastar.
* **Resultado Esperado:** A linha vermelha deve conectar os pontos. A tabela lateral deve atualizar Distância e Rumo.

### TC04: Persistência de Dados

* **Pré-condição:** Rota criada.
* **Ação:** Recarregar a página (F5).
* **Resultado Esperado:** (Se implementado no State) A rota deve permanecer ou o sistema deve avisar "Rota não salva". *Nota: Na v3.1 a persistência de rota é local (localStorage).*

### TC05: Painel Admin

* **Pré-condição:** Estar logado com Token "Admin".
* **Ação:** Acessar `/admin.html`. Criar um convite. Revogar o convite recém-criado.
* **Resultado Esperado:** O novo convite deve aparecer na lista. Após revogar, ele deve sumir ou ficar vermelho.

### TC06: Responsividade Mobile

* **Ação:** Abrir o sistema em modo responsivo (F12 > Mobile) ou celular real.
* **Resultado Esperado:** O Menu lateral deve virar um "Hambúrguer" ou abas inferiores. O mapa deve ser manipulável com toque (Touch).
