/**
 * backend/migrations/066_add_minor_fields_to_pending_verifications.js
 * 
 * PROPÓSITO: Agregar las columnas necesarias de fecha de nacimiento y control de menores
 * a la tabla "pending_verifications", corrigiendo el fallo del flujo de registro local y
 * garantizando la consistencia en el almacenamiento de datos OTP pre-verificación.
 * 
 * TABLAS AFECTADAS:
 * - pending_verifications (Adición de date_of_birth e is_minor)
 * 
 * COMPLIANCE: Cumplimiento contractual legal (GDPR / COPPA) y consistencia de esquema.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 066] ⚙️ Añadiendo columnas de menores de edad a "pending_verifications"...');
    
    await client.query(`
        ALTER TABLE pending_verifications
        ADD COLUMN IF NOT EXISTS date_of_birth DATE,
        ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT FALSE;
    `);
    
    console.log('[MIGRATION 066] ✅ Columnas añadidas a "pending_verifications" con éxito.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 066] Revirtiendo columnas de menores en "pending_verifications"...');
    
    await client.query(`
        ALTER TABLE pending_verifications
        DROP COLUMN IF EXISTS date_of_birth,
        DROP COLUMN IF EXISTS is_minor;
    `);
    
    console.log('[MIGRATION 066] Reversión de esquema finalizada.');
};
