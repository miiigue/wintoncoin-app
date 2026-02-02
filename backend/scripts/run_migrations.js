require('dotenv').config({ path: '../.env.demo.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { ensureSchemaMigrationsTable, computeChecksum, recordMigration } = require('../migrations/_migration_utils');

// Verificación básica
if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL en las variables de entorno.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
    console.log('🚀 Iniciando proceso de migraciones...');
    const client = await pool.connect();

    try {
        // 1. Asegurar tabla de control de versiones
        await ensureSchemaMigrationsTable(client);

        // 2. Leer archivos de migración
        const migrationsDir = path.join(__dirname, '../migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.js') && !f.startsWith('_')) // Ignorar _utils
            .sort(); // Orden alfabético (001, 002...)

        console.log(`📂 Se encontraron ${files.length} archivos de migración.`);

        // 3. Ejecutar una por una
        for (const file of files) {
            const migrationName = file;

            // Verificar si ya se aplicó
            const checkRes = await client.query('SELECT 1 FROM schema_migrations WHERE migration_name = $1', [migrationName]);
            if (checkRes.rowCount > 0) {
                console.log(`⏩ Saltando ${migrationName} (ya aplicada)`);
                continue;
            }

            console.log(`▶️  Aplicando ${migrationName}...`);

            // Cargar módulo
            const migrationModule = require(path.join(migrationsDir, file));

            // Iniciar transacción individual para cada migración
            try {
                await client.query('BEGIN');

                // Ejecutar la función 'up' de la migración
                if (typeof migrationModule.up === 'function') {
                    await migrationModule.up(client);
                } else {
                    // Si el archivo no exporta 'up', quizás ejecuta código directo al requerirse?
                    // Esto depende de cómo estén escritos tus archivos de migración.
                    // Si son scripts que se auto-ejecutan, esto podría ser peligroso o redundante.
                    // Asumiremos que exportan una función 'up' o similar.
                    console.warn(`⚠️  Advertencia: ${migrationName} no exporta una función 'up'. Se asume ejecución al importar.`);
                }

                // Registrar éxito
                const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                const checksum = computeChecksum(content);
                await recordMigration(client, migrationName, checksum);

                await client.query('COMMIT');
                console.log(`✅ ${migrationName} aplicada con éxito.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Falló la migración ${migrationName}:`, err);
                process.exit(1); // Detener todo si una falla
            }
        }

        console.log('✨ Todas las migraciones completadas.');

    } catch (error) {
        console.error('❌ Error general durante migraciones:', error);
    } finally {
        client.release();
        pool.end();
    }
}

runMigrations();
