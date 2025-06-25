// 1. Importar las librerías necesarias
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path'); // Añadimos el módulo path

// 2. Configuración inicial
const app = express();
// El puerto será el que nos asigne Hostinger (process.env.PORT) o el 3000 si estamos en desarrollo.
const PORT = process.env.PORT || 3000;
const saltRounds = 10; // Costo del hasheo para bcrypt

// 3. Middlewares
app.use(cors()); // Permite peticiones de otros orígenes (nuestro frontend)
app.use(express.json()); // Permite al servidor entender JSON en el cuerpo de las peticiones
// Servimos los archivos estáticos desde la carpeta frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// 4. Conectar a la Base de Datos SQLite
// Usamos path.join para crear una ruta absoluta y evitar problemas
const dbPath = path.join(__dirname, 'database.db');

// La inicialización de la base de datos ahora es una función que devuelve una Promesa
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al abrir la base de datos:", err.message);
                return reject(err);
            }
        console.log("Conectado a la base de datos SQLite.");
            
        db.serialize(() => {
                // Usamos una serie de `run` que se pueden encadenar para asegurar el orden
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                blue_balance INTEGER NOT NULL DEFAULT 0,
                    red_balance INTEGER NOT NULL DEFAULT 0,
                    average_rating REAL NOT NULL DEFAULT 0,
                    ratings_count INTEGER NOT NULL DEFAULT 0
            )`, (err) => {
                    if (err) return reject(err);
                    console.log("Tabla 'users' asegurada.");
            });

            db.run(`CREATE TABLE IF NOT EXISTS publications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                blue_cost INTEGER NOT NULL,
                    is_sell_post BOOLEAN NOT NULL DEFAULT 0,
                author_username TEXT NOT NULL,
                accepted_by_username TEXT,
                    status TEXT NOT NULL DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                    if (err) return reject(err);
                    console.log("Tabla 'publications' asegurada.");
            });

            db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_username TEXT NOT NULL,
                message TEXT NOT NULL,
                    is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                    if (err) return reject(err);
                    console.log("Tabla 'notifications' asegurada.");
            });

            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                    type TEXT NOT NULL,
                description TEXT NOT NULL,
                blue_change INTEGER NOT NULL DEFAULT 0,
                red_change INTEGER NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                    if (err) return reject(err);
                    console.log("Tabla 'transactions' asegurada.");
                });

                db.run(`CREATE TABLE IF NOT EXISTS ratings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    publication_id INTEGER NOT NULL,
                    rater_username TEXT NOT NULL,
                    ratee_username TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    comment TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (publication_id) REFERENCES publications(id),
                    FOREIGN KEY (rater_username) REFERENCES users(username),
                    FOREIGN KEY (ratee_username) REFERENCES users(username)
                )`, (err) => {
                    if (err) return reject(err);
                    console.log("Tabla 'ratings' creada/asegurada.");
                });

                // Resolvemos la promesa con la instancia de la base de datos
                resolve(db);
            });
            });
        });
    }

// 5. Función principal asíncrona para iniciar el servidor
async function startServer() {
    try {
        const db = await initializeDatabase();
        console.log("Base de datos inicializada correctamente.");

        // --- AHORA DEFINIMOS LAS RUTAS, SOLO DESPUÉS DE QUE LA BD ESTÉ LISTA ---

// Ruta de Registro de Usuario
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
        db.run(sql, [username, hashedPassword], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(409).json({ message: "El nombre de usuario ya existe." });
                }
                console.error("Error al registrar usuario:", err.message);
                return res.status(500).json({ message: "Error interno del servidor." });
            }
            res.status(201).json({ message: `Usuario ${username} registrado exitosamente.` });
        });
    } catch (error) {
        console.error("Error en el hasheo:", error);
        res.status(500).json({ message: "Error interno del servidor al procesar la contraseña." });
    }
});

// Ruta de Inicio de Sesión
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }

    const sql = `SELECT * FROM users WHERE username = ?`;
    db.get(sql, [username], async (err, user) => {
        if (err) {
            console.error("Error al buscar usuario:", err.message);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado. Por favor, regístrese primero." });
        }

        try {
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
            console.error("Error en la comparación de contraseñas:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    });
});

// Ruta para crear una nueva Publicación
app.post('/publish', (req, res) => {
            // Ahora podemos recibir 'blueCost' (para trabajos) o 'blueSell' (para ventas)
            const { title, description, blueCost, blueSell, authorUsername } = req.body;
        
            // Validamos que los campos comunes existan
            if (!title || !description || !authorUsername) {
                return res.status(400).json({ message: "El título, la descripción y el autor son requeridos." });
            }
        
            // Validamos que se haya provisto un coste o una venta, pero no ambos implícitamente
            if ((!blueCost && !blueSell) || (blueCost && blueSell)) {
                return res.status(400).json({ message: "Debe especificar un costo a pagar o un monto a vender, pero no ambos." });
            }
        
            const isSellPost = !!blueSell; // Convertimos la presencia de blueSell a un booleano
            const cost = blueSell || blueCost; // Usamos el valor que no sea undefined
        
            const sql = `INSERT INTO publications (title, description, blue_cost, is_sell_post, author_username) VALUES (?, ?, ?, ?, ?)`;
            db.run(sql, [title, description, cost, isSellPost, authorUsername], function(err) {
        if (err) {
            console.error("Error al guardar la publicación:", err.message);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        res.status(201).json({ message: "Publicación creada exitosamente.", publicationId: this.lastID });
    });
});

// Ruta para obtener todas las publicaciones
app.get('/publications', (req, res) => {
            // Nos aseguramos de seleccionar la nueva columna is_sell_post
    const sql = `SELECT * FROM publications ORDER BY created_at DESC`; // Las más nuevas primero
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error al obtener las publicaciones:", err.message);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        res.status(200).json(rows);
    });
});

// Ruta para obtener solo las publicaciones ACTIVAS (para el panel principal)
        // AHORA filtra según el usuario que hace la petición
app.get('/publications/active', (req, res) => {
            const { user } = req.query;
        
            if (!user) {
                return res.status(400).json({ message: "Es necesario especificar un usuario." });
            }
        
            // Esta consulta ahora es más compleja:
            // 1. Selecciona cualquier publicación que esté 'open'.
            // 2. O, selecciona publicaciones en otros estados si el usuario es el autor O el aceptante.
    const sql = `
        SELECT * FROM publications 
                WHERE 
                    status = 'open' 
                    OR (
                        status IN ('pending_approval', 'approved', 'completed') 
                        AND (author_username = ? OR accepted_by_username = ?)
                    )
        ORDER BY created_at DESC
    `;
            
            // Pasamos el nombre del usuario dos veces a la consulta, para los placeholders '?'
            db.all(sql, [user, user], (err, rows) => {
        if (err) {
            console.error("Error al obtener las publicaciones activas:", err.message);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        res.status(200).json(rows);
    });
});

        // Ruta para Aceptar una publicación
app.post('/publications/:id/accept', (req, res) => {
            const { id } = req.params;
    const { acceptorUsername } = req.body;

            db.get(`SELECT author_username FROM publications WHERE id = ? AND status = 'open'`, [id], (err, pub) => {
                if (err || !pub) {
                    return res.status(404).json({ message: "Publicación no encontrada o ya no está abierta." });
                }
        
                if (pub.author_username === acceptorUsername) {
                    return res.status(400).json({ message: "No puedes aceptar tu propia publicación." });
                }
        
                const updateSql = `UPDATE publications SET accepted_by_username = ?, status = 'pending_approval' WHERE id = ?`;
                db.run(updateSql, [acceptorUsername, id], function(err) {
                    if (err) {
                    return res.status(500).json({ message: "Error al aceptar la publicación." });
                }
        
                    const message = `El usuario ${acceptorUsername} ha aceptado tu publicación "${pub.title}".`;
                    const notifySql = `INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`;
                    db.run(notifySql, [pub.author_username, message], (err) => {
                        if (err) console.error("Error al crear notificación de aceptación:", err.message);
                    });
        
                    res.status(200).json({ message: "Publicación aceptada. Esperando aprobación del autor." });
                });
    });
});

        // Ruta para Aprobar a un usuario
app.post('/publications/:id/approve', (req, res) => {
            const { id } = req.params;
            const { approverUsername } = req.body; // Es el autor de la publicación
        
            db.get(`SELECT * FROM publications WHERE id = ? AND author_username = ? AND status = 'pending_approval'`, [id, approverUsername], (err, pub) => {
                if (err || !pub) {
                    return res.status(404).json({ message: "No se puede aprobar esta publicación." });
                }
        
                db.run(`UPDATE publications SET status = 'approved' WHERE id = ?`, [id], function(err) {
                    if (err) {
                    return res.status(500).json({ message: "Error al aprobar." });
                }
        
                    const message = `¡Has sido aprobado para la tarea "${pub.title}"!`;
                    db.run(`INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`, [pub.accepted_by_username, message]);
        
                    res.status(200).json({ message: "Usuario aprobado." });
                });
    });
});

        // Ruta para Marcar como Culminada
app.post('/publications/:id/complete', (req, res) => {
            const { id } = req.params;
            const { completerUsername } = req.body;
        
            db.get(`SELECT * FROM publications WHERE id = ? AND accepted_by_username = ? AND status = 'approved'`, [id, completerUsername], (err, pub) => {
                if (err || !pub) {
                    return res.status(404).json({ message: "No se puede completar esta tarea." });
                }
        
                db.run(`UPDATE publications SET status = 'completed' WHERE id = ?`, [id], function(err) {
                    if (err) {
                        return res.status(500).json({ message: "Error al marcar como completada." });
                    }
        
                    const message = `${completerUsername} ha marcado la tarea "${pub.title}" como culminada.`;
                    db.run(`INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`, [pub.author_username, message]);
        
                    res.status(200).json({ message: "Tarea marcada como culminada." });
                });
    });
});

        // Ruta para Confirmar y Pagar
app.post('/publications/:id/confirm-payment', (req, res) => {
    const pubId = req.params.id;
            const { confirmerUsername } = req.body;

    db.get(`SELECT * FROM publications WHERE id = ? AND author_username = ? AND status = 'completed'`, [pubId, confirmerUsername], (err, pub) => {
        if (err || !pub) return res.status(404).json({ message: "No se encontró la publicación o no se puede confirmar el pago." });

        const cost = pub.blue_cost;
                const author = pub.author_username; // El creador de la publicación
                const worker = pub.accepted_by_username; // Quien aceptó y completó

        const insertTxSql = `
            INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
                    if (pub.is_sell_post) {
                        // --- LÓGICA DE VENTA ---
                        // El autor (vendedor) recibe BLUE.
                        db.run(`UPDATE users SET blue_balance = blue_balance + ? WHERE username = ?`, [cost, author]);
                        const authorDesc = `Vendiste: "${pub.title}"`;
                        db.run(insertTxSql, [author, 'sale_completed', authorDesc, cost, 0, pubId]);
        
                        // El trabajador (comprador) recibe RED.
                        db.run(`UPDATE users SET red_balance = red_balance + ? WHERE username = ?`, [cost, worker]);
                        const workerDesc = `Compraste: "${pub.title}"`;
                        db.run(insertTxSql, [worker, 'purchase_completed', workerDesc, 0, cost, pubId]);
                        
                    } else {
                        // --- LÓGICA DE TRABAJO (NORMAL) ---
                        // El autor (pagador) recibe RED.
                        db.run(`UPDATE users SET red_balance = red_balance + ? WHERE username = ?`, [cost, author]);
                        const authorDesc = `Solicitaste: "${pub.title}"`;
                        db.run(insertTxSql, [author, 'payment_sent', authorDesc, 0, cost, pubId]);

                        // El trabajador (receptor del pago) recibe BLUE.
                        db.run(`UPDATE users SET blue_balance = blue_balance + ? WHERE username = ?`, [cost, worker]);
                        const workerDesc = `Realizaste: "${pub.title}"`;
                        db.run(insertTxSql, [worker, 'payment_received', workerDesc, cost, 0, pubId]);
                    }
            
                    // --- Acciones Comunes ---
                    // 1. Actualizar estado de la publicación
            db.run(`UPDATE publications SET status = 'confirmed_paid' WHERE id = ?`, [pubId]);
            
                    // 2. Crear notificación final para el trabajador
                    const notificationMessage = pub.is_sell_post 
                        ? `¡Has completado la compra de "${pub.title}" y recibido ${cost} RED!`
                        : `¡Has recibido ${cost} BLUE por la tarea "${pub.title}"!`;
                    db.run(`INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`, [worker, notificationMessage]);
            
            db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Error crítico en la transacción." });
                }
                res.status(200).json({ message: "Pago confirmado y tarea finalizada." });
            });
        });
    });
});

// Ruta para obtener las notificaciones de un usuario
app.get('/notifications/:username', (req, res) => {
    const { username } = req.params;
    const sql = `SELECT * FROM notifications WHERE recipient_username = ? ORDER BY created_at DESC`;
    db.all(sql, [username], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        res.status(200).json(rows);
    });
});

// Ruta para marcar notificaciones como leídas
app.post('/notifications/mark-read', (req, res) => {
    const { username } = req.body;
    const sql = `UPDATE notifications SET is_read = 1 WHERE recipient_username = ? AND is_read = 0`;
    db.run(sql, [username], function(err) {
        if (err) {
            return res.status(500).json({ message: "Error al marcar notificaciones como leídas." });
        }
        res.status(200).json({ message: `${this.changes} notificaciones marcadas como leídas.` });
    });
});

// Ruta para QUEMAR tokens
app.post('/users/burn', (req, res) => {
    const { username, amount } = req.body;

    // Validar que el monto sea un número positivo
    if (!username || !amount || amount <= 0) {
        return res.status(400).json({ message: "La cantidad a quemar debe ser un número positivo." });
    }

    // Obtener los saldos actuales del usuario
    db.get(`SELECT blue_balance, red_balance FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        // Validar que el usuario tenga suficientes fondos de AMBOS tipos
        if (user.blue_balance < amount || user.red_balance < amount) {
            return res.status(400).json({ message: "No tienes suficientes BLUE o RED para quemar esta cantidad." });
        }
        
        // Proceder con la quema
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Actualizar saldos
            const sql = `UPDATE users SET blue_balance = blue_balance - ?, red_balance = red_balance - ? WHERE username = ?`;
            db.run(sql, [amount, amount, username]);

            // 2. Registrar la transacción de quema
            const burnDesc = `Tokens Quemados`;
            const insertTxSql = `
                INSERT INTO transactions (username, type, description, blue_change, red_change) 
                VALUES (?, 'burn', ?, ?, ?)
            `;
            db.run(insertTxSql, [username, burnDesc, -amount, -amount]);

            db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Error del servidor al quemar los tokens." });
                }
                res.status(200).json({ message: `Has quemado ${amount} BLUE y ${amount} RED exitosamente.` });
            });
        });
    });
});

// NUEVA RUTA: Obtener el historial de un usuario
app.get('/users/:username/history', (req, res) => {
    const { username } = req.params;

    const authoredSql = `
        SELECT * FROM publications 
        WHERE author_username = ? 
        ORDER BY created_at DESC
    `;
    
    const completedSql = `
        SELECT * FROM publications 
        WHERE accepted_by_username = ? AND status = 'confirmed_paid'
        ORDER BY created_at DESC
    `;

    // Usamos Promise.all para ejecutar ambas consultas en paralelo para mayor eficiencia
    Promise.all([
        new Promise((resolve, reject) => {
            db.all(authoredSql, [username], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.all(completedSql, [username], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
    ]).then(([authored, completed]) => {
        res.status(200).json({ authored, completed });
    }).catch(err => {
        console.error("Error al obtener el historial del usuario:", err.message);
        res.status(500).json({ message: "Error interno del servidor." });
    });
});

// NUEVA RUTA: Obtener las transacciones de un usuario
app.get('/users/:username/transactions', (req, res) => {
    const { username } = req.params;
    const sql = `SELECT * FROM transactions WHERE username = ? ORDER BY created_at DESC`;

    db.all(sql, [username], (err, rows) => {
        if (err) {
            console.error("Error al obtener las transacciones:", err.message);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        res.status(200).json(rows);
    });
});

        // Ruta para obtener el historial de transacciones de un usuario
        app.get('/transactions/:username', (req, res) => {
            const { username } = req.params;
            const sql = `SELECT * FROM transactions WHERE username = ? ORDER BY created_at DESC`;
        
            db.all(sql, [username], (err, rows) => {
                if (err) {
                    console.error("Error al obtener las transacciones:", err.message);
                    return res.status(500).json({ message: "Error interno del servidor." });
                }
                res.status(200).json(rows);
            });
        });
        
        // RUTA RESTAURADA: Obtener los saldos de un usuario
        // Este endpoint es crucial para mostrar los saldos en el panel principal.
        app.get('/users/:username/balance', (req, res) => {
            const { username } = req.params;
            const sql = `SELECT blue_balance, red_balance FROM users WHERE username = ?`;
            db.get(sql, [username], (err, row) => {
                if (err) {
                    console.error("Error al obtener saldos:", err.message);
                    return res.status(500).json({ message: "Error interno del servidor." });
                }
                if (!row) {
                    return res.status(404).json({ message: "Usuario no encontrado." });
                }
                res.status(200).json(row);
            });
        });
        
        // Ruta para obtener datos públicos de un usuario (incluyendo calificación)
        app.get('/user/:username', (req, res) => {
            const { username } = req.params;
            const sql = `SELECT username, average_rating, ratings_count FROM users WHERE username = ?`;
        
            db.get(sql, [username], (err, user) => {
                if (err) {
                    console.error("Error al obtener datos del usuario:", err.message);
                    return res.status(500).json({ message: "Error interno del servidor." });
                }
                if (!user) {
                    return res.status(404).json({ message: "Usuario no encontrado." });
                }
                res.status(200).json(user);
            });
        });
        
        // Ruta para crear una calificación
        app.post('/rate', (req, res) => {
            const { publicationId, raterUsername, rateeUsername, rating, comment } = req.body;
        
            // 1. Insertar la calificación
            const sql = `INSERT INTO ratings (publication_id, rater_username, ratee_username, rating, comment) VALUES (?, ?, ?, ?, ?)`;
            db.run(sql, [publicationId, raterUsername, rateeUsername, rating, comment], function(err) {
                if (err) {
                    console.error("Error al guardar la calificación:", err.message);
                    return res.status(500).json({ message: "Error interno al guardar la calificación." });
                }
        
                // 2. Recalcular el promedio para el usuario calificado (ratee)
                const recalcSql = `
                    SELECT AVG(rating) as average_rating, COUNT(rating) as ratings_count 
                    FROM ratings 
                    WHERE ratee_username = ?
                `;
                db.get(recalcSql, [rateeUsername], (err, result) => {
                    if (err) {
                        console.error("Error al recalcular el promedio:", err.message);
                        // La calificación se guardó, pero el promedio no se actualizó. No es ideal, pero no rompemos la app.
                        return res.status(201).json({ message: "Calificación guardada, pero hubo un error al actualizar el promedio." });
                    }
        
                    const updateSql = `UPDATE users SET average_rating = ?, ratings_count = ? WHERE username = ?`;
                    db.run(updateSql, [result.average_rating, result.ratings_count, rateeUsername], (err) => {
                        if (err) {
                            console.error("Error al actualizar el usuario con el nuevo promedio:", err.message);
                        }
                        res.status(201).json({ message: "¡Gracias por tu calificación!" });
                    });
                });
            });
        });

        // Ruta para ELIMINAR una publicación
        app.delete('/publications/:id', (req, res) => {
            const { id } = req.params;
            const { deleterUsername } = req.body; // El usuario que intenta borrar

            if (!deleterUsername) {
                return res.status(400).json({ message: "Se requiere el nombre de usuario para eliminar." });
            }

            const getSql = `SELECT author_username, status FROM publications WHERE id = ?`;
            db.get(getSql, [id], (err, pub) => {
                if (err) {
                    console.error("Error al buscar la publicación para eliminar:", err.message);
                    return res.status(500).json({ message: "Error interno del servidor." });
                }
                if (!pub) {
                    return res.status(404).json({ message: "La publicación no existe." });
                }
                if (pub.author_username !== deleterUsername) {
                    return res.status(403).json({ message: "No tienes permiso para eliminar esta publicación." });
                }
                if (pub.status !== 'open') {
                    return res.status(403).json({ message: "No se puede eliminar una tarea que ya ha sido aceptada o está en progreso." });
                }

                // Si todas las comprobaciones pasan, proceder a eliminar
                const deleteSql = `DELETE FROM publications WHERE id = ?`;
                db.run(deleteSql, [id], function(err) {
                    if (err) {
                        console.error("Error al eliminar la publicación:", err.message);
                        return res.status(500).json({ message: "Error interno al eliminar la publicación." });
                    }
                    res.status(200).json({ message: "Publicación eliminada correctamente." });
                });
            });
});

// 6. Iniciar el servidor
        app.listen(PORT, '0.0.0.0',() => {
            console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
        });

    } catch (err) {
        console.error("Error fatal al iniciar el servidor:", err);
        process.exit(1); // Salir si la base de datos no se puede inicializar
    }
}

// Llamamos a la función principal para que todo comience
startServer(); 