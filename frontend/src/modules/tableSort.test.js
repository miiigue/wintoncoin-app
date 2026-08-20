/**
 * Test unitario exhaustivo para tableSort.js
 * Incluye parsing, ordenamiento, renderizado de encabezados y manejo de eventos.
 */

import { parseSortValue, sortDataset, getNextSortDirection, renderSortableTh, attachTableSortHandler } from './tableSort.js';

console.log('--- INICIANDO PRUEBAS UNITARIAS DE tableSort.js ---');

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FALLÓ: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASÓ: ${message}`);
    }
}

// 1. Prueba de parseSortValue para números con formato español
assert(parseSortValue('681.710,0000', 'number') === 681710, 'Parseo de saldo 681.710,0000 a número 681710');
assert(parseSortValue('900,0000', 'number') === 900, 'Parseo de saldo 900,0000 a número 900');
assert(parseSortValue('13 / 33', 'number') === 13, 'Parseo de participantes 13 / 33 a número 13');
assert(parseSortValue('0 / 20', 'number') === 0, 'Parseo de participantes 0 / 20 a número 0');
assert(parseSortValue(null, 'number') === -Infinity, 'Parseo de valor nulo a -Infinity');
assert(parseSortValue(undefined, 'number') === -Infinity, 'Parseo de undefined a -Infinity');
assert(parseSortValue(1234.56, 'number') === 1234.56, 'Parseo de número nativo');

// 2. Prueba de parseSortValue para fechas
const testDate = '2026-08-20T17:53:00Z';
assert(parseSortValue(testDate, 'date') === new Date(testDate).getTime(), 'Parseo de fecha ISO a timestamp');
assert(parseSortValue(new Date('2026-01-01'), 'date') === new Date('2026-01-01').getTime(), 'Parseo de instancia Date');

// 3. Prueba de parseSortValue para booleanos
assert(parseSortValue(true, 'boolean') === 1, 'Parseo de true a 1');
assert(parseSortValue(false, 'boolean') === 0, 'Parseo de false a 0');

// 4. Prueba de sortDataset con números (Mayor a Menor y Menor a Mayor)
const samplePublications = [
    { title: 'Baja', blue_cost: '72,0000' },
    { title: 'Alta', blue_cost: '900,0000' },
    { title: 'Media', blue_cost: '90,0000' }
];

const sortedDesc = sortDataset(samplePublications, 'blue_cost', 'desc', { blue_cost: 'number' });
assert(sortedDesc[0].title === 'Alta' && sortedDesc[1].title === 'Media' && sortedDesc[2].title === 'Baja', 'Ordenamiento descendente de saldos BLUE');

const sortedAsc = sortDataset(samplePublications, 'blue_cost', 'asc', { blue_cost: 'number' });
assert(sortedAsc[0].title === 'Baja' && sortedAsc[1].title === 'Media' && sortedAsc[2].title === 'Alta', 'Ordenamiento ascendente de saldos BLUE');

// 5. Prueba de sortDataset con textos en español con tildes y mayúsculas
const sampleUsers = [
    { username: 'Álvaro' },
    { username: 'alondra' },
    { username: 'jonathan' },
    { username: 'Zulma' }
];
const sortedUsersAsc = sortDataset(sampleUsers, 'username', 'asc', { username: 'text' });
assert(sortedUsersAsc[0].username.toLowerCase().startsWith('a') && sortedUsersAsc[3].username === 'Zulma', 'Ordenamiento alfabético insensible A-Z');

// 6. Prueba de getNextSortDirection
assert(getNextSortDirection('blue_cost', 'blue_cost', 'desc', 'number') === 'asc', 'Ciclo en misma columna: desc -> asc');
assert(getNextSortDirection('blue_cost', 'blue_cost', 'asc', 'number') === 'desc', 'Ciclo en misma columna: asc -> desc');
assert(getNextSortDirection('title', 'blue_cost', 'asc', 'number') === 'desc', 'Cambio a columna numérica inicia en desc');
assert(getNextSortDirection('blue_cost', 'username', 'desc', 'text') === 'asc', 'Cambio a columna de texto inicia en asc');

// 7. Prueba de renderSortableTh
const thActiveDesc = renderSortableTh({
    key: 'liquid_blue_balance',
    label: 'Saldo BLUE',
    currentSortKey: 'liquid_blue_balance',
    currentDirection: 'desc',
    type: 'number'
});
assert(thActiveDesc.includes('active-sort'), 'renderSortableTh genera clase active-sort');
assert(thActiveDesc.includes('sort-arrow-down active'), 'renderSortableTh activa flecha descendente');
assert(thActiveDesc.includes('aria-sort="descending"'), 'renderSortableTh incluye accesibilidad ARIA');

const thInactive = renderSortableTh({
    key: 'username',
    label: 'Usuario',
    currentSortKey: 'liquid_blue_balance',
    currentDirection: 'desc',
    type: 'text'
});
assert(!thInactive.includes('active-sort'), 'renderSortableTh columna inactiva no tiene active-sort');
assert(thInactive.includes('aria-sort="none"'), 'renderSortableTh columna inactiva tiene aria-sort="none"');

// 8. Prueba de attachTableSortHandler (idempotencia y actualización de callback)
let calls = 0;
let lastKey = null;
let lastType = null;

const mockListeners = [];
const mockContainer = {
    addEventListener: (event, handler) => {
        mockListeners.push({ event, handler });
    },
    contains: () => true
};

attachTableSortHandler(mockContainer, (k, t) => { calls++; lastKey = k; lastType = t; });
assert(mockListeners.length === 2, 'Primer attach registra 2 listeners (click + keydown)');

// Segundo attach en el mismo contenedor NO debe duplicar listeners
attachTableSortHandler(mockContainer, (k, t) => { calls += 10; lastKey = k; lastType = t; });
assert(mockListeners.length === 2, 'Segundo attach NO duplica listeners (idempotente)');

// Simular clic en <th>
const mockTh = {
    closest: () => mockTh,
    getAttribute: (attr) => attr === 'data-sort-key' ? 'total_blue' : (attr === 'data-sort-type' ? 'number' : null)
};
const clickHandler = mockListeners.find(l => l.event === 'click').handler;
clickHandler({ target: mockTh });

assert(calls === 10, 'El callback ejecutado es el más reciente');
assert(lastKey === 'total_blue', 'Key capturada correctamente en evento');
assert(lastType === 'number', 'Type capturado correctamente en evento');

console.log('🎉 TODAS LAS 18 PRUEBAS UNITARIAS DE tableSort.js PASARON SATISFACTORIAMENTE');
