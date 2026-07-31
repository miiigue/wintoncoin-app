const pool = require('../src/config/db');

/**
 * Migración 096: Sistema de Registro, Censo, Notificaciones y Entregas Múltiples para Damnificados del Terremoto (SOS Venezuela)
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Crea:
 * 1. Tabla disaster_victims_registry: Expedientes de damnificados con censo familiar, ubicación y código inteligente.
 * 2. Tabla disaster_aid_disbursements: Historial de entregas mensuales/recurrentes de ayuda en BLUE IOU.
 * 3. Tabla email_templates_sos: Plantillas de correo personalizables desde el Panel Admin.
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Tabla de Expedientes de Damnificados
        await client.query(`
            CREATE TABLE IF NOT EXISTS disaster_victims_registry (
                id SERIAL PRIMARY KEY,
                dossier_number VARCHAR(50) UNIQUE NOT NULL,
                user_id INT REFERENCES users(id) ON DELETE SET NULL,
                full_name VARCHAR(255) NOT NULL,
                id_document VARCHAR(30) UNIQUE NOT NULL,
                gender VARCHAR(20) NOT NULL DEFAULT 'female',
                is_head_of_family BOOLEAN NOT NULL DEFAULT TRUE,
                email VARCHAR(255) NOT NULL,
                phone_number VARCHAR(30) NOT NULL,
                state VARCHAR(100) NOT NULL,
                municipality VARCHAR(100) NOT NULL,
                sector VARCHAR(150) NOT NULL,
                address_details TEXT NOT NULL,
                dependents_minors INT NOT NULL DEFAULT 0,
                dependents_elderly INT NOT NULL DEFAULT 0,
                dependents_disabled INT NOT NULL DEFAULT 0,
                affectation_level VARCHAR(50) NOT NULL DEFAULT 'essential_needs',
                description TEXT NOT NULL,
                evidence_urls TEXT[] DEFAULT '{}',
                status VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
                data_consent_accepted BOOLEAN NOT NULL DEFAULT TRUE,
                sworn_declaration_accepted BOOLEAN NOT NULL DEFAULT TRUE,
                verified_by_admin_id INT REFERENCES admin_users(id) ON DELETE SET NULL,
                admin_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Tabla de Historial de Entregas Múltiples/Recurrentes
        await client.query(`
            CREATE TABLE IF NOT EXISTS disaster_aid_disbursements (
                id SERIAL PRIMARY KEY,
                victim_id INT NOT NULL REFERENCES disaster_victims_registry(id) ON DELETE CASCADE,
                amount_blue NUMERIC(15,4) NOT NULL,
                disbursement_period VARCHAR(50) NOT NULL DEFAULT 'Fase Inicial',
                disbursed_by_admin_id INT REFERENCES admin_users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Tabla de Plantillas de Correo SOS
        await client.query(`
            CREATE TABLE IF NOT EXISTS email_templates_sos (
                template_key VARCHAR(100) PRIMARY KEY,
                subject VARCHAR(255) NOT NULL,
                html_body TEXT NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insertar plantillas por defecto si no existen
        const defaultTemplates = [
            {
                key: 'victim_registration_confirm',
                subject: '[WintonCoin SOS] Solicitud de Ayuda Registrada - Expediente #{{expediente}}',
                body: `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #db2777; margin: 0;">WintonCoin SOS Venezuela 🇻🇪</h2>
                        <p style="color: #64748b; font-size: 0.9rem;">Campaña Humanitaria por el Terremoto</p>
                    </div>
                    <p>Hola <strong>{{nombre}}</strong>,</p>
                    <p>Tu solicitud de asistencia humanitaria ha sido registrada exitosamente en nuestro sistema bajo el número de expediente:</p>
                    <div style="background: #f8fafc; border: 1px dashed #db2777; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 1.4rem; font-weight: bold; color: #db2777;">#{{expediente}}</span>
                    </div>
                    <p><strong>Estado Actual:</strong> <span style="color: #d97706; font-weight: bold;">En Proceso de Verificación Manual</span></p>
                    <p>Nuestro equipo de seguridad e inspección de campo está revisando los datos suministrados. Te notificaremos por este medio ante cualquier actualización o aprobación de ayuda.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">Este proceso es 100% gratuito. Nunca te solicitaremos dinero en efectivo, criptomonedas ni transferencias bancarias.</p>
                </div>
                `
            },
            {
                key: 'victim_info_requested',
                subject: '[WintonCoin SOS] Información Adicional Requerida - Expediente #{{expediente}}',
                body: `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #d97706;">WintonCoin SOS Venezuela 🇻🇪</h2>
                    <p>Hola <strong>{{nombre}}</strong>,</p>
                    <p>Para continuar con la evaluación de tu expediente <strong>#{{expediente}}</strong>, necesitamos que nos suministres la siguiente información adicional:</p>
                    <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 12px 15px; margin: 15px 0; color: #92400e;">
                        {{observaciones}}
                    </div>
                    <p>Por favor responde a este correo o ingresa a tu portal para adjuntar los datos requeridos.</p>
                </div>
                `
            },
            {
                key: 'victim_aid_approved',
                subject: '[WintonCoin SOS] ¡Solicitud de Ayuda Aprobada! - Expediente #{{expediente}}',
                body: `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #10b981; border-radius: 12px;">
                    <h2 style="color: #10b981;">¡Ayuda Aprobada! 🇻🇪</h2>
                    <p>Hola <strong>{{nombre}}</strong>,</p>
                    <p>Nos alegra informarte que tu expediente <strong>#{{expediente}}</strong> ha sido auditado y <strong>APROBADO</strong> para la asignación de asistencia humanitaria.</p>
                    <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 1.2rem; font-weight: bold; color: #065f46;">Asignación: {{monto_blue}} BLUE IOU</span>
                    </div>
                    <p>Los fondos han sido acreditados a tu cuenta de WintonCoin. Puedes ingresar a la aplicación para gestionarlos.</p>
                </div>
                `
            }
        ];

        for (const t of defaultTemplates) {
            await client.query(`
                INSERT INTO email_templates_sos (template_key, subject, html_body)
                VALUES ($1, $2, $3)
                ON CONFLICT (template_key) DO NOTHING;
            `, [t.key, t.subject, t.body]);
        }

        await client.query('COMMIT');
        console.log('✅ Migración 096 completada: Tablas disaster_victims_registry, disaster_aid_disbursements y email_templates_sos creadas.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración 096:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up };
