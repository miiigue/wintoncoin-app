// ============================================================================
// MIGRACIÓN 038: Sistema de Causas Solidarias (Winton Solidario)
// ============================================================================
// Crea la tabla humanitarian_causes para que los usuarios puedan postularse
// para recibir donaciones de sus referidos a través de WintonCoin Solidario.
//
// Formato: module.exports = { up, down } — Compatible con migrationRunner.js
// El runner maneja BEGIN/COMMIT/ROLLBACK automáticamente.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 038] Creando tabla humanitarian_causes...');

        // Tabla principal de causas humanitarias
        await client.query(`
            CREATE TABLE IF NOT EXISTS humanitarian_causes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                title VARCHAR(255) NOT NULL,
                story TEXT NOT NULL,
                goal_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
                current_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, completed
                evidence_urls JSONB DEFAULT '[]',      -- URLs de documentos de respaldo
                admin_notes TEXT,                       -- Notas del administrador al revisar
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Índices para búsquedas rápidas por usuario y estado
        await client.query('CREATE INDEX IF NOT EXISTS idx_humanitarian_user ON humanitarian_causes(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_humanitarian_status ON humanitarian_causes(status)');

        console.log('[MIGRATION 038] ✅ Tabla humanitarian_causes creada exitosamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 038] Revirtiendo tabla humanitarian_causes...');
        await client.query('DROP TABLE IF EXISTS humanitarian_causes CASCADE;');
        console.log('[MIGRATION 038] ✅ Tabla eliminada.');
    }
};
