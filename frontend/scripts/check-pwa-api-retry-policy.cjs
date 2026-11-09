const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const frontendRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(frontendRoot, 'src', 'sw-source.js'), 'utf8');

assert.match(source, /registerRoute\(\s*\/\\\/api\\\/\/\s*,\s*new NetworkOnly\(\)/s,
    'Las rutas /api deben usar NetworkOnly sin plugins de reintento.');
assert.doesNotMatch(source, /BackgroundSyncPlugin|from\s+['"]workbox-background-sync['"]|new\s+Queue\s*\(/,
    'El Service Worker no debe importar ni crear colas de Background Sync para /api.');
assert.match(source, /deleteDatabase\(LEGACY_API_QUEUE_DB\)/,
    'El Service Worker debe eliminar la base de solicitudes diferidas de versiones anteriores.');
assert.match(source, /event\.tag === LEGACY_API_QUEUE_TAG/,
    'Un evento sync heredado debe borrar la cola, nunca reproducirla.');

for (const folder of process.argv.slice(2)) {
    assert(['dist-demo', 'dist'].includes(folder), 'Carpeta de build no admitida.');
    const workerPath = path.join(frontendRoot, folder, 'sw-source.js');
    assert(fs.existsSync(workerPath), `Falta ${folder}/sw-source.js; compila antes de verificar.`);
    const worker = fs.readFileSync(workerPath, 'utf8');
    assert.doesNotMatch(worker, /queue-replay-failed|replayRequests/,
        `${folder} no debe incluir código capaz de reproducir una cola API.`);
    assert.match(worker, /workbox-background-sync:wintoncoin-api-queue/,
        `${folder} debe reconocer y neutralizar la etiqueta heredada.`);
}

console.log('PASS: las solicitudes /api nunca se guardan para reintento automático.');
