/**
 * backend/migrations/064_add_missing_schema_columns.js
 * 
 * PROPÓSITO: Agregar columnas de esquema faltantes requeridas por el backend 
 * (encontradas en parches de demo pero no integradas en el flujo oficial),
 * crear la tabla de auditoría "balance_events" y la función almacenada "record_balance_event"
 * con control de inmutabilidad (Append-Only) para cumplir estándares bancarios y SOC 2.
 * 
 * TABLAS AFECTADAS:
 * - publications (Adición de columnas de expiración, borrado lógico y quick sale)
 * - users (Adición de columnas de tutoría/menores, estado de cuenta y booster)
 * - balance_events (Nueva tabla de auditoría contable/Event Sourcing)
 * 
 * COMPLIANCE: Mantiene la consistencia del esquema de producción y desarrollo local,
 * garantizando la paridad de entornos y la trazabilidad de cambios (SOC 2, FinTech, AML).
 */

'use strict';

exports.up = async (client) => {
    // 1. Columnas necesarias para control de expiración, borrado lógico y ventas rápidas en publicaciones
    console.log('[MIGRATION 064] Añadiendo columnas faltantes a la tabla "publications"...');
    await client.query(`
        ALTER TABLE publications
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS deleted_by_username VARCHAR(255),
        ADD COLUMN IF NOT EXISTS is_quick_sale BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS target_username VARCHAR(255);
    `);

    // 2. Columnas necesarias para control de menores de edad (tutoría), estado de cuenta, referidos y perfil de impulsor (booster)
    console.log('[MIGRATION 064] Añadiendo columnas faltantes a la tabla "users"...');
    await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS tutor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS referrer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS is_booster BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS booster_level INTEGER DEFAULT 1;
    `);

    // Crear índice para optimizar consultas de referidos en scoring
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
    `);

    // 3. Crear tabla balance_events para el registro inmutable de transacciones (Event Sourcing)
    // Se definen los tipos de datos siguiendo estándares estrictos de precisión contable y financiera (NUMERIC 19, 4)
    console.log('[MIGRATION 064] Creando tabla de auditoría "balance_events" (Event Sourcing)...');
    await client.query(`
        CREATE TABLE IF NOT EXISTS balance_events (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            event_type VARCHAR(100) NOT NULL,
            balance_type VARCHAR(100) NOT NULL,
            amount NUMERIC(19, 4) NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 4. Crear índices de optimización para asegurar tiempos de respuesta rápidos y evitar table scans en auditorías masivas
    console.log('[MIGRATION 064] Creando índices de optimización para "balance_events"...');
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_balance_events_user_id ON balance_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_balance_events_balance_type ON balance_events(balance_type);
        CREATE INDEX IF NOT EXISTS idx_balance_events_created_at ON balance_events(created_at);
    `);

    // 5. Proteger la tabla contra actualizaciones y eliminaciones físicas (SOC 2, Auditoría Bancaria)
    // El trigger prevent_ledger_mutation() (creado en la migración 063) aborta cualquier intento de UPDATE o DELETE
    console.log('[MIGRATION 064] Aplicando trigger de inmutabilidad (Append-Only) en "balance_events"...');
    await client.query(`DROP TRIGGER IF EXISTS trg_prevent_mutation_balance_events ON balance_events;`);
    await client.query(`
        CREATE TRIGGER trg_prevent_mutation_balance_events
        BEFORE UPDATE OR DELETE ON balance_events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_ledger_mutation();
    `);

    // 6. Crear la función almacenada "record_balance_event" para actualizar balances y registrar eventos en una sola transacción
    // Cumple con el estándar de atomicidad de base de datos e integridad contable (sin riesgo de condiciones de carrera)
    console.log('[MIGRATION 064] Creando función almacenada "record_balance_event"...');
    await client.query(`
        CREATE OR REPLACE FUNCTION record_balance_event(
            p_user_id INTEGER,
            p_event_type VARCHAR,
            p_balance_type VARCHAR,
            p_amount NUMERIC,
            p_metadata JSONB
        )
        RETURNS VOID AS $$
        DECLARE
            v_adjustment NUMERIC(19, 4);
            v_column_name TEXT;
            v_sql TEXT;
        BEGIN
            -- Determinar el signo del ajuste según el tipo de evento
            -- Los eventos de depósito, crédito, reembolso y recepción de pagos incrementan el balance
            IF p_event_type IN ('deposit', 'credit', 'payment_received', 'refund', 'reversal_deposit') THEN
                v_adjustment := p_amount;
            -- Los eventos de retiro, envío de pagos, cargos y penalidades disminuyen el balance
            ELSIF p_event_type IN ('withdrawal', 'payment_sent', 'charge', 'penalty', 'reversal_withdrawal') THEN
                v_adjustment := -p_amount;
            ELSE
                -- Por defecto, si no se reconoce el tipo de evento, usar el signo del amount proporcionado
                v_adjustment := p_amount;
            END IF;

            -- Validar y mapear el tipo de balance a su respectiva columna en la tabla de usuarios
            IF p_balance_type = 'liquid_blue' THEN
                v_column_name := 'liquid_blue_balance';
            ELSIF p_balance_type = 'escrow_blue' THEN
                v_column_name := 'escrow_blue_balance';
            ELSIF p_balance_type = 'red' THEN
                v_column_name := 'red_balance';
            ELSE
                RAISE EXCEPTION 'Tipo de balance no válido: %', p_balance_type;
            END IF;
            
            -- Actualizar el saldo del usuario correspondiente en la base de datos
            v_sql := format('UPDATE users SET %I = COALESCE(%I, 0) + $1 WHERE id = $2', v_column_name, v_column_name);
            EXECUTE v_sql USING v_adjustment, p_user_id;

            -- Registrar el evento en la tabla balance_events (garantiza trazabilidad completa 100% auditable)
            INSERT INTO balance_events (user_id, event_type, balance_type, amount, metadata, created_at)
            VALUES (p_user_id, p_event_type, p_balance_type, p_amount, p_metadata, CURRENT_TIMESTAMP);
            
        END;
        $$ LANGUAGE plpgsql;
    `);

    console.log('[MIGRATION 064] ✅ Columnas, tablas, índices y funciones creados con éxito.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 064] Revirtiendo trigger y función de "balance_events"...');
    // Eliminar primero el trigger y la función asociada
    await client.query(`DROP TRIGGER IF EXISTS trg_prevent_mutation_balance_events ON balance_events;`);
    await client.query(`DROP FUNCTION IF EXISTS record_balance_event(INTEGER, VARCHAR, VARCHAR, NUMERIC, JSONB);`);

    console.log('[MIGRATION 064] Revirtiendo tabla "balance_events" e índices...');
    // Eliminar la tabla en cascada
    await client.query(`DROP TABLE IF EXISTS balance_events CASCADE;`);

    console.log('[MIGRATION 064] Revirtiendo columnas añadidas en publications...');
    // Remover las columnas agregadas a publications
    await client.query(`
        ALTER TABLE publications
        DROP COLUMN IF EXISTS expires_at,
        DROP COLUMN IF EXISTS deleted_at,
        DROP COLUMN IF EXISTS deleted_by_username,
        DROP COLUMN IF EXISTS is_quick_sale,
        DROP COLUMN IF EXISTS target_username;
    `);

    console.log('[MIGRATION 064] Revirtiendo columnas añadidas en users...');
    // Eliminar índice de referidos
    await client.query(`DROP INDEX IF EXISTS idx_users_referrer_id;`);
    // Remover las columnas y referencias agregadas a users
    await client.query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS is_minor,
        DROP COLUMN IF EXISTS tutor_user_id,
        DROP COLUMN IF EXISTS account_status,
        DROP COLUMN IF EXISTS referrer_id,
        DROP COLUMN IF EXISTS is_booster,
        DROP COLUMN IF EXISTS booster_level;
    `);
    console.log('[MIGRATION 064] Reversión finalizada.');
};
