// Script de Limpieza Segura para Base de Datos WintonCoin
require('dotenv').config();
const { Pool } = require('pg');
const { createBackup } = require('./backup-database.js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Función para mostrar estadísticas de la base de datos
async function showDatabaseStats() {
    const client = await pool.connect();
    try {
        console.log('📊 Estadísticas actuales de la base de datos:');
        console.log('==========================================');
        
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM publications) as total_publications,
                (SELECT COUNT(*) FROM transactions) as total_transactions,
                (SELECT COUNT(*) FROM notifications) as total_notifications,
                (SELECT COUNT(*) FROM ratings) as total_ratings,
                (SELECT COUNT(*) FROM red_token_debts WHERE is_settled = FALSE) as active_debts,
                (SELECT COUNT(*) FROM blue_token_escrows WHERE is_released = FALSE) as active_escrows
        `);
        
        const data = stats.rows[0];
        console.log(`👥 Usuarios: ${data.total_users}`);
        console.log(`📝 Publicaciones: ${data.total_publications}`);
        console.log(`💰 Transacciones: ${data.total_transactions}`);
        console.log(`🔔 Notificaciones: ${data.total_notifications}`);
        console.log(`⭐ Calificaciones: ${data.total_ratings}`);
        console.log(`💸 Deudas activas: ${data.active_debts}`);
        console.log(`🔒 Escrows activos: ${data.active_escrows}`);
        
    } finally {
        client.release();
    }
}

// Función para limpiar datos de prueba/desarrollo
async function cleanupTestData() {
    const client = await pool.connect();
    try {
        console.log('🧹 Iniciando limpieza de datos de prueba...');
        
        await client.query('BEGIN');
        
        // 1. Eliminar usuarios de prueba (que contengan 'test' en el username)
        const testUsersResult = await client.query(`
            DELETE FROM users 
            WHERE username ILIKE '%test%' 
            OR username ILIKE '%demo%' 
            OR username ILIKE '%example%'
            RETURNING username
        `);
        console.log(`🗑️ Usuarios de prueba eliminados: ${testUsersResult.rowCount}`);
        
        // 2. Eliminar publicaciones de prueba
        const testPublicationsResult = await client.query(`
            DELETE FROM publications 
            WHERE title ILIKE '%test%' 
            OR title ILIKE '%demo%' 
            OR title ILIKE '%example%'
            RETURNING id
        `);
        console.log(`🗑️ Publicaciones de prueba eliminadas: ${testPublicationsResult.rowCount}`);
        
        // 3. Limpiar notificaciones antiguas (más de 30 días)
        const oldNotificationsResult = await client.query(`
            DELETE FROM notifications 
            WHERE created_at < NOW() - INTERVAL '30 days'
            RETURNING id
        `);
        console.log(`🗑️ Notificaciones antiguas eliminadas: ${oldNotificationsResult.rowCount}`);
        
        await client.query('COMMIT');
        console.log('✅ Limpieza de datos de prueba completada');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la limpieza:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Función para limpiar datos de usuarios inactivos
async function cleanupInactiveUsers(daysInactive = 90) {
    const client = await pool.connect();
    try {
        console.log(`🧹 Limpiando usuarios inactivos (más de ${daysInactive} días)...`);
        
        await client.query('BEGIN');
        
        // Obtener usuarios inactivos
        const inactiveUsersResult = await client.query(`
            SELECT username, created_at, liquid_blue_balance, escrow_blue_balance, red_balance
            FROM users 
            WHERE created_at < NOW() - INTERVAL '${daysInactive} days'
            AND username NOT LIKE '%Plataforma%'
            AND liquid_blue_balance = 100.0000
            AND escrow_blue_balance = 0.0000
            AND red_balance = 0.0000
        `);
        
        if (inactiveUsersResult.rowCount === 0) {
            console.log('✅ No se encontraron usuarios inactivos para eliminar');
            await client.query('COMMIT');
            return;
        }
        
        console.log(`📋 Usuarios inactivos encontrados: ${inactiveUsersResult.rowCount}`);
        
        // Mostrar usuarios que se van a eliminar
        for (const user of inactiveUsersResult.rows) {
            console.log(`  - ${user.username} (creado: ${user.created_at.toLocaleDateString()})`);
        }
        
        // Eliminar usuarios inactivos
        const deleteResult = await client.query(`
            DELETE FROM users 
            WHERE created_at < NOW() - INTERVAL '${daysInactive} days'
            AND username NOT LIKE '%Plataforma%'
            AND liquid_blue_balance = 100.0000
            AND escrow_blue_balance = 0.0000
            AND red_balance = 0.0000
        `);
        
        console.log(`🗑️ Usuarios inactivos eliminados: ${deleteResult.rowCount}`);
        
        await client.query('COMMIT');
        console.log('✅ Limpieza de usuarios inactivos completada');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la limpieza:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Función para limpiar publicaciones antiguas
async function cleanupOldPublications(daysOld = 180) {
    const client = await pool.connect();
    try {
        console.log(`🧹 Limpiando publicaciones antiguas (más de ${daysOld} días)...`);
        
        await client.query('BEGIN');
        
        // Obtener publicaciones antiguas
        const oldPublicationsResult = await client.query(`
            SELECT id, title, created_at, status
            FROM publications 
            WHERE created_at < NOW() - INTERVAL '${daysOld} days'
            AND status IN ('completed', 'confirmed_paid')
        `);
        
        if (oldPublicationsResult.rowCount === 0) {
            console.log('✅ No se encontraron publicaciones antiguas para eliminar');
            await client.query('COMMIT');
            return;
        }
        
        console.log(`📋 Publicaciones antiguas encontradas: ${oldPublicationsResult.rowCount}`);
        
        // Mostrar publicaciones que se van a eliminar
        for (const pub of oldPublicationsResult.rows) {
            console.log(`  - ${pub.title} (${pub.status}) - ${pub.created_at.toLocaleDateString()}`);
        }
        
        // Eliminar publicaciones antiguas
        const deleteResult = await client.query(`
            DELETE FROM publications 
            WHERE created_at < NOW() - INTERVAL '${daysOld} days'
            AND status IN ('completed', 'confirmed_paid')
        `);
        
        console.log(`🗑️ Publicaciones antiguas eliminadas: ${deleteResult.rowCount}`);
        
        await client.query('COMMIT');
        console.log('✅ Limpieza de publicaciones antiguas completada');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la limpieza:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Función para resetear completamente la base de datos (PELIGROSO)
async function resetDatabase() {
    const client = await pool.connect();
    try {
        console.log('⚠️  ADVERTENCIA: Esta operación eliminará TODOS los datos');
        console.log('⚠️  Solo usar en desarrollo o cuando estés completamente seguro');
        
        // Confirmación manual
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            rl.question('¿Estás completamente seguro? Escribe "SI, ELIMINAR TODO" para continuar: ', resolve);
        });
        rl.close();
        
        if (answer !== 'SI, ELIMINAR TODO') {
            console.log('❌ Operación cancelada');
            return;
        }
        
        console.log('🧹 Iniciando reset completo de la base de datos...');
        
        await client.query('BEGIN');
        
        // Eliminar datos en orden correcto (respetando foreign keys)
        const tablesToClean = [
            'notifications',
            'ratings', 
            'publication_acceptances',
            'hidden_publications',
            'transactions',
            'red_token_debts',
            'blue_token_escrows',
            'referral_log',
            'booster_blue_ledger',
            'booster_payment_log',
            'platform_commission_log',
            'publications',
            'users',
            'booster_level_settings',
            'platform_wallet'
        ];
        
        for (const table of tablesToClean) {
            const result = await client.query(`DELETE FROM "${table}"`);
            console.log(`🗑️ Tabla ${table}: ${result.rowCount} registros eliminados`);
        }
        
        // Reinicializar configuraciones por defecto
        const defaultSettings = [
            ['public_profiles_enabled', 'true', 'Permite que cualquiera vea perfiles de usuario.'],
            ['allow_new_registrations', 'true', 'Permite que nuevos usuarios se registren.'],
            ['allow_new_publications', 'true', 'Permite a los usuarios crear nuevas publicaciones.'],
            ['debt_system_enabled', 'true', 'Activa o desactiva el sistema de deuda de tokens RED.'],
            ['debt_cycle_days', '30', 'Días para el ciclo de deuda RED.'],
            ['debt_cycle_hours', '0', 'Horas para el ciclo de deuda RED.'],
            ['debt_cycle_minutes', '0', 'Minutos para el ciclo de deuda RED.'],
            ['blue_escrow_days', '1', 'Días para el depósito de BLUE en escrow.'],
            ['blue_escrow_hours', '0', 'Horas para el depósito de BLUE en escrow.'],
            ['blue_escrow_minutes', '0', 'Minutos para el depósito de BLUE en escrow.'],
            ['platform_commission_percentage', '5', 'Porcentaje de comisión para la plataforma (ej: 5 para 5%).'],
            ['referral_system_enabled', 'true', 'Activa el sistema de referidos para nuevos registros.'],
            ['referral_reward_amount', '10', 'Cantidad de BLUE que ganan el referente y el referido al registrarse.'],
            ['booster_system_enabled', 'true', 'Activa el sistema de Impulsores y su lógica de pagos mensuales.']
        ];
        
        for (const setting of defaultSettings) {
            await client.query(
                'INSERT INTO app_settings (setting_key, setting_value, description) VALUES ($1, $2, $3) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2',
                setting
            );
        }
        
        // Crear usuario de plataforma
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        const passwordHash = await require('bcrypt').hash('secure_password_123', 10);
        const uniqueIdentifier = platformUsername.toLowerCase().replace(/\s+/g, '-');
        const email = `platform-${uniqueIdentifier}@wintoncoin.io`;
        const phone = `000000-${uniqueIdentifier}`;
        
        await client.query(
            'INSERT INTO users (username, password_hash, email, phone) VALUES ($1, $2, $3, $4)',
            [platformUsername, passwordHash, email, phone]
        );
        
        // Inicializar billetera de plataforma
        await client.query('INSERT INTO platform_wallet(id, total_blue_commission_balance) VALUES (1, 0)');
        
        await client.query('COMMIT');
        console.log('✅ Reset completo de la base de datos completado');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante el reset:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Función principal
async function main() {
    const command = process.argv[2];
    const days = parseInt(process.argv[3]) || 90;
    
    try {
        // Crear backup antes de cualquier operación
        console.log('🔄 Creando backup de seguridad...');
        await createBackup();
        console.log('✅ Backup de seguridad creado');
        
        switch (command) {
            case 'stats':
                await showDatabaseStats();
                break;
                
            case 'test-data':
                await cleanupTestData();
                break;
                
            case 'inactive-users':
                await cleanupInactiveUsers(days);
                break;
                
            case 'old-publications':
                await cleanupOldPublications(days);
                break;
                
            case 'reset':
                await resetDatabase();
                break;
                
            default:
                console.log('🧹 Script de Limpieza Segura para WintonCoin Database');
                console.log('');
                console.log('Uso:');
                console.log('  node cleanup-database.js stats                    - Mostrar estadísticas');
                console.log('  node cleanup-database.js test-data               - Limpiar datos de prueba');
                console.log('  node cleanup-database.js inactive-users [días]   - Limpiar usuarios inactivos (default: 90)');
                console.log('  node cleanup-database.js old-publications [días] - Limpiar publicaciones antiguas (default: 180)');
                console.log('  node cleanup-database.js reset                   - RESET COMPLETO (PELIGROSO)');
                console.log('');
                console.log('⚠️  NOTA: Se crea un backup automático antes de cada operación');
                break;
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main();
}

module.exports = { 
    showDatabaseStats, 
    cleanupTestData, 
    cleanupInactiveUsers, 
    cleanupOldPublications, 
    resetDatabase 
}; 