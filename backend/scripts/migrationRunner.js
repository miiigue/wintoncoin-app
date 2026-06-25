/**
 * Módulo de ejecución de migraciones PROGRAMÁTICA (para inicialización de servidor).
 * Diseñado para ser importado por server.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// CARGA DE CONFIGURACIÓN PROFESIONAL
require('../config');

if (!process.env.DATABASE_URL) {
    console.error(`[MIGRATIONS] ❌ FATAL: La variable DATABASE_URL no está definida en el entorno.`);
    // No detenemos el proceso aquí para permitir que server.js maneje su propio flujo,
    // pero marcamos el error claramente.
}

// Configuración de conexión: SSL condicional robusto según entorno
const dbUrl = process.env.DATABASE_URL || '';
let useSsl = false;
if (dbUrl.includes('.internal')) {
    useSsl = false;
} else if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    useSsl = false;
} else if (dbUrl.includes('render.com') || process.env.NODE_ENV === 'production' || process.env.IS_DEMO_ENV === 'true') {
    useSsl = { rejectUnauthorized: false };
} else {
    useSsl = false;
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: useSsl
});

/**
 * Tabla de control de migraciones para auditoría
 */
const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'SUCCESS',
    applied_by TEXT,
    environment TEXT,
    checksum TEXT
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

        // 1.5 Auto-reparación: Asegurar que existan todos los campos de auditoría requeridos por utilidades legacy.
        try {
            await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'SUCCESS\'');
            await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS applied_by TEXT');
            await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS environment TEXT');
            await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
        } catch (e) {
            console.log('[MIGRATIONS] Nota: Verificación de columnas de auditoría completada.');
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

        // --- CIBERSEGURIDAD Y COMPATIBILIDAD RETROACTIVA (SOC 2 / AUDITORÍA BANCARIA) ---
        // Implementación de MockPool para retrocompatibilidad con migraciones legacy (001 a 049).
        // Las migraciones legacy instancian su propio Pool de conexiones y corren consultas en IIFEs.
        // Interceptamos pg.Pool de forma temporal antes de hacer require de cada migración legacy
        // para canalizar todas las consultas por el cliente del runner y forzar ejecución secuencial transaccional.
        const pg = require('pg');
        const OriginalPool = pg.Pool;
        const mockPoolInstances = [];

        class MockPool {
            constructor(config) {
                this.config = config;
                this.failed = false;
                this.released = false;
                this.ended = false;
                mockPoolInstances.push(this);
            }

            async connect() {
                const mockClient = {
                    query: async (text, params) => {
                        const upperText = typeof text === 'string' ? text.trim().toUpperCase() : '';
                        // Evitamos anidación de transacciones porque el runner maneja BEGIN/COMMIT/ROLLBACK.
                        if (upperText === 'BEGIN' || upperText === 'COMMIT' || upperText === 'ROLLBACK') {
                            if (upperText === 'ROLLBACK') {
                                this.failed = true;
                            }
                            return { rows: [] };
                        }
                        // Redirigir la consulta al cliente transaccional del runner
                        return client.query(text, params);
                    },
                    release: () => {
                        this.released = true;
                        this._resolveFinished();
                    }
                };
                return mockClient;
            }

            async end() {
                this.ended = true;
                this._resolveFinished();
            }

            _resolveFinished() {
                if (this._onFinished) {
                    this._onFinished();
                }
            }

            awaitFinished() {
                return new Promise((resolve, reject) => {
                    if (this.released || this.ended) {
                        if (this.failed) reject(new Error('La migración falló (se ejecutó ROLLBACK en el script legacy).'));
                        else resolve();
                        return;
                    }
                    this._onFinished = () => {
                        if (this.failed) reject(new Error('La migración falló (se ejecutó ROLLBACK en el script legacy).'));
                        else resolve();
                    };
                });
            }
        }

        // 4. Ejecutar pendientes con transacciones individuales
        for (const file of pending) {
            console.log(`[MIGRATIONS] ▶️  Aplicando: ${file}...`);

            const migrationPath = path.join(migrationsDir, file);
            let migrationModule;

            try {
                // Iniciamos la transacción para esta migración individual (grado bancario)
                await client.query('BEGIN');

                // Eliminar del caché de Node para obligar su ejecución si se requiere múltiples veces en el mismo proceso (ej: en tests)
                delete require.cache[require.resolve(migrationPath)];

                // Si la migración no es moderna (no exporta up), activamos el mockeo antes del require
                pg.Pool = MockPool;
                
                try {
                    migrationModule = require(migrationPath);
                } finally {
                    // Restauramos siempre el Pool original de inmediato para evitar efectos secundarios en otros módulos
                    pg.Pool = OriginalPool;
                }

                // Ejecutar la función 'up' si existe (formato moderno)
                if (typeof migrationModule.up === 'function') {
                    await migrationModule.up(client);
                } else {
                    console.log(`[MIGRATIONS] ⚠️  ${file} no exporta up(). Se asume ejecución al importar.`);
                    // Es una migración legacy. Obtenemos el MockPool instanciado durante el require
                    const lastInstance = mockPoolInstances[mockPoolInstances.length - 1];
                    if (lastInstance) {
                        // Esperamos a que finalice la ejecución asíncrona secuencialmente
                        await lastInstance.awaitFinished();
                    } else {
                        throw new Error(`No se pudo inicializar la conexión simulada para la migración legacy: ${file}`);
                    }
                }

                // Registrar como exitosa DENTRO de la misma transacción para consistencia.
                // Se utiliza ON CONFLICT para soportar las migraciones legacy que se auto-registran mediante _migration_utils.js
                // previniendo colisiones de clave duplicada y preservando sus checksums/metadata de auditoría originales.
                await client.query(
                    `INSERT INTO schema_migrations (migration_name, status)
                     VALUES ($1, $2)
                     ON CONFLICT (migration_name) 
                     DO UPDATE SET status = EXCLUDED.status`,
                    [file, 'SUCCESS']
                );

                await client.query('COMMIT');
                console.log(`[MIGRATIONS] ✅ ${file} completada y registrada.`);

            } catch (migrationError) {
                // Si falla cualquier consulta o el script legacy reporta un ROLLBACK,
                // revertimos todo el lote de esta migración
                await client.query('ROLLBACK');
                console.error(`[MIGRATIONS] ❌ Falló la migración ${file}:`, migrationError.message);
                throw migrationError; // Detener inicio del servidor por fallo de integridad
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

