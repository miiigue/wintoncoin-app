/**
 * Migración 043: Sistema de Reclutamiento Profesional
 * Crea la tabla de postulaciones con estándares de auditoría bancaria.
 */

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 043] Creando tabla de reclutamiento recruitment_proposals...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS recruitment_proposals (
                id                  SERIAL PRIMARY KEY,
                user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
                full_name           VARCHAR(255) NOT NULL,
                email               VARCHAR(255) NOT NULL,
                linkedin_url        VARCHAR(255),
                role                VARCHAR(100) NOT NULL,
                cv_filename         VARCHAR(255) NOT NULL,
                status              VARCHAR(50) DEFAULT 'pending'
                                        CHECK (status IN ('pending', 'reviewed', 'interview', 'hired', 'rejected')),
                multiplier_applied  DECIMAL(10, 2) DEFAULT 15.00,
                ip_address          VARCHAR(45),
                user_agent          TEXT,
                created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Índices de auditoría y rendimiento
            CREATE INDEX IF NOT EXISTS idx_recruitment_email ON recruitment_proposals(email);
            CREATE INDEX IF NOT EXISTS idx_recruitment_status ON recruitment_proposals(status);
            CREATE INDEX IF NOT EXISTS idx_recruitment_created ON recruitment_proposals(created_at);
        `);

        console.log('[MIGRATION 043] ✅ Tabla recruitment_proposals creada con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 043] Revirtiendo sistema de reclutamiento...');
        await client.query('DROP TABLE IF EXISTS recruitment_proposals CASCADE;');
        console.log('[MIGRATION 043] ✅ Estructura eliminada.');
    }
};
