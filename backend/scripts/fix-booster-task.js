require('../config');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixBoosterTask() {
    const client = await pool.connect();
    try {
        console.log('🔍 Verificando publicación "prueba"...');
        
        // Buscar la publicación "prueba"
        const result = await client.query(`
            SELECT id, title, description, blue_cost, is_booster_task, author_id 
            FROM publications 
            WHERE title ILIKE '%prueba%' OR description ILIKE '%prueba%'
        `);
        
        if (result.rows.length === 0) {
            console.log('❌ No se encontró ninguna publicación con "prueba" en el título o descripción');
            return;
        }
        
        console.log('📋 Publicaciones encontradas:');
        result.rows.forEach(pub => {
            console.log(`- ID: ${pub.id}, Título: "${pub.title}", BLUE: ${pub.blue_cost}, is_booster_task: ${pub.is_booster_task}`);
        });
        
        // Verificar si es de la plataforma
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        const platformResult = await client.query('SELECT id FROM users WHERE username = $1', [platformUsername]);
        
        if (platformResult.rows.length === 0) {
            console.log('❌ No se encontró el usuario de la plataforma');
            return;
        }
        
        const platformUserId = platformResult.rows[0].id;
        
        // Marcar como tarea de impulsor si es de la plataforma
        for (const pub of result.rows) {
            if (pub.author_id === platformUserId) {
                console.log(`🔧 Corrigiendo publicación ID ${pub.id} como tarea de impulsor...`);
                
                await client.query(`
                    UPDATE publications 
                    SET is_booster_task = TRUE 
                    WHERE id = $1
                `, [pub.id]);
                
                console.log(`✅ Publicación ID ${pub.id} marcada como tarea de impulsor`);
            } else {
                console.log(`⚠️ Publicación ID ${pub.id} no es de la plataforma, no se modifica`);
            }
        }
        
        // Verificar el resultado
        const verifyResult = await client.query(`
            SELECT id, title, blue_cost, is_booster_task 
            FROM publications 
            WHERE title ILIKE '%prueba%' OR description ILIKE '%prueba%'
        `);
        
        console.log('\n📊 Estado final:');
        verifyResult.rows.forEach(pub => {
            console.log(`- ID: ${pub.id}, Título: "${pub.title}", BLUE: ${pub.blue_cost}, is_booster_task: ${pub.is_booster_task}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixBoosterTask(); 