'use strict';

const pool = require('../config/db');

/**
 * Agrega un tutor legal a una cuenta de menor de edad.
 */
async function addTutor(req, res) {
    const { minorUsername, tutorUsernameOrEmail } = req.body;

    if (!minorUsername || !tutorUsernameOrEmail) {
        return res.status(400).json({ message: "Se requiere el nombre de usuario del menor y el usuario o email del tutor." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verificar que el menor existe y es realmente menor
        const minorResult = await client.query(
            "SELECT id, username, is_minor, tutor_user_id, account_status FROM users WHERE username = $1",
            [minorUsername]
        );

        if (minorResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Usuario menor no encontrado." });
        }

        const minor = minorResult.rows[0];

        if (!minor.is_minor) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Este usuario no es menor de edad." });
        }

        if (minor.tutor_user_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Este usuario ya tiene un tutor asignado." });
        }

        // 2. Buscar el tutor por username o email
        const tutorResult = await client.query(
            "SELECT id, username, email FROM users WHERE username = $1 OR email = $2",
            [tutorUsernameOrEmail, tutorUsernameOrEmail]
        );

        if (tutorResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Tutor no encontrado. El tutor debe tener una cuenta activa en WintonCoin." });
        }

        const tutor = tutorResult.rows[0];

        // 3. Verificar que el tutor no es el mismo que el menor
        if (tutor.id === minor.id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "No puedes ser tu propio tutor." });
        }

        // 4. Verificar que el tutor no es menor
        const tutorIsMinorResult = await client.query(
            "SELECT is_minor FROM users WHERE id = $1",
            [tutor.id]
        );

        if (tutorIsMinorResult.rows[0].is_minor) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "El tutor no puede ser menor de edad." });
        }

        // 5. Asignar tutor al menor
        await client.query(
            "UPDATE users SET tutor_user_id = $1, account_status = 'active' WHERE id = $2",
            [tutor.id, minor.id]
        );

        // 6. Crear notificación para el tutor
        await client.query(
            "INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)",
            [tutor.username, "Has sido asignado como tutor responsable de la cuenta de " + minor.username + ". Serás responsable de todas las obligaciones financieras generadas por esta cuenta."]
        );

        // 7. Crear notificación para el menor
        await client.query(
            "INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)",
            [minor.username, "Tu cuenta ha sido activada con " + tutor.username + " como tutor responsable. Ahora puedes realizar transacciones en la plataforma."]
        );

        await client.query('COMMIT');
        res.status(200).json({
            message: "Tutor agregado exitosamente. " + tutor.username + " es ahora responsable de tu cuenta.",
            tutor_username: tutor.username
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al agregar tutor:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

module.exports = {
    addTutor
};
