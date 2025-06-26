// 1. Importar las librerías necesarias
const express = require('express');
const { Pool } = require('pg'); // Importamos el Pool de pg
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

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
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // Necesario para conexiones en Render
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
                accepted_by_username VARCHAR(255),
                status VARCHAR(50) NOT NULL DEFAULT 'open',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'publications' asegurada.");

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
                publication_id INTEGER NOT NULL REFERENCES publications(id),
                rater_username VARCHAR(255) NOT NULL REFERENCES users(username),
                ratee_username VARCHAR(255) NOT NULL REFERENCES users(username),
                rating INTEGER NOT NULL,
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'ratings' creada/asegurada.");

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
            const { title, description, blueCost, blueSell, authorUsername } = req.body;
        
            if (!title || !description || !authorUsername || (!blueCost && !blueSell)) {
                return res.status(400).json({ message: "Faltan datos requeridos para la publicación." });
            }
        
            const isSellPost = !!blueSell;
            const cost = blueSell || blueCost;
        
            try {
                const sql = `INSERT INTO publications (title, description, blue_cost, is_sell_post, author_username) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
                const result = await pool.query(sql, [title, description, cost, isSellPost, authorUsername]);
                res.status(201).json({ message: "Publicación creada exitosamente.", publicationId: result.rows[0].id });
            } catch (error) {
                console.error("Error al guardar la publicación:", error);
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para obtener publicaciones activas
        app.get('/publications/active', async (req, res) => {
            const { user } = req.query;
            if (!user) return res.status(400).json({ message: "Es necesario especificar un usuario." });
            
            const sql = `
                SELECT * FROM publications 
                WHERE status = 'open' OR (status IN ('pending_approval', 'approved', 'completed') AND (author_username = $1 OR accepted_by_username = $2))
                ORDER BY created_at DESC
            `;
            try {
                const result = await pool.query(sql, [user, user]);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener las publicaciones activas:", error);
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para Aceptar una publicación
        app.post('/publications/:id/accept', async (req, res) => {
            const { id } = req.params;
            const { acceptorUsername } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(`SELECT * FROM publications WHERE id = $1 AND status = 'open' FOR UPDATE`, [id]);
                const pub = pubResult.rows[0];

                if (!pub) {
                    throw { status: 404, message: "Publicación no encontrada o ya no está abierta." };
                }
                if (pub.author_username === acceptorUsername) {
                    throw { status: 400, message: "No puedes aceptar tu propia publicación." };
                }

                await client.query(`UPDATE publications SET accepted_by_username = $1, status = 'pending_approval' WHERE id = $2`, [acceptorUsername, id]);
                
                const message = `El usuario ${acceptorUsername} ha aceptado tu publicación "${pub.title}".`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, message]);

                await client.query('COMMIT');
                res.status(200).json({ message: "Publicación aceptada. Esperando aprobación del autor." });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al aceptar publicación:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // Ruta para Aprobar a un usuario
        app.post('/publications/:id/approve', async (req, res) => {
            const { id } = req.params;
            const { approverUsername } = req.body;
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(`SELECT * FROM publications WHERE id = $1 AND author_username = $2 AND status = 'pending_approval' FOR UPDATE`, [id, approverUsername]);
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "No se puede aprobar esta publicación." };

                await client.query(`UPDATE publications SET status = 'approved' WHERE id = $1`, [id]);
                
                const message = `¡Has sido aprobado para la tarea "${pub.title}"!`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.accepted_by_username, message]);
                
                await client.query('COMMIT');
                res.status(200).json({ message: "Usuario aprobado." });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al aprobar:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Marcar como Culminada
        app.post('/publications/:id/complete', async (req, res) => {
            const { id } = req.params;
            const { completerUsername } = req.body;
        
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
        
                const pubResult = await client.query(`SELECT * FROM publications WHERE id = $1 AND accepted_by_username = $2 AND status = 'approved' FOR UPDATE`, [id, completerUsername]);
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "No se puede completar esta tarea." };
        
                await client.query(`UPDATE publications SET status = 'completed' WHERE id = $1`, [id]);
                
                const message = `${completerUsername} ha marcado la tarea "${pub.title}" como culminada.`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, message]);
        
                await client.query('COMMIT');
                res.status(200).json({ message: "Tarea marcada como culminada." });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al completar tarea:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Confirmar y Pagar
        app.post('/publications/:id/confirm-payment', async (req, res) => {
            const pubId = req.params.id;
            const { confirmerUsername } = req.body;
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(`SELECT * FROM publications WHERE id = $1 AND author_username = $2 AND status = 'completed' FOR UPDATE`, [pubId, confirmerUsername]);
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "No se encontró la publicación o no se puede confirmar el pago." };

                const cost = pub.blue_cost;
                const author = pub.author_username;
                const worker = pub.accepted_by_username;

                const insertTxSql = `INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) VALUES ($1, $2, $3, $4, $5, $6)`;

                if (pub.is_sell_post) {
                    // Venta: Vendedor (author) recibe BLUE, Comprador (worker) recibe RED.
                    await client.query(`UPDATE users SET blue_balance = blue_balance + $1 WHERE username = $2`, [cost, author]);
                    await client.query(insertTxSql, [author, 'sale_completed', `Vendiste: "${pub.title}"`, cost, 0, pubId]);
                    
                    await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [cost, worker]);
                    await client.query(insertTxSql, [worker, 'purchase_completed', `Compraste: "${pub.title}"`, 0, cost, pubId]);
                } else {
                    // Trabajo: Pagador (author) recibe RED, Trabajador (worker) recibe BLUE.
                    await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [cost, author]);
                    await client.query(insertTxSql, [author, 'payment_sent', `Solicitaste: "${pub.title}"`, 0, cost, pubId]);
                    
                    await client.query(`UPDATE users SET blue_balance = blue_balance + $1 WHERE username = $2`, [cost, worker]);
                    await client.query(insertTxSql, [worker, 'payment_received', `Realizaste: "${pub.title}"`, cost, 0, pubId]);
                }
                
                await client.query(`UPDATE publications SET status = 'confirmed_paid' WHERE id = $1`, [pubId]);
                
                const notificationMessage = pub.is_sell_post 
                    ? `¡Has completado la compra de "${pub.title}" y recibido ${cost} RED!`
                    : `¡Has recibido ${cost} BLUE por la tarea "${pub.title}"!`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [worker, notificationMessage]);
                
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
                const authoredSql = `SELECT * FROM publications WHERE author_username = $1 ORDER BY created_at DESC`;
                const completedSql = `SELECT * FROM publications WHERE accepted_by_username = $1 AND status = 'confirmed_paid' ORDER BY created_at DESC`;

                const [authored, completed] = await Promise.all([
                    pool.query(authoredSql, [username]),
                    pool.query(completedSql, [username])
                ]);

                res.status(200).json({ authored: authored.rows, completed: completed.rows });
            } catch (err) {
                console.error("Error al obtener el historial:", err.message);
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

                const pubResult = await client.query(`SELECT author_username, status FROM publications WHERE id = $1 FOR UPDATE`, [id]);
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "La publicación no existe." };
                if (pub.author_username !== deleterUsername) throw { status: 403, message: "No tienes permiso para eliminar esto." };
                if (pub.status !== 'open') throw { status: 403, message: "No se puede eliminar una tarea en progreso." };

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

        // 6. Iniciar el servidor
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error("Error fatal al iniciar el servidor:", err);
        process.exit(1);
    }
}

// Llamamos a la función principal para que todo comience
startServer(); 