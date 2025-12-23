/**
 * ARQUIVO: State.js
 * MÓDULO: Gerenciamento de Estado Global (Singleton)
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 3.0.0 (Estrutura Hierárquica Final)
 * DESCRIÇÃO:
 * Armazena as variáveis voláteis da aplicação durante a execução.
 * Centraliza os dados para acesso fácil por outros módulos (App, UI, Map).
 * * ESTRUTURA:
 * - routePoints: Array de objetos com os waypoints da rota atual.
 * - totalDistance: Distância acumulada da rota em milhas náuticas.
 * - isAppraisalValid: Booleano que define se o checklist de segurança foi aprovado.
 * - mapInstance: Referência ao objeto Leaflet do mapa.
 * - layers: Camadas do mapa (rota, navio, etc).
 */

const State = {
    // Dados de Navegação
    routePoints: [],      // Array contendo os waypoints carregados do GPX
    totalDistance: 0,     // Distância total da rota em NM

    // Perfil da Embarcação (Dados Operacionais)
    // Perfil da Embarcação (Dados Operacionais)
    shipProfile: {
        name: "SAAM CARAJÁ",   // Default (Exemplo)
        imo: "9457488",        // Default IMO
        commander: "",
        branch: "ITAGUAÍ",     // Filial
        crew: 6,               // Tripulação
        date: new Date().toISOString().split('T')[0], // Data Elaboração
        speed: 10.0,           // Velocidade de cruzeiro (nós)
        towSpeed: 0.0,         // Velocidade rebocando (nós)
        fuelRate: 150.0,       // Consumo (Litros/Hora)
        fuelStock: 33200.0,    // Estoque inicial (Litros)
        draft: {
            aft: 5.4,   // Popa
            fwd: 5.5,   // Proa
            towAft: 0.0, // Rebocado Popa
            towFwd: 0.0  // Rebocado Proa
        }
    },

    // Flags de Controle e Dados do Checklist
    appraisal: {
        isValid: false,
        selectedCharts: [], // Array de strings (ex: "23100 - BAÍA DE SEPETIBA")
        meteoLink: "",
        navareaLink: "",
        files: {
            meteo: null,    // Nome do arquivo
            navarea: null,
            tideDep: null,
            tideArr: null
        },
        shoreContacts: [], // [{name, phone, email}]
        lighthouses: [],   // [{name, lat, lon, char}]
        shelters: []       // [{name, type, details}]
    },

    // Instâncias de Mapa (Leaflet)
    mapInstance: null,    // Referência ao objeto L.map (para controle de zoom/pan)
    layers: {
        track: null,      // Camada da linha da rota (Polylines)
        ship: null,       // Camada do ícone do navio (Marker)
        waypoints: null   // Camada dos marcadores de pontos (CircleMarkers)
    },

    // Dados Ambientais (Cache simples para evitar requisições duplicadas)
    weatherData: {
        departure: null,
        arrival: null
    },

    /**
     * Reseta o estado para uma nova viagem (Limpeza de Memória).
     * Limpa rota e dados, mas mantém o mapa instanciado para performance.
     */
    resetVoyage: function () {
        this.routePoints = [];
        this.totalDistance = 0;
        this.appraisal.isValid = false;
        this.appraisal.selectedCharts = [];
        this.appraisal.meteoLink = "";
        this.appraisal.navareaLink = "";
        this.appraisal.files = { meteo: null, navarea: null, tideDep: null, tideArr: null };
        this.appraisal.shoreContacts = [];
        this.appraisal.lighthouses = [];
        this.appraisal.shelters = [];
        this.weatherData = { departure: null, arrival: null };
        console.log("State: Dados da viagem resetados para nova operação.");
    }
};

export default State;