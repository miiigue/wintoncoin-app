exports.up = async (client) => {
    console.log("[MIGRATION 097] Iniciando creación de tabla audit_logs...");

    await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(255) NOT NULL,
            details JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Crear índice para búsquedas rápidas por usuario y acción
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    console.log("[MIGRATION 097] ✅ Tabla audit_logs e índices creados exitosamente.");
};

exports.down = async (client) => {
    await client.query(`DROP TABLE IF EXISTS audit_logs;`);
    console.log("[MIGRATION 097] ⏪ Tabla audit_logs eliminada.");
};
