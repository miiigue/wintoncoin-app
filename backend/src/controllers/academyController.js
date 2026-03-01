const db = require('../config/db');

const academyController = {
    // OBTENER TODOS LOS VIDEOS ACTIVOS (Público, para la galería)
    getPublicVideos: async (req, res) => {
        try {
            const query = `
        SELECT id, youtube_id, title, order_num 
        FROM academy_videos 
        WHERE is_active = true 
        ORDER BY order_num ASC, created_at DESC
      `;
            const result = await db.query(query);
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('[academyController] Error en getPublicVideos:', error);
            res.status(500).json({ error: 'Error inteno al descargar videos de la Winton Academy' });
        }
    },

    // OBTENER TODOS LOS VIDEOS (Admin Panel)
    getAllVideos: async (req, res) => {
        try {
            const query = `
        SELECT id, youtube_id, title, order_num, is_active, created_at 
        FROM academy_videos 
        ORDER BY order_num ASC, created_at DESC
      `;
            const result = await db.query(query);
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('[academyController] Error en getAllVideos:', error);
            res.status(500).json({ error: 'Error del servidor listando los videos.' });
        }
    },

    // CREAR UN NUEVO VIDEO (Admin)
    createVideo: async (req, res) => {
        let { youtube_url, title, order_num } = req.body;

        if (!youtube_url || !title) {
            return res.status(400).json({ error: 'Falta la URL de YouTube o el Título.' });
        }

        // Extraer YouTube ID usando regex para mayor seguridad
        let youtube_id = null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = youtube_url.match(regExp);

        if (match && match[2].length === 11) {
            youtube_id = match[2];
        } else if (youtube_url.length === 11 && !youtube_url.includes('http')) {
            // En caso de que el admin pegue el ID directo en lugar de la URL completa
            youtube_id = youtube_url;
        }

        if (!youtube_id) {
            return res.status(400).json({ error: 'Enlace de YouTube no es válido.' });
        }

        try {
            const insertQuery = `
          INSERT INTO academy_videos (youtube_id, title, order_num) 
          VALUES ($1, $2, COALESCE($3, 0)) 
          RETURNING *;
        `;
            const result = await db.query(insertQuery, [youtube_id, title, order_num]);
            res.status(201).json({ success: true, message: 'Video agregado con éxito', video: result.rows[0] });
        } catch (error) {
            console.error('[academyController] Error en createVideo:', error);
            res.status(500).json({ error: 'Error al intentar guardar el video.' });
        }
    },

    // ACTUALIZAR ESTADO ACTIVO/INACTIVO Y ORDEN (Admin)
    updateVideoStatus: async (req, res) => {
        const videoId = req.params.id;
        const { is_active, order_num } = req.body;

        try {
            let updateQuery = 'UPDATE academy_videos SET ';
            const params = [];
            let paramIndex = 1;

            if (is_active !== undefined) {
                updateQuery += `is_active = $${paramIndex} `;
                params.push(is_active);
                paramIndex++;
            }

            if (order_num !== undefined) {
                if (params.length > 0) updateQuery += ', ';
                updateQuery += `order_num = $${paramIndex} `;
                params.push(order_num);
                paramIndex++;
            }

            if (params.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

            updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
            params.push(videoId);

            const result = await db.query(updateQuery, params);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Video no encontrado' });

            res.status(200).json({ success: true, message: 'Video de academia modificado exitosamente', video: result.rows[0] });

        } catch (error) {
            console.error('[academyController] Error alterando status:', error);
            res.status(500).json({ error: 'Hubo un error alterando los parámetros visuales.' });
        }
    },

    // ELIMINAR VIDEO DEFINITIVAMENTE (Admin)
    deleteVideo: async (req, res) => {
        const videoId = req.params.id;

        try {
            const deleteQuery = 'DELETE FROM academy_videos WHERE id = $1 RETURNING id';
            const result = await db.query(deleteQuery, [videoId]);

            if (result.rows.length === 0) return res.status(404).json({ error: 'Video no existe en la base de datos' });

            res.status(200).json({ success: true, message: 'Video eliminado con éxito de Winton Academy.' });
        } catch (error) {
            console.error('[academyController] Fallo eliminando video:', error);
            res.status(500).json({ error: 'Error eliminando el registro' });
        }
    }
};

module.exports = academyController;
