/**
 * Módulo de ejecución de migraciones PROGRAMÁTICA (para inicialización de servidor).
 * Diseñado para ser importado por server.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// CARGA DE CONFIGURACIÓN PROFESIONAL
// Buscamos el archivo .env según el entorno si existe, pero no bloqueamos si no está
const env = process.env.NODE_ENV || 'development';
const pathEnvFile = `../../.env.${env}`;
const envPath = path.resolve(__dirname, pathEnvFile);

if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`[MIGRATIONS] ⚙️ Archivo de entorno cargado: ${pathEnvFile}`);
} else {
    // Intentamos cargar el .env genérico por si acaso
    require('dotenv').config();
    console.log(`[MIGRATIONS] ⚙️ Usando variables de entorno del sistema.`);
}

if (!process.env.DATABASE_URL) {
    console.error(`[MIGRATIONS] ❌ FATAL: La variable DATABASE_URL no está definida en el entorno.`);
    // No detenemos el proceso aquí para permitir que server.js maneje su propio flujo,
    // pero marcamos el error claramente.
}

// Configuración de conexión: SSL condicional según entorno (patrón estándar del proyecto)
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

        // 1.5 Auto-reparación: Si la tabla ya existía pero versión vieja senta 'status', agregarla.
        try {
            await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'SUCCESS\'');
        } catch (e) {
            // Ignorar error si ya existe (aunque IF NOT EXISTS debería manejarlo en Postgres moderno)
            console.log('[MIGRATIONS] Nota: Verificación de columna status completada.');
        }

        // 2. Leer archivos de migración disponibles
        const migrationsDir = path.join(__dirname, '../migrations');
        console.log(`[MIGRATIONS] 📂 Escaneando carpeta: ${migrationsDir}`);
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

        // 4. Ejecutar pendientes con transacciones individuales
        for (const file of pending) {
            console.log(`[MIGRATIONS] ▶️  Aplicando: ${file}...`);

            const migrationPath = path.join(migrationsDir, file);
            const migrationModule = require(migrationPath);

            try {
                // Cada migración corre en su propia transacción para aislamiento
                await client.query('BEGIN');

                // Ejecutar la función 'up' si existe (formato moderno)
                if (typeof migrationModule.up === 'function') {
                    await migrationModule.up(client);
                } else {
                    // Si no exporta up(), asumimos que se auto-ejecuta al requerirlo
                    console.log(`[MIGRATIONS] ⚠️  ${file} no exporta up(). Se asume ejecución al importar.`);
                }

                // Registrar como exitosa DENTRO de la misma transacción
                // Así si la migración falla, el registro NO se guarda (ROLLBACK)
                await client.query(
                    'INSERT INTO schema_migrations (migration_name, status) VALUES ($1, $2)',
                    [file, 'SUCCESS']
                );

                await client.query('COMMIT');
                console.log(`[MIGRATIONS] ✅ ${file} completada y registrada.`);

            } catch (migrationError) {
                // Si falla, revertimos TODO (la migración + el registro)
                await client.query('ROLLBACK');
                console.error(`[MIGRATIONS] ❌ Falló la migración ${file}:`, migrationError.message);
                throw migrationError; // Propagar para detener el servidor
            }
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

module.exports = { runPendingMigrations };

// Permite ejecución directa desde terminal: node scripts/migrationRunner.js
if (require.main === module) {
    runPendingMigrations()
        .then(() => {
            console.log('[MIGRATIONS] 🏁 Proceso finalizado.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[MIGRATIONS] ❌ Error en ejecución directa:', err);
            process.exit(1);
        });
}

