// ============================================================================
// MIGRACIÓN 029: Sistema Winton Momentum
// ============================================================================
// Crea las tablas necesarias para el módulo de gestión de influencers.
// Las tablas usan el prefijo 'momentum_' para aislamiento del sistema principal.
//
// Tablas creadas:
//   - momentum_profiles:      Perfiles de influencer (tier, red social, etc.)
//   - momentum_global_config: Configuración global (multiplicador, cupos, fase)
//   - momentum_campaigns:     Campañas/tareas con precios por tier
//   - momentum_submissions:   Entregas de tareas con flujo de aprobación
//
// NOTA: Los saldos de BLUE IOU se registran en booster_blue_ledger (existente).
// ============================================================================

const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationLogic = async (client) => {
    console.log('[MIGRATION 029] Creando esquema del sistema Winton Momentum...');

    // -------------------------------------------------------------------------
    // TABLA 1: momentum_profiles
    // -------------------------------------------------------------------------
    // Almacena los datos específicos de cada influencer.
    // Vinculada a la tabla 'users' principal para reutilizar autenticación.
    // El tier determina qué campañas puede ver y su pago base.
    // -------------------------------------------------------------------------
    await client.query(`
        CREATE TABLE IF NOT EXISTS momentum_profiles (
            id SERIAL PRIMARY KEY,

            -- Vínculo con la cuenta de usuario de WintonCoin
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

            -- Datos del perfil de influencer
            nickname VARCHAR(100) NOT NULL,
            social_platform VARCHAR(50) NOT NULL,
            social_link VARCHAR(500) NOT NULL,
            social_screenshot_url VARCHAR(500),
            followers_count INTEGER DEFAULT 0,
            niche VARCHAR(100),

            -- Sistema de Tiers: PENDIENTE → BRONCE → PLATA → ORO
            -- PENDIENTE: recién aplicó, espera revisión del Admin
            -- BRONCE/PLATA/ORO: activado, puede ver campañas de su nivel e inferiores
            tier VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
                CHECK (tier IN ('PENDIENTE', 'BRONCE', 'PLATA', 'ORO')),

            -- Notas internas del admin (no visibles para el influencer)
            admin_notes TEXT,

            -- Estado del perfil (para suspensiones sin borrar datos)
            status VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended')),

            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Índice para búsquedas frecuentes por tier y estado
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_momentum_profiles_tier
        ON momentum_profiles(tier)
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_momentum_profiles_status
        ON momentum_profiles(status)
    `);

    console.log('[MIGRATION 029] ✅ Tabla momentum_profiles creada.');

    // -------------------------------------------------------------------------
    // TABLA 2: momentum_global_config
    // -------------------------------------------------------------------------
    // Tabla singleton (solo 1 fila, id=1) con la configuración global.
    // El multiplicador se aplica a todas las campañas: pago_final = base × mult.
    // Los cupos controlan la barra de FOMO en la landing.
    // -------------------------------------------------------------------------
    await client.query(`
        CREATE TABLE IF NOT EXISTS momentum_global_config (
            id INTEGER PRIMARY KEY DEFAULT 1
                CHECK (id = 1),  -- Garantiza que solo haya 1 fila (singleton)

            -- Multiplicador vigente: pago_final = base_tier × multiplicador
            multiplier NUMERIC(10, 2) NOT NULL DEFAULT 1,

            -- Información de la fase actual
            phase_name VARCHAR(100) NOT NULL DEFAULT 'Etapa 2',
            phase_end_date TIMESTAMPTZ,

            -- Control de cupos para la barra de FOMO
            total_slots INTEGER NOT NULL DEFAULT 100,
            occupied_slots INTEGER NOT NULL DEFAULT 0,

            -- Timestamp de última modificación
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Insertar configuración por defecto si no existe
    await client.query(`
        INSERT INTO momentum_global_config (id, multiplier, phase_name, total_slots, occupied_slots)
        VALUES (1, 1, 'Etapa 2', 100, 0)
        ON CONFLICT (id) DO NOTHING
    `);

    console.log('[MIGRATION 029] ✅ Tabla momentum_global_config creada (con datos iniciales).');

    // -------------------------------------------------------------------------
    // TABLA 3: momentum_campaigns
    // -------------------------------------------------------------------------
    // Cada campaña tiene un pago base diferente por tier.
    // El pago final que ve el influencer es: base_tier × multiplicador_global.
    // Solo el Admin puede crear/editar campañas.
    // -------------------------------------------------------------------------
    await client.query(`
        CREATE TABLE IF NOT EXISTS momentum_campaigns (
            id SERIAL PRIMARY KEY,

            -- Contenido de la campaña
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,

            -- Pago base por nivel (antes de multiplicar)
            -- Ejemplo: bronce=333, plata=666, oro=1000
            -- Con multiplicador 15: bronce=4995, plata=9990, oro=15000
            base_pay_bronce NUMERIC(19, 4) NOT NULL DEFAULT 0,
            base_pay_plata NUMERIC(19, 4) NOT NULL DEFAULT 0,
            base_pay_oro NUMERIC(19, 4) NOT NULL DEFAULT 0,

            -- Estado de la campaña
            is_active BOOLEAN NOT NULL DEFAULT TRUE,

            -- Auditoría: quién creó esta campaña
            created_by INTEGER REFERENCES users(id),

            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Índice para filtrar campañas activas rápidamente
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_momentum_campaigns_active
        ON momentum_campaigns(is_active)
    `);

    console.log('[MIGRATION 029] ✅ Tabla momentum_campaigns creada.');

    // -------------------------------------------------------------------------
    // TABLA 4: momentum_submissions
    // -------------------------------------------------------------------------
    // Registra cada entrega de tarea realizada por un influencer.
    // Flujo: PENDIENTE → APROBADO (se paga) o RECHAZADO (con nota)
    //
    // Al aprobar: se llama record_booster_event() para acreditar en
    // booster_blue_ledger (los mismos BLUE IOU del programa de impulsores).
    // -------------------------------------------------------------------------
    await client.query(`
        CREATE TABLE IF NOT EXISTS momentum_submissions (
            id SERIAL PRIMARY KEY,

            -- Vínculos: quién entrega y para qué campaña
            profile_id INTEGER NOT NULL REFERENCES momentum_profiles(id) ON DELETE CASCADE,
            campaign_id INTEGER NOT NULL REFERENCES momentum_campaigns(id) ON DELETE CASCADE,

            -- Evidencia: URL del contenido realizado
            proof_link VARCHAR(1000) NOT NULL,

            -- Estado del flujo de revisión
            status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
                CHECK (status IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),

            -- Nota del admin (obligatoria al rechazar, opcional al aprobar)
            admin_note TEXT,

            -- Bono extra: monto adicional que el admin puede otorgar
            -- al aprobar (ej: video viral → bonus)
            bonus_amount NUMERIC(19, 4) NOT NULL DEFAULT 0,

            -- Monto final pagado (base × multiplicador + bonus)
            -- Se calcula y registra al momento de aprobar
            paid_amount NUMERIC(19, 4),

            -- Quién revisó y cuándo
            reviewed_by INTEGER REFERENCES users(id),
            submitted_at TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ,

            -- Prevención de entregas duplicadas: un influencer no puede
            -- enviar la misma campaña dos veces a menos que la anterior
            -- haya sido rechazada. Esto se controla por lógica en el backend.
            UNIQUE (profile_id, campaign_id, status)
        )
    `);

    // Índice para listar entregas pendientes rápidamente (vista admin)
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_momentum_submissions_status
        ON momentum_submissions(status)
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_momentum_submissions_profile
        ON momentum_submissions(profile_id)
    `);

    console.log('[MIGRATION 029] ✅ Tabla momentum_submissions creada.');
    console.log('[MIGRATION 029] ✅ Sistema Winton Momentum listo.');
};

// ============================================================================
// Función principal de ejecución (modo standalone)
// ============================================================================
async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 029_create_momentum_system');

    try {
        await client.query('BEGIN');
        await migrationLogic(client);
        await client.query('COMMIT');
        console.log('🎉 Migración 029 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 029:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// ============================================================================
// Exportaciones para el migration runner automático
// ============================================================================
module.exports = {
    up: async (client) => {
        await migrationLogic(client);
    },
    down: async (client) => {
        // Orden inverso por dependencias de FK
        await client.query('DROP TABLE IF EXISTS momentum_submissions CASCADE');
        await client.query('DROP TABLE IF EXISTS momentum_campaigns CASCADE');
        await client.query('DROP TABLE IF EXISTS momentum_global_config CASCADE');
        await client.query('DROP TABLE IF EXISTS momentum_profiles CASCADE');
    }
};

// Permite ejecución directa: node migrations/029_create_momentum_system.js
if (require.main === module) {
    runMigration();
}
