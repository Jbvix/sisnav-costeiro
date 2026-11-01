# Documentação Técnica e API - SISNAV Costeiro v3.0

## 1. Visão Geral
O **SISNAV Costeiro** é um sistema de auxílio à navegação focado em operações costeiras e restritas. Ele opera como uma Single Page Application (SPA) estática, utilizando JavaScript moderno (ES6 modules) no frontend e scripts Python no backend para coleta e processamento de dados ambientais (marés e meteorologia).

O sistema foi projetado para rebocadores portuários em viagem costeira entre os portos do Brasil. Antes da saída do rebocador, são coletadas e inseridas informações sobre o itinerário da viagem. O Comandante é responsável pela inserção das informações, garantindo que o planejamento esteja correto antes da partida.

## 2. Arquitetura do Sistema

### 2.1 Modelo Híbrido (Static + Data Pre-fetching)
*   **Frontend**: Vanilla JavaScript + Leaflet (Mapas). Consome dados estáticos CSV.
*   **Backend (Data Pipeline)**: Scripts Python (`scraping_tide.py`, `rebuild_csv.py`) que realizam o *web scraping* de sites como o *Tábua de Marés* e consolidam as informações em arquivos CSV.
*   **Camada de Dados**: Arquivos CSV (`tides_scraped.csv`, `weather_scraped.csv`) atuam como banco de dados local.

### 2.2 Fluxo de Dados
1.  **Coleta**: O operador executa `rebuild_csv.py` em porto (com internet).
2.  **Processamento**: O script acessa dados online, estrutura e salva em `./tides_scraped.csv`.
3.  **Consumo**: Durante a navegação (offline), o `TideCSVService.js` lê os CSVs.
4.  **Interpolação**: O frontend calcula a altura exata da maré para o instante atual usando interpolação senoidal entre os pontos discretos do CSV.

---

## 3. Estrutura de Arquivos

```text
/SISNAV
├── index.html            # Ponto de entrada da aplicação
├── tides_scraped.csv     # Banco de dados de marés (Gerado via Python)
├── weather_scraped.csv   # Banco de dados meteorológico
├── rebuild_csv.py        # Script orquestrador de atualização de dados
├── scraping_tide.py      # Módulo de scraping (Core logic)
│
├── js/
│   ├── App.js            # Controlador principal
│   │
│   ├── services/         # Camada de API Interna (Services)
│   │   ├── MapService.js      # Gerenciamento do Mapa Leaflet
│   │   ├── TideCSVService.js  # Leitura e processamento de CSVs
│   │   ├── TideLocator.js     # Lógica geoespacial (Snapping)
│   │   └── WeatherAPI.js      # Fachada unificada (Facade) para dados ambientais
│   │
│   └── core/             # Lógica de Negócio Pura
│       ├── NavMath.js    # Fórmulas de navegação (Loxodromia, etc)
│       └── State.js      # Gerenciamento de Estado Global
```

---

## 4. Documentação da API Interna (JS Services)

Como a aplicação não possui um backend REST tradicional, os "Serviços" JavaScript atuam como a API interna.

### 4.1 WeatherAPI (`js/services/WeatherAPI.js`)
Atua como **Facade**, orquestrando a chamada aos outros serviços para entregar um objeto de dados completo para a UI.

#### `async fetchMetOcean(lat, lon, dateObj)`
Retorna dados ambientais completos para uma coordenada e data.

*   **Parâmetros**:
    *   `lat` (Number): Latitude decimal.
    *   `lon` (Number): Longitude decimal.
    *   `dateObj` (Date): Objeto Date do Javascript.
*   **Retorno** (Object):
    ```json
    {
      "status": "OK",
      "locationType": "COSTEIRO" | "OCEÂNICO",
      "refStation": "Nome da Estação (ex: Santos)",
      "marine": {
        "tideHeight": 1.45,       // Altura atual (m)
        "tideTrend": "RISING",    // Tendência: RISING, FALLING, STABLE
        "waveHeight": 1.2,        // Altura onda (m)
        "isTideReliable": true
      },
      "atmosphere": {
        "windSpd": 12.5,          // Velocidade vento (nós)
        "windDir": "SE",          // Direção vento
        "temp": 24.5              // Temperatura (°C)
      }
    }
    ```

### 4.2 TideCSVService (`js/services/TideCSVService.js`)
Responsável pelo "Low-level data access" aos arquivos CSV.

#### `init()`
Carrega e faz o parse dos arquivos `tides_scraped.csv` e `weather_scraped.csv` para a memória (Map Cache). Deve ser chamado antes de qualquer outra função.

#### `getInterpolatedTide(stationName, dateObj)`
Realiza o cálculo matemático da maré exata no instante solicitado.

*   **Lógica**: Encontra o evento de maré anterior e o próximo. Aplica interpolação cosseno (Cosine Interpolation) para suavizar a curva entre Preamar e Baixa-mar.
*   **Retorno**: `{ height: Number, trend: String }`

#### `getWeatherAt(stationName, dateObj)`
Busca a previsão meteorológica mais próxima do horário solicitado (Matching por hora).

### 4.3 TideLocator (`js/services/TideLocator.js`)
Serviço de Geo-referenciamento que mapeia uma coordenada GPS arbitrária para a estação de monitoramento mais próxima.

#### `findNearest(lat, lon)`
*   **Lógica**: Calcula distância (Orthodromic/Haversine) para todas as estações cadastradas.
*   **Threshold**: Se a distância for < 30 NM, considera "COSTEIRO". Caso contrário, "OCEÂNICO".

---

## 5. Formato de Dados (CSV)

### 5.1 tides_scraped.csv
Arquivo gerado automaticamente pelo Python.
*   **Header**: `station_id, station_name, date, time, height, type`
*   **Exemplo**:
    ```csv
    BR_STS, Santos, 18/12/2025, 14:30, 1.4, HIGH
    BR_STS, Santos, 18/12/2025, 20:45, 0.2, LOW
    ```

### 5.2 weather_scraped.csv
Dados de previsão de vento, onda e temperatura.
*   **Header**: `station_id, station_name, date, time, wind_speed, wind_dir, wave_height, wave_dir, temp`
*   **Unidades**: Vento (km/h ou nós dependendo da fonte), Onda (m), Temp (°C).
    *   *Nota*: O `WeatherAPI.js` converte vento de km/h para nós (kn) automaticamente.

---

## 6. Scripts de Automação (Backend Python)

### `rebuild_csv.py`
Script principal para atualização da base de dados.
*   **Uso**: `python rebuild_csv.py`
*   **Função**: Percorre a lista de estações (`STATIONS_MAP`), chama o scraper para cada uma (prevendo 10 dias à frente) e reescreve o `tides_scraped.csv`.

### `scraping_tide.py`
Módulo core de Web Scraping.
*   **Dependências**: `requests`, `beautifulsoup4`.
*   **Fonte**: Extrai dados do site *tabuademares.com*.
*   **Classes**: `TideDataCollector` (Coleta HTML), `DailyTideInfo` (Estrutura de dados).
