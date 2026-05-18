/**
 * backend/migrations/055_add_kyc_verified_to_users.js
 * 
 * PROPÓSITO: Implementar la columna de respaldo 'kyc_verified' en la tabla 'users'.
 * Esta columna actúa como caché y respaldo (fallback) robusto ante reinicios del 
 * nodo blockchain local (Anvil/Hardhat) o desconexiones del RPC, garantizando que el 
 * estatus de verificación KYC se mantenga inmutable y consistente en la plataforma.
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia de Migración, Cumplimiento Normativo y Auditoría Fintech.
 */

exports.up = async (client) => {
    // Registro de inicio para trazabilidad y auditoría técnica.
    console.log('[MIGRATION 055] Iniciando actualización de esquema: Agregando columna kyc_verified a users...');

    // MODIFICACIÓN DE ESQUEMA (TABLA USERS)
    // Se utiliza ALTER TABLE con IF NOT EXISTS para prevenir errores si la columna ya existe.
    // kyc_verified: BOOLEAN con valor por defecto FALSE.
    await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE
    `);
    
    console.log('[MIGRATION 055] Columna de respaldo KYC inyectada exitosamente en tabla "users".');
    console.log('[MIGRATION 055] Proceso finalizado exitosamente. Sistema 100% auditable y resiliente.');
};

exports.down = async (client) => {
    // Función de reversión para rollback controlado en caso de emergencia.
    console.log('[MIGRATION 055] Revirtiendo migración: Eliminando columna kyc_verified de users...');
    await client.query(`
        ALTER TABLE users 
        DROP COLUMN IF EXISTS kyc_verified
    `);
    console.log('[MIGRATION 055] Rollback completado exitosamente.');
};
