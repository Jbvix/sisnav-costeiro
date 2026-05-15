/* =============================================================================
 * SISNAV Costeiro — Sistema de Auxílio à Navegação
 * Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
 * Autor: Jossian Brito | Contato: jossiancosta@gmail.com
 * Este software é proprietário e confidencial. O uso não autorizado é proibido.
 * =============================================================================
 */

/**
 * ARQUIVO: GPXParser.js
 * MÓDULO: Utilitário de Leitura de Arquivos GPX
 * AUTOR: Jossian Brito
 * DESCRIÇÃO: Extrai pontos na ordem do ficheiro (trk → rte → wpt).
 */

const GPXParser = {

    _text: function (el, tag) {
        if (!el || !el.getElementsByTagName) return '';
        const n = el.getElementsByTagName(tag)[0];
        return n && n.textContent ? String(n.textContent).trim() : '';
    },

    _pushPoint: function (arr, lat, lon, name, chart) {
        if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;
        arr.push({
            lat,
            lon,
            name: name || '',
            chart: chart || ''
        });
    },

    /**
     * @param {string} xmlString
     * @returns {Array<{lat:number, lon:number, name:string, chart:string}>}
     */
    parse: function (xmlString) {
        if (!xmlString || typeof xmlString !== 'string') return [];

        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'application/xml');
        const err = doc.querySelector('parsererror');
        if (err) {
            console.error('GPXParser:', err.textContent || 'parsererror');
            return [];
        }

        const points = [];

        // 1) Trilhas (trk/trkseg/trkpt) — ordem do documento
        const trks = doc.getElementsByTagName('trk');
        for (let ti = 0; ti < trks.length; ti++) {
            const segs = trks[ti].getElementsByTagName('trkseg');
            for (let si = 0; si < segs.length; si++) {
                const pts = segs[si].getElementsByTagName('trkpt');
                for (let pi = 0; pi < pts.length; pi++) {
                    const node = pts[pi];
                    const lat = parseFloat(node.getAttribute('lat'));
                    const lon = parseFloat(node.getAttribute('lon'));
                    const name = this._text(node, 'name') || this._text(node, 'desc');
                    this._pushPoint(points, lat, lon, name, '');
                }
            }
        }

        if (points.length > 0) return points;

        // 2) Rotas planeadas (rte/rtept)
        const rtes = doc.getElementsByTagName('rte');
        for (let ri = 0; ri < rtes.length; ri++) {
            const rpts = rtes[ri].getElementsByTagName('rtept');
            for (let i = 0; i < rpts.length; i++) {
                const node = rpts[i];
                const lat = parseFloat(node.getAttribute('lat'));
                const lon = parseFloat(node.getAttribute('lon'));
                const name = this._text(node, 'name') || this._text(node, 'desc');
                this._pushPoint(points, lat, lon, name, '');
            }
        }

        if (points.length > 0) return points;

        // 3) Waypoints de topo (filhos diretos de <gpx>) — ordem no ficheiro
        const root = doc.documentElement;
        if (root) {
            for (let i = 0; i < root.children.length; i++) {
                const node = root.children[i];
                if (node.tagName && node.tagName.toLowerCase() !== 'wpt') continue;
                const lat = parseFloat(node.getAttribute('lat'));
                const lon = parseFloat(node.getAttribute('lon'));
                const name = this._text(node, 'name') || this._text(node, 'desc');
                this._pushPoint(points, lat, lon, name, '');
            }
        }

        return points;
    }
};

export default GPXParser;
