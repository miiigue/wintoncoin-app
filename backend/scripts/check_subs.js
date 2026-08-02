require('../config');
const pool = require('../src/config/db');

async function check() {
    try {
        const res = await pool.query('SELECT * FROM push_subscriptions');
        console.log('--- PUSH SUBSCRIPTIONS ---');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error checking subs:', err);
        process.exit(1);
    }
}

check();
