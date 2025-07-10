// 0. Cargar variables de entorno
require('dotenv').config();

// 1. Importar las librerías necesarias
const express = require('express');
const { Pool } = require('pg'); // Importamos el Pool de pg
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

// 2. Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// 3. Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 4. Conectar a la Base de Datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Función para verificar la conexión
async function checkDbConnection() {
    try {
        const client = await pool.connect();
        console.log("Conectado a la base de datos PostgreSQL.");
        client.release();
    } catch (err) {
        console.error("Error al conectar con PostgreSQL:", err);
        throw err;
    }
}

// Nueva función para manejar todas las migraciones y alteraciones de tablas existentes.
async function applyMigrations(client) {
    const migrationQueries = [
        // MIGRACIÓN #0: Limpieza de columnas obsoletas.
        // Esto elimina la columna 'author_username' si todavía existe en la tabla de publicaciones.
        // Es una fuente común de errores si la base de datos proviene de una versión muy antigua.
        `DO $$
         BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='author_username') THEN
               ALTER TABLE publications DROP COLUMN author_username;
            END IF;
         END $$;`,
        // MIGRACIÓN 1: (RECONSTRUIDA) Asegurar que la columna 'author_id' existe y es correcta en 'publications'
        `DO $$
         BEGIN
            -- Paso 1: Asegurar la existencia de la columna.
            -- Si 'author_id' no existe...
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='author_id') THEN
                -- ...vemos si existe la versión antigua 'user_id'.
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='user_id') THEN
                    -- Si existe, la renombramos. Es la acción más segura.
                    ALTER TABLE publications RENAME COLUMN user_id TO author_id;
                ELSE
                    -- Si ninguna de las dos existe, la tabla está incompleta. La añadimos.
                    ALTER TABLE publications ADD COLUMN author_id INT;
                END IF;
            END IF;

            -- Paso 2: Asegurar que la columna tiene la referencia correcta a la tabla de usuarios.
            -- Esto previene errores si la columna se creó sin la referencia (FOREIGN KEY).
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'publications_author_id_fkey' AND conrelid = 'publications'::regclass
            ) THEN
                -- Eliminamos cualquier referencia vieja que pudiera existir en la columna.
                ALTER TABLE publications DROP CONSTRAINT IF EXISTS publications_user_id_fkey;
                -- Añadimos la nueva y correcta referencia.
                ALTER TABLE publications ADD CONSTRAINT publications_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
         END $$;`,
        // MIGRACIÓN 2: Asegurar que la tabla 'ratings' tenga ON DELETE CASCADE
        `DO $$
         BEGIN
             IF NOT EXISTS (
                 SELECT 1 FROM pg_constraint
                 WHERE conname = 'ratings_publication_id_fkey' AND confdeltype = 'c'
             ) THEN
                 ALTER TABLE "ratings"
                 DROP CONSTRAINT IF EXISTS "ratings_publication_id_fkey",
                 ADD CONSTRAINT "ratings_publication_id_fkey"
                 FOREIGN KEY ("publication_id") REFERENCES "publications"(id) ON DELETE CASCADE;
             END IF;
         END $$;`,
        // MIGRACIÓN 3: Asegurar la regla de 'una solicitud activa por tarea'.
        `DO $$
         BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'one_active_acceptance_per_user_per_pub_idx') THEN
                ALTER TABLE publication_acceptances DROP CONSTRAINT IF EXISTS publication_acceptances_publication_id_acceptor_username_key;
                CREATE UNIQUE INDEX one_active_acceptance_per_user_per_pub_idx
                ON publication_acceptances (publication_id, acceptor_username)
                WHERE (status <> 'confirmed_paid');
            END IF;
         END $$;`,
        // MIGRACIÓN 4: Añadir la columna 'description' a 'app_settings'.
        // Esto soluciona un error de arranque si la base de datos es antigua y no tiene esta columna.
        `DO $$
         BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='description') THEN
                ALTER TABLE app_settings ADD COLUMN description TEXT;
            END IF;
         END $$;`,
        // MIGRACIÓN 5: (ROBUSTA) Asegurar que la tabla 'publications' tiene todas las columnas necesarias.
        // Esto previene errores si la tabla fue creada en un estado incompleto en una versión anterior.
        `DO $$
         BEGIN
            -- Columna status
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='status') THEN
                ALTER TABLE publications ADD COLUMN status VARCHAR(50) DEFAULT 'open';
            END IF;
            -- Columna is_sell_post
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='is_sell_post') THEN
                ALTER TABLE publications ADD COLUMN is_sell_post BOOLEAN DEFAULT FALSE;
            END IF;
            -- Columna available_slots
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='available_slots') THEN
                ALTER TABLE publications ADD COLUMN available_slots INT DEFAULT 1;
            END IF;
            -- Columna is_paused
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='is_paused') THEN
                ALTER TABLE publications ADD COLUMN is_paused BOOLEAN DEFAULT FALSE;
            END IF;
         END $$;`,
        // Añadir la columna de comisión a la tabla de transacciones si no existe.
        `DO $$
         BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='platform_fee_blue') THEN
                ALTER TABLE transactions ADD COLUMN platform_fee_blue NUMERIC(19, 4) NOT NULL DEFAULT 0;
            END IF;
         END $$;`
    ];

    console.log("Iniciando revisión de migraciones de base de datos...");
    for (const query of migrationQueries) {
        await client.query(query);
    }
    console.log("Revisión de migraciones finalizada.");

    // --- MIGRACIÓN DE DATOS ---
    // Una vez que todas las columnas de esquema están en su lugar, podemos limpiar datos rotos.
    try {
        console.log("DATA CLEANUP: Deleting orphaned publications (where author_id IS NULL)...");
        const deleteResult = await client.query(`
            DELETE FROM publications WHERE author_id IS NULL
        `);
        if (deleteResult.rowCount > 0) {
            console.log(`DATA CLEANUP: Successfully deleted ${deleteResult.rowCount} orphaned publication(s).`);
        } else {
            console.log("DATA CLEANUP: No orphaned publications found. Database is clean.");
        }
    } catch (error) {
        console.error("DATA CLEANUP: Error while trying to delete orphaned publications:", error);
        // No relanzamos el error aquí, ya que no es crítico para el arranque del servidor si esto falla.
    }
}


/**
 * Función principal para configurar y asegurar que todas las tablas de la DB existen.
 */
async function initializeDatabase() {
    const tableCreationQueries = [
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 100.0000,
            escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            average_rating REAL NOT NULL DEFAULT 0,
            ratings_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS publications (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            blue_cost NUMERIC(19, 4) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'open',
            author_id INT REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_sell_post BOOLEAN DEFAULT FALSE,
            available_slots INT DEFAULT 1,
            is_paused BOOLEAN DEFAULT FALSE
        );`,
        `CREATE TABLE IF NOT EXISTS hidden_publications (
            id SERIAL PRIMARY KEY,
            publication_id INT REFERENCES publications(id) ON DELETE CASCADE,
            hider_username VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
            UNIQUE (publication_id, hider_username)
        );`,
        `CREATE TABLE IF NOT EXISTS publication_acceptances (
            id SERIAL PRIMARY KEY,
            publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
            acceptor_username VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            recipient_username VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            blue_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
            red_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
            related_publication_id INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS ratings (
            id SERIAL PRIMARY KEY,
            publication_id INTEGER NOT NULL REFERENCES publications(id),
            rater_username VARCHAR(255) NOT NULL,
            ratee_username VARCHAR(255) NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS red_token_debts (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            due_at TIMESTAMPTZ NOT NULL,
            is_settled BOOLEAN NOT NULL DEFAULT FALSE,
            is_penalized BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(255) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            description TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS blue_token_escrows (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            unlock_at TIMESTAMPTZ NOT NULL,
            is_released BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVAS TABLAS PARA LA BILLETERA DE LA PLATAFORMA ---
        `CREATE TABLE IF NOT EXISTS platform_wallet (
            id INT PRIMARY KEY DEFAULT 1, -- Solo habrá una fila
            total_blue_commission_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000
        );`,
        `CREATE TABLE IF NOT EXISTS platform_commission_log (
            id SERIAL PRIMARY KEY,
            related_publication_id INT NOT NULL,
            related_user_transaction_id INT, -- El ID de la transacción de usuario que generó esta comisión
            commission_amount_blue NUMERIC(19, 4) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`
    ];
    
    const defaultSettings = [
        ['public_profiles_enabled', 'true', 'Permite que cualquiera vea perfiles de usuario.'],
        ['allow_new_registrations', 'true', 'Permite que nuevos usuarios se registren.'],
        ['allow_new_publications', 'true', 'Permite a los usuarios crear nuevas publicaciones.'],
        ['debt_system_enabled', 'true', 'Activa o desactiva el sistema de deuda de tokens RED.'],
        // --- Configuraciones de tiempo granulares ---
        ['debt_cycle_days', '30', 'Días para el ciclo de deuda RED.'],
        ['debt_cycle_hours', '0', 'Horas para el ciclo de deuda RED.'],
        ['debt_cycle_minutes', '0', 'Minutos para el ciclo de deuda RED.'],
        ['blue_escrow_days', '1', 'Días para el depósito de BLUE en escrow.'],
        ['blue_escrow_hours', '0', 'Horas para el depósito de BLUE en escrow.'],
        ['blue_escrow_minutes', '0', 'Minutos para el depósito de BLUE en escrow.'],
        // --- NUEVA CONFIGURACIÓN DE COMISIÓN ---
        ['platform_commission_percentage', '5', 'Porcentaje de comisión para la plataforma (ej: 5 para 5%).']
    ];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Paso 1: Aplicar todas las migraciones de esquema.
        await applyMigrations(client);

        // Paso 2: Asegurar que todas las tablas base existen.
        for (const query of tableCreationQueries) {
            await client.query(query);
        }
        console.log("Todas las tablas han sido aseguradas en PostgreSQL.");

        // Paso 3: Asegurar que todas las configuraciones por defecto existen.
        for (const setting of defaultSettings) {
            await client.query(
                'INSERT INTO app_settings (setting_key, setting_value, description) VALUES ($1, $2, $3) ON CONFLICT (setting_key) DO NOTHING',
                setting
            );
        }
        console.log("Configuraciones por defecto aseguradas en 'app_settings'.");
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error al inicializar las tablas:', e);
        throw e;
    } finally {
        client.release();
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
                const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
                if (userCheck.rows.length > 0) {
                    return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
                }

                const passwordHash = await bcrypt.hash(password, saltRounds);
                
                const sql = `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`;
                const result = await pool.query(sql, [username, passwordHash]);
                const newUser = result.rows[0];

                res.status(201).json({ 
                    message: `Usuario '${newUser.username}' registrado con éxito.`,
                    userId: newUser.id,
                    username: newUser.username
                });
            } catch (error) {
                console.error('Error al registrar usuario:', error);
                if (error.code === '23505') {
                    return res.status(409).json({ message: 'El nombre de usuario ya está registrado.' });
                }
                res.status(500).json({ message: 'Error interno del servidor al intentar registrar el usuario.' });
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

                if (!user.password_hash) {
                    console.error(`Intento de login para el usuario '${username}' falló: la cuenta está corrupta (no tiene password_hash).`);
                    return res.status(401).json({ message: 'Credenciales inválidas. La cuenta de usuario podría estar corrupta.' });
                }

                const match = await bcrypt.compare(password, user.password_hash);

                if (match) {
                    res.status(200).json({
                        message: "Inicio de sesión exitoso.",
                        username: user.username,
                        blue_balance: user.liquid_blue_balance,
                        escrow_blue_balance: user.escrow_blue_balance,
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
            const costString = (blueSell || blueCost).toString().replace(',', '.');
            const cost = parseFloat(costString);

            if (isNaN(cost) || cost <= 0) {
                return res.status(400).json({ message: "El costo o recompensa debe ser un número positivo." });
            }

            const slots = availableSlots ? parseInt(availableSlots, 10) : 1;
            if (isNaN(slots) || slots < 1) {
                return res.status(400).json({ message: "La cantidad de cupos disponibles debe ser mayor a 0." });
            }
        
            try {
                const userResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [authorUsername]);
                if (userResult.rowCount === 0) {
                    return res.status(404).json({ message: "El autor de la publicación no existe." });
                }
                const authorId = userResult.rows[0].id;

                const sql = `INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
                const result = await pool.query(sql, [title, description, cost, isSellPost, authorId, slots]);
                res.status(201).json({ message: "Publicación creada exitosamente.", publicationId: result.rows[0].id });
            } catch (error) {
                console.error("Error al guardar la publicación:", error);
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para obtener publicaciones activas
        app.get('/publications/active', async (req, res) => {
            const { user: requestingUser } = req.query;
            if (!requestingUser) return res.status(400).json({ message: "Es necesario especificar un usuario." });
            
            const sql = `
                SELECT
                    p.*,
                    u.username as author_username,
                    (
                        SELECT pa.status 
                        FROM publication_acceptances pa 
                        WHERE pa.publication_id = p.id AND pa.acceptor_username = $1
                        ORDER BY
                            CASE pa.status
                                WHEN 'approved' THEN 1
                                WHEN 'completed' THEN 2
                                WHEN 'pending_approval' THEN 3
                                WHEN 'confirmed_paid' THEN 4
                                ELSE 5
                            END
                        LIMIT 1
                    ) as user_acceptance_status,
                    (CASE
                        WHEN u.username = $1 THEN (
                            SELECT json_agg(json_build_object(
                                'username', participant_user.username,
                                'status', pa.status,
                                'average_rating', participant_user.average_rating,
                                'ratings_count', participant_user.ratings_count
                            ))
                            FROM publication_acceptances pa
                            JOIN users participant_user ON pa.acceptor_username = participant_user.username
                            WHERE pa.publication_id = p.id
                        )
                        ELSE NULL
                    END) as participants
                FROM
                    publications p
                JOIN
                    users u on p.author_id = u.id
                WHERE
                    p.id NOT IN (SELECT hp.publication_id FROM hidden_publications hp WHERE hp.hider_username = $1)
                    AND (
                        (p.available_slots > 0)
                        OR (u.username = $1 AND EXISTS (SELECT 1 FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status != 'confirmed_paid'))
                        OR (p.id IN (SELECT pa.publication_id FROM publication_acceptances pa WHERE pa.acceptor_username = $1 AND pa.status != 'confirmed_paid'))
                    )
                ORDER BY
                    p.created_at DESC
            `;
            try {
                const result = await pool.query(sql, [requestingUser]);
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

        // Ruta para Aceptar una publicación
        app.post('/publications/:id/accept', async (req, res) => {
            const { id } = req.params;
            const { acceptorUsername } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 FOR UPDATE`, [id]);
                const pub = pubResult.rows[0];

                if (!pub) {
                    throw { status: 404, message: "La publicación ya no existe." };
                }
                if (pub.author_username === acceptorUsername) {
                    throw { status: 400, message: "No puedes aceptar tu propia publicación." };
                }
                if (pub.available_slots <= 0) {
                    throw { status: 400, message: "Lo sentimos, ya no quedan cupos disponibles." };
                }

                await client.query(`UPDATE publications SET available_slots = available_slots - 1 WHERE id = $1`, [id]);
                
                await client.query(`INSERT INTO publication_acceptances (publication_id, acceptor_username, status) VALUES ($1, $2, 'pending_approval')`, [id, acceptorUsername]);
                
                const message = `El usuario ${acceptorUsername} quiere realizar la tarea "${pub.title}".`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, message]);

                await client.query('COMMIT');
                res.status(200).json({ message: "Solicitud enviada. Esperando aprobación." });

            } catch (error) {
                await client.query('ROLLBACK');
                if (error.constraint === 'one_active_acceptance_per_user_per_pub_idx') {
                    return res.status(409).json({ message: "Ya has enviado una solicitud para esta tarea." });
                }
                console.error("Error al aceptar publicación:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
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
        
                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 AND u.username = $2 FOR UPDATE`, [id, discarderUsername]);
                const pub = pubResult.rows[0];
                if (!pub) {
                    throw { status: 403, message: "No tienes permiso para gestionar esta tarea." };
                }
        
                const deleteResult = await client.query(
                    `DELETE FROM publication_acceptances WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'pending_approval' RETURNING *`,
                    [id, userToDiscard]
                );
                
                if (deleteResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una solicitud pendiente para este usuario." };
                }
        
                await client.query(`UPDATE publications SET available_slots = available_slots + 1 WHERE id = $1`, [id]);
        
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

        // Ruta para Aprobar a un usuario
        app.post('/publications/:id/approve', async (req, res) => {
            const { id } = req.params;
            const { approverUsername, userToApprove } = req.body; 
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 AND u.username = $2`, [id, approverUsername]);
                const pub = pubResult.rows[0];
                if (!pub) throw { status: 403, message: "No tienes permiso para aprobar solicitudes." };

                const updateResult = await client.query(
                    `UPDATE publication_acceptances SET status = 'approved' WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'pending_approval' RETURNING *`,
                    [id, userToApprove]
                );
                
                if (updateResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una solicitud pendiente válida para este usuario." };
                }

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

        // Ruta para Marcar como Culminada
        app.post('/publications/:id/complete', async (req, res) => {
            const pubId = req.params.id;
            const { completerUsername } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Buscamos una solicitud 'aprobada' para este usuario en esta publicación.
                const acceptanceResult = await client.query(
                    `SELECT p.blue_cost, p.is_sell_post, p.title, u.username as author_username, pa.id as acceptance_id
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
                     WHERE p.id = $1 AND pa.acceptor_username = $2 AND pa.status = 'approved'
                     FOR UPDATE`,
                    [pubId, completerUsername]
                );

                const acceptance = acceptanceResult.rows[0];
                if (!acceptance) {
                    throw { status: 404, message: "No se encontró una tarea o compra aprobada para procesar." };
                }

                // Aquí está la bifurcación de la lógica profesional:
                if (acceptance.is_sell_post) {
                    // --- LÓGICA PARA UNA VENTA: El comprador confirma y paga en un solo paso ---
                    const { blue_cost, title, author_username: seller, acceptance_id } = acceptance;
                    const cost = parseFloat(blue_cost);
                    const buyer = completerUsername;

                    // Obtenemos los intervalos y la nueva comisión de la configuración
                    const settingKeys = [
                        'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 
                        'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes',
                        'platform_commission_percentage'
                    ];
                    const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`, [settingKeys]);
                    const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
                    const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
                    const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;

                    // --- CÁLCULO DE COMISIÓN ---
                    const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
                    const commissionAmount = cost * (commissionPercentage / 100);
                    const redToReceive = cost + commissionAmount; // El comprador asume la comisión en su deuda RED

                    // Realizamos la transacción completa
                    // 1. El comprador (completerUsername) recibe RED (costo + comisión) y una deuda.
                    await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [redToReceive, buyer]);
                    await client.query(`INSERT INTO red_token_debts (username, amount, due_at) VALUES ($1, $2, NOW() + INTERVAL '${debtInterval}')`, [buyer, redToReceive]);
                    
                    // 2. El vendedor (author) recibe BLUE (costo base) en depósito (escrow).
                    await client.query(`UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2`, [cost, seller]);
                    await client.query(`INSERT INTO blue_token_escrows (username, amount, unlock_at) VALUES ($1, $2, NOW() + INTERVAL '${escrowInterval}')`, [seller, cost]);

                    // --- REGISTRO DE COMISIÓN PARA LA PLATAFORMA ---
                    // 3. Añadir la comisión a la billetera de la plataforma
                    await client.query(
                        `INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1)
                         ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`,
                        [commissionAmount]
                    );

                    // 4. Actualizamos el estado de la aceptación directamente a "pagado".
                    await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance_id]);

                    // 5. Se registran las transacciones para ambos usuarios.
                    const buyerTxResult = await client.query(
                        `INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) 
                         VALUES ($1, 'purchase_completed', $2, 0, $3, $4, $5) RETURNING id`,
                        [buyer, `Compraste: "${title}"`, redToReceive, pubId, commissionAmount]
                    );
                    const buyerTxId = buyerTxResult.rows[0].id;

                    await client.query(
                        `INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) 
                         VALUES ($1, 'sale_completed', $2, $3, 0, $4)`,
                        [seller, `Vendiste: "${title}"`, cost, pubId]
                    );
                    
                    // 6. Loguear la comisión ganada por la plataforma
                    await client.query(
                        `INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`,
                        [pubId, buyerTxId, commissionAmount]
                    );

                    // 7. Se notifica al vendedor que ha recibido el pago.
                    const sellerNotification = `¡Has recibido el pago de ${cost.toFixed(4)} BLUE (en depósito) por "${title}" de parte de ${buyer}!`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [seller, sellerNotification]);
                    
                    await client.query('COMMIT');
                    res.status(200).json({ message: "¡Compra completada y pagada! Gracias." });

                } else {
                    // --- LÓGICA PARA UNA SOLICITUD: El trabajador marca la tarea como finalizada ---
                    const { title, author_username, acceptance_id } = acceptance;
                    await client.query(`UPDATE publication_acceptances SET status = 'completed' WHERE id = $1`, [acceptance_id]);
                    
                    const message = `${completerUsername} ha marcado la tarea "${title}" como culminada.`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [author_username, message]);
        
                    await client.query('COMMIT');
                    res.status(200).json({ message: "Tarea marcada como culminada. Esperando la confirmación del autor." });
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al completar tarea/venta:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Confirmar y Pagar
        app.post('/publications/:id/confirm-payment', async (req, res) => {
            const pubId = req.params.id;
            const { confirmerUsername, workerUsername } = req.body; 
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const acceptanceResult = await client.query(
                    `SELECT p.blue_cost, p.is_sell_post, p.title, u.username as author_username, pa.id as acceptance_id
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
                     WHERE p.id = $1 
                       AND u.username = $2 
                       AND pa.acceptor_username = $3
                       AND pa.status = 'completed'
                     FOR UPDATE`,
                    [pubId, confirmerUsername, workerUsername]
                );
                
                const acceptance = acceptanceResult.rows[0];
                if (!acceptance) throw { status: 404, message: "No se encontró una tarea completada válida para confirmar." };

                const { blue_cost, is_sell_post, title, author_username: author, acceptance_id } = acceptance;
                const cost = parseFloat(blue_cost);

                // MEJORA DE CALIDAD: Esta ruta solo debe manejar 'solicitudes', no 'ventas'.
                if (is_sell_post) {
                    console.error(`ERROR DE LÓGICA: Se intentó usar /confirm-payment para una venta (Pub ID: ${pubId}). El pago de ventas se gestiona en /complete.`);
                    throw { status: 500, message: "Error de lógica interna: Esta acción no es aplicable a publicaciones de venta." };
                }

                // --- LÓGICA PARA SOLICITUDES (El autor paga al trabajador) ---
                const settingKeys = [
                    'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes',
                    'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes',
                    'platform_commission_percentage'
                ];
                const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`, [settingKeys]);
                const settings = settingsResult.rows.reduce((acc, row) => ({...acc, [row.setting_key]: row.setting_value }), {});

                const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
                const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;

                // --- CÁLCULO Y DISTRIBUCIÓN DE COMISIÓN ---
                const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
                const commissionAmount = cost * (commissionPercentage / 100);
                const redForAuthor = cost + commissionAmount;

                // 1. El autor (confirmerUsername) recibe su deuda RED (costo + comisión).
                await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [redForAuthor, author]);
                await client.query(`INSERT INTO red_token_debts (username, amount, due_at) VALUES ($1, $2, NOW() + INTERVAL '${debtInterval}')`, [author, redForAuthor]);
                
                // 2. El trabajador (workerUsername) recibe los BLUE del trabajo (costo base) en depósito.
                await client.query(`UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2`, [cost, workerUsername]);
                await client.query(`INSERT INTO blue_token_escrows (username, amount, unlock_at) VALUES ($1, $2, NOW() + INTERVAL '${escrowInterval}')`, [workerUsername, cost]);
                
                // 3. La plataforma recibe su comisión en BLUE.
                await client.query(
                    `INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1)
                     ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`,
                    [commissionAmount]
                );
                
                // 4. Se registran las transacciones para ambos usuarios.
                const authorTxResult = await client.query(
                    `INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) 
                     VALUES ($1, 'payment_sent', $2, 0, $3, $4, $5) RETURNING id`, 
                    [author, `Pagaste por: "${title}"`, redForAuthor, pubId, commissionAmount]
                );
                const authorTxId = authorTxResult.rows[0].id;

                await client.query(
                    `INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) 
                     VALUES ($1, 'payment_received', $2, $3, 0, $4)`, 
                    [workerUsername, `Realizaste: "${title}"`, cost, pubId]
                );
                
                // 5. Se registra la comisión en el log de la plataforma.
                await client.query(
                    `INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`,
                    [pubId, authorTxId, commissionAmount]
                );

                // 6. Se actualiza el estado de la aceptación.
                await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance_id]);
                
                // 7. Se notifica al trabajador.
                const notificationMessage = `¡Has recibido ${cost.toFixed(4)} BLUE (en depósito) por la tarea "${title}"!`;
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
            const sql = `SELECT * FROM notifications WHERE recipient_username = $1 AND is_read = FALSE ORDER BY created_at DESC`;
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
                res.status(200).json({ success: true, count: result.rowCount });
            } catch(error) {
                res.status(500).json({ message: "Error al marcar notificaciones como leídas." });
            }
        });

        // Ruta para descartar una notificación INDIVIDUAL
        app.post('/notifications/:id/dismiss', async (req, res) => {
            const { id } = req.params;
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({ message: "Se requiere nombre de usuario." });
            }

            try {
                const sql = `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_username = $2 AND is_read = FALSE RETURNING id`;
                const result = await pool.query(sql, [id, username]);

                if (result.rowCount > 0) {
                    res.status(200).json({ message: "Notificación descartada." });
                } else {
                    res.status(200).json({ message: "La notificación no necesitaba ser descartada." });
                }
            } catch (error) {
                console.error('Error al descartar notificación:', error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para QUEMAR tokens (Ahora refactorizada para usar la función central)
        app.post('/users/burn', async (req, res) => {
            const { username, amount } = req.body;

            const amountToBurnString = (amount || "0").toString().replace(',', '.');
            const amountToBurn = parseFloat(amountToBurnString);

            if (!username || !amountToBurn || amountToBurn <= 0) {
                return res.status(400).json({ message: "La cantidad a quemar debe ser un número positivo." });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                const burnResult = await executeBurn(client, username, amountToBurn);
                
                if (burnResult.success) {
                    await client.query('COMMIT');
                    res.json({ message: burnResult.message });
                } else {
                    await client.query('ROLLBACK');
                    // Usamos un código de estado 400 (Bad Request) para errores de lógica de negocio como saldo insuficiente.
                    res.status(400).json({ message: burnResult.message });
                }
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error en la ruta /users/burn:", error);
                res.status(500).json({ message: error.message || "Error del servidor." });
            } finally {
                client.release();
            }
        });

        // Ruta: Obtener el historial de un usuario
        app.get('/users/:username/history', async (req, res) => {
            const { username } = req.params;
            try {
                const authoredSql = `SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE u.username = $1 ORDER BY p.created_at DESC`;

                const completedSql = `
                    SELECT p.*, u.username as author_username, pa.status as user_acceptance_status
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
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
                SELECT pa.acceptor_username, pa.status, u.average_rating, u.ratings_count
                FROM publication_acceptances pa JOIN users u ON pa.acceptor_username = u.username
                WHERE pa.publication_id = $1 ORDER BY pa.created_at
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
            
            const client = await pool.connect();
            try {
                const userSql = `SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1`;
                
                const debtSql = `
                    SELECT due_at, amount FROM red_token_debts 
                    WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC LIMIT 1
                `;

                const escrowSql = `
                    SELECT unlock_at, amount FROM blue_token_escrows
                    WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC LIMIT 1
                `;
                
                const [userResult, debtResult, escrowResult] = await Promise.all([
                    client.query(userSql, [username]),
                    client.query(debtSql, [username]),
                    client.query(escrowSql, [username])
                ]);

                if (userResult.rows.length === 0) {
                    return res.status(404).json({ message: "Usuario no encontrado." });
                }

                const responseData = {
                    blue_balance: userResult.rows[0].liquid_blue_balance,
                    escrow_blue_balance: userResult.rows[0].escrow_blue_balance,
                    red_balance: userResult.rows[0].red_balance,
                    next_due_at: debtResult.rows[0]?.due_at || null,
                    next_due_amount: debtResult.rows[0]?.amount || null,
                    next_unlock_at: escrowResult.rows[0]?.unlock_at || null,
                    next_unlock_amount: escrowResult.rows[0]?.amount || null
                };
                
                res.status(200).json(responseData);
            } catch (err) {
                console.error("Error al obtener balance y deuda:", err);
                return res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                client.release();
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
            const { publication_id, rater_username, ratee_username, rating, comment } = req.body;
            if (!publication_id || !rater_username || !ratee_username || !rating) {
                return res.status(400).json({ message: 'Faltan datos requeridos para la calificación.' });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const insertRatingQuery = `
                    INSERT INTO ratings (publication_id, rater_username, ratee_username, rating, comment)
                    VALUES ($1, $2, $3, $4, $5)
                `;
                await client.query(insertRatingQuery, [publication_id, rater_username, ratee_username, rating, comment || null]);

                const updateUserRatingQuery = `
                    UPDATE users u
                    SET 
                        ratings_count = r.total_ratings,
                        average_rating = r.avg_rating
                    FROM (
                        SELECT 
                            ratee_username, COUNT(*) AS total_ratings, AVG(rating) AS avg_rating
                        FROM ratings WHERE ratee_username = $1 GROUP BY ratee_username
                    ) r
                    WHERE u.username = $1;
                `;
                await client.query(updateUserRatingQuery, [ratee_username]);

                await client.query('COMMIT');
                res.status(201).json({ message: `¡Gracias! Tu calificación para ${ratee_username} ha sido guardada.` });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error al guardar la calificación:', error.message);
                res.status(500).json({ message: 'Error interno al guardar la calificación.' });
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

                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 FOR UPDATE`, [id]);
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "La publicación no existe." };
                if (pub.author_username !== deleterUsername) throw { status: 403, message: "No tienes permiso para eliminar esto." };

                const participantsCheck = await client.query(
                    `SELECT 1 FROM publication_acceptances WHERE publication_id = $1 AND status IN ('approved', 'completed') LIMIT 1`,
                    [id]
                );
                if (participantsCheck.rowCount > 0) {
                    throw { status: 403, message: "No se puede eliminar una tarea con participantes activos." };
                }
                
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

        // Ruta para PAUSAR/REANUDAR una publicación
        app.post('/publications/:id/toggle-pause', async (req, res) => {
            const { id } = req.params;
            const { username } = req.body;

            try {
                const sql = `
                    UPDATE publications SET is_paused = NOT is_paused
                    WHERE author_id = (SELECT id FROM users WHERE username = $1) AND id = $2
                    RETURNING is_paused;
                `;
                const result = await pool.query(sql, [username, id]);
                
                if (result.rowCount === 0) {
                    return res.status(403).json({ message: "No tienes permiso o la publicación no existe." });
                }

                const isPaused = result.rows[0].is_paused;
                const message = isPaused ? "Publicación pausada." : "Publicación reanudada.";
                
                res.status(200).json({ message, isPaused });
            } catch (error) {
                console.error("Error en toggle-pause:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para OCULTAR una publicación
        app.post('/publications/:id/hide', async (req, res) => {
            const { id } = req.params;
            const { username } = req.body;

            try {
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
                const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'public_profiles_enabled'`);
                const isEnabled = settingsResult.rows[0]?.setting_value === 'true';
        
                if (!isEnabled) {
                    return res.status(404).json({ message: "Perfiles de usuario no encontrados." });
                }
        
                await client.query('BEGIN');
        
                const userSql = `SELECT username, average_rating, ratings_count FROM users WHERE username = $1`;
                const userResult = await client.query(userSql, [username]);
                if (userResult.rowCount === 0) {
                    throw { status: 404, message: "Usuario no encontrado." };
                }
                const userProfile = userResult.rows[0];
        
                const ratingsSql = `SELECT rater_username, rating, comment, created_at FROM ratings WHERE ratee_username = $1 ORDER BY created_at DESC`;
                const ratingsResult = await client.query(ratingsSql, [username]);
                const ratings = ratingsResult.rows;
        
                await client.query('COMMIT');
        
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

        // --- Rutas de Administración ---

        app.post('/api/admin/login', (req, res) => {
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ message: "Se requiere la contraseña." });
            }
            if (password === process.env.ADMIN_PASSWORD) {
                const accessToken = jwt.sign({ name: 'admin' }, process.env.ADMIN_SECRET_KEY, { expiresIn: '8h' });
                res.json({ token: accessToken });
            } else {
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
        });
        
        app.get('/api/admin/settings', verifyAdminToken, async (req, res) => {
            try {
                const result = await pool.query(`SELECT * FROM app_settings ORDER BY setting_key`);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener todas las configuraciones:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        app.post('/api/admin/settings', verifyAdminToken, async (req, res) => {
            const { key, value } = req.body;
            if (!key || typeof value !== 'string') {
                return res.status(400).json({ message: "Se requiere 'key' y 'value'." });
            }
            try {
                const result = await pool.query(`UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2 RETURNING *`, [value, key]);
                if (result.rowCount === 0) {
                    return res.status(404).json({ message: `Clave de configuración '${key}' no encontrada.` });
                }
                res.status(200).json({ message: `Configuración '${key}' actualizada.`, setting: result.rows[0] });
            } catch (error) {
                console.error("Error al actualizar la configuración:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });
        
        app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
            const { search = '' } = req.query;
            try {
                const sql = `
                    SELECT id, username, liquid_blue_balance, escrow_blue_balance, red_balance, 
                           average_rating, ratings_count, created_at
                    FROM users WHERE username ILIKE $1 ORDER BY created_at DESC
                `;
                const result = await pool.query(sql, [`%${search}%`]);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener la lista de usuarios:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        app.get('/api/admin/debtors', verifyAdminToken, async (req, res) => {
            try {
                const sql = `
                    SELECT username, SUM(amount) AS total_penalized_debt, COUNT(*) AS penalized_debts_count
                    FROM red_token_debts WHERE is_penalized = TRUE AND is_settled = FALSE
                    GROUP BY username ORDER BY total_penalized_debt DESC
                `;
                const result = await pool.query(sql);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener la lista de deudores:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        app.get('/api/admin/dashboard-stats', verifyAdminToken, async (req, res) => {
            const client = await pool.connect();
            try {
                const [usersData, publicationsData, tokensData, platformWalletData] = await Promise.all([
                    client.query('SELECT COUNT(*) AS total_users FROM users'),
                    client.query(`
                        SELECT COUNT(DISTINCT p.id) AS active_publications FROM publications p
                        LEFT JOIN publication_acceptances pa ON p.id = pa.publication_id
                        WHERE pa.status IS NULL OR pa.status != 'confirmed_paid'
                    `),
                    client.query('SELECT SUM(liquid_blue_balance + escrow_blue_balance) AS users_total_blue, SUM(red_balance) AS total_red FROM users'),
                    client.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1')
                ]);
        
                const usersTotalBlue = parseFloat(tokensData.rows[0].users_total_blue) || 0;
                const platformCommissionBalance = parseFloat(platformWalletData.rows[0]?.total_blue_commission_balance) || 0;
                const totalBlueInSystem = usersTotalBlue + platformCommissionBalance;
        
                const stats = {
                    totalUsers: parseInt(usersData.rows[0].total_users, 10),
                    activePublications: parseInt(publicationsData.rows[0].active_publications, 10),
                    totalBlue: totalBlueInSystem,
                    totalRed: parseFloat(tokensData.rows[0].total_red) || 0,
                    platformCommissionBalance: platformCommissionBalance
                };
        
                res.status(200).json(stats);
            } catch (error) {
                console.error("Error al obtener estadísticas del dashboard:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // --- ENDPOINTS PARA BILLETERA DE PLATAFORMA (CORRECCIÓN) ---
        app.get('/api/admin/platform-wallet/balance', verifyAdminToken, async (req, res) => {
            try {
                const result = await pool.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1');
                const balance = result.rows[0]?.total_blue_commission_balance || '0';
                res.json({ balance: parseFloat(balance) });
            } catch (error) {
                console.error("Error al obtener el saldo de la plataforma:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        app.get('/api/admin/platform-wallet/log', verifyAdminToken, async (req, res) => {
            try {
                const query = `
                    SELECT 
                        pcl.id,
                        pcl.commission_amount_blue,
                        pcl.created_at,
                        p.id as publication_id,
                        p.title as publication_title,
                        t.username as user_who_paid
                    FROM platform_commission_log pcl
                    LEFT JOIN publications p ON pcl.related_publication_id = p.id
                    LEFT JOIN transactions t ON pcl.related_user_transaction_id = t.id
                    ORDER BY pcl.created_at DESC
                `;
                const result = await pool.query(query);
                
                const logWithNullChecks = result.rows.map(entry => ({
                    ...entry,
                    publication_title: entry.publication_title || '(Publicación eliminada)',
                    user_who_paid: entry.user_who_paid || '(Usuario desconocido)'
                }));
                res.json(logWithNullChecks);

            } catch (error) {
                console.error("Error al obtener el log de comisiones:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Endpoint para obtener todas las publicaciones para el panel de administración
        app.get('/api/admin/publications', verifyAdminToken, async (req, res) => {
            const searchTerm = req.query.search || '';
            try {
                const query = `
                    SELECT
                        p.id, p.title, u.username AS author_username, p.blue_cost, p.status, p.created_at,
                        p.is_paused, p.is_sell_post, p.available_slots,
                        COALESCE(pa_counts.participants_count, 0)::int as participants_count,
                        COALESCE(pa_counts.completed_count, 0)::int as completed_count
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
                    LEFT JOIN (
                        SELECT
                            publication_id, COUNT(*) as participants_count,
                            COUNT(*) FILTER (WHERE status = 'confirmed_paid') as completed_count
                        FROM publication_acceptances GROUP BY publication_id
                    ) pa_counts ON pa_counts.publication_id = p.id
                    WHERE p.title ILIKE $1 OR u.username ILIKE $1
                    ORDER BY p.created_at DESC
                `;
                const result = await pool.query(query, [`%${searchTerm}%`]);
                res.json(result.rows);
            } catch (error) {
                console.error('Error fetching all publications for admin:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // Endpoint para que un administrador elimine una publicación
        app.delete('/api/admin/publications/:id', verifyAdminToken, async (req, res) => {
            const { id } = req.params;
            try {
                const deleteResult = await pool.query('DELETE FROM publications WHERE id = $1', [id]);

                if (deleteResult.rowCount === 0) {
                    return res.status(404).json({ message: 'Publicación no encontrada.' });
                }
                
                res.json({ success: true, message: 'Publicación eliminada correctamente.' });
            } catch (error) {
                console.error(`Error deleting publication ${id} for admin:`, error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        app.get('/api/settings', async (req, res) => {
            try {
                const sql = `
                    SELECT setting_key, setting_value FROM app_settings 
                    WHERE setting_key IN (
                        'public_profiles_enabled', 
                        'allow_new_registrations', 
                        'allow_new_publications',
                        'platform_commission_percentage'
                    )
                `;
                const result = await pool.query(sql);
                const settings = result.rows.reduce((acc, row) => {
                    // El porcentaje lo devolvemos como número, el resto como booleano.
                    if (row.setting_key === 'platform_commission_percentage') {
                        acc[row.setting_key] = parseFloat(row.setting_value) || 0;
                    } else {
                        acc[row.setting_key] = row.setting_value === 'true';
                    }
                    return acc;
                }, {});
                res.status(200).json(settings);
            } catch (error) {
                console.error("Error al obtener la configuración pública:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });
        
        // --- Procesos en segundo plano ---

        // Función reutilizable y centralizada para la quema de tokens
        async function executeBurn(client, username, amountToBurn) {
            if (amountToBurn <= 0) {
                return { success: false, message: 'La cantidad a quemar debe ser positiva.', actualAmountBurned: 0 };
            }

            // 1. Obtener saldos y deudas del usuario dentro de una transacción
            const userResult = await client.query(
                `SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1 FOR UPDATE`,
                [username]
            );

            if (userResult.rowCount === 0) {
                return { success: false, message: 'Usuario no encontrado.', actualAmountBurned: 0 };
            }

            const user = userResult.rows[0];
            const liquidBlue = parseFloat(user.liquid_blue_balance);
            const escrowBlue = parseFloat(user.escrow_blue_balance);
            const totalBlueAvailable = liquidBlue + escrowBlue;
            const totalRed = parseFloat(user.red_balance);

            // Determinar la cantidad real que se puede quemar (la más pequeña entre BLUE disponible, RED disponible y la cantidad solicitada)
            const actualAmountToBurn = Math.min(amountToBurn, totalBlueAvailable, totalRed);

            if (actualAmountToBurn < 0.0001) { // Usamos un umbral pequeño para evitar problemas de punto flotante
                return { success: true, message: 'No hay saldo suficiente para quemar.', actualAmountBurned: 0 };
            }

            // 2. Determinar cuánto se quema de cada tipo de saldo BLUE
            const burnedFromLiquid = Math.min(actualAmountToBurn, liquidBlue);
            const burnedFromEscrow = actualAmountToBurn - burnedFromLiquid;

            // 3. Saldar deudas RED (las más antiguas primero)
            const debtsResult = await client.query(
                `SELECT id, amount FROM red_token_debts WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC FOR UPDATE`,
                [username]
            );
            
            let remainingToSettle = actualAmountToBurn;
            for (const debt of debtsResult.rows) {
                if (remainingToSettle <= 0) break;

                const amountFromThisDebt = Math.min(remainingToSettle, parseFloat(debt.amount));
                const newDebtAmount = parseFloat(debt.amount) - amountFromThisDebt;
                
                if (newDebtAmount < 0.0001) {
                    // CORRECCIÓN: Si la deuda se paga por completo, la eliminamos de la tabla.
                    // La lógica anterior intentaba poner el monto a 0, lo que violaba la restricción de la DB.
                    await client.query(`DELETE FROM red_token_debts WHERE id = $1`, [debt.id]);
                } else {
                    // Si el pago es parcial, solo actualizamos el monto restante.
                    await client.query(`UPDATE red_token_debts SET amount = $1 WHERE id = $2`, [newDebtAmount, debt.id]);
                }
                remainingToSettle -= amountFromThisDebt;
            }

            // 4. Consumir de los depósitos BLUE en escrow si es necesario
            if (burnedFromEscrow > 0.0001) {
                const escrowLotsResult = await client.query(
                    `SELECT id, amount FROM blue_token_escrows WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC FOR UPDATE`,
                    [username]
                );

                let remainingToConsumeFromEscrow = burnedFromEscrow;
                for (const escrowLot of escrowLotsResult.rows) {
                    if (remainingToConsumeFromEscrow <= 0) break;

                    const amountFromThisLot = Math.min(remainingToConsumeFromEscrow, parseFloat(escrowLot.amount));
                    const newEscrowLotAmount = parseFloat(escrowLot.amount) - amountFromThisLot;

                    if (newEscrowLotAmount < 0.0001) {
                        await client.query(`DELETE FROM blue_token_escrows WHERE id = $1`, [escrowLot.id]);
                    } else {
                        await client.query(`UPDATE blue_token_escrows SET amount = $1 WHERE id = $2`, [newEscrowLotAmount, escrowLot.id]);
                    }
                    remainingToConsumeFromEscrow -= amountFromThisLot;
                }
            }

            // 5. Actualizar los saldos principales del usuario
            await client.query(
                `UPDATE users 
                 SET liquid_blue_balance = liquid_blue_balance - $1,
                     escrow_blue_balance = escrow_blue_balance - $2, 
                     red_balance = red_balance - $3 
                 WHERE username = $4`,
                [burnedFromLiquid, burnedFromEscrow, actualAmountToBurn, username]
            );

            // 6. Registrar la transacción
            const burnDesc = `Quemaste ${actualAmountToBurn.toFixed(4)} tokens. Se usaron ${burnedFromLiquid.toFixed(4)} BLUE (disponible) y ${burnedFromEscrow.toFixed(4)} BLUE (pendiente).`;
            await client.query(
                `INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'burn', $2, $3, $4)`,
                [username, burnDesc, -actualAmountToBurn, -actualAmountToBurn]
            );
            
            return { success: true, message: `Se han quemado ${actualAmountToBurn.toFixed(4)} tokens exitosamente.`, actualAmountBurned: actualAmountToBurn };
        }

        const DEBT_COLLECTOR_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
        setInterval(async () => {
            console.log('DEBT COLLECTOR: Iniciando ciclo de recolección de deudas vencidas...');
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'debt_system_enabled'`);
                const isDebtSystemEnabled = settingsResult.rows[0]?.setting_value === 'true';

                if (!isDebtSystemEnabled) {
                    console.log('DEBT COLLECTOR: El sistema de deudas está desactivado. Saltando ciclo.');
                    await client.query('ROLLBACK');
                    return;
                }

                // 1. Obtener todas las deudas vencidas, no saldadas y no penalizadas, agrupadas por usuario
                const overdueDebtsResult = await client.query(`
                    SELECT username, SUM(amount) as total_due
                    FROM red_token_debts
                    WHERE due_at <= NOW() AND is_settled = FALSE AND is_penalized = FALSE
                    GROUP BY username
                `);

                if (overdueDebtsResult.rowCount === 0) {
                    console.log('DEBT COLLECTOR: No se encontraron deudas vencidas para procesar.');
                    await client.query('ROLLBACK');
                    return;
                }
                
                console.log(`DEBT COLLECTOR: Se encontraron deudas vencidas para ${overdueDebtsResult.rowCount} usuario(s).`);

                // 2. Procesar cada usuario con deudas vencidas
                for (const userDebt of overdueDebtsResult.rows) {
                    const { username, total_due } = userDebt;
                    const amountToSettle = parseFloat(total_due);

                    // La función executeBurn ya determina el máximo posible a quemar.
                    // Le pasamos el total de la deuda y ella hará el resto.
                    console.log(`DEBT COLLECTOR: Intentando saldar ${amountToSettle.toFixed(4)} RED para el usuario ${username}.`);
                    const burnResult = await executeBurn(client, username, amountToSettle);

                    if (burnResult.success && burnResult.actualAmountBurned > 0) {
                        const notificationMessage = `Se realizó una quema automática de ${burnResult.actualAmountBurned.toFixed(4)} tokens para cubrir tu deuda vencida.`;
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [username, notificationMessage]);
                        console.log(`DEBT COLLECTOR: Quema automática exitosa para ${username}. Cantidad: ${burnResult.actualAmountBurned.toFixed(4)}`);
                    } else {
                        console.log(`DEBT COLLECTOR: No se pudo realizar la quema automática para ${username}. Mensaje: ${burnResult.message}`);
                    }

                    // 3. Marcar las deudas restantes (si las hay) como penalizadas
                    await client.query(
                        `UPDATE red_token_debts SET is_penalized = TRUE WHERE username = $1 AND due_at <= NOW() AND is_settled = FALSE`,
                        [username]
                    );
                }

                await client.query('COMMIT');
                console.log('DEBT COLLECTOR: Ciclo de recolección finalizado exitosamente.');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('DEBT COLLECTOR: Error crítico durante el ciclo de recolección de deudas.', error);
            } finally {
                client.release();
            }
        }, DEBT_COLLECTOR_INTERVAL_MS);

        const TOKEN_RELEASER_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto
        setInterval(async () => {
            console.log('TOKEN RELEASER: Iniciando ciclo de liberación de tokens BLUE...');
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Obtener todos los depósitos vencidos y no liberados, agrupados por usuario
                const overdueEscrowsResult = await client.query(`
                    SELECT 
                        username, 
                        SUM(amount) as total_to_release,
                        array_agg(id) as escrow_ids
                    FROM blue_token_escrows
                    WHERE unlock_at <= NOW() AND is_released = FALSE
                    GROUP BY username
                `);

                if (overdueEscrowsResult.rowCount === 0) {
                    console.log('TOKEN RELEASER: No se encontraron tokens para liberar.');
                    await client.query('ROLLBACK'); // No need to keep transaction open
                    return;
                }
                
                console.log(`TOKEN RELEASER: Se encontraron depósitos para liberar para ${overdueEscrowsResult.rowCount} usuario(s).`);

                // 2. Procesar cada usuario con depósitos a liberar
                for (const userEscrow of overdueEscrowsResult.rows) {
                    const { username, total_to_release, escrow_ids } = userEscrow;
                    const amountToRelease = parseFloat(total_to_release);

                    if (amountToRelease <= 0) continue;

                    console.log(`TOKEN RELEASER: Liberando ${amountToRelease.toFixed(4)} BLUE para el usuario ${username}.`);

                    // 3. Actualizar saldos del usuario
                    await client.query(
                        `UPDATE users 
                         SET liquid_blue_balance = liquid_blue_balance + $1,
                             escrow_blue_balance = escrow_blue_balance - $1
                         WHERE username = $2`,
                        [amountToRelease, username]
                    );

                    // 4. Marcar los depósitos como liberados
                    await client.query(
                        `UPDATE blue_token_escrows SET is_released = TRUE WHERE id = ANY($1::int[])`,
                        [escrow_ids]
                    );
                    
                    // 5. Crear una transacción para el historial
                    const releaseDesc = `Se han liberado ${amountToRelease.toFixed(4)} BLUE que estaban en depósito.`;
                    await client.query(
                        `INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'escrow_release', $2, $3, 0)`,
                        [username, releaseDesc, amountToRelease]
                    );

                    // 6. Enviar notificación al usuario
                    const notificationMessage = `¡Buenas noticias! ${amountToRelease.toFixed(4)} BLUE de tu saldo pendiente ya están disponibles.`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [username, notificationMessage]);
                }

                await client.query('COMMIT');
                console.log('TOKEN RELEASER: Ciclo de liberación finalizado exitosamente.');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('TOKEN RELEASER: Error crítico durante el ciclo de liberación de tokens.', error);
            } finally {
                client.release();
            }
        }, TOKEN_RELEASER_INTERVAL_MS);

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error("Error fatal al iniciar el servidor:", err);
        process.exit(1);
    }
}

function verifyAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

startServer();