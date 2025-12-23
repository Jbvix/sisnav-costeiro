/**
 * ARQUIVO: MapService.js
 * MÓDULO: Gerenciador de Mapas (Wrapper do Leaflet)
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 3.1.0 (Refatorado para Estrutura Hierárquica)
 * DESCRIÇÃO:
 * Encapsula toda a lógica de renderização de mapas, camadas, marcadores
 * e ícones. Isola a biblioteca 'Leaflet' do restante do sistema para facilitar manutenção.
 * * DEPENDÊNCIAS:
 * - State.js: Para manter a referência única do mapa (Singleton).
 */

import State from '../core/State.js';

const MapService = {

    /**
     * Inicializa o mapa no container especificado.
     * @param {string} containerId - ID do elemento DIV HTML onde o mapa será renderizado.
     */
    init: function (containerId) {
        // Evita reinicializar se já existe (Singleton behavior)
        if (State.mapInstance) return;

        // Cria o mapa centrado no Brasil (visão geral inicial [-23, -43])
        const map = L.map(containerId).setView([-23.00, -43.00], 5);

        // Salva referência no State
        State.mapInstance = map;

        // Adiciona camada de tiles (OpenStreetMap)
        // Adiciona camada de tiles (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);

        // Adiciona camada Náutica (OpenSeaMap) - Marks
        L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenSeaMap',
            maxZoom: 18
        }).addTo(map);

        // Inicializa grupos de camadas para facilitar limpeza posterior
        State.layers.track = L.layerGroup().addTo(map);
        State.layers.ship = L.layerGroup().addTo(map); // Grupo separado para o navio
        State.layers.waypoints = L.layerGroup().addTo(map); // Grupo separado para WPs
        State.layers.ports = L.layerGroup().addTo(map); // Grupo para Portos (Âncoras)

        console.log("MapService: ECDIS Inicializado com sucesso.");
    },

    /**
     * Renderiza marcadores de portos no mapa.
     * @param {Array} portList - Lista de portos do PortDatabase.
     */
    renderPorts: function (portList) {
        if (!State.mapInstance || !State.layers.ports) return;

        State.layers.ports.clearLayers();

        portList.forEach(port => {
            const anchorIcon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="text-center" style="transform: translate(-50%, -50%);">
                         <div class="text-xl">⚓</div>
                         <div class="text-[8px] font-bold bg-white/80 px-1 rounded shadow text-slate-900 whitespace-nowrap">${port.name}</div>
                       </div>`,
                iconSize: [0, 0] // HTML handles size
            });

            L.marker([port.lat, port.lon], { icon: anchorIcon }).addTo(State.layers.ports);
        });
    },

    /**
     * Plota a rota no mapa com linhas e waypoints.
     * @param {Array<object>} routePoints - Array de objetos {lat, lon, name}.
     */
    plotRoute: function (routePoints) {
        if (!State.mapInstance || !routePoints || routePoints.length === 0) return;

        // Limpa rota anterior usando as referências guardadas no State
        if (State.layers.track) State.layers.track.clearLayers();
        if (State.layers.waypoints) State.layers.waypoints.clearLayers();

        // Extrai apenas as coordenadas [lat, lon] para a polilinha do Leaflet
        const latlngs = routePoints.map(p => [p.lat, p.lon]);

        // 1. Desenha o "XTE corridor" (Linha grossa transparente vermelha - Corredor de segurança)
        L.polyline(latlngs, {
            color: 'red',
            weight: 30,
            opacity: 0.15
        }).addTo(State.layers.track);

        // 2. Desenha a linha de rota (Tracejada azul - Rota Planejada)
        const polyline = L.polyline(latlngs, {
            color: 'blue',
            weight: 3,
            dashArray: '5, 10'
        }).addTo(State.layers.track);

        // 3. Adiciona marcadores para cada Waypoint
        routePoints.forEach(p => {
            L.circleMarker([p.lat, p.lon], {
                radius: 4,
                color: '#333',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 1
            })
                .bindPopup(`<b>${p.name}</b>`)
                .addTo(State.layers.waypoints);
        });

        // Ajusta o zoom para caber toda a rota na tela (Fit Bounds)
        State.mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    },

    /**
     * Atualiza a posição do navio no mapa (Simulação ou Real).
     * @param {number} lat - Latitude atual.
     * @param {number} lon - Longitude atual.
     * @param {number} heading - Proa (Opcional, futuro uso).
     */
    updateShipPosition: function (lat, lon, heading = 0) {
        if (!State.mapInstance) return;

        // Remove navio anterior se existir (Limpa layer específica do navio)
        if (State.layers.ship) {
            State.layers.ship.clearLayers();
        }

        // Ícone Customizado (Seta de Navegação usando FontAwesome)
        const shipIcon = L.divIcon({
            className: 'bg-transparent',
            html: `<i class="fas fa-location-arrow text-red-600 text-3xl" 
                      style="transform: rotate(45deg); 
                      filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.5));">
                   </i>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15] // Centro do ícone para precisão
        });

        // Adiciona novo marcador do navio
        L.marker([lat, lon], { icon: shipIcon, zIndexOffset: 1000 })
            .addTo(State.layers.ship);

        // (Opcional) Pan para o navio para seguir a embarcação
        // State.mapInstance.panTo([lat, lon]);
    },

    /**
     * Força o recálculo do tamanho do mapa.
     * Útil quando o mapa sai de um estado 'hidden' (display: none) para visível.
     */
    invalidateSize: function () {
        if (State.mapInstance) {
            State.mapInstance.invalidateSize();
        }
    },

    /**
     * Habilita o modo de "Snapping" (Imã) para planejamento visual.
     * @param {Array<Array<object>>} knownRoutes - Lista de listas de pontos (rotas conhecidas).
     * @param {Function} onSnapClick - Callback quando o usuário clica num ponto "snapped".
     */
    enableSnapping: function (knownRoutes, onSnapClick) {
        if (!State.mapInstance) return;

        const map = State.mapInstance;
        let ghostMarker = null;

        // Remove listener anterior para evitar duplicidade
        map.off('mousemove');
        map.off('click');

        // Cria layer group temporário para visualização das "Rodovias do Mar"
        const snappableLayer = L.layerGroup().addTo(map);

        // Plota as rotas conhecidas em cinza claro no fundo
        knownRoutes.forEach(route => {
            const latlngs = route.map(p => [p.lat, p.lon]);
            L.polyline(latlngs, { color: '#94a3b8', weight: 2, dashArray: '4, 4', opacity: 0.6 }).addTo(snappableLayer);
        });

        map.on('mousemove', (e) => {
            let shortestDist = Infinity;
            let closestPoint = null;

            // Varre todas as rotas para achar o ponto mais próximo do mouse
            // Otimização: Em produção, usar R-Tree ou QuadTree. Aqui usamos força bruta simples.
            knownRoutes.forEach(route => {
                for (let i = 0; i < route.length - 1; i++) {
                    const p1 = L.latLng(route[i].lat, route[i].lon);
                    const p2 = L.latLng(route[i + 1].lat, route[i + 1].lon);

                    // L.LineUtil.closestPointOnSegment precisa de pontos de tela ou geometria plana
                    // Vamos usar distâncias simples euclidianas para "snap" no vértice mais próximo primeiro
                    // Para simplificar a V1, fazemos snap nos VERTICES (Waypoints) conhecidos.

                    const d = map.distance(e.latlng, p1);
                    if (d < shortestDist) {
                        shortestDist = d;
                        closestPoint = route[i];
                    }
                }
            });

            // Se estiver a menos de 5 Milhas Náuticas (~9km), ativa o snap
            if (shortestDist < 9000 && closestPoint) {
                if (!ghostMarker) {
                    ghostMarker = L.circleMarker([closestPoint.lat, closestPoint.lon], {
                        radius: 6, color: 'lime', fillColor: 'lime', fillOpacity: 0.5
                    }).addTo(map);
                } else {
                    ghostMarker.setLatLng([closestPoint.lat, closestPoint.lon]);
                }
                map.getContainer().style.cursor = 'crosshair';
            } else {
                if (ghostMarker) {
                    ghostMarker.remove();
                    ghostMarker = null;
                }
                map.getContainer().style.cursor = '';
            }
        });

        map.on('click', () => {
            if (ghostMarker) {
                const ll = ghostMarker.getLatLng();
                // Passa de volta para o App preencher o modal
                onSnapClick({ lat: ll.lat, lon: ll.lng });
            }
        });
    }
};

export default MapService;