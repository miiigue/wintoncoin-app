require('../config');
const pool = require('../src/config/db');

async function main() {
    try {
        console.log('--- DEBUG TODAS LAS PUBLICACIONES DE PLATAFORMA ---');

        const platformUser = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        console.log(`Platform Username: ${platformUser}`);

        const sql = `
            SELECT
                p.id, p.title, p.status, p.is_paused, p.available_slots,
                p.deleted_at, p.expires_at,
                (
                    CASE
                        WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                        ELSE (
                            p.available_slots <= 0
                        )
                    END
                ) AS is_completed_publication
            FROM publications p
            JOIN users u ON p.author_id = u.id
            WHERE u.username = $1
        `;

        const res = await pool.query(sql, [platformUser]);

        console.log(`Total encontradas: ${res.rows.length}`);

        res.rows.forEach(p => {
            let status = 'ACTIVE';
            if (p.deleted_at) status = 'DELETED';
            else if (p.expires_at && new Date(p.expires_at) < new Date()) status = 'EXPIRED';
            else if (p.is_paused) status = 'PAUSED';
            else if (p.is_completed_publication) status = 'COMPLETED (NO SLOTS)';

            console.log(`[${status}] ID: ${p.id} - ${p.title}`);
            console.log(`    Slots: ${p.available_slots}, Expires: ${p.expires_at}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

main();
