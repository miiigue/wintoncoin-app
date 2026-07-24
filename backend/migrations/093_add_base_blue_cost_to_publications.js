const pool = require('../src/config/db');

async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Agregar columna base_blue_cost para almacenar el monto base ingresado por el admin/creador
        await client.query(`
            ALTER TABLE publications 
            ADD COLUMN IF NOT EXISTS base_blue_cost NUMERIC(15, 4);
        `);

        // Para publicaciones existentes donde base_blue_cost sea NULL, inicializar con el blue_cost actual
        await client.query(`
            UPDATE publications 
            SET base_blue_cost = blue_cost 
            WHERE base_blue_cost IS NULL;
        `);

        await client.query('COMMIT');
        console.log('✅ Migración 093 completada: Columna base_blue_cost agregada e inicializada en publications.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración 093:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up };
