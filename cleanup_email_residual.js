// Script para limpiar líneas residuales del viejo sendAnnouncementEmail en emailService.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'services', 'emailService.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

console.log(`Total de líneas antes de la limpieza: ${lines.length}`);

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.header { padding: 40px;')) {
        startIndex = i - 7; // Incluye los saltos de línea vacíos anteriores desde la 434
    }
    if (startIndex !== -1 && lines[i].includes('async function processPendingBroadcasts')) {
        endIndex = i - 1; // Termina justo antes del JSDoc de processPendingBroadcasts
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    console.log(`Eliminando bloque residual desde la línea ${startIndex + 1} hasta ${endIndex + 1}...`);
    const cleanLines = [
        ...lines.slice(0, startIndex),
        '',
        ...lines.slice(endIndex)
    ];
    fs.writeFileSync(filePath, cleanLines.join('\r\n'), 'utf-8');
    console.log(`✅ Archivo limpiado con éxito. Total de líneas después: ${cleanLines.length}`);
} else {
    console.log(`⚠️ Indices no encontrados: startIndex=${startIndex}, endIndex=${endIndex}`);
}
