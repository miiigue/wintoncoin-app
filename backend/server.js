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
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al abrir la base de datos:", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        // Usamos db.serialize para asegurar que los comandos se ejecutan en orden
        db.serialize(() => {
            // Tabla de usuarios con saldos
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                blue_balance INTEGER NOT NULL DEFAULT 0,
                red_balance INTEGER NOT NULL DEFAULT 0
            )`, (err) => {
                if (err) console.error("Error al asegurar tabla 'users':", err.message);
                else console.log("Tabla 'users' asegurada.");
            });

            // Recreamos la tabla de publicaciones con el nuevo esquema
            db.run(`CREATE TABLE IF NOT EXISTS publications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                blue_cost INTEGER NOT NULL,
                author_username TEXT NOT NULL,
                accepted_by_username TEXT,
                status TEXT NOT NULL DEFAULT 'open', -- open, pending_approval, approved, completed, confirmed_paid
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error al asegurar la tabla 'publications':", err.message);
                else console.log("Tabla 'publications' asegurada.");
            });

            // Recreamos la tabla de notificaciones con el nuevo esquema
            db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_username TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read INTEGER DEFAULT 0, -- 0 for unread, 1 for read
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error al asegurar la tabla 'notifications':", err.message);
                else console.log("Tabla 'notifications' asegurada.");
            });

            // NUEVA TABLA: Historial de Transacciones
            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                type TEXT NOT NULL, -- 'payment_sent', 'payment_received', 'burn'
                description TEXT NOT NULL,
                blue_change INTEGER NOT NULL DEFAULT 0,
                red_change INTEGER NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error al asegurar tabla 'transactions':", err.message);
                else console.log("Tabla 'transactions' asegurada.");
            });
        });
    }
});

// 5. Definir las Rutas (Endpoints)

// Ruta de Registro de Usuario
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }

    try {
        // Hashear la contraseña antes de guardarla
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
        db.run(sql, [username, hashedPassword], function(err) {
            if (err) {
                // El código de error 'SQLITE_CONSTRAINT' indica una violación de la restricción UNIQUE
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
            // Comparar la contraseña proporcionada con el hash almacenado
            const match = await bcrypt.compare(password, user.password);

            if (match) {
                // Si la contraseña es correcta, devolvemos un mensaje de éxito
                // y los datos del usuario que el frontend necesita.
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
    const { title, description, blueCost, authorUsername } = req.body;

    if (!title || !description || !blueCost || !authorUsername) {
        return res.status(400).json({ message: "Todos los campos son requeridos." });
    }

    const sql = `INSERT INTO publications (title, description, blue_cost, author_username) VALUES (?, ?, ?, ?)`;
    db.run(sql, [title, description, blueCost, authorUsername], function(err) {
        if (err) {
            console.error("Error al guardar la publicación:", err.message);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        res.status(201).json({ message: "Publicación creada exitosamente.", publicationId: this.lastID });
    });
});

// Ruta para obtener todas las publicaciones
app.get('/publications', (req, res) => {
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

// Ruta para ACEPTAR una publicación
app.post('/publications/:id/accept', (req, res) => {
    const pubId = req.params.id;
    const { acceptorUsername } = req.body;

    db.get("SELECT * FROM publications WHERE id = ? AND status = 'open'", [pubId], (err, pub) => {
        if (err || !pub) return res.status(404).json({ message: "Publicación no encontrada o ya no está abierta." });
        if (pub.author_username === acceptorUsername) return res.status(403).json({ message: "No puedes aceptar tu propia publicación." });

        const updatePubSql = `UPDATE publications SET status = 'pending_approval', accepted_by_username = ? WHERE id = ?`;
        const message = `El usuario ${acceptorUsername} ha aceptado tu publicación: "${pub.title}"`;
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            db.run(updatePubSql, [acceptorUsername, pubId]);
            db.run(`INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`, [pub.author_username, message]);
            db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Error al aceptar la publicación." });
                }
                res.status(200).json({ message: "Solicitud enviada. Esperando aprobación del autor." });
            });
        });
    });
});

// NUEVA RUTA: Aprobar desde la publicación
app.post('/publications/:id/approve', (req, res) => {
    const pubId = req.params.id;
    const { approverUsername } = req.body; // El autor

    db.get("SELECT * FROM publications WHERE id = ? AND author_username = ? AND status = 'pending_approval'", [pubId, approverUsername], (err, pub) => {
        if (err || !pub) return res.status(404).json({ message: "No se encontró la publicación o no se puede aprobar." });

        const updatePubSql = `UPDATE publications SET status = 'approved' WHERE id = ?`;
        const createNotifSql = `INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`;
        const message = `¡Tu solicitud para "${pub.title}" fue aprobada! Ya puedes empezar.`;

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            db.run(updatePubSql, [pubId]);
            db.run(createNotifSql, [pub.accepted_by_username, message]);
            db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Error al aprobar." });
                }
                res.status(200).json({ message: "Aprobado. Se ha notificado al otro usuario." });
            });
        });
    });
});

// NUEVA RUTA: Culminar desde la publicación
app.post('/publications/:id/complete', (req, res) => {
    const pubId = req.params.id;
    const { completerUsername } = req.body; // El que aceptó

    db.get("SELECT * FROM publications WHERE id = ? AND accepted_by_username = ? AND status = 'approved'", [pubId, completerUsername], (err, pub) => {
        if (err || !pub) return res.status(404).json({ message: "No se encontró la publicación o no se puede culminar." });

        const updatePubSql = `UPDATE publications SET status = 'completed' WHERE id = ?`;
        const createNotifSql = `INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`;
        const message = `${completerUsername} ha culminado la tarea "${pub.title}". Por favor, confirma para liberar el pago.`;
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            db.run(updatePubSql, [pubId]);
            db.run(createNotifSql, [pub.author_username, message]);
            db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Error al culminar la tarea." });
                }
                res.status(200).json({ message: "Tarea marcada como culminada. Esperando confirmación." });
            });
        });
    });
});

// NUEVA RUTA: Obtener saldos de un usuario
app.get('/users/:username/balance', (req, res) => {
    const { username } = req.params;
    const sql = `SELECT blue_balance, red_balance FROM users WHERE username = ?`;
    db.get(sql, [username], (err, row) => {
        if (err || !row) return res.status(404).json({ message: "Usuario no encontrado." });
        res.status(200).json(row);
    });
});

// Ruta para CONFIRMAR PAGO (ahora maneja saldos)
app.post('/publications/:id/confirm-payment', (req, res) => {
    const pubId = req.params.id;
    const { confirmerUsername } = req.body; // El autor (pagador)

    db.get(`SELECT * FROM publications WHERE id = ? AND author_username = ? AND status = 'completed'`, [pubId, confirmerUsername], (err, pub) => {
        if (err || !pub) return res.status(404).json({ message: "No se encontró la publicación o no se puede confirmar el pago." });

        const cost = pub.blue_cost;
        const author = pub.author_username;
        const worker = pub.accepted_by_username;

        // La verificación de fondos ya no es necesaria con el nuevo modelo económico.

        const insertTxSql = `
            INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        // Realizar la transacción completa
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // 1. AÑADIR RED al autor (pagador) y registrar su transacción
            db.run(`UPDATE users SET red_balance = red_balance + ? WHERE username = ?`, [cost, author]);
            const authorDesc = `Solicitaste: "${pub.title}"`;
            db.run(insertTxSql, [author, 'payment_sent', authorDesc, 0, cost, pubId]);

            // 2. AÑADIR BLUE al trabajador y registrar su transacción
            db.run(`UPDATE users SET blue_balance = blue_balance + ? WHERE username = ?`, [cost, worker]);
            const workerDesc = `Realizaste: "${pub.title}"`;
            db.run(insertTxSql, [worker, 'payment_received', workerDesc, cost, 0, pubId]);
            
            // 3. Actualizar estado de la publicación
            db.run(`UPDATE publications SET status = 'confirmed_paid' WHERE id = ?`, [pubId]);
            
            // 4. Crear notificación final para el trabajador
            const message = `¡Has recibido ${cost} BLUE por la tarea "${pub.title}"!`;
            db.run(`INSERT INTO notifications (recipient_username, message) VALUES (?, ?)`, [worker, message]);
            
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

// ---- NUEVA RUTA ----
// Redirección de la raíz a la página de login
app.get('/', (req, res) => {
    // Apuntamos al login.html dentro de la carpeta frontend
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// 6. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
}); 