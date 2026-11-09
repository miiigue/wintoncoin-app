'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist-demo');
const productBackend = 'https://wintoncoin-backend.onrender.com';
const forbiddenProductOrigins = /https:\/\/(?:www\.)?(?:crm\.|boosters\.)?wintoncoin\.com/i;
const expectedMarker = 'data-winton-environment="demo"';

if (!fs.existsSync(dist)) throw new Error('Falta dist-demo. Ejecuta primero npm run build:demo.');

const files = [];
function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else files.push(absolute);
    }
}
walk(dist);

const textFiles = files.filter(file => /\.(?:html|js|css|json|map|txt|xml|webmanifest)$/i.test(file));
const leaks = textFiles.filter(file => {
    const content = fs.readFileSync(file, 'utf8');
    return content.includes(productBackend) || forbiddenProductOrigins.test(content);
});
if (leaks.length > 0) {
    throw new Error(`El build Demo contiene una referencia al entorno productivo: ${leaks.map(file => path.relative(dist, file)).join(', ')}`);
}

const unmarkedHtml = textFiles
    .filter(file => file.endsWith('.html'))
    .filter(file => !fs.readFileSync(file, 'utf8').includes(expectedMarker));
if (unmarkedHtml.length > 0) {
    throw new Error(`HTML sin marca inmutable de entorno Demo: ${unmarkedHtml.map(file => path.relative(dist, file)).join(', ')}`);
}

console.log(`Aislamiento Demo verificado en ${textFiles.length} artefactos de texto.`);
