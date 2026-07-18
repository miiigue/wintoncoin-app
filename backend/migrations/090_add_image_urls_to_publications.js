const pool = require('../src/config/db');

async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Agregar columna para multiples imagenes en publications
        await client.query(`
            ALTER TABLE publications 
            ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
        `);

        // Agregar flag booleano para exigir evidencias en la culminacion
        await client.query(`
            ALTER TABLE publications 
            ADD COLUMN IF NOT EXISTS requires_evidence BOOLEAN NOT NULL DEFAULT FALSE;
        `);

        await client.query('COMMIT');
        console.log('✅ Migración 090 completada: Columnas de imágenes y evidencias agregadas a publications.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración 090:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up };
