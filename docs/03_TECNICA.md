# 03 - Documentação Técnica e API

## 1. Estrutura de Diretórios
```text
/SISNAV
├── css/              # Estilos (Tailwind input/output)
├── js/
│   ├── core/         # State.js, NavMath.js
│   ├── services/     # MapService.js, TideCSVService.js, WeatherAPI.js
│   └── App.js        # Controller Principal
├── docs/             # Documentação do Projeto
├── api/              # (Virtual) Endpoints do Flask
└── server.py         # Servidor de Aplicação
```

## 2. API do Backend (Flask)

O servidor `server.py` expõe endpoints RESTful para sincronização de frota.

### `POST /api/position`
Recebe telemetry da embarcação.
*   **Auth**: Não implementado (confiança na origem ou token futuro).
*   **Body (JSON)**:
    ```json
    {
      "id": "SAAM_CHILE",      // Identificador Único (IMO ou Nome Clean)
      "name": "SAAM CHILE",    // Nome Display
      "lat": -1.2345,
      "lon": -48.1234,
      "sog": 10.5,             // Speed Over Ground (kn)
      "cog": 270               // Course Over Ground (graus)
    }
    ```
*   **Resposta**: `200 OK` `{ "status": "success" }` ou `400/500 Error`.

### `GET /api/fleet`
Retorna a lista de navios ativos nas últimas 24 horas.
*   **Response (JSON Array)**:
    ```json
    [
      {
        "id": "SAAM_CHILE",
        "name": "SAAM CHILE",
        "lat": -1.2345,
        "lon": -48.1234,
        "sog": 10.5,
        "last_seen": 1735411200 // Unix Timestamp
      }
    ]
    ```

---

## 3. Serviços JavaScript (Frontend)

### 3.1. TideCSVService (`js/services/TideCSVService.js`)
Serviço crítico para análise de marés offline.
*   **`init()`**: Carrega `tides_scraped.csv` para memória.
*   **`getInterpolatedTide(station, date)`**:
    *   Algoritmo: Busca o pico (High) e vale (Low) adjacentes ao horário `date`.
    *   Fórmula: `H(t) = Mean + Amp * cos(k * t)` (Aproximação senoidal).

### 3.2. MapService (`js/services/MapService.js`)
Wrapper em torno do Leaflet.js.
*   **`init(containerId)`**: Inicializa o mapa focado no Brasil.
*   **`drawRoute(waypoints)`**: Plota a linha de rota (Polyline) e calcula a viewport para enquadrar a viagem (Bounds).
*   **`updateFleetMarkers(fleetArray)`**: Sincroniza os ícones no mapa.
    *   Lógica Inteligente: Se o navio já existe, apenas move o ícone (setLatLng) e gira (setRotationAngle) para evitar flicker de re-renderização.

---

## 4. Scripts de Automação (Python)

### `rebuild_csv.py`
Script de atualização da base de dados.
*   Lê `maritimo_mare_meteo.json` para obter a lista de URLs de origem.
*   Faz requisições HTTP (com headers de User-Agent reais) para evitar bloqueios.
*   Utiliza `BeautifulSoup` para extrair tabelas HTML.
*   Salva em `tides_scraped.csv` com formato: `ID, Nome, Data, Hora, Altura, Tipo`.

### `server.py` (Detalhes Internos)
*   **Persistência**: Utiliza `/tmp/sisnav_fleet_data.json` com travamento de arquivo (Atomic Write) para evitar que leituras (GET) ocorram enquanto um processo está escrevendo (POST).
*   **Garbage Collection**: No endpoint `GET /api/fleet`, remove automaticamente entradas mais velhas que 48 horas para manter o arquivo leve.
