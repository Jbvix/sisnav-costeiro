# Requisitos do Sistema - SISNAV Costeiro v3.1

## 1. Requisitos Funcionais (RF)

### Módulo de Planejamento (Planning)

* **RF01 - Criação de Rotas:** O sistema deve permitir criar rotas clicando no mapa ou inserindo coordenadas (Lat/Lon) manualmente.
* **RF02 - Importação GPX:** O usuário deve conseguir importar arquivos `.gpx` e visualizar a rota no mapa instantaneamente.
* **RF03 - Cálculo de Distância (Ruler):** O sistema deve calcular a distância total (NM) e o rumo (Course) entre cada perna da viagem (Rhum Line).
* **RF04 - Estimativa de Combustível:** Com base no perfil da embarcação (Consumo/Hora), o sistema deve estimar o gasto total da viagem.
* **RF05 - Consulta de Marés:** O sistema deve exibir dados de maré (Altura e Hora) para o porto de origem e destino, interpolando valores se necessário.

### Módulo de Monitoramento (Monitoring)

* **RF06 - Moving Map:** O mapa deve centralizar automaticamente na embarcação selecionada.
* **RF07 - Telemetria:** Exibir SOG (Speed Over Ground), COG (Course Over Ground) e Heading em tempo real.
* **RF08 - Status da Frota:** O admin deve ver uma lista de todos os navios ativos e seu status (Online/Offline).

### Módulo de Administração & Segurança

* **RF09 - Convites de Acesso:** O sistema não deve ter cadastro público. O Admin gera links de convite únicos.
* **RF10 - Níveis de Permissão:** Suporte a 3 perfis: Admin (Total), Planning (Edição) e Monitor (Leitura).
* **RF11 - Persistência:** As rotas e convites devem ser salvos em banco de dados local (JSON) no servidor.

## 2. Requisitos Não Funcionais (RNF)

* **RNF01 - Compatibilidade:** O sistema deve funcionar nas últimas versões do Chrome, Firefox e Edge.
* **RNF02 - Responsividade:** A interface deve se adaptar a Desktops (Escritório) e Tablets (Ponte de Comando).
* **RNF03 - Performance:** O carregamento inicial do mapa não deve exceder 3 segundos em conexões 4G.
* **RNF04 - Privacidade:** Dados de posição dos navios não devem ser acessíveis publicamente (apenas usuários logados).
* **RNF05 - Infraestrutura:** O backend deve ser leve para rodar em hospedagem compartilhada cPanel (Python/Flask).
* **RNF06 - Disponibilidade:** O sistema deve operar 24/7, com reinício automático em caso de falha (Passenger).
