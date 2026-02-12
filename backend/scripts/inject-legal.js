
const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Miiiguebotbinance@localhost:5432/wintoncoin_dev' });

async function run() {
    try {
        const activeDocs = await pool.query('SELECT type, version, content_hash FROM legal_documents WHERE is_active = true');
        console.log(`Found ${activeDocs.rowCount} active docs`);

        for (const doc of activeDocs.rows) {
            await pool.query(
                `INSERT INTO user_agreements_log (user_id, document_type, document_version, document_hash, accepted_at, ip_address, user_agent) 
                 VALUES (1, $1, $2, $3, NOW(), '127.0.0.1', 'System Auto-Accept')`,
                [doc.type, doc.version, doc.content_hash]
            );
            console.log(`Injected acceptance for ${doc.type} ${doc.version}`);
        }
        console.log('Acceptance injection complete.');
    } catch (e) {
        console.error('Error during injection:', e);
    } finally {
        await pool.end();
    }
}

run();
