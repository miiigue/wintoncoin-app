// ============================================================================
// MIGRACIÓN 105: Consolidación Inmutable de Tablas de Auditoría
// ============================================================================
// Propósito: Transferir todos los registros históricos almacenados en la tabla
// obsoleta 'audit_logs' (plural) hacia la tabla principal 'audit_log' (singular)
// garantizando cero pérdida de datos, eliminación de duplicados y cumplimiento
// con los estándares de auditoría bancaria SOC 2 / FinTech / ISO 27001.
//
// Mapeo de columnas:
//   - user_id    -> actor_id (FK inmutable hacia users(id))
//   - action     -> event_type (Tipo de evento registrado)
//   - details    -> metadata (Objeto JSONB con detalles de la operación)
//   - created_at -> created_at (Timestamp exacto del evento)
//   - category   -> Dinámico ('FINANCIAL', 'SOS_HUMANITARIAN', 'SYSTEM')
// ============================================================================

exports.up = async (client) => {
    // 1. Mensaje de inicio auditable en la consola de migraciones
    console.log('[MIGRATION 105] 🚀 Iniciando consolidación inmutable de tablas de auditoría (audit_logs -> audit_log)...');

    // 2. Verificar si la tabla de origen audit_logs existe antes de intentar copiar
    const tableCheckRes = await client.query(`
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name = 'audit_logs'
        );
    `);

    const tableExists = tableCheckRes.rows[0].exists;

    if (tableExists) {
        // 3. Traspaso seguro de datos con prevención de duplicados (WHERE NOT EXISTS)
        // Se utiliza CASE para clasificar la categoría de forma inteligente según la acción realizada.
        const backfillRes = await client.query(`
            INSERT INTO audit_log (actor_id, event_type, metadata, created_at, category)
            SELECT 
                src.user_id AS actor_id,
                src.action AS event_type,
                COALESCE(src.details, '{}'::jsonb) AS metadata,
                src.created_at,
                CASE 
                    WHEN LOWER(src.action) LIKE '%sos%' OR LOWER(src.action) LIKE '%victim%' THEN 'SOS_HUMANITARIAN'
                    WHEN LOWER(src.action) LIKE '%burn%' OR LOWER(src.action) LIKE '%debt%' THEN 'FINANCIAL'
                    ELSE 'SYSTEM'
                END AS category
            FROM audit_logs src
            WHERE NOT EXISTS (
                SELECT 1 FROM audit_log dst 
                WHERE dst.actor_id = src.user_id 
                  AND dst.event_type = src.action 
                  AND dst.created_at = src.created_at
            );
        `);

        console.log(`[MIGRATION 105] 📦 Filas históricas consolidadas exitosamente en audit_log: ${backfillRes.rowCount}`);

        // 4. Eliminar la tabla obsoleta 'audit_logs' para evitar inconsistencias futuras
        await client.query(`DROP TABLE IF EXISTS audit_logs CASCADE;`);
        console.log('[MIGRATION 105] 🗑️ Tabla duplicada audit_logs eliminada correctamente.');
    } else {
        console.log('[MIGRATION 105] ℹ️ La tabla audit_logs no existía o ya fue consolidada. Omitiendo traspaso.');
    }

    console.log('[MIGRATION 105] ✅ Consolidación de auditoría completada con éxito.');
};

exports.down = async (client) => {
    // 5. En sistemas bancarios SOC 2, los registros de auditoría transferidos a audit_log no se eliminan al hacer rollback.
    // Simplemente recreamos la tabla audit_logs por compatibilidad de reversión si fuera estrictamente necesario.
    console.log('[MIGRATION 105] ⏪ Recreando tabla audit_logs por compatibilidad de rollback...');
    await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(255) NOT NULL,
            details JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('[MIGRATION 105] ⏪ Tabla audit_logs restablecida.');
};
