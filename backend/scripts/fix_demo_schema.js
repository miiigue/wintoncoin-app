require('dotenv').config({ path: '../.env.demo.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
    console.log('🔧 Parcheando schema de la base de datos DEMO...');
    const client = await pool.connect();

    try {
        // Añadir columnas faltantes a publications
        const fixes = [
            // Publications
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;`,
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'sell';`,
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`,
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS deleted_by_username VARCHAR(255);`,
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS is_quick_sale BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS target_username VARCHAR(255);`,
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS is_booster_task BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS form_fields JSONB;`,
            // Users
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS tutor_user_id INTEGER;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active';`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50);`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS booster_blue_balance NUMERIC(19,4) DEFAULT 0;`,
        ];

        for (const sql of fixes) {
            try {
                await client.query(sql);
                console.log('✅', sql.substring(0, 60) + '...');
            } catch (err) {
                if (err.code === '42701') { // Column already exists
                    console.log('⏩ Ya existe:', sql.substring(30, 70));
                } else {
                    console.error('❌ Error:', err.message);
                }
            }
        }

        console.log('✅ Schema parcheado correctamente.');
    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        client.release();
        pool.end();
    }
}

fixSchema();
