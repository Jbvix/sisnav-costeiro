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
import NavMath from '../core/NavMath.js';

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
        State.layers.lighthouses = L.layerGroup().addTo(map); // Grupo para Faróis

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
     * Renderiza marcadores de faróis no mapa.
     * @param {Array} lhList - Lista de faróis carregada no App.
     */
    renderLighthouses: function (lhList) {
        if (!State.mapInstance || !State.layers.lighthouses) return;

        State.layers.lighthouses.clearLayers();

        lhList.forEach(lh => {
            // Validate coordinates
            if (!lh.latDec || !lh.lonDec) return;

            const lhIcon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="flex items-center justify-center w-3 h-3 bg-white rounded-full border border-red-600 shadow-sm transition-transform hover:scale-150" style="transform: translate(-50%, -50%);">
                         <div class="w-1 h-1 bg-red-600 rounded-full"></div>
                       </div>`,
                iconSize: [12, 12]
            });

            L.marker([lh.latDec, lh.lonDec], { icon: lhIcon })
                .bindPopup(`
                    <div class="text-xs text-slate-800">
                        <strong class="uppercase text-blue-800">${lh.name}</strong><br>
                        <span class="font-mono">${lh.lat} / ${lh.lon}</span><br>
                        <span class="text-gray-600 italic">${lh.char}</span><br>
                        <p class="mt-1 border-t pt-1">${lh.desc || ''}</p>
                    </div>
                `)
                .addTo(State.layers.lighthouses);
        });

        console.log(`MapService: ${lhList.length} faróis plotados.`);
    },

    /**
     * Plota a rota no mapa com linhas e waypoints.
     * @param {Array<object>} routePoints - Array de objetos {lat, lon, name}.
     */
    plotRoute: function (routePoints) {
        if (!State.mapInstance || !routePoints) return;

        // Limpa rota anterior usando as referências guardadas no State
        if (State.layers.track) State.layers.track.clearLayers();
        if (State.layers.waypoints) State.layers.waypoints.clearLayers();

        if (routePoints.length === 0) return;

        // Extrai apenas as coordenadas [lat, lon] para a polilinha do Leaflet
        const latlngs = routePoints.map(p => [p.lat, p.lon]);

        // 1. Desenha o "XTE corridor" (Linha grossa transparente vermelha - Background)
        L.polyline(latlngs, {
            color: 'red',
            weight: 30,
            opacity: 0.15
        }).addTo(State.layers.track);

        // helper to attach listeners
        const attachEditListeners = (marker, index) => {
            marker.on('dragend', (e) => {
                const newLL = e.target.getLatLng();
                const cb = State.editingCallback;
                if (cb) cb('move', index, newLL.lat, newLL.lng);
            });

            marker.on('contextmenu', (e) => {
                const cb = State.editingCallback;
                if (cb) {
                    if (confirm('Excluir este Waypoint?')) {
                        cb('delete', index);
                    }
                }
            });
        };

        // 2. Loop principal: Waypoints e Segmentos
        routePoints.forEach((p, index) => {
            // A. Marcador Numerado
            const wpIcon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white" style="transform: translate(-50%, -50%);">
                         ${index + 1}
                       </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const markerOptions = {
                icon: wpIcon,
                routeIndex: index,
                draggable: State.isEditingRoute || false // Apply draggable if in edit mode
            };

            const marker = L.marker([p.lat, p.lon], markerOptions).addTo(State.layers.waypoints);

            marker.bindPopup(`
                <div class="text-xs text-center">
                    <strong class="text-blue-800 text-sm">${index + 1}. ${p.name}</strong><br>
                    ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}
                </div>
            `);

            // If editing, attach listeners immediately
            if (State.isEditingRoute) {
                attachEditListeners(marker, index);
            }

            // B. Segmento de Linha (Perna)
            if (index < routePoints.length - 1) {
                const pNext = routePoints[index + 1];
                const segmentLine = L.polyline([[p.lat, p.lon], [pNext.lat, pNext.lon]], {
                    color: 'blue',
                    weight: 3,
                    dashArray: '5, 10'
                }).addTo(State.layers.track);

                // Cálculo de Rumo e Distância do Segmento
                if (NavMath && typeof NavMath.calcLeg === 'function') {
                    const leg = NavMath.calcLeg(p.lat, p.lon, pNext.lat, pNext.lon);
                    const popupContent = `
                        <div class="text-center text-sm">
                            <strong class="text-blue-700">Perna ${index + 1}</strong><br>
                            Rumo: <strong>${leg.crs.toFixed(1)}°</strong><br>
                            Dist: <strong>${leg.dist.toFixed(1)} NM</strong>
                        </div>
                    `;
                    segmentLine.bindPopup(popupContent);

                    // Mouseover visual effect
                    segmentLine.on('mouseover', function () { this.setStyle({ weight: 5, color: '#2563eb' }); });
                    segmentLine.on('mouseout', function () { this.setStyle({ weight: 3, color: 'blue' }); });

                    // IF EDITING: Click to Insert Waypoint
                    if (State.isEditingRoute) {
                        segmentLine.on('click', (e) => {
                            L.DomEvent.stopPropagation(e); // Prevent map click
                            const cb = State.editingCallback;
                            if (cb) {
                                // Insert AT click position
                                cb('insert', index, e.latlng.lat, e.latlng.lng);
                            }
                        });
                        // Change cursor
                        segmentLine.getElement().style.cursor = 'copy'; // "Plus" cursor
                    }
                }
            }
        });

        // Ajusta o zoom para caber toda a rota na tela (Fit Bounds) se não estiver editando
        if (!State.isEditingRoute) {
            const polyline = L.polyline(latlngs);
            State.mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        }
    },

    /**
     * Alterna o modo de edição da rota.
     * @param {boolean} enabled - True para ativar, False para travar.
     * @param {Function} onUpdate - Callback (index, newLat, newLon) ou (action, index) quando houver mudança.
     */
    setEditingMode: function (enabled, onUpdate) {
        if (!State.mapInstance || !State.layers.waypoints) return;

        State.isEditingRoute = enabled;
        if (enabled && onUpdate) {
            State.editingCallback = onUpdate; // Store callback for future replots
        }

        const map = State.mapInstance;

        // Clean up Map Click listener
        map.off('click');

        if (enabled) {
            // MAP CLICK: Append Waypoint
            map.on('click', (e) => {
                const cb = State.editingCallback;
                if (cb) {
                    cb('add', null, e.latlng.lat, e.latlng.lng);
                }
            });
        }

        // Itera sobre os marcadores existentes (para o toggle inicial)
        State.layers.waypoints.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                // Habilita/Desabilita arraste
                if (layer.dragging) {
                    enabled ? layer.dragging.enable() : layer.dragging.disable();
                }

                // Remove listeners antigos para evitar duplicação em toggles repetidos
                layer.off('dragend');
                layer.off('contextmenu');

                if (enabled) {
                    layer.on('dragend', (e) => {
                        const newLL = e.target.getLatLng();
                        const idx = layer.options.routeIndex; // Relies on index being correct from plotRoute
                        if (idx !== undefined && State.editingCallback) {
                            State.editingCallback('move', idx, newLL.lat, newLL.lng);
                        }
                    });

                    layer.on('contextmenu', (e) => {
                        L.DomEvent.stopPropagation(e);
                        const idx = layer.options.routeIndex;
                        if (idx !== undefined && State.editingCallback) {
                            if (confirm('Excluir este Waypoint?')) {
                                State.editingCallback('delete', idx);
                            }
                        }
                    });
                }
            }
        });

        // Update Cursor
        const mapContainer = State.mapInstance.getContainer();
        mapContainer.style.cursor = enabled ? 'crosshair' : '';
    },

    /**
     * Atualiza a posição do navio no mapa (Simulação ou Real).
     * @param {number} lat - Latitude atual.
     * @param {number} lon - Longitude atual.
     * @param {number} heading - Proa (Opcional, futuro uso).
     */
    updateShipPosition: function (lat, lon, heading = 0, data = {}) {
        if (!State.mapInstance) return;

        // Remove navio anterior se existir (Limpa layer específica do navio)
        if (State.layers.ship) {
            State.layers.ship.clearLayers();
        }

        // Ícone Customizado (Seta de Navegação - Rotacionada)
        // O ícone fa-location-arrow aponta para 45 graus (NE) por padrão.
        // Subtraímos 45 do heading para alinhar com o norte (0 graus).
        const rotation = heading - 45;

        const shipIcon = L.divIcon({
            className: 'bg-transparent',
            html: `<i class="fas fa-location-arrow text-red-600 text-3xl" 
                      style="transform: rotate(${rotation}deg); display: block;
                      filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.5));">
                   </i>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15] // Centro do ícone para precisão
        });

        // Monta Conteúdo do Popup
        let popupContent = `
            <div class="text-sm">
                <strong class="text-blue-800 uppercase">${data.name || "Minha Embarcação"}</strong><hr class="my-1">
                <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-700">
                    <span>Rumo:</span> <span class="font-bold">${heading.toFixed(0)}°</span>
                    <span>Consumo:</span> <span class="font-bold">${(data.fuelRate || 0).toFixed(1)} L/h</span>
                    <span>Saldo (ROB):</span> <span class="font-bold">${(data.fuelStock || 0).toLocaleString('pt-BR')} L</span>
                </div>
        `;

        // Lógica condicional para consumo de 12h
        if (data.elapsedHours > 12) {
            const cons12h = (data.fuelRate || 0) * 12;
            popupContent += `
                <div class="mt-1 pt-1 border-t text-xs text-red-600 font-bold">
                    Consumo 12h: ${cons12h.toFixed(1)} L
                </div>
            `;
        }

        popupContent += `</div>`;

        // Adiciona novo marcador do navio
        L.marker([lat, lon], { icon: shipIcon, zIndexOffset: 1000 })
            .bindPopup(popupContent)
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
    },
    setView: function (lat, lon, zoom) {
        if (State.mapInstance) {
            State.mapInstance.setView([lat, lon], zoom);
        }
    }
};

export default MapService;