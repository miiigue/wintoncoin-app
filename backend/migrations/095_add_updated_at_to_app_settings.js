const pool = require('../src/config/db');

/**
 * Migración 095: Agregar columna updated_at a la tabla app_settings
 * ════════════════════════════════════════════════════════════════════════════════════
 * Estándar de Ciberseguridad & Auditoría FinTech (SOC 2 / ISO 27001):
 * Agrega la columna updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 * a la tabla app_settings para garantizar la trazabilidad del estado actual de los
 * parámetros globales de la plataforma.
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Agregar columna updated_at si aún no existe
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'app_settings' AND column_name = 'updated_at'
                ) THEN 
                    ALTER TABLE app_settings ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);

        // Inicializar filas donde updated_at sea NULL
        await client.query(`
            UPDATE app_settings 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE updated_at IS NULL;
        `);

        await client.query('COMMIT');
        console.log('✅ Migración 095 completada: Columna updated_at agregada a app_settings para auditoría.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración 095:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up };
