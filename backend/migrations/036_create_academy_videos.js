// ============================================================================
// MIGRACIÓN 036: Crear tabla de videos para la Winton Academy
// ============================================================================
// Esta migración crea la entidad necesaria para gestionar los tutoriales
// de YouTube de forma dinámica desde el Admin Panel.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 036] Creando tabla academy_videos...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS academy_videos (
                id SERIAL PRIMARY KEY,
                youtube_id VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                order_num INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Otorgamos un orden visual predeterminado a los registros futuros
            -- basándonos en el timestamp si es que order_num no es provisto explicitamente
            CREATE INDEX IF NOT EXISTS idx_academy_videos_order ON academy_videos (order_num, created_at);
        `);

        console.log('[MIGRATION 036] ✅ Tabla academy_videos creada exitosamente.');

        // Opcionalmente podemos inyectar aquí los 5 videos estáticos iniciales
        // que ya teníamos, para migrar la data suavemente.
        console.log('[MIGRATION 036] Inyectando catálogo base de Winton Academy...');

        const initialVideos = [
            { youtube_id: 'bx0BuO7l7MQ', title: 'Paso a paso para crear una publicación en WintonCoin 📲', order_num: 1 },
            { youtube_id: '7hgP8x4DMe8', title: 'Como postularte a Momentum en la app WintonCoin 💻', order_num: 2 },
            { youtube_id: '-Xtty88O0Iw', title: 'Te explico el ecosistema de WintonCoin 🚀', order_num: 3 },
            { youtube_id: 'ozX0caONb0w', title: 'Paga tu deuda RED en WintonCoin en 3 simples pasos 🤝', order_num: 4 },
            { youtube_id: 'zvnggNG2UNg', title: 'Programa de Impulsores y Referidos WintonCoin 💸', order_num: 5 }
        ];

        for (const video of initialVideos) {
            // Utilizamos ON CONFLICT DO NOTHING (requiere unique limit, así que como no lo tenemos en DB, checaremos existencia cruda por precaución)
            const result = await client.query('SELECT id FROM academy_videos WHERE youtube_id = $1', [video.youtube_id]);
            if (result.rows.length === 0) {
                await client.query(
                    'INSERT INTO academy_videos (youtube_id, title, order_num) VALUES ($1, $2, $3)',
                    [video.youtube_id, video.title, video.order_num]
                );
            }
        }

        console.log('[MIGRATION 036] ✅ Catálogo inicial poblado.');
    },

    down: async (client) => {
        console.log('[MIGRATION 036] Revirtiendo tabla academy_videos...');
        await client.query(`DROP TABLE IF EXISTS academy_videos CASCADE;`);
        console.log('[MIGRATION 036] ✅ Tabla eliminada.');
    }
};
