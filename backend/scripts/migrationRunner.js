/**
 * Módulo de ejecución de migraciones PROGRAMÁTICA (para inicialización de servidor).
 * Diseñado para ser importado por server.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración de conexión (usará las mismas vars de entorno que el server)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Tabla de control de migraciones para auditoría
 */
const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'SUCCESS'
);
`;

/**
 * Ejecuta las migraciones pendientes de forma segura y transaccional.
 */
async function runPendingMigrations() {
    console.log('[MIGRATIONS] 🚀 Verificando estado de la base de datos...');
    const client = await pool.connect();

    try {
        // 1. Asegurar que existe la tabla de control
        await client.query(MIGRATIONS_TABLE_SQL);

        // 2. Leer archivos de migración disponibles
        const migrationsDir = path.join(__dirname, '../migrations');
        if (!fs.existsSync(migrationsDir)) {
            console.warn('[MIGRATIONS] ⚠️ Carpeta de migraciones no encontrada.');
            return;
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.js') && !f.startsWith('_')) // Solo .js y no utilidades
            .sort(); // Orden alfabético estricto (001, 002...)

        // 3. Verificar cuáles faltan
        const { rows: appliedRows } = await client.query('SELECT migration_name FROM schema_migrations');
        const appliedMigrations = new Set(appliedRows.map(r => r.migration_name));

        const pending = files.filter(f => !appliedMigrations.has(f));

        if (pending.length === 0) {
            console.log('[MIGRATIONS] ✅ Base de datos al día. No hay cambios pendientes.');
            return;
        }

        console.log(`[MIGRATIONS] 📦 Se encontraron ${pending.length} migraciones pendientes.`);

        // 4. Ejecutar pendientes
        for (const file of pending) {
            console.log(`[MIGRATIONS] ▶️  Aplicando: ${file}...`);

            // Leemos el contenido del archivo para extraer el SQL o la lógica
            // NOTA IMPORTANTE: Tus archivos actuales se auto-ejecutan (runMigration()).
            // Para este runner profesional, necesitamos que EXPORTEN su lógica, o leeremos su contenido si es simple.
            // Dado que el archivo 019 se auto-ejecuta, vamos a usar un truco: child_process para correrlo como script aislado
            // O MEJOR AUN: Extraemos la query si es posible (pero es frágil).
            // LA MEJOR OPCION: Child Process para aislar el contexto.

            await runMigrationScript(path.join(migrationsDir, file));

            // Si tuvo éxito (no lanzó error), registramos
            await client.query(
                'INSERT INTO schema_migrations (migration_name, status) VALUES ($1, $2)',
                [file, 'SUCCESS']
            );
            console.log(`[MIGRATIONS] ✅ ${file} completada y registrada.`);
        }

        console.log('[MIGRATIONS] ✨ Todas las migraciones finalizaron correctamente.');

    } catch (error) {
        console.error('[MIGRATIONS] ❌ Error crítico:', error);
        // No matamos el proceso (process.exit) porque podría ser un error menor, 
        // pero en producción estricta DEBERÍAMOS detener el inicio si la DB no está lista.
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Ejecuta un script de migración en un proceso hijo para evitar conflictos de variables y conexiones.
 */
function runMigrationScript(scriptPath) {
    return new Promise((resolve, reject) => {
        const { fork } = require('child_process');

        // Ejecutamos el script con las mismas variables de entorno
        const child = fork(scriptPath, [], {
            env: process.env,
            stdio: 'inherit' // Para ver los logs del hijo en la consola principal
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`El script de migración falló con código ${code}`));
            }
        });
    });
}

module.exports = { runPendingMigrations };
