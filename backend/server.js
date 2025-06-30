// 0. Cargar variables de entorno
require('dotenv').config();

// 1. Importar las librerías necesarias
const express = require('express');
const { Pool } = require('pg'); // Importamos el Pool de pg
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken'); // <-- NUEVA LIBRERÍA

// 2. Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// 3. Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 4. Conectar a la Base de Datos PostgreSQL
// Usamos un Pool, que gestiona múltiples conexiones eficientemente.
// Se conectará automáticamente usando la variable de entorno DATABASE_URL en Render.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Render requiere conexiones SSL, pero PostgreSQL localmente generalmente no.
    // Esta línea asegura que SSL solo se use en el entorno de producción (Render).
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Función para verificar la conexión
async function checkDbConnection() {
    try {
        const client = await pool.connect();
        console.log("Conectado a la base de datos PostgreSQL.");
        client.release(); // Liberamos el cliente inmediatamente
    } catch (err) {
        console.error("Error al conectar con PostgreSQL:", err);
        throw err; // Lanzamos el error para detener el inicio del servidor si falla
    }
}


// La inicialización de la base de datos ahora crea las tablas en PostgreSQL si no existen
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Iniciar transacción para la creación de tablas

        // Notar los cambios:
        // - INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL PRIMARY KEY
        // - TEXT UNIQUE NOT NULL -> VARCHAR(255) UNIQUE NOT NULL (más específico)
        // - DATETIME -> TIMESTAMPTZ (timestamp con zona horaria, más robusto)
        // - DEFAULT CURRENT_TIMESTAMP -> DEFAULT NOW()
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                blue_balance INTEGER NOT NULL DEFAULT 0,
                red_balance INTEGER NOT NULL DEFAULT 0,
                average_rating REAL NOT NULL DEFAULT 0,
                ratings_count INTEGER NOT NULL DEFAULT 0
            )
        `);
        console.log("Tabla 'users' asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS publications (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                blue_cost INTEGER NOT NULL,
                is_sell_post BOOLEAN NOT NULL DEFAULT FALSE,
                author_username VARCHAR(255) NOT NULL,
                available_slots INTEGER NOT NULL DEFAULT 1 CHECK (available_slots >= 0),
                is_paused BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'publications' asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS hidden_publications (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
                hider_username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                UNIQUE (publication_id, hider_username)
            )
        `);
        console.log("Tabla 'hidden_publications' creada/asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS publication_acceptances (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
                acceptor_username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (publication_id, acceptor_username)
            )
        `);
        console.log("Tabla 'publication_acceptances' creada/asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'notifications' asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                type VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                blue_change INTEGER NOT NULL DEFAULT 0,
                red_change INTEGER NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'transactions' asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
                rater_username VARCHAR(255) NOT NULL REFERENCES users(username),
                ratee_username VARCHAR(255) NOT NULL REFERENCES users(username),
                rating INTEGER NOT NULL,
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'ratings' creada/asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value TEXT NOT NULL
            )
        `);
        console.log("Tabla 'app_settings' creada/asegurada.");

        // Insertar la configuración por defecto para los perfiles públicos.
        // ON CONFLICT... evita errores si la llave ya existe, simplemente no hace nada.
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES 
                ('public_profiles_enabled', 'false'),
                ('allow_new_registrations', 'true'),
                ('allow_new_publications', 'true')
            ON CONFLICT (setting_key) DO NOTHING;
        `);
        console.log("Configuraciones por defecto aseguradas en 'app_settings'.");

        // --- MIGRACIÓN SIMPLE PARA ASEGURAR COMPATIBILIDAD ---

        // MIGRACIÓN para available_slots
        const slotsColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='publications' AND column_name='available_slots'
        `);
        if (slotsColumnCheck.rowCount === 0) {
            console.log("MIGRACIÓN: La columna 'available_slots' no existe. Añadiéndola a 'publications'...");
            await client.query(`ALTER TABLE publications ADD COLUMN available_slots INTEGER NOT NULL DEFAULT 1`);
            console.log("MIGRACIÓN: Columna 'available_slots' añadida exitosamente.");
        }

        // Verificamos si la columna 'is_paused' existe en 'publications'.
        // Esto es crucial para no fallar en bases de datos que fueron creadas ANTES de añadir este campo.
        const columnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='publications' AND column_name='is_paused'
        `);

        // Si el resultado es 0 filas, la columna no existe, así que la añadimos.
        if (columnCheck.rowCount === 0) {
            console.log("MIGRACIÓN: La columna 'is_paused' no existe. Añadiéndola a 'publications'...");
            await client.query(`ALTER TABLE publications ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT FALSE`);
            console.log("MIGRACIÓN: Columna 'is_paused' añadida exitosamente.");
        }

        // --- MIGRACIÓN PARA LA REGLA DE BORRADO EN CASCADA DE RATINGS ---
        // Esto soluciona el error de llave foránea al eliminar una publicación que tiene calificaciones.
        try {
            // Primero, eliminamos la restricción vieja si existe. Usamos un nombre genérico que PostgreSQL suele dar.
            await client.query(`ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_publication_id_fkey;`);
            // Luego, añadimos la restricción correcta con ON DELETE CASCADE.
            await client.query(`
                ALTER TABLE ratings 
                ADD CONSTRAINT ratings_publication_id_fkey 
                FOREIGN KEY (publication_id) 
                REFERENCES publications(id) 
                ON DELETE CASCADE;
            `);
            console.log("MIGRACIÓN: Regla 'ON DELETE CASCADE' para ratings asegurada.");
        } catch(e) {
            // Si la constraint no existe con ese nombre, podría fallar, lo ignoramos y continuamos.
            console.warn("Advertencia al intentar migrar la llave foránea de ratings. Puede que ya estuviera correcta.", e.message);
        }

        await client.query('COMMIT'); // Finalizar transacción
        console.log("Todas las tablas han sido aseguradas en PostgreSQL.");

    } catch (err) {
        await client.query('ROLLBACK'); // Revertir en caso de error
        console.error("Error al inicializar las tablas:", err);
        throw err;
    } finally {
        client.release(); // Siempre liberar el cliente
    }
}

// 5. Función principal asíncrona para iniciar el servidor
async function startServer() {
    try {
        await checkDbConnection();
        await initializeDatabase();
        console.log("Base de datos inicializada correctamente.");

        // --- AHORA DEFINIMOS LAS RUTAS ---

// Ruta de Registro de Usuario
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
                // La sintaxis de las consultas cambia a $1, $2, etc.
                const sql = `INSERT INTO users (username, password) VALUES ($1, $2)`;
                await pool.query(sql, [username, hashedPassword]);
                res.status(201).json({ message: `Usuario ${username} registrado exitosamente.` });
            } catch (error) {
                // El código de error para violación de constraint 'unique' en PostgreSQL es '23505'
                if (error.code === '23505') {
                    return res.status(409).json({ message: "El nombre de usuario ya existe." });
                }
                console.error("Error al registrar usuario:", error);
                res.status(500).json({ message: "Error interno del servidor." });
    }
});

// Ruta de Inicio de Sesión
        app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }

            try {
                const sql = `SELECT * FROM users WHERE username = $1`;
                const result = await pool.query(sql, [username]);
                const user = result.rows[0];
        
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado. Por favor, regístrese primero." });
        }

            const match = await bcrypt.compare(password, user.password);
            if (match) {
                res.status(200).json({
                    message: "Inicio de sesión exitoso.",
                    username: user.username,
                    blue_balance: user.blue_balance,
                    red_balance: user.red_balance
                });
            } else {
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
        } catch (error) {
                console.error("Error en el inicio de sesión:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
});

// Ruta para crear una nueva Publicación
        app.post('/publish', async (req, res) => {
            const { title, description, blueCost, blueSell, authorUsername, availableSlots } = req.body;
        
            if (!title || !description || !authorUsername || (!blueCost && !blueSell)) {
                return res.status(400).json({ message: "Faltan datos requeridos para la publicación." });
            }
        
            const isSellPost = !!blueSell;
            const cost = blueSell || blueCost;
            // Si no se especifica, por defecto es 1. Lo convertimos a número.
            const slots = availableSlots ? parseInt(availableSlots, 10) : 1;

            if (isNaN(slots) || slots < 1) {
                return res.status(400).json({ message: "La cantidad de cupos disponibles debe ser un número mayor a 0." });
            }
        
            try {
                const sql = `INSERT INTO publications (title, description, blue_cost, is_sell_post, author_username, available_slots) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
                const result = await pool.query(sql, [title, description, cost, isSellPost, authorUsername, slots]);
                res.status(201).json({ message: "Publicación creada exitosamente.", publicationId: result.rows[0].id });
            } catch (error) {
                console.error("Error al guardar la publicación:", error);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        });

        // Ruta para obtener publicaciones activas (RECONSTRUIDA)
        app.get('/publications/active', async (req, res) => {
            const { user } = req.query;
            if (!user) return res.status(400).json({ message: "Es necesario especificar un usuario." });

            // Esta consulta es más compleja y eficiente:
            // 1. Selecciona todas las publicaciones.
            // 2. Obtiene el estado de aceptación específico para el usuario que hace la petición (`user_acceptance_status`).
            // 3. Si el usuario es el autor de la publicación, agrega un objeto JSON con la lista de todos los participantes (`participants`).
            // 4. Filtra las publicaciones para mostrar solo las relevantes: con cupos, o donde el usuario es autor o participante.
    const sql = `
                SELECT
                    p.*,
                    (SELECT pa.status FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.acceptor_username = $1) as user_acceptance_status,
                    (CASE
                        WHEN p.author_username = $1 THEN (
                            SELECT json_agg(json_build_object(
                                'username', u.username,
                                'status', pa.status,
                                'average_rating', u.average_rating,
                                'ratings_count', u.ratings_count
                            ))
                            FROM publication_acceptances pa
                            JOIN users u ON pa.acceptor_username = u.username
                            WHERE pa.publication_id = p.id
                        )
                        ELSE NULL
                    END) as participants
                FROM
                    publications p
                WHERE
                    -- Regla #1: No mostrar si el usuario la ha ocultado.
                    p.id NOT IN (SELECT hp.publication_id FROM hidden_publications hp WHERE hp.hider_username = $1)
                    AND (
                        -- Regla #2: Mostrar al PÚBLICO si tiene cupos disponibles. 
                        -- El estado 'pausado' se gestiona en el frontend; aquí solo nos importa que sea visible.
                        (p.available_slots > 0)
                        
                        -- O Regla #3: Mostrar al AUTOR si la tarea no está completamente finalizada (aunque no tenga cupos).
                        OR (
                            p.author_username = $1 AND
                            EXISTS ( -- tiene participantes cuyo estado no es 'confirmed_paid'
                                SELECT 1 FROM publication_acceptances pa
                                WHERE pa.publication_id = p.id AND pa.status != 'confirmed_paid'
                            )
                        )
                        -- O Regla #4: Mostrar a un PARTICIPANTE si su propia tarea no está finalizada (aunque no tenga cupos).
                        OR (
                            p.id IN (
                                SELECT pa.publication_id FROM publication_acceptances pa
                                WHERE pa.acceptor_username = $1 AND pa.status != 'confirmed_paid'
                            )
                        )
                    )
                ORDER BY
                    p.created_at DESC
            `;
            try {
                const result = await pool.query(sql, [user]);
                // Nos aseguramos de que 'participants' sea siempre un array para facilitar el trabajo en el frontend.
                const publications = result.rows.map(p => ({
                    ...p,
                    participants: p.participants || [],
                }));
                res.status(200).json(publications);
            } catch (error) {
                console.error("Error al obtener las publicaciones activas:", error);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        });

        // Ruta para Aceptar una publicación (RECONSTRUIDA)
        app.post('/publications/:id/accept', async (req, res) => {
            const { id } = req.params;
    const { acceptorUsername } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Bloqueamos la fila en 'publications' para evitar que dos personas acepten el último cupo a la vez (condición de carrera)
                const pubResult = await client.query(`SELECT * FROM publications WHERE id = $1 FOR UPDATE`, [id]);
                const pub = pubResult.rows[0];

                if (!pub) {
                    throw { status: 404, message: "La publicación ya no existe." };
                }
                if (pub.author_username === acceptorUsername) {
                    throw { status: 400, message: "No puedes aceptar tu propia publicación." };
                }
                if (pub.available_slots <= 0) {
                    throw { status: 400, message: "Lo sentimos, ya no quedan cupos disponibles para esta tarea." };
                }

                // Disminuimos los cupos disponibles y creamos el registro de aceptación
                await client.query(`UPDATE publications SET available_slots = available_slots - 1 WHERE id = $1`, [id]);
                
                const acceptanceSQL = `INSERT INTO publication_acceptances (publication_id, acceptor_username, status) VALUES ($1, $2, 'pending_approval')`;
                await client.query(acceptanceSQL, [id, acceptorUsername]);
                
                const message = `El usuario ${acceptorUsername} quiere realizar la tarea "${pub.title}".`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, message]);

                await client.query('COMMIT');
                res.status(200).json({ message: "Solicitud enviada. Esperando aprobación del autor." });

            } catch (error) {
                await client.query('ROLLBACK');
                 // Manejar el error de violación de la restricción UNIQUE (usuario ya aceptó)
                if (error.code === '23505') {
                    return res.status(409).json({ message: "Ya has enviado una solicitud para esta tarea." });
                }
                console.error("Error al aceptar publicación:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // Ruta para Descartar a un usuario
        app.post('/publications/:id/discard', async (req, res) => {
            const { id } = req.params;
            const { discarderUsername, userToDiscard } = req.body;
        
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
        
                // 1. Verificar que quien descarta es el autor.
                const pubResult = await client.query(`SELECT * FROM publications WHERE id = $1 AND author_username = $2 FOR UPDATE`, [id, discarderUsername]);
                const pub = pubResult.rows[0];
                if (!pub) {
                    throw { status: 403, message: "No tienes permiso para gestionar esta tarea." };
                }
        
                // 2. Eliminar la solicitud de aceptación.
                const deleteResult = await client.query(
                    `DELETE FROM publication_acceptances WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'pending_approval' RETURNING *`,
                    [id, userToDiscard]
                );
                
                if (deleteResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una solicitud pendiente para este usuario." };
                }
        
                // 3. Devolver el cupo a la publicación.
                await client.query(`UPDATE publications SET available_slots = available_slots + 1 WHERE id = $1`, [id]);
        
                // 4. Notificar al usuario descartado con un mensaje amigable.
                const message = `Tu solicitud para la tarea "${pub.title}" no fue seleccionada. ¡Gracias por tu interés!`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [userToDiscard, message]);
        
                await client.query('COMMIT');
                res.status(200).json({ message: `Has descartado la solicitud de ${userToDiscard}.` });
        
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al descartar solicitud:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Aprobar a un usuario (RECONSTRUIDA)
        app.post('/publications/:id/approve', async (req, res) => {
            const { id } = req.params;
            // Ahora necesitamos saber a quién aprobar
            const { approverUsername, userToApprove } = req.body; 
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Verificamos que quien aprueba es el autor de la publicación.
                const pubResult = await client.query(`SELECT * FROM publications WHERE id = $1 AND author_username = $2`, [id, approverUsername]);
                const pub = pubResult.rows[0];
                if (!pub) throw { status: 403, message: "No tienes permiso para aprobar solicitudes para esta tarea." };

                // 2. Actualizamos el estado de la aceptación específica
                const updateResult = await client.query(
                    `UPDATE publication_acceptances SET status = 'approved' WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'pending_approval' RETURNING *`,
                    [id, userToApprove]
                );
                
                // Si no se actualizó ninguna fila, es que no había una solicitud válida.
                if (updateResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una solicitud pendiente válida para este usuario." };
                }

                // 3. Enviamos la notificación al usuario aprobado
                const message = `¡Has sido aprobado para la tarea "${pub.title}"!`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [userToApprove, message]);
                
                await client.query('COMMIT');
                res.status(200).json({ message: `Has aprobado a ${userToApprove}.` });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al aprobar:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Marcar como Culminada (RECONSTRUIDA)
        app.post('/publications/:id/complete', async (req, res) => {
            const { id } = req.params;
            const { completerUsername } = req.body;
        
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Buscamos la publicación para obtener el nombre del autor para la notificación.
                const pubResult = await client.query(`SELECT author_username, title FROM publications WHERE id = $1`, [id]);
                if (pubResult.rowCount === 0) throw { status: 404, message: "La publicación no existe." };
                const pub = pubResult.rows[0];
        
                // 2. Actualizamos la aceptación del usuario si está en estado 'approved'.
                const updateResult = await client.query(
                    `UPDATE publication_acceptances SET status = 'completed' WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'approved' RETURNING *`,
                    [id, completerUsername]
                );
                
                if (updateResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una tarea aprobada para marcar como culminada." };
                }
        
                // 3. Notificamos al autor.
                const message = `${completerUsername} ha marcado la tarea "${pub.title}" como culminada.`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, message]);
        
                await client.query('COMMIT');
                res.status(200).json({ message: "Tarea marcada como culminada. Esperando la confirmación del autor." });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al completar tarea:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Confirmar y Pagar (RECONSTRUIDA)
        app.post('/publications/:id/confirm-payment', async (req, res) => {
            const pubId = req.params.id;
            // Necesitamos saber quién confirma (autor) y para quién confirma (trabajador)
            const { confirmerUsername, workerUsername } = req.body; 
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Buscamos la publicación y la aceptación específica que está en 'completed'.
                // Nos aseguramos de que el confirmerUsername es el autor.
                const acceptanceResult = await client.query(
                    `SELECT p.blue_cost, p.is_sell_post, p.title, p.author_username, pa.id as acceptance_id
                     FROM publications p
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
                     WHERE p.id = $1 
                       AND p.author_username = $2 
                       AND pa.acceptor_username = $3
                       AND pa.status = 'completed'
                     FOR UPDATE`, // Bloqueamos las filas para la transacción
                    [pubId, confirmerUsername, workerUsername]
                );
                
                const acceptance = acceptanceResult.rows[0];
                if (!acceptance) throw { status: 404, message: "No se encontró una tarea completada válida para confirmar." };

                const { blue_cost: cost, is_sell_post, title, author_username: author, acceptance_id } = acceptance;

                // 2. Realizamos la lógica de transferencia de tokens y transacciones
                const insertTxSql = `INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) VALUES ($1, $2, $3, $4, $5, $6)`;
                
                if (is_sell_post) {
                    // Venta: Vendedor (author) recibe BLUE, Comprador (worker) recibe RED.
                    await client.query(`UPDATE users SET blue_balance = blue_balance + $1 WHERE username = $2`, [cost, author]);
                    await client.query(insertTxSql, [author, 'sale_completed', `Vendiste: "${title}"`, cost, 0, pubId]);
                    
                    await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [cost, workerUsername]);
                    await client.query(insertTxSql, [workerUsername, 'purchase_completed', `Compraste: "${title}"`, 0, cost, pubId]);
                } else {
                    // Trabajo: Pagador (author) recibe RED, Trabajador (worker) recibe BLUE.
                    await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [cost, author]);
                    await client.query(insertTxSql, [author, 'payment_sent', `Solicitaste: "${title}"`, 0, cost, pubId]);
                    
                    await client.query(`UPDATE users SET blue_balance = blue_balance + $1 WHERE username = $2`, [cost, workerUsername]);
                    await client.query(insertTxSql, [workerUsername, 'payment_received', `Realizaste: "${title}"`, cost, 0, pubId]);
                }
                
                // 3. Actualizamos el estado de la aceptación a 'confirmed_paid'
                await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance_id]);
                
                // 4. Enviamos la notificación al trabajador
                const notificationMessage = is_sell_post 
                    ? `¡Has completado la compra de "${title}" y recibido ${cost} RED!`
                    : `¡Has recibido ${cost} BLUE por la tarea "${title}"!`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [workerUsername, notificationMessage]);
                
                await client.query('COMMIT');
                res.status(200).json({ message: "Pago confirmado y tarea finalizada." });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error en confirm-payment:", error);
                res.status(error.status || 500).json({ message: error.message || "Error crítico en la transacción." });
            } finally {
                client.release();
            }
});

// Ruta para obtener las notificaciones de un usuario
        app.get('/notifications/:username', async (req, res) => {
    const { username } = req.params;
            const sql = `SELECT * FROM notifications WHERE recipient_username = $1 ORDER BY created_at DESC`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json(result.rows);
            } catch(error) {
                res.status(500).json({ message: "Error interno del servidor." });
            }
});

// Ruta para marcar notificaciones como leídas
        app.post('/notifications/mark-read', async (req, res) => {
    const { username } = req.body;
            const sql = `UPDATE notifications SET is_read = TRUE WHERE recipient_username = $1 AND is_read = FALSE`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json({ message: `${result.rowCount} notificaciones marcadas como leídas.` });
            } catch(error) {
                res.status(500).json({ message: "Error al marcar notificaciones como leídas." });
            }
});

// Ruta para QUEMAR tokens
        app.post('/users/burn', async (req, res) => {
    const { username, amount } = req.body;
    if (!username || !amount || amount <= 0) {
        return res.status(400).json({ message: "La cantidad a quemar debe ser un número positivo." });
    }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                const userResult = await client.query(`SELECT blue_balance, red_balance FROM users WHERE username = $1 FOR UPDATE`, [username]);
                const user = userResult.rows[0];

                if (!user) throw { status: 404, message: "Usuario no encontrado." };
        if (user.blue_balance < amount || user.red_balance < amount) {
                    throw { status: 400, message: "No tienes suficientes BLUE o RED para quemar esta cantidad." };
                }

                await client.query(`UPDATE users SET blue_balance = blue_balance - $1, red_balance = red_balance - $2 WHERE username = $3`, [amount, amount, username]);
                
            const burnDesc = `Tokens Quemados`;
                await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'burn', $2, $3, $4)`, [username, burnDesc, -amount, -amount]);

                await client.query('COMMIT');
                res.status(200).json({ message: `Has quemado ${amount} BLUE y ${amount} RED exitosamente.` });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al quemar tokens:", error);
                res.status(error.status || 500).json({ message: error.message || "Error del servidor al quemar los tokens." });
            } finally {
                client.release();
            }
        });

        // Ruta: Obtener el historial de un usuario
        app.get('/users/:username/history', async (req, res) => {
    const { username } = req.params;
            try {
                // Para las publicaciones creadas por el usuario, ahora simplemente las seleccionamos.
                // El frontend se encargará de buscar a los participantes si es necesario.
                const authoredSql = `SELECT * FROM publications WHERE author_username = $1 ORDER BY created_at DESC`;

                // Para las tareas completadas, hacemos un JOIN para encontrar las que el usuario aceptó y fueron pagadas.
    const completedSql = `
                    SELECT p.*, pa.status as user_acceptance_status
                    FROM publications p
                    JOIN publication_acceptances pa ON p.id = pa.publication_id
                    WHERE pa.acceptor_username = $1 AND pa.status = 'confirmed_paid'
                    ORDER BY p.created_at DESC
                `;

                const [authoredResult, completedResult] = await Promise.all([
                    pool.query(authoredSql, [username]),
                    pool.query(completedSql, [username])
                ]);

                res.status(200).json({ authored: authoredResult.rows, completed: completedResult.rows });
            } catch (err) {
                console.error("Error al obtener el historial:", err.message);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para obtener todos los participantes de una publicación
        app.get('/publications/:id/participants', async (req, res) => {
            const { id } = req.params;
            const sql = `
                SELECT
                    pa.acceptor_username,
                    pa.status,
                    u.average_rating,
                    u.ratings_count
                FROM
                    publication_acceptances pa
                JOIN
                    users u ON pa.acceptor_username = u.username
                WHERE
                    pa.publication_id = $1
                ORDER BY
                    pa.created_at
            `;
            try {
                const result = await pool.query(sql, [id]);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error('Error al obtener participantes:', error);
        res.status(500).json({ message: "Error interno del servidor." });
            }
});

        // Ruta: Obtener las transacciones de un usuario
        app.get('/users/:username/transactions', async (req, res) => {
    const { username } = req.params;
            const sql = `SELECT * FROM transactions WHERE username = $1 ORDER BY created_at DESC`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json(result.rows);
            } catch (err) {
            console.error("Error al obtener las transacciones:", err.message);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        });

        // RUTA: Obtener los saldos de un usuario
        app.get('/users/:username/balance', async (req, res) => {
            const { username } = req.params;
            const sql = `SELECT blue_balance, red_balance FROM users WHERE username = $1`;
            try {
                const result = await pool.query(sql, [username]);
                if (result.rows.length === 0) {
                    return res.status(404).json({ message: "Usuario no encontrado." });
                }
                res.status(200).json(result.rows[0]);
            } catch (err) {
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });
        
        // Ruta para obtener datos públicos de un usuario (calificación)
        app.get('/user/:username', async (req, res) => {
            const { username } = req.params;
            const sql = `SELECT username, average_rating, ratings_count FROM users WHERE username = $1`;
            try {
                const result = await pool.query(sql, [username]);
                if (result.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
                res.status(200).json(result.rows[0]);
            } catch (err) {
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });
        
        // Ruta para crear una calificación
        app.post('/rate', async (req, res) => {
            const { publicationId, raterUsername, rateeUsername, rating, comment } = req.body;
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                const sql = `INSERT INTO ratings (publication_id, rater_username, ratee_username, rating, comment) VALUES ($1, $2, $3, $4, $5)`;
                await client.query(sql, [publicationId, raterUsername, rateeUsername, rating, comment]);

                const recalcSql = `SELECT AVG(rating) as average_rating, COUNT(rating) as ratings_count FROM ratings WHERE ratee_username = $1`;
                const recalcResult = await client.query(recalcSql, [rateeUsername]);
                const { average_rating, ratings_count } = recalcResult.rows[0];
                
                const updateSql = `UPDATE users SET average_rating = $1, ratings_count = $2 WHERE username = $3`;
                await client.query(updateSql, [average_rating, ratings_count, rateeUsername]);

                await client.query('COMMIT');
                res.status(201).json({ message: "¡Gracias por tu calificación!" });
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("Error al guardar la calificación:", err.message);
                res.status(500).json({ message: "Error interno al guardar la calificación." });
            } finally {
                client.release();
            }
        });

        // Ruta para ELIMINAR una publicación
        app.delete('/publications/:id', async (req, res) => {
            const { id } = req.params;
            const { deleterUsername } = req.body;
            if (!deleterUsername) return res.status(400).json({ message: "Se requiere nombre de usuario." });

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(`SELECT author_username FROM publications WHERE id = $1 FOR UPDATE`, [id]);
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "La publicación no existe." };
                if (pub.author_username !== deleterUsername) throw { status: 403, message: "No tienes permiso para eliminar esto." };

                // REGLA DE NEGOCIO CORREGIDA:
                // Solo se puede eliminar si no hay participantes en estado 'approved' o 'completed'.
                // Se permite eliminar si solo hay pendientes (se cancelan) o si ya todos fueron pagados (se archiva).
                const participantsCheck = await client.query(
                    `SELECT 1 FROM publication_acceptances WHERE publication_id = $1 AND status IN ('approved', 'completed') LIMIT 1`,
                    [id]
                );

                if (participantsCheck.rowCount > 0) {
                    throw { status: 403, message: "No se puede eliminar una tarea con participantes activos que no han sido pagados." };
                }

                // Si la validación pasa, eliminamos la publicación. El ON DELETE CASCADE se encargará de las aceptaciones pendientes y pagadas.
                await client.query(`DELETE FROM publications WHERE id = $1`, [id]);
                
                await client.query('COMMIT');
                res.status(200).json({ message: "Publicación eliminada correctamente." });
            } catch(err) {
                await client.query('ROLLBACK');
                console.error("Error al eliminar publicación:", err.message);
                res.status(err.status || 500).json({ message: err.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para PAUSAR/REANUDAR una publicación (NUEVA)
        app.post('/publications/:id/toggle-pause', async (req, res) => {
            const { id } = req.params;
            const { username } = req.body; // El autor que realiza la acción

            try {
                // Buscamos la publicación, verificamos que el usuario es el autor, y cambiamos el estado de 'is_paused'
                const sql = `
                    UPDATE publications
                    SET is_paused = NOT is_paused
                    WHERE id = $1 AND author_username = $2
                    RETURNING is_paused;
                `;
                const result = await pool.query(sql, [id, username]);
                
                if (result.rowCount === 0) {
                    return res.status(403).json({ message: "No tienes permiso o la publicación no existe." });
                }

                const isPaused = result.rows[0].is_paused;
                const message = isPaused ? "Publicación pausada. No se aceptan nuevas solicitudes." : "Publicación reanudada. Nuevas solicitudes permitidas.";
                
                res.status(200).json({ message, isPaused });

            } catch (error) {
                console.error("Error en toggle-pause:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para OCULTAR una publicación (NUEVA)
        app.post('/publications/:id/hide', async (req, res) => {
            const { id } = req.params;
            const { username } = req.body; // El usuario que oculta la publicación

            try {
                // Simplemente insertamos un registro en la tabla de ocultos.
                // Si ya existe (UNIQUE constraint), no hará nada, lo que está bien.
                const sql = `INSERT INTO hidden_publications (publication_id, hider_username) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
                await pool.query(sql, [id, username]);
                res.status(200).json({ message: "Publicación ocultada de tu vista." });
            } catch (error) {
                console.error("Error en /hide:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para obtener el perfil público de un usuario
        app.get('/users/:username/profile', async (req, res) => {
            const { username } = req.params;
        
            const client = await pool.connect();
            try {
                // 1. PRIMERO Y MÁS IMPORTANTE: Verificar si la funcionalidad está activada
                const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'public_profiles_enabled'`);
                const isEnabled = settingsResult.rows[0]?.setting_value === 'true';
        
                if (!isEnabled) {
                    return res.status(404).json({ message: "Perfiles de usuario no encontrados." }); // Usamos 404 para no revelar que la función existe pero está desactivada.
                }
        
                // 2. Si está activado, procedemos a buscar los datos del perfil
                await client.query('BEGIN');
        
                // Obtener datos básicos del usuario
                const userSql = `SELECT username, average_rating, ratings_count FROM users WHERE username = $1`;
                const userResult = await client.query(userSql, [username]);
                if (userResult.rowCount === 0) {
                    throw { status: 404, message: "Usuario no encontrado." };
                }
                const userProfile = userResult.rows[0];
        
                // Obtener todas las calificaciones y comentarios recibidos por el usuario
                const ratingsSql = `SELECT rater_username, rating, comment, created_at FROM ratings WHERE ratee_username = $1 ORDER BY created_at DESC`;
                const ratingsResult = await client.query(ratingsSql, [username]);
                const ratings = ratingsResult.rows;
        
                await client.query('COMMIT');
        
                // 3. Devolver el perfil completo
                res.status(200).json({
                    user: userProfile,
                    ratings: ratings
                });
        
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`Error al obtener el perfil de ${username}:`, error);
                res.status(error.status || 500).json({ message: error.message || "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // --- Rutas de Configuración y Administración ---

        // Ruta de LOGIN para el administrador (NO necesita autenticación)
        app.post('/api/admin/login', (req, res) => {
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ message: "Se requiere la contraseña." });
            }

            // Comparamos la contraseña enviada con la variable de entorno
            if (password === process.env.ADMIN_PASSWORD) {
                // La contraseña es correcta, generamos un token JWT
                const adminUser = { name: 'admin' }; // Payload del token
                const accessToken = jwt.sign(adminUser, process.env.ADMIN_SECRET_KEY, { expiresIn: '8h' }); // Token expira en 8 horas
                
                res.json({ token: accessToken });
            } else {
                // Contraseña incorrecta
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
        });

        // Ruta PÚBLICA para obtener configuraciones seguras para el frontend
        app.get('/api/settings', async (req, res) => {
            try {
                // Ahora exponemos todas las claves que el frontend necesita.
                const sql = `
                    SELECT setting_key, setting_value 
                    FROM app_settings 
                    WHERE setting_key IN ('public_profiles_enabled', 'allow_new_registrations', 'allow_new_publications')
                `;
                const result = await pool.query(sql);
                // Convertimos el resultado en un objeto clave-valor para fácil uso en el frontend
                const settings = result.rows.reduce((acc, row) => {
                    // Convertimos 'true'/'false' strings a booleanos reales
                    acc[row.setting_key] = row.setting_value === 'true';
                    return acc;
                }, {});
                res.status(200).json(settings);
            } catch (error) {
                console.error("Error al obtener la configuración pública:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // NOTA: Las siguientes rutas son para el futuro panel de administración.
        // AHORA ESTÁN PROTEGIDAS POR EL MIDDLEWARE verifyAdminToken.

        // Ruta de ADMIN para obtener TODAS las configuraciones
        app.get('/api/admin/settings', verifyAdminToken, async (req, res) => {
            try {
                const sql = `SELECT * FROM app_settings ORDER BY setting_key`;
                const result = await pool.query(sql);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener todas las configuraciones:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta de ADMIN para actualizar una configuración
        app.post('/api/admin/settings', verifyAdminToken, async (req, res) => {
            const { key, value } = req.body;
            if (!key || typeof value !== 'string') {
                return res.status(400).json({ message: "Se requiere una 'key' y un 'value' (string)." });
            }

            try {
                const sql = `UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2 RETURNING *`;
                const result = await pool.query(sql, [value, key]);

                if (result.rowCount === 0) {
                    return res.status(404).json({ message: `La clave de configuración '${key}' no fue encontrada.` });
                }

                res.status(200).json({ message: `Configuración '${key}' actualizada.`, setting: result.rows[0] });
            } catch (error) {
                console.error("Error al actualizar la configuración:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // --- Rutas del Dashboard ---
        app.get('/api/admin/dashboard-stats', verifyAdminToken, async (req, res) => {
            const client = await pool.connect();
            try {
                // Usamos Promise.all para ejecutar todas las consultas en paralelo, es más eficiente.
                const [
                    usersResult,
                    publicationsResult,
                    tokensResult
                ] = await Promise.all([
                    // 1. Contar usuarios totales
                    client.query('SELECT COUNT(*) AS total_users FROM users'),
                    // 2. Contar publicaciones activas (definidas como las que no están completamente pagadas)
                    client.query(`
                        SELECT COUNT(DISTINCT p.id) AS active_publications
                        FROM publications p
                        LEFT JOIN publication_acceptances pa ON p.id = pa.publication_id
                        WHERE pa.status IS NULL OR pa.status != 'confirmed_paid'
                    `),
                    // 3. Sumar todos los tokens en circulación
                    client.query('SELECT SUM(blue_balance) AS total_blue, SUM(red_balance) AS total_red FROM users')
                ]);

                const stats = {
                    totalUsers: parseInt(usersResult.rows[0].total_users, 10),
                    activePublications: parseInt(publicationsResult.rows[0].active_publications, 10),
                    totalBlue: parseInt(tokensResult.rows[0].total_blue, 10) || 0,
                    totalRed: parseInt(tokensResult.rows[0].total_red, 10) || 0
                };
                
                res.status(200).json(stats);

            } catch (error) {
                console.error("Error al obtener las estadísticas del dashboard:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

// 6. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
}); 

    } catch (err) {
        console.error("Error fatal al iniciar el servidor:", err);
        process.exit(1);
    }
}

// --- MIDDLEWARE DE AUTENTICACIÓN DE ADMIN ---
function verifyAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Forbidden (token inválido o expirado)
        }
        req.user = user;
        next(); // El token es válido, continuar
    });
}

// Llamamos a la función principal para que todo comience
startServer(); 