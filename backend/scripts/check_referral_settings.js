const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkSettings() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT * FROM app_settings WHERE setting_key IN ('referral_reward_amount', 'referral_bonus_amount', 'referral_codes_expiry_date', 'referral_reward_after_expiry')");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSettings();
