const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'wintoncoin_dev',
    password: 'Miiiguebotbinance',
    port: 5432,
});

async function cleanupIncorrectBalance() {
    const client = await pool.connect();
    try {
        console.log('🔍 Verificando saldos incorrectos...');
        
        // Buscar usuarios que tienen saldo en escrow de tareas de impulsor
        const result = await client.query(`
            SELECT 
                u.username,
                u.escrow_blue_balance,
                (SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id) as booster_blue
            FROM users u
            WHERE u.escrow_blue_balance > 0
        `);
        
        console.log('📊 Usuarios con saldo en escrow:');
        result.rows.forEach(user => {
            console.log(`- ${user.username}: Escrow: ${user.escrow_blue_balance}, Booster: ${user.booster_blue || 0}`);
        });
        
        // Buscar específicamente el usuario miguelchrome
        const userResult = await client.query(`
            SELECT 
                username,
                escrow_blue_balance,
                (SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = users.id) as booster_blue
            FROM users 
            WHERE username = 'miguelchrome'
        `);
        
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            console.log(`\n🎯 Usuario miguelchrome:`);
            console.log(`- Escrow: ${user.escrow_blue_balance}`);
            console.log(`- Booster: ${user.booster_blue || 0}`);
            
            if (user.escrow_blue_balance > 0) {
                console.log(`\n🔧 Limpiando saldo incorrecto...`);
                
                // Limpiar el escrow
                await client.query(`
                    UPDATE users 
                    SET escrow_blue_balance = 0 
                    WHERE username = 'miguelchrome'
                `);
                
                // Limpiar los escrows en la tabla blue_token_escrows
                await client.query(`
                    DELETE FROM blue_token_escrows 
                    WHERE username = 'miguelchrome'
                `);
                
                console.log(`✅ Saldo de escrow limpiado para miguelchrome`);
            }
        }
        
        // Verificar el resultado
        const verifyResult = await client.query(`
            SELECT 
                username,
                escrow_blue_balance,
                (SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = users.id) as booster_blue
            FROM users 
            WHERE username = 'miguelchrome'
        `);
        
        if (verifyResult.rows.length > 0) {
            const user = verifyResult.rows[0];
            console.log(`\n📊 Estado final de miguelchrome:`);
            console.log(`- Escrow: ${user.escrow_blue_balance}`);
            console.log(`- Booster: ${user.booster_blue || 0}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanupIncorrectBalance(); 