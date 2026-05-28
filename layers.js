// --- MAP LAYERS & CATALOG ---

// --- EXTERNAL MAP LAYERS (Iframe Integration) ---
const ExternalMapLayer = L.Layer.extend({
    options: {
        urlBuilder: null, // Function(lat, lon, zoom) -> url
        interactive: true
    },

    initialize: function (options) {
        L.setOptions(this, options);
    },

    onAdd: function (map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'external-map-layer');

        // Style to cover the map
        Object.assign(this._container.style, {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 50,
            backgroundColor: '#050814',
            pointerEvents: 'none' // CRITICAL: Let clicks pass through
        });

        // Create Iframe
        this._iframe = L.DomUtil.create('iframe', '', this._container);
        Object.assign(this._iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            pointerEvents: 'none'
        });

        this._updateUrl();
        map.getContainer().appendChild(this._container);

        map.on('moveend', this._updateUrl, this);
        map.on('zoomend', this._updateUrl, this);
        map.on('movestart', this._onMoveStart, this);
        map.on('move', this._onMove, this);

        this._addInteractionControl();
        return this;
    },

    onRemove: function (map) {
        if (this._container) {
            this._container.parentNode.removeChild(this._container);
        }
        map.off('moveend', this._updateUrl, this);
        map.off('zoomend', this._updateUrl, this);
        map.off('movestart', this._onMoveStart, this);
        map.off('move', this._onMove, this);

        if (this._interactionCtrl) {
            map.removeControl(this._interactionCtrl);
            this._interactionCtrl = null;
        }
    },

    _addInteractionControl: function () {
        if (this._interactionCtrl) return;
        const self = this;
        const InteractionControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function (map) {
                const btn = L.DomUtil.create('button', 'interaction-toggle-btn');
                btn.innerHTML = '👆';
                btn.title = 'Ativar Interação com Fundo';
                btn.style.backgroundColor = 'white';
                btn.style.width = '30px';
                btn.style.height = '30px';
                btn.style.fontSize = '18px';
                btn.style.cursor = 'pointer';
                btn.style.border = '2px solid rgba(0,0,0,0.2)';
                btn.style.borderRadius = '4px';

                let interactive = false;
                btn.onclick = function () {
                    interactive = !interactive;
                    self._setInteractive(interactive);
                    if (interactive) {
                        btn.innerHTML = '🖐';
                        btn.style.backgroundColor = '#ffcc00';
                        btn.title = 'Desativar Interação';
                    } else {
                        btn.innerHTML = '👆';
                        btn.style.backgroundColor = 'white';
                        btn.title = 'Ativar Interação';
                    }
                };
                L.DomEvent.disableClickPropagation(btn);
                return btn;
            }
        });
        this._interactionCtrl = new InteractionControl();
        this._map.addControl(this._interactionCtrl);
    },

    _setInteractive: function (enable) {
        const val = enable ? 'auto' : 'none';
        if (this._container) this._container.style.pointerEvents = val;
        if (this._iframe) this._iframe.style.pointerEvents = val;
    },

    _onMoveStart: function () {
        this._startCenter = this._map.getCenter();
    },

    _onMove: function () {
        if (!this._startCenter) return;
        const pointNow = this._map.latLngToContainerPoint(this._startCenter);
        const centerScreen = this._map.getSize().divideBy(2);
        const x = pointNow.x - centerScreen.x;
        const y = pointNow.y - centerScreen.y;
        this._container.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },

    _updateUrl: function () {
        if (this._container) this._container.style.transform = '';
        if (!this._map || !this.options.urlBuilder) return;
        const center = this._map.getCenter();
        const zoom = this._map.getZoom();
        const lat = center.lat.toFixed(5);
        const lon = center.lng.toFixed(5);
        const url = this.options.urlBuilder(lat, lon, zoom);
        if (this._iframe.src !== url) {
            this._iframe.src = url;
            console.log("Updated External Layer:", lat, lon, zoom);
        }
    }
});

// --- DEFINE LAYERS ---

const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
});

const oceanBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri Ocean Basemap',
    maxZoom: 13
});

const oceanReferenceLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri Ocean Reference',
    maxZoom: 13
});

const openSeaMap = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    attribution: 'OpenSeaMap'
});

const vesselDensityLayer = L.tileLayer.wms('https://ows.emodnet-humanactivities.eu/wms', {
    layers: 'emodnet:vessel_density_map_all_2022',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    attribution: 'EMODnet',
    opacity: 0.7
});

const marineTrafficLayer = new ExternalMapLayer({
    urlBuilder: (lat, lon, zoom) => {
        const safeZoom = Math.min(zoom, 18);
        return `https://www.marinetraffic.com/en/ais/embed/zoom:${safeZoom}/centerx:${lon}/centery:${lat}/maptype:0/shownames:true/showmenu:false/showtrack:false`;
    }
});

const windyLayer = new ExternalMapLayer({
    urlBuilder: (lat, lon, zoom) => {
        const safeZoom = Math.min(zoom, 11);
        return `https://embed.windy.com/embed.html?type=map&location=coordinates&zoom=${safeZoom}&lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&metricWind=kt&metricTemp=%C2%B0C`;
    }
});

// Cartesian/Nautical Layer
var tileUrl = backendUrl ? backendUrl + '/tiles/{z}/{x}/{y}.png' : 'tiles/{z}/{x}/{y}.png';
// Fix for strict path
if (backendUrl === '/charts') tileUrl = '/charts/tiles/{z}/{x}/{y}.png';

var nauticalLayer = L.tileLayer(tileUrl, {
    maxZoom: 18,
    attribution: 'Marinha do Brasil / NAVIEW',
    tms: false,
    keepBuffer: 8,
    updateWhenIdle: false,
    updateWhenZooming: false,
    maxNativeZoom: 15
}).addTo(map);

// Layer Control
const baseMaps = {
    "Dark Matter": darkLayer,
    "OpenStreetMap": osmLayer,
    "Satélite": satelliteLayer,
    "Oceano (Batimetria)": oceanBaseLayer,
    "MarineTraffic (Ao Vivo)": marineTrafficLayer,
    "Windy (Tempo)": windyLayer
};

const overlayMaps = {
    "Cartas NAVIEW": nauticalLayer,
    "OpenSeaMap (Navegação)": openSeaMap,
    "Densidade de Tráfego (EMODnet)": vesselDensityLayer,
    "Linhas Isobáticas (Batimetria)": oceanReferenceLayer,
    // Lighthouses & Ruler added dynamically references global vars
    "Faróis (Dados ao Vivo)": lighthouseLayer, // Will be enabled by default below? No, app.js did it.
    "📏 Régua de Medição (NM)": measuringLayer,
    "Rota e Waypoints": routeLayerGroup
};

L.control.layers(baseMaps, overlayMaps, { position: 'bottomright' }).addTo(map);
// Enable Lighthouses by default
lighthouseLayer.addTo(map);

// --- CATALOG LOADER ---
async function loadCatalog() {
    const listContainer = document.getElementById('chart-list');
    listContainer.innerHTML = '<div style="text-align:center; padding:20px;">Carregando cartas...⚓</div>';

    try {
        const response = await fetch('full_catalog.json');
        if (!response.ok) throw new Error("Erro ao carregar catálogo");

        const data = await response.json();
        let charts = data.charts;

        // Sort by Scale Descending
        charts.sort((a, b) => b.scale - a.scale);

        listContainer.innerHTML = '';

        charts.forEach(chart => {
            const item = document.createElement('div');
            item.className = 'chart-item';
            const scaleStr = `1:${chart.scale.toLocaleString('pt-BR')}`;

            item.innerHTML = `
                <div class="chart-code">${chart.id}</div>
                <div class="chart-name">${chart.name}</div>
                <div class="chart-scale">${scaleStr}</div>
            `;

            item.onmouseenter = () => {
                catalogLayer.clearLayers();
                const bounds = [
                    [chart.bounds.min_lat, chart.bounds.min_lon],
                    [chart.bounds.max_lat, chart.bounds.max_lon]
                ];
                L.rectangle(bounds, { color: "red", weight: 2, fill: false }).addTo(catalogLayer);
            };

            item.onclick = () => {
                map.flyToBounds([
                    [chart.bounds.min_lat, chart.bounds.min_lon],
                    [chart.bounds.max_lat, chart.bounds.max_lon]
                ], { padding: [50, 50] });

                document.querySelectorAll('.chart-item').forEach(el => el.style.background = '');
                item.style.background = '#444';
            };

            listContainer.appendChild(item);
        });

    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<div style="color:red; padding:10px;">Erro ao carregar lista de cartas.</div>';
    }
}
