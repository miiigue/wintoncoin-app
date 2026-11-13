'use strict';

/**
 * ============================================================================
 * GUARDIÁN AUTOMÁTICO DE ARQUITECTURA E HIGIENE DEL REPOSITORIO (SOC 2 / FINTECH)
 * ============================================================================
 * Propósito:
 * Verificar automáticamente que ningún desarrollador ni agente de IA deje archivos
 * sueltos no autorizados en la raíz del proyecto, artefactos temporales (.resolved,
 * .bak) o prefijos de migración duplicados posteriores al baseline histórico.
 * ============================================================================
 */

// Importamos el módulo nativo de sistema de archivos de Node.js
const fs = require('node:fs');
// Importamos el módulo nativo de rutas multiplataforma de Node.js
const path = require('node:path');

// Definimos la ruta absoluta a la raíz del repositorio (un nivel arriba de /scripts)
const ROOT_DIR = path.resolve(__dirname, '..');

// Lista blanca estricta de archivos permitidos en la raíz del proyecto
const ALLOWED_ROOT_FILES = new Set([
    '.env',
    '.env.development',
    '.env.test',
    '.env.local',
    '.env.demo',
    '.env.production',
    '.env.example',
    '.gitignore',
    'package.json',
    'package-lock.json',
    'VERSION',
    'README.md',
    'EVOLUCION.md',
    'MIGRACION_REACT_CATALOGO.md',
    'QA_TEST_CATALOG.md',
    'verify_all_backend_imports.js'
]);

// Lista blanca de carpetas permitidas en la raíz del proyecto
const ALLOWED_ROOT_DIRS = new Set([
    '.agents',
    '.codex',
    '.cursor',
    '.git',
    '.github',
    '.husky',
    '.vscode',
    'agent-ops',
    'android',
    'backend',
    'docs',
    'frontend',
    'node_modules',
    'puente-agentes',
    'scripts',
    'web3-contracts'
]);

// Excepción histórica conocida en migraciones (050 duplicado en el pasado, inmutable en BD)
const HISTORICAL_DUPLICATE_MIGRATION_PREFIXES = new Set(['050']);

// Arreglo acumulador de violaciones arquitectónicas detectadas
const violations = [];

// 1. Auditar entradas en la raíz del repositorio
for (const entry of fs.readdirSync(ROOT_DIR, { withFileTypes: true })) {
    // Obtenemos el nombre del archivo o directorio en la raíz
    const name = entry.name;
    if (entry.isDirectory()) {
        // Si es una carpeta y no está en la lista blanca, registramos violación
        if (!ALLOWED_ROOT_DIRS.has(name)) {
            violations.push(`Carpeta no autorizada en la raíz del repositorio: "${name}" (debe ubicarse en docs/ o su módulo correspondiente).`);
        }
    } else {
        // Si es un archivo y no está en la lista blanca, registramos violación
        if (!ALLOWED_ROOT_FILES.has(name)) {
            violations.push(`Archivo suelto no autorizado en la raíz del repositorio: "${name}" (mueve reportes a docs/ y elimina scripts one-off).`);
        }
    }
}

// 2. Auditar que no existan archivos duplicados de EVOLUCION.md ni artefactos .resolved en docs/
const docsDir = path.join(ROOT_DIR, 'docs');
if (fs.existsSync(docsDir)) {
    // Verificamos que docs/EVOLUCION.md no vuelva a crearse (SSOT en raíz)
    if (fs.existsSync(path.join(docsDir, 'EVOLUCION.md'))) {
        violations.push('Duplicidad detectada: "docs/EVOLUCION.md" existe. Solo debe existir "EVOLUCION.md" en la raíz (Single Source of Truth).');
    }
    // Escaneamos recursivamente docs/ en busca de archivos temporales .resolved o .bak
    const scanDocs = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDocs(fullPath);
            } else if (entry.name.endsWith('.resolved') || entry.name.includes('.bak')) {
                violations.push(`Artefacto temporal no permitido en docs/: "${path.relative(ROOT_DIR, fullPath)}".`);
            }
        }
    };
    scanDocs(docsDir);
}

// 3. Auditar unicidad de prefijos numéricos en backend/migrations/
const migrationsDir = path.join(ROOT_DIR, 'backend', 'migrations');
if (fs.existsSync(migrationsDir)) {
    // Mapa para contabilizar qué archivo utiliza cada prefijo numérico (ej. "126")
    const seenPrefixes = new Map();
    for (const file of fs.readdirSync(migrationsDir).sort()) {
        if (!file.endsWith('.js') || file.startsWith('_')) continue;
        // Extraemos los dígitos iniciales antes del primer guion bajo
        const match = /^(\d+)_/.exec(file);
        if (!match) {
            violations.push(`Migración sin formato numérico estándar (NNN_nombre.js): "backend/migrations/${file}".`);
            continue;
        }
        const prefix = match[1];
        if (seenPrefixes.has(prefix) && !HISTORICAL_DUPLICATE_MIGRATION_PREFIXES.has(prefix)) {
            violations.push(`Prefijo de migración duplicado "${prefix}": "${seenPrefixes.get(prefix)}" y "${file}".`);
        }
        seenPrefixes.set(prefix, file);
    }
}

// 4. Emitir veredicto de auditoría estructural
if (violations.length > 0) {
    console.error('❌ [ARQUITECTURA SOC 2] Se detectaron violaciones de organización en el repositorio:');
    for (const v of violations) {
        console.error(`   • ${v}`);
    }
    process.exitCode = 1;
} else {
    console.log('✅ [ARQUITECTURA SOC 2] Estructura del repositorio verificada sin archivos huérfanos ni colisiones.');
}

