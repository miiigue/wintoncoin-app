// ============================================================================
// MIGRACIÓN 089: Columnas de Email y OTP para Administradores
// ============================================================================
// Propósito: Añadir campos necesarios para habilitar notificaciones transaccionales
//            y Step-Up Authentication (OTP) en el cambio de contraseña de admin,
//            manteniendo estricta segregación de privilegios (SOC 2).
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 089] Añadiendo columnas de seguridad (email, OTP) a admin_users...');
        
        // 1. Añadir columnas
        await client.query(`
            ALTER TABLE admin_users 
            ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
            ADD COLUMN IF NOT EXISTS password_change_hash VARCHAR(255),
            ADD COLUMN IF NOT EXISTS password_change_expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS password_change_attempts INTEGER DEFAULT 0 NOT NULL;
        `);
        
        console.log('[MIGRATION 089] ✅ Columnas añadidas correctamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 089] Revirtiendo columnas de seguridad en admin_users...');
        
        await client.query(`
            ALTER TABLE admin_users 
            DROP COLUMN IF EXISTS email,
            DROP COLUMN IF EXISTS password_change_hash,
            DROP COLUMN IF EXISTS password_change_expires_at,
            DROP COLUMN IF EXISTS password_change_attempts;
        `);
        
        console.log('[MIGRATION 089] ✅ Reversión completada.');
    }
};
