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
                liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0,
                escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0,
                red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0,
                average_rating REAL NOT NULL DEFAULT 0,
                ratings_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'users' asegurada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS publications (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                blue_cost NUMERIC(19, 4) NOT NULL,
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
                blue_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                red_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
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
            CREATE TABLE IF NOT EXISTS red_token_debts (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                amount NUMERIC(19, 4) NOT NULL CHECK (amount > 0),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                due_at TIMESTAMPTZ NOT NULL,
                is_settled BOOLEAN NOT NULL DEFAULT FALSE,
                is_penalized BOOLEAN NOT NULL DEFAULT FALSE
            )
        `);
        console.log("Tabla 'red_token_debts' asegurada.");

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
                ('allow_new_publications', 'true'),
                ('debt_system_enabled', 'false'),
                ('debt_cycle_days', '30'),
                ('blue_escrow_days', '7')
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

        // MIGRACIÓN para añadir la fecha de registro a los usuarios existentes
        const usersCreatedAtCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='users' AND column_name='created_at'
        `);
        if (usersCreatedAtCheck.rowCount === 0) {
            console.log("MIGRACIÓN: La columna 'created_at' no existe en 'users'. Añadiéndola...");
            await client.query(`ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()`);
            console.log("MIGRACIÓN: Columna 'created_at' añadida exitosamente a 'users'.");
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

        // --- MIGRACIÓN Y CREACIÓN PARA EL SISTEMA DE ESCROW DE TOKENS BLUE ---

        // 1. Crear la nueva tabla blue_token_escrows
        await client.query(`
            CREATE TABLE IF NOT EXISTS blue_token_escrows (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                amount NUMERIC(19, 4) NOT NULL CHECK (amount > 0),
                unlock_at TIMESTAMPTZ NOT NULL,
                is_released BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Tabla 'blue_token_escrows' asegurada.");

        // --- MIGRACIONES Y SANEAMIENTO DE DATOS ---

        // 1. SANEAMIENTO: Corregir cualquier saldo de escrow negativo existente
        const fixNegativeResult = await client.query(`UPDATE users SET escrow_blue_balance = 0 WHERE escrow_blue_balance < 0 RETURNING username`);
        if (fixNegativeResult.rowCount > 0) {
            const fixedUsers = fixNegativeResult.rows.map(r => r.username).join(', ');
            console.log(`SANEAMIENTO: Corregidos saldos de escrow negativos para los usuarios: ${fixedUsers}`);
        }

        // 2. FORTALECIMIENTO: Añadir la restricción CHECK si no existe
        const constraintCheck = await client.query(`
            SELECT 1 FROM information_schema.constraint_column_usage
            WHERE table_name = 'users' AND constraint_name = 'users_escrow_blue_balance_non_negative'
        `);
        if (constraintCheck.rowCount === 0) {
            console.log("FORTALECIMIENTO: Añadiendo restricción CHECK para escrow_blue_balance no negativo...");
            await client.query(`ALTER TABLE users ADD CONSTRAINT users_escrow_blue_balance_non_negative CHECK (escrow_blue_balance >= 0);`);
            console.log("FORTALECIMIENTO: Restricción añadida exitosamente.");
        }

        // --- MIGRACIONES PARA DECIMALES ---
        // Este bloque ahora es el único responsable de asegurar que todas las columnas
        // monetarias tengan el tipo NUMERIC(19, 4) correcto.
        const columns_to_migrate = [
            { table: 'users', column: 'liquid_blue_balance' },
            { table: 'users', column: 'escrow_blue_balance' },
            { table: 'users', column: 'red_balance' },
            { table: 'publications', column: 'blue_cost' },
            { table: 'transactions', column: 'blue_change' },
            { table: 'transactions', column: 'red_change' },
            { table: 'red_token_debts', column: 'amount' },
            { table: 'blue_token_escrows', column: 'amount' }
        ];

        for (const { table, column } of columns_to_migrate) {
            const check = await client.query(`
                SELECT data_type, numeric_precision, numeric_scale 
                FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
            `, [table, column]);

            if (check.rowCount > 0) {
                const colInfo = check.rows[0];
                const isInteger = colInfo.data_type.includes('int');
                const isWrongNumeric = colInfo.data_type === 'numeric' && (colInfo.numeric_precision !== 19 || colInfo.numeric_scale !== 4);

                if (isInteger || isWrongNumeric) {
                    console.log(`MIGRACIÓN: Cambiando tipo de la columna ${table}.${column} a NUMERIC(19, 4)...`);
                    // Usamos USING para convertir los datos existentes de forma segura.
                    await client.query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE NUMERIC(19, 4) USING ${column}::NUMERIC(19, 4);`);
                    console.log(`MIGRACIÓN: Columna ${table}.${column} migrada exitosamente.`);
                }
            }
        }

        // 2. Migrar la tabla 'users' para los nuevos balances
        const liquidBalanceCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='users' AND column_name='liquid_blue_balance'
        `);

        if (liquidBalanceCheck.rowCount === 0) {
            console.log("MIGRACIÓN: La columna 'liquid_blue_balance' no existe. Migrando 'blue_balance'...");
            const oldBalanceCheck = await client.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='blue_balance'
            `);
            if (oldBalanceCheck.rowCount > 0) {
                await client.query(`ALTER TABLE users RENAME COLUMN blue_balance TO liquid_blue_balance;`);
                console.log("MIGRACIÓN: Columna 'blue_balance' renombrada a 'liquid_blue_balance'.");
            } else {
                await client.query(`ALTER TABLE users ADD COLUMN liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0;`);
                console.log("MIGRACIÓN: Creada columna 'liquid_blue_balance' porque no se encontró ninguna versión anterior.");
            }
        }

        const escrowBalanceCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='users' AND column_name='escrow_blue_balance'
        `);

        if (escrowBalanceCheck.rowCount === 0) {
            console.log("MIGRACIÓN: La columna 'escrow_blue_balance' no existe. Añadiéndola a 'users'...");
            await client.query(`ALTER TABLE users ADD COLUMN escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0;`);
            console.log("MIGRACIÓN: Columna 'escrow_blue_balance' añadida exitosamente.");
        }

        await client.query('COMMIT'); // Finalizar transacción
        console.log("Todas las tablas han sido aseguradas en PostgreSQL.");

        // El frontend se encargará de buscar a los participantes si es necesario.
        await client.query(`
            INSERT INTO publication_acceptances (publication_id, acceptor_username) 
            SELECT p.id, u.username
            FROM publications p, users u
            WHERE p.title = 'Tarea de Prueba para Calificación' AND u.username = 'miguelchrome'
            ON CONFLICT DO NOTHING
        `);

        // --- MIGRACIÓN PARA LA REGLA DE "UNA SOLICITUD ACTIVA POR TAREA" ---
        // Esto permite que un usuario pueda volver a aceptar una tarea que ya completó.

        // 1. Eliminamos la antigua restricción UNIQUE si existe.
        const constraintName = 'publication_acceptances_publication_id_acceptor_username_key';
        await client.query(`ALTER TABLE publication_acceptances DROP CONSTRAINT IF EXISTS ${constraintName};`);

        // 2. Creamos un nuevo ÍNDICE ÚNICO PARCIAL.
        // Este índice solo se aplica a las filas que NO están 'confirmed_paid', permitiendo duplicados
        // si el estado es finalizado, pero no si está activo.
        const indexName = 'one_active_acceptance_per_user_per_pub_idx';
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS ${indexName}
            ON publication_acceptances (publication_id, acceptor_username)
            WHERE (status <> 'confirmed_paid');
        `);
        console.log("MIGRACIÓN: Regla de 'una solicitud activa por tarea' asegurada.");

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
                return res.status(400).json({ message: "Faltan datos requeridos para la publicación. Título, descripción y costo son obligatorios." });
            }
        
            const isSellPost = !!blueSell;
            const costString = (blueSell || blueCost).toString().replace(',', '.');
            const cost = parseFloat(costString);

            if (isNaN(cost) || cost <= 0) {
                return res.status(400).json({ message: "El costo o recompensa debe ser un número positivo." });
            }

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

                // Obtenemos la configuración de días para las deudas y el escrow
                const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('debt_cycle_days', 'blue_escrow_days')`);
                const settings = settingsResult.rows.reduce((acc, row) => ({...acc, [row.setting_key]: row.setting_value }), {});
                const debtCycleDays = parseInt(settings.debt_cycle_days || '30', 10);
                const blueEscrowDays = parseInt(settings.blue_escrow_days || '7', 10);

                // 2. Realizamos la lógica de transferencia de tokens y transacciones
                const insertTxSql = `INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) VALUES ($1, $2, $3, $4, $5, $6)`;
                
                if (is_sell_post) {
                    // Venta: Comprador (worker) recibe RED.
                    // ¡AQUÍ SE GENERA UNA DEUDA RED!
                    await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [cost, workerUsername]);
                    await client.query(
                        `INSERT INTO red_token_debts (username, amount, due_at) VALUES ($1, $2, NOW() + INTERVAL '${debtCycleDays} days')`,
                        [workerUsername, cost]
                    );
                    await client.query(insertTxSql, [workerUsername, 'purchase_completed', `Compraste: "${title}"`, 0, cost, pubId]);
                    
                    // Vendedor (author) recibe BLUE, pero ahora en ESCROW.
                    await client.query(`UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2`, [cost, author]);
                    await client.query(
                        `INSERT INTO blue_token_escrows (username, amount, unlock_at) VALUES ($1, $2, NOW() + INTERVAL '${blueEscrowDays} days')`,
                        [author, cost]
                    );
                    await client.query(insertTxSql, [author, 'sale_completed', `Vendiste: "${title}"`, cost, 0, pubId]);
                } else {
                    // Trabajo: Pagador (author) recibe RED.
                    // ¡AQUÍ SE GENERA UNA DEUDA RED!
                    await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [cost, author]);
                    await client.query(
                        `INSERT INTO red_token_debts (username, amount, due_at) VALUES ($1, $2, NOW() + INTERVAL '${debtCycleDays} days')`,
                        [author, cost]
                    );
                    await client.query(insertTxSql, [author, 'payment_sent', `Solicitaste: "${title}"`, 0, cost, pubId]);
                    
                    // Trabajador (worker) recibe BLUE, pero ahora en ESCROW.
                    await client.query(`UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2`, [cost, workerUsername]);
                    await client.query(
                        `INSERT INTO blue_token_escrows (username, amount, unlock_at) VALUES ($1, $2, NOW() + INTERVAL '${blueEscrowDays} days')`,
                        [workerUsername, cost]
                    );
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

// Ruta para QUEMAR tokens (RECONSTRUIDA CON LÓGICA FIFO)
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
        
        // --- 1. VALIDACIÓN RIGUROSA DE SALDOS ---
        const userBalancesResult = await client.query(
            `SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1 FOR UPDATE`,
            [username]
        );

        if (userBalancesResult.rowCount === 0) {
            throw { status: 404, message: "Usuario no encontrado." };
        }

        const user = userBalancesResult.rows[0];
        const liquidBlue = parseFloat(user.liquid_blue_balance);
        const escrowBlue = parseFloat(user.escrow_blue_balance);
        const totalBlueAvailable = liquidBlue + escrowBlue;
        const totalRed = parseFloat(user.red_balance);

        if (totalBlueAvailable < amountToBurn) {
            throw { status: 400, message: `No tienes suficientes tokens BLUE para quemar ${amountToBurn}. Tienes un total de ${totalBlueAvailable.toFixed(4)} (disponibles + pendientes).` };
        }
        if (totalRed < amountToBurn) {
            throw { status: 400, message: `No tienes suficientes tokens RED para quemar ${amountToBurn}. Tienes ${totalRed.toFixed(4)}.` };
        }

        // --- 2. DEDUCCIÓN ATÓMICA DE BLUE (LÍQUIDO PRIMERO) ---
        const burnedFromLiquid = Math.min(amountToBurn, liquidBlue);
        const burnedFromEscrow = amountToBurn - burnedFromLiquid;

        // --- 3. SALDADO DE DEUDAS RED (LÓGICA FIFO) ---
        const debtsResult = await client.query(
            `SELECT id, amount FROM red_token_debts WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC FOR UPDATE`,
            [username]
        );
        const debts = debtsResult.rows;

        let remainingToSettle = amountToBurn;
        for (const debt of debts) {
            if (remainingToSettle <= 0) break;

            const amountFromThisDebt = Math.min(remainingToSettle, parseFloat(debt.amount));
            const newDebtAmount = parseFloat(debt.amount) - amountFromThisDebt;
            
            if (newDebtAmount < 0.0001) { // Si la deuda se salda por completo...
                // LA CORRECCIÓN: En lugar de actualizar a 0, eliminamos el registro.
                await client.query(`DELETE FROM red_token_debts WHERE id = $1`, [debt.id]);
            } else {
                await client.query(`UPDATE red_token_debts SET amount = $1 WHERE id = $2`, [newDebtAmount, debt.id]);
            }
            remainingToSettle -= amountFromThisDebt;
        }

        // --- 3.5. CONSUMO DE LOTES DE ESCROW (LÓGICA FIFO) ---
        if (burnedFromEscrow > 0.0001) {
            const escrowLotsResult = await client.query(
                `SELECT id, amount FROM blue_token_escrows WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC FOR UPDATE`,
                [username]
            );
            const escrowLots = escrowLotsResult.rows;

            let remainingToConsumeFromEscrow = burnedFromEscrow;
            for (const escrowLot of escrowLots) {
                if (remainingToConsumeFromEscrow <= 0) break;

                const amountFromThisLot = Math.min(remainingToConsumeFromEscrow, parseFloat(escrowLot.amount));
                const newEscrowLotAmount = parseFloat(escrowLot.amount) - amountFromThisLot;

                if (newEscrowLotAmount < 0.0001) { // Si el lote de escrow se consume por completo...
                    await client.query(`DELETE FROM blue_token_escrows WHERE id = $1`, [escrowLot.id]);
                } else {
                    await client.query(`UPDATE blue_token_escrows SET amount = $1 WHERE id = $2`, [newEscrowLotAmount, escrowLot.id]);
                }
                remainingToConsumeFromEscrow -= amountFromThisLot;
            }
        }

        // --- 4. ACTUALIZACIÓN FINAL DE SALDOS DEL USUARIO ---
        await client.query(
            `UPDATE users 
             SET liquid_blue_balance = liquid_blue_balance - $1,
                 escrow_blue_balance = escrow_blue_balance - $2, 
                 red_balance = red_balance - $3 
             WHERE username = $4`,
            [burnedFromLiquid, burnedFromEscrow, amountToBurn, username]
        );
        
        // --- 5. REGISTRO DE TRANSACCIÓN ---
        const burnDesc = `Quemaste ${amountToBurn.toFixed(4)} tokens. Se usaron ${burnedFromLiquid.toFixed(4)} BLUE (disponible) y ${burnedFromEscrow.toFixed(4)} BLUE (pendiente).`;
        await client.query(
            `INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'burn', $2, $3, $4)`,
            [username, burnDesc, -amountToBurn, -amountToBurn]
        );

        await client.query('COMMIT');
        res.json({ message: `Se han quemado ${amountToBurn.toFixed(4)} tokens exitosamente. Tu saldo ha sido actualizado.` });

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
            
            const client = await pool.connect();
            try {
                const userSql = `SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1`;
                
                // Query for next RED debt
                const debtSql = `
                    SELECT due_at, amount
                    FROM red_token_debts 
                    WHERE username = $1 AND is_settled = FALSE 
                    ORDER BY due_at ASC 
                    LIMIT 1
                `;

                // Query for next BLUE escrow release, AHORA TAMBIÉN INCLUYE LA CANTIDAD
                const escrowSql = `
                    SELECT unlock_at, amount
                    FROM blue_token_escrows
                    WHERE username = $1 AND is_released = FALSE
                    ORDER BY unlock_at ASC
                    LIMIT 1
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
                    next_due_amount: debtResult.rows[0]?.amount || null, // <-- AÑADIDO
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

        // Ruta de ADMIN para obtener la lista de usuarios (con búsqueda)
        app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
            const { search = '' } = req.query; // Default a string vacío si no hay búsqueda
            
            try {
                // Seleccionamos solo los datos que son seguros y útiles para el administrador.
                // NUNCA exponemos el hash de la contraseña.
                const sql = `
                    SELECT 
                        id, 
                        username, 
                        liquid_blue_balance, 
                        escrow_blue_balance,
                        red_balance, 
                        average_rating, 
                        ratings_count,
                        created_at
                    FROM users
                    WHERE username ILIKE $1  -- ILIKE es como LIKE pero insensible a mayúsculas/minúsculas
                    ORDER BY created_at DESC
                `;
                // El comodín '%' permite buscar cualquier usuario que contenga el término de búsqueda.
                const searchTerm = `%${search}%`;
                const result = await pool.query(sql, [searchTerm]);
                
                res.status(200).json(result.rows);

            } catch (error) {
                console.error("Error al obtener la lista de usuarios:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta de ADMIN para obtener la lista de DEUDORES (NUEVA)
        app.get('/api/admin/debtors', verifyAdminToken, async (req, res) => {
            try {
                // Sumamos todas las deudas penalizadas por usuario para tener un total.
                const sql = `
                    SELECT 
                        username, 
                        SUM(amount) AS total_penalized_debt,
                        COUNT(*) AS penalized_debts_count
                    FROM red_token_debts
                    WHERE is_penalized = TRUE AND is_settled = FALSE
                    GROUP BY username
                    ORDER BY total_penalized_debt DESC
                `;
                const result = await pool.query(sql);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener la lista de deudores:", error);
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
                    client.query('SELECT SUM(liquid_blue_balance + escrow_blue_balance) AS total_blue, SUM(red_balance) AS total_red FROM users')
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

        // --- PROCESO AUTOMÁTICO DE VENCIMIENTO DE DEUDAS (RECOLECTOR) ---
        // Se ejecuta cada 5 minutos
        const DEBT_COLLECTOR_INTERVAL_MS = 5 * 60 * 1000; 

        setInterval(async () => {
            // Esta es la función principal del recolector de deudas
            const client = await pool.connect();
            try {
                const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'debt_system_enabled'`);
                const isEnabled = settingsResult.rows[0]?.setting_value === 'true';

                if (!isEnabled) {
                    return;
                }

                console.log('[Debt Collector] Iniciando ciclo de revisión de deudas vencidas...');
                
                await client.query('BEGIN');

                const overdueDebtsResult = await client.query(`
                    SELECT id, username, amount 
                    FROM red_token_debts
                    WHERE due_at <= NOW() AND is_settled = FALSE AND is_penalized = FALSE
                    ORDER BY username, due_at ASC
                `);

                if (overdueDebtsResult.rowCount === 0) {
                    console.log('[Debt Collector] No se encontraron deudas vencidas. Ciclo finalizado.');
                    await client.query('COMMIT');
                    return;
                }
                
                let currentUser = null;
                let userBalances = {};

                for (const debt of overdueDebtsResult.rows) {
                    if (currentUser !== debt.username) {
                        if (currentUser) {
                            await client.query('UPDATE users SET liquid_blue_balance = $1, red_balance = $2 WHERE username = $3', [userBalances.blue, userBalances.red, currentUser]);
                        }
                        currentUser = debt.username;
                        const userResult = await client.query('SELECT liquid_blue_balance, red_balance FROM users WHERE username = $1 FOR UPDATE', [currentUser]);
                        userBalances = { blue: userResult.rows[0].liquid_blue_balance, red: userResult.rows[0].red_balance };
                        console.log(`[Debt Collector] Procesando a ${currentUser} con ${userBalances.blue} BLUE y ${userBalances.red} RED.`);
                    }

                    const debtAmount = debt.amount;
                    if (userBalances.blue >= debtAmount) {
                        // Caso A: Pago completo
                        userBalances.blue -= debtAmount;
                        userBalances.red -= debtAmount;
                        await client.query('UPDATE red_token_debts SET is_settled = TRUE WHERE id = $1', [debt.id]);
                        const desc = `Cobro automático por deuda vencida de ${debtAmount} tokens.`;
                        await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'auto_burn', $2, $3, $4)`, [currentUser, desc, -debtAmount, -debtAmount]);
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [currentUser, `Se ha realizado un cobro automático de ${debtAmount} tokens por una deuda vencida.`]);
                    } else {
                        // Caso B: Penalización
                        const amountToBurn = userBalances.blue;
                        const remainingDebt = debtAmount - amountToBurn;
                        userBalances.red -= amountToBurn;
                        userBalances.blue = 0;
                        await client.query('UPDATE red_token_debts SET is_penalized = TRUE, amount = $1 WHERE id = $2', [remainingDebt, debt.id]);
                        const desc = `Penalización por deuda vencida. Se quemaron ${amountToBurn} de ${debtAmount}.`;
                        await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'penalty', $2, $3, $4)`, [currentUser, desc, -amountToBurn, -amountToBurn]);
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [currentUser, `¡ATENCIÓN! No tenías suficientes BLUE para cubrir una deuda de ${debtAmount}. Has sido penalizado con ${remainingDebt} RED.`]);
                    }
                }

                if (currentUser) {
                    await client.query('UPDATE users SET liquid_blue_balance = $1, red_balance = $2 WHERE username = $3', [userBalances.blue, userBalances.red, currentUser]);
                }

                await client.query('COMMIT');
                console.log(`[Debt Collector] Ciclo finalizado. Se procesaron ${overdueDebtsResult.rowCount} deudas.`);

            } catch (error) {
                console.error('[Debt Collector] Error durante el ciclo de revisión, revirtiendo cambios:', error);
                await client.query('ROLLBACK');
            } finally {
                if (client) client.release();
            }
        }, DEBT_COLLECTOR_INTERVAL_MS);

        // --- PROCESO AUTOMÁTICO DE LIBERACIÓN DE TOKENS (LIBERADOR) ---
        // Se ejecuta cada 4 minutos para no solaparse exactamente con el colector
        const TOKEN_RELEASER_INTERVAL_MS = 4 * 60 * 1000;

        setInterval(async () => {
            const client = await pool.connect();
            try {
                console.log('[Token Releaser] Iniciando ciclo de liberación de tokens BLUE en escrow...');
                await client.query('BEGIN');

                // 1. Encontrar todos los escrows listos para ser liberados y bloquearlos para la transacción
                const releasableEscrowsResult = await client.query(`
                    SELECT id, username, amount
                    FROM blue_token_escrows
                    WHERE unlock_at <= NOW() AND is_released = FALSE
                    FOR UPDATE
                `);
                
                const escrows = releasableEscrowsResult.rows;

                if (escrows.length === 0) {
                    console.log('[Token Releaser] No se encontraron tokens para liberar. Ciclo finalizado.');
                    await client.query('COMMIT');
                    return;
                }

                // 2. Agregar los montos por usuario para eficiencia
                const userUpdateMap = new Map();
                for (const escrow of escrows) {
                    const currentAmount = userUpdateMap.get(escrow.username) || 0;
                    userUpdateMap.set(escrow.username, currentAmount + escrow.amount);
                }

                // 3. Actualizar balances, notificaciones y transacciones por cada usuario
                for (const [username, totalAmount] of userUpdateMap.entries()) {
                    // Mover los tokens de escrow a líquido
                    await client.query(
                        `UPDATE users 
                         SET liquid_blue_balance = liquid_blue_balance + $1, 
                             escrow_blue_balance = GREATEST(0, escrow_blue_balance - $1)
                         WHERE username = $2`,
                        [totalAmount, username]
                    );

                    // Registrar la transacción
                    const desc = `Se liberaron ${totalAmount} BLUE de tu saldo pendiente.`;
                    await client.query(
                        `INSERT INTO transactions (username, type, description, blue_change) VALUES ($1, 'escrow_release', $2, $3)`,
                        [username, desc, totalAmount]
                    );
                    
                    // Notificar al usuario
                    await client.query(
                        `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                        [username, `¡Buenas noticias! ${desc}`]
                    );
                    console.log(`[Token Releaser] Liberados ${totalAmount} BLUE para el usuario ${username}.`);
                }

                // 4. Marcar todos los escrows procesados como liberados
                const escrowIds = escrows.map(e => e.id);
                await client.query(
                    `UPDATE blue_token_escrows SET is_released = TRUE WHERE id = ANY($1::int[])`,
                    [escrowIds]
                );

                await client.query('COMMIT');
                console.log(`[Token Releaser] Ciclo finalizado. Se procesaron ${escrows.length} registros de escrow para ${userUpdateMap.size} usuarios.`);

            } catch (error) {
                console.error('[Token Releaser] Error durante el ciclo de liberación, revirtiendo cambios:', error);
                await client.query('ROLLBACK');
            } finally {
                if (client) client.release();
            }
        }, TOKEN_RELEASER_INTERVAL_MS);

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