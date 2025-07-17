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

        console.log('\n🗑️ INICIANDO RESET COMPLETO DE LA BASE DE DATOS...\n');

        // Desactivar temporalmente las restricciones de clave foránea
        await client.query('SET session_replication_role = replica;');

        // Lista de tablas en orden inverso de dependencias
        const tables = [
            'user_ratings',
            'notifications', 
            'transactions',
            'publication_participants',
            'publications',
            'user_booster_profiles',
            'referral_codes',
            'users',
            'admin_settings',
            'user_sessions',
            'publication_categories',
            'admin_audit_log'
        ];

        let totalDeleted = 0;

        for (const table of tables) {
            try {
                const result = await client.query(`DELETE FROM ${table}`);
                const deletedCount = result.rowCount;
                totalDeleted += deletedCount;
                if (deletedCount > 0) {
                    console.log(`🗑️ ${table}: ${deletedCount} registros eliminados`);
                }
            } catch (error) {
                console.log(`⚠️ ${table}: Tabla no existe o ya está vacía`);
            }
        }

        // Reiniciar secuencias de ID
        const sequences = [
            'users_id_seq',
            'publications_id_seq', 
            'transactions_id_seq',
            'notifications_id_seq',
            'user_ratings_id_seq',
            'admin_audit_log_id_seq'
        ];

        for (const seq of sequences) {
            try {
                await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
                console.log(`🔄 Secuencia ${seq} reiniciada`);
            } catch (error) {
                // Silenciosamente continúa si la secuencia no existe
            }
        }

        // Reactivar las restricciones de clave foránea
        await client.query('SET session_replication_role = DEFAULT;');

        console.log('\n✅ RESET COMPLETO FINALIZADO');
        console.log(`📊 Total de registros eliminados: ${totalDeleted}`);
        console.log('🔄 Todas las secuencias reiniciadas');
        console.log('🆕 La base de datos está lista para nuevos datos');
        
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n💡 Para crear el usuario administrador inicial:');
            console.log('   node server.js (se creará automáticamente)');
        }

    } catch (error) {
        console.error('❌ Error durante el reset:', error);
        process.exit(1);
    } finally {
        await client.end();
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