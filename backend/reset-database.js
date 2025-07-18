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

        // Lista de tablas para limpiar. El orden es importante para las claves foráneas.
        const tablesToDelete = [
            'user_ratings',
            'notifications',
            'transactions',
            'publication_participants',
            'user_actions',
            'publications',
            'user_booster_profiles',
            'referral_codes',
            'user_sessions',
            'admin_audit_log',
            'users' 
            // 'app_settings' y 'publication_categories' se dejan intactas intencionadamente
        ];

        for (const table of tablesToDelete) {
            try {
                const result = await client.query(`DELETE FROM public."${table}"`);
                if (result.rowCount > 0) {
                    console.log(`🗑️ ${table}: ${result.rowCount} registros eliminados`);
                }
            } catch (err) {
                // Ignorar si la tabla no existe, para mayor robustez
                if (err.code !== '42P01') { 
                    throw err; // Lanzar otros errores
                }
            }
        }
        
        console.log('✅ Todas las tablas han sido limpiadas.');

        // --- Reinserción de datos esenciales ---
        console.log("👤 Re-insertando usuario 'Plataforma WintonCoin'...");
        await client.query(`
            INSERT INTO users (username, password, email, created_at, last_login, blue_balance, red_balance, is_platform) 
            VALUES ('Plataforma WintonCoin', 'no-login', 'platform@wintoncoin.com', NOW(), NOW(), 0, 0, TRUE)
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
                'INSERT INTO users (username, password, email, is_admin) VALUES ($1, $2, $3, true) ON CONFLICT (username) DO NOTHING',
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