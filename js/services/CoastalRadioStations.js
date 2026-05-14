/**
 * Estações costeiras (rádio CHM) — faixas aproximadas de latitude ao longo do litoral brasileiro.
 * Usado para sugerir automaticamente estações no trecho entre porto origem e porto destino.
 */

/** Ordem geográfica N → S (exibição no select) */
export const STATION_ORDER_NORTH_SOUTH = [
    'Belém Rádio (PPL)',
    'Recife Rádio (PPO)',
    'Salvador Rádio (PPA)',
    'Vitória Rádio (PPV)',
    'Rio Rádio (PPR)',
    'Santos Rádio (PPS)',
    'Rio Grande Rádio (PPQ)',
];

/**
 * Faixas de latitude (graus decimais, Sul negativo).
 * latNorth > latSouth. Sobreposição leve nas fronteiras evita “buracos” entre áreas.
 */
const STATION_BANDS = [
    { value: 'Belém Rádio (PPL)', latSouth: -6.5, latNorth: 5.5 },
    { value: 'Recife Rádio (PPO)', latSouth: -11.5, latNorth: -3.0 },
    { value: 'Salvador Rádio (PPA)', latSouth: -14.5, latNorth: -10.0 },
    { value: 'Vitória Rádio (PPV)', latSouth: -22.0, latNorth: -13.5 },
    { value: 'Rio Rádio (PPR)', latSouth: -24.5, latNorth: -21.0 },
    { value: 'Santos Rádio (PPS)', latSouth: -30.0, latNorth: -22.5 },
    { value: 'Rio Grande Rádio (PPQ)', latSouth: -35.0, latNorth: -29.0 },
];

function overlapsRoute(latSouth, latNorth, rLo, rHi) {
    return !(latNorth < rLo || latSouth > rHi);
}

function bandContainsLat(band, lat) {
    return lat >= band.latSouth && lat <= band.latNorth;
}

/**
 * Devolve lista de valores de estação (strings iguais às options do HTML) que interceptam
 * o segmento em latitude entre os dois portos.
 */
export function getStationsAlongRoute(depPortId, arrPortId, portList) {
    if (!depPortId || !arrPortId || !portList || !portList.length) return null;

    const pDep = portList.find((p) => p.id === depPortId);
    const pArr = portList.find((p) => p.id === arrPortId);
    if (!pDep || !pArr) return null;

    const rLo = Math.min(pDep.lat, pArr.lat);
    const rHi = Math.max(pDep.lat, pArr.lat);

    const hit = STATION_BANDS.filter((b) => overlapsRoute(b.latSouth, b.latNorth, rLo, rHi));

    if (hit.length === 0) {
        const depBands = STATION_BANDS.filter((b) => bandContainsLat(b, pDep.lat));
        const arrBands = STATION_BANDS.filter((b) => bandContainsLat(b, pArr.lat));
        const merged = [...new Set([...depBands, ...arrBands].map((b) => b.value))];
        return merged.length ? sortStationsNorthToSouth(merged) : STATION_ORDER_NORTH_SOUTH.slice();
    }

    return sortStationsNorthToSouth(hit.map((b) => b.value));
}

export function sortStationsNorthToSouth(values) {
    const idx = (v) => {
        const i = STATION_ORDER_NORTH_SOUTH.indexOf(v);
        return i === -1 ? 999 : i;
    };
    return [...values].sort((a, b) => idx(a) - idx(b));
}

/** Estação cuja faixa contém a latitude de partida (para pré-seleção). */
export function stationForDepartureLat(lat) {
    const found = STATION_BANDS.find((b) => bandContainsLat(b, lat));
    return found ? found.value : null;
}
