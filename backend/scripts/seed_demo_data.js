require('dotenv').config({ path: '../.env.demo' }); // Carga variables de entorno específicas para demo
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Verificación de seguridad CRÍTICA
if (process.env.NODE_ENV === 'production' && !process.env.IS_DEMO_ENV) {
    console.log('Ambiente detectado:', process.env.NODE_ENV);
    console.log('IS_DEMO_ENV:', process.env.IS_DEMO_ENV);
    console.error('⛔ PELIGRO: Intentando correr script de seed en producción sin confirmación explícita.');
    console.error('Este script BORRA datos. Asegúrate de estar en el entorno DEMO.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const DEMO_PASSWORD = 'password123'; // Contraseña común para todos los usuarios demo

async function seedDemoData() {
    console.log('🌱 Iniciando sembrado de datos para DEMO...');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Limpieza (TRUNCATE es rápido y furioso)
        console.log('🧹 Limpiando base de datos demo...');
        // Orden importante para respetar Foreign Keys
        await client.query(`
            TRUNCATE TABLE 
                notifications, 
                publication_acceptances, 
                publications, 
                transactions, 
                users 
            RESTART IDENTITY CASCADE
        `);

        // 2. Crear Usuario Inversionista (El que usarás en la demo)
        console.log('👤 Creando usuario Inversionista...');
        const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

        const investorRes = await client.query(`
            INSERT INTO users (username, email, password_hash, liquid_blue_balance, is_verified)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
        `, ['demo_investor', 'investor@wintoncoin.com', hashedPassword, 50000.00]);

        const investorId = investorRes.rows[0].id;

        // 3. Crear Usuarios Ficticios (La "comunidad")
        const fakeUsersData = [
            { username: 'maria_fintech', email: 'maria@test.com', balance: 1250.50 },
            { username: 'cryptojuan', email: 'juan@test.com', balance: 3400.00 },
            { username: 'ana_startup', email: 'ana@test.com', balance: 890.00 },
            { username: 'pedro_trader', email: 'pedro@test.com', balance: 15600.00 },
            { username: 'luisa_dev', email: 'luisa@test.com', balance: 450.25 }
        ];

        const fakeUserIds = [];
        console.log(`👥 Creando ${fakeUsersData.length} usuarios de relleno...`);

        for (const u of fakeUsersData) {
            const res = await client.query(`
                INSERT INTO users (username, email, password_hash, liquid_blue_balance, is_verified)
                VALUES ($1, $2, $3, $4, true)
                RETURNING id
            `, [u.username, u.email, hashedPassword, u.balance]);
            fakeUserIds.push(res.rows[0].id);
        }

        // 4. Crear Algunas Publicaciones Activas
        console.log('📝 Creando publicaciones de ejemplo...');
        await client.query(`
            INSERT INTO publications (author_id, title, description, blue_cost, category, available_slots, status, created_at)
            VALUES 
            ($1, 'Consultoría Blockchain Estratégica', 'Asesoría completa para integración de web3 en empresas tradicionales.', 500, 'sell', 5, 'open', NOW() - INTERVAL '2 days'),
            ($2, 'Diseño de Logo Corporativo', 'Diseño profesional de identidad visual.', 150, 'sell', 3, 'open', NOW() - INTERVAL '5 hours'),
            ($3, 'Clases de Finanzas Personales', 'Aprende a gestionar tus activos digitales.', 50, 'sell', 10, 'open', NOW() - INTERVAL '1 day')
        `, [fakeUserIds[3], fakeUserIds[0], fakeUserIds[2]]); // Pedro, Maria, Ana publican

        // 5. Generar Historial de Transacciones para el Inversionista
        console.log('💸 Generando transacciones falsas...');

        // Transacciones donde el investor RECIBE (type 'purchase' o 'transfer')
        // En la tabla transactions, 'user_id' es el dueño de la transacción.
        // Simulamos ingresos
        await client.query(`
            INSERT INTO transactions (user_id, type, description, blue_change, created_at)
            VALUES 
            ($1, 'reward', 'Recompensa del sistema', 1000, NOW() - INTERVAL '10 days'),
            ($1, 'transfer_received', 'Transferencia recibida de Pedro', 500, NOW() - INTERVAL '5 days'),
            ($1, 'transfer_received', 'Transferencia recibida de Maria', 150, NOW() - INTERVAL '2 days'),
            ($1, 'reward', 'Bonus diario', 250, NOW() - INTERVAL '1 hour')
        `, [investorId]);

        // Gastos recientes (pagos enviados)
        await client.query(`
            INSERT INTO transactions (user_id, type, description, blue_change, created_at)
            VALUES 
            ($1, 'transfer_sent', 'Pago a Ana Startup', -200, NOW() - INTERVAL '8 days'),
            ($1, 'transfer_sent', 'Pago a Luisa Dev', -50, NOW() - INTERVAL '3 days')
        `, [investorId]);

        await client.query('COMMIT');
        console.log('✅ BASE DE DATOS DEMO SEMBRADA CON ÉXITO.');
        console.log(`🔑 Credenciales Demo: Usuario: demo_investor / Pass: ${DEMO_PASSWORD}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error sembrando datos:', error);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

seedDemoData();
