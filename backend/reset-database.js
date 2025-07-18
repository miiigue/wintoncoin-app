const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetDatabase() {
    try {
        await client.connect();
        console.log('🔗 Conectado a la base de datos');

        // Crear backup automático antes del reset
        console.log('📦 Creando backup automático...');
        const { exec } = require('child_process');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupFileName = `backup_before_reset_${timestamp}.sql`;
        
        const backupCommand = process.env.DATABASE_URL.includes('localhost') 
            ? `pg_dump "${process.env.DATABASE_URL}" > ${backupFileName}`
            : `pg_dump "${process.env.DATABASE_URL}" --no-owner --no-privileges > ${backupFileName}`;

        await new Promise((resolve, reject) => {
            exec(backupCommand, (error, stdout, stderr) => {
                if (error) {
                    console.warn('⚠️ No se pudo crear backup automático:', error.message);
                    resolve(); // Continuamos sin backup si falla
                } else {
                    console.log(`✅ Backup creado: ${backupFileName}`);
                    resolve();
                }
            });
        });

        console.log('\n🔥 Iniciando reseteo completo de la base de datos...\n');

        await client.query('BEGIN');
        console.log('🔑 Transacción iniciada.');

        // Obtener todas las tablas del esquema 'public' para asegurar que limpiamos todo.
        const tablesResult = await client.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename NOT IN ('app_settings', 'publication_categories') -- No tocar estas tablas
              AND tablename NOT LIKE 'pg_%' -- Ignorar tablas internas de PostgreSQL
              AND tablename NOT LIKE 'sql_%'; -- Ignorar tablas de extensiones
        `);

        const tablesToTruncate = tablesResult.rows.map(row => `public."${row.tablename}"`);

        if (tablesToTruncate.length > 0) {
            // Usamos TRUNCATE con CASCADE. Es más rápido y maneja las dependencias automáticamente.
            // RESTART IDENTITY reinicia los contadores de ID.
            const truncateQuery = `TRUNCATE TABLE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE;`;
            console.log(`🗑️  Vaciando todas las tablas de usuario...`);
            await client.query(truncateQuery);
            console.log('✅ Todas las tablas han sido vaciadas y sus secuencias reiniciadas.');
        } else {
            console.log('No se encontraron tablas para vaciar.');
        }
        
        // --- Reinserción de datos esenciales ---
        console.log("👤 Re-insertando usuario 'Plataforma WintonCoin'...");
        await client.query(`
            INSERT INTO users (username, password_hash, email, created_at, blue_balance, red_balance, is_platform) 
            VALUES ('Plataforma WintonCoin', 'no-login', 'platform@wintoncoin.com', NOW(), 0, 0, TRUE)
            ON CONFLICT (username) DO NOTHING;
        `);

        console.log("🚀 Re-insertando booster para 'Plataforma WintonCoin'...");
        await client.query(`
            INSERT INTO user_booster_profiles (user_id, level, monthly_payment, last_payment_date)
            SELECT id, 0, 0, NOW() FROM users WHERE username = 'Plataforma WintonCoin'
            ON CONFLICT (user_id) DO NOTHING;
        `);
        
        console.log('👑 Re-insertando usuario Administrador...');
        const adminUser = process.env.ADMIN_USER || 'admin';
        const adminPass = process.env.ADMIN_PASS_HASH; // Debe estar hasheada
        if(adminPass) {
            await client.query(
                'INSERT INTO users (username, password_hash, email, is_admin) VALUES ($1, $2, $3, true) ON CONFLICT (username) DO NOTHING',
                [adminUser, adminPass, 'admin@wintoncoin.com']
            );
        } else {
            console.warn('⚠️ No se encontró ADMIN_PASS_HASH. No se creará el usuario admin.');
        }

        await client.query('COMMIT');
        console.log('💾 Transacción completada (COMMIT).');

        console.log('\n🎉 ¡Reseteo de la base de datos completado! La base de datos está limpia y lista para empezar.');
        
    } catch (error) {
        console.error('❌ Error durante el reset:', error);
        await client.query('ROLLBACK');
        console.log('⏪ Transacción revertida (ROLLBACK).');
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Conexión con la base de datos cerrada.');
    }
}

// Verificar si se ejecuta directamente
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] !== 'CONFIRM_RESET') {
        console.log('🚨 ADVERTENCIA: Este comando eliminará TODOS los datos de la base de datos');
        console.log('📦 Se creará un backup automático antes del reset');
        console.log('');
        console.log('Para confirmar el reset completo, ejecuta:');
        console.log('   node reset-database.js CONFIRM_RESET');
        console.log('');
        console.log('💡 Alternativas más seguras:');
        console.log('   node cleanup-database.js test-data        (solo datos de prueba)');
        console.log('   node cleanup-database.js inactive-users 90 (usuarios inactivos)');
        process.exit(0);
    }

    resetDatabase();
}

module.exports = { resetDatabase }; 