const pool = require('../src/config/db');

async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Agregar columna para multiples imagenes de evidencia en publication_acceptances
        await client.query(`
            ALTER TABLE publication_acceptances 
            ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}';
        `);

        await client.query('COMMIT');
        console.log('✅ Migración 091 completada: Columna de evidencias agregada a publication_acceptances.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración 091:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up };
