// ============================================================================
// MIGRACIÓN 104: Sistema Global de Plantillas de Correo Editables (Admin Email CMS)
// ============================================================================
// Propósito: Centralizar TODAS las plantillas de correo transaccional del sistema
//            en una tabla única `email_templates` para que sean editables desde
//            el Panel de Administración sin necesidad de desplegar código.
//
// Arquitectura:
//   - Cada plantilla tiene un `template_key` único (ej: 'otp_verification').
//   - `category` agrupa las plantillas por módulo (seguridad, finanzas, sos, etc.).
//   - `subject` y `body_html` contienen el asunto y cuerpo editable con variables
//     dinámicas (ej: {{nombre}}, {{monto}}, {{otp}}).
//   - `available_variables` documenta las variables disponibles para cada plantilla.
//   - El Layout Máster (logo, CSS, footer No-Reply) se inyecta en tiempo de envío
//     por `emailService.js`, por lo que aquí solo se guarda el contenido editable.
//
// Estándar: Zero-Trust, idempotente (IF NOT EXISTS), auditabilidad total.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 104] Creando tabla global email_templates...');

        // 1. Crear la tabla global de plantillas de correo
        await client.query(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id SERIAL PRIMARY KEY,
                template_key VARCHAR(100) UNIQUE NOT NULL,
                category VARCHAR(50) NOT NULL DEFAULT 'general',
                subject VARCHAR(500) NOT NULL,
                body_html TEXT NOT NULL,
                available_variables TEXT NOT NULL DEFAULT '',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_by VARCHAR(100) DEFAULT 'system'
            );
        `);

        // 2. Índice para búsqueda rápida por categoría (filtro en el panel admin)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_email_templates_category
            ON email_templates (category);
        `);

        // 3. Sembrar las plantillas iniciales del sistema
        //    Cada INSERT usa ON CONFLICT para ser 100% idempotente
        const seedTemplates = [
            // ── SEGURIDAD: OTP / Verificación de Cuenta ──
            {
                key: 'otp_verification',
                category: 'seguridad',
                subject: 'Tu código de verificación de WintonCoin',
                body: `<h1 style="margin:0 0 10px 0; font-size:20px; font-weight:700;">Tu código de verificación</h1>
<p style="margin:0 0 18px 0; font-size:14px; color:#344054;">
  Usa este código para completar la verificación de tu cuenta en <strong>WintonCoin</strong>.
</p>
<div style="margin:0 0 16px 0; padding:16px; background:#F8FAFC; border:1px solid #EEF2F6; border-radius:12px; text-align:center;">
  <div style="font-size:28px; letter-spacing:6px; font-weight:800; color:#0B5FFF; font-family: monospace;">{{otp}}</div>
  <div style="margin-top:8px; font-size:12px; color:#667085;">Expira en 10 minutos</div>
</div>`,
                variables: 'otp, ip, requestedAt'
            },

            // ── FINANZAS: Recibo de Transacción / Pago ──
            {
                key: 'transaction_receipt',
                category: 'finanzas',
                subject: 'Recibo de Transacción - WintonCoin',
                body: `<h1 style="margin:0 0 10px 0; font-size:20px; font-weight:700;">{{title}}</h1>
<div style="text-align:center; margin-bottom:24px;">
  <p style="margin:0 0 8px; color:#667085; font-size:16px;">Monto total</p>
  <div style="font-size:36px; color:#0B5FFF; font-weight:800;">{{amount}}</div>
</div>
<p style="margin:0 0 24px; color:#344054; font-size:16px; line-height:24px;">{{message}}</p>
<div style="background:#F9FAFB; border-radius:12px; padding:24px;">{{details_table}}</div>`,
                variables: 'title, amount, message, details_table'
            },

            // ── COMUNICADOS: Anuncios y Difusiones Oficiales ──
            {
                key: 'announcement_broadcast',
                category: 'comunicados',
                subject: 'Comunicado Oficial - WintonCoin',
                body: `<div style="font-size:16px; color:#4b5563; margin-bottom:32px;">{{body_content}}</div>
{{action_button}}`,
                variables: 'body_content, action_button'
            },

            // ── GOBERNANZA: Notificaciones Winton-Consensus ──
            {
                key: 'governance_notification',
                category: 'gobernanza',
                subject: 'Notificación de Gobernanza - WintonCoin',
                body: `<h1 style="margin:0 0 10px 0; font-size:20px; font-weight:700;">{{title}}</h1>
<p style="margin:0 0 18px 0; font-size:14px; color:#344054;">{{body}}</p>
{{details_section}}
{{action_button}}
{{recent_changes_section}}`,
                variables: 'title, body, details_section, action_button, recent_changes_section'
            },

            // ── RECLUTAMIENTO: Confirmación de Postulación ──
            {
                key: 'recruitment_confirmation',
                category: 'reclutamiento',
                subject: 'Postulación Recibida - WintonCoin Talent',
                body: `<h1 style="margin:0 0 10px 0; font-size:20px; font-weight:700;">¡Postulación Recibida!</h1>
<p style="margin:0 0 18px 0; font-size:14px; color:#344054;">
  Hola <strong>{{nombre}}</strong>, hemos recibido tu postulación para <strong>{{rol}}</strong>.
  Nuestro equipo de talento revisará tu perfil y te contactaremos a la brevedad.
</p>`,
                variables: 'nombre, rol'
            },

            // ── SOS VENEZUELA: Registro de Expediente ──
            {
                key: 'sos_victim_registered',
                category: 'sos_venezuela',
                subject: '[WintonCoin SOS] Solicitud Registrada - Expediente #{{expediente}}',
                body: `<h2 style="color: #db2777;">WintonCoin SOS Venezuela 🇻🇪</h2>
<p>Hola <strong>{{nombre}}</strong>,</p>
<p>Tu solicitud de asistencia humanitaria ha sido registrada exitosamente bajo el número de expediente:</p>
<div style="background:#f8fafc; border:1px dashed #db2777; border-radius:8px; padding:15px; text-align:center; margin:20px 0;">
  <span style="font-size:1.4rem; font-weight:bold; color:#db2777;">#{{expediente}}</span>
</div>
<p><strong>Estado Actual:</strong> <span style="color:#d97706; font-weight:bold;">En Proceso de Verificación Manual</span></p>
<div style="background:#fff5f5; border:1px solid #fecdd3; border-radius:10px; padding:16px; margin:20px 0; font-size:0.95rem; color:#1e293b;">
  <h4 style="margin:0 0 12px; color:#9f1239; border-bottom:1px solid #fecdd3; padding-bottom:6px;">📋 Resumen del Censo:</h4>
  <p style="margin:6px 0;"><strong>Nombre:</strong> {{nombre}}</p>
  <p style="margin:6px 0;"><strong>Cédula:</strong> {{cedula}}</p>
  <p style="margin:6px 0;"><strong>Edad:</strong> {{edad}} años</p>
  <p style="margin:6px 0;"><strong>Ubicación:</strong> {{ubicacion}}</p>
  <p style="margin:6px 0;"><strong>Censo Familiar:</strong> {{censo_familiar}}</p>
  <p style="margin:6px 0;"><strong>Nivel de Afectación:</strong> {{afectacion}}</p>
  <p style="margin:6px 0;"><strong>Detalles:</strong> {{descripcion}}</p>
</div>
<p>Nuestro equipo de verificación está revisando los datos suministrados. Te notificaremos por este medio ante cualquier actualización.</p>
<hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;">
<p style="font-size:0.8rem; color:#94a3b8; text-align:center;">Este proceso es 100% gratuito. Nunca te solicitaremos dinero.</p>`,
                variables: 'nombre, expediente, cedula, edad, ubicacion, censo_familiar, afectacion, descripcion'
            },

            // ── SOS VENEZUELA: Solicitud de Información Adicional ──
            {
                key: 'sos_victim_info_requested',
                category: 'sos_venezuela',
                subject: '[WintonCoin SOS] Información Adicional Requerida - Expediente #{{expediente}}',
                body: `<h2 style="color:#d97706;">WintonCoin SOS Venezuela 🇻🇪</h2>
<p>Hola <strong>{{nombre}}</strong>,</p>
<p>Para continuar con la evaluación de tu expediente <strong>#{{expediente}}</strong>, necesitamos que nos suministres la siguiente información adicional:</p>
<div style="background:#fffbeb; border-left:4px solid #d97706; padding:12px 15px; margin:15px 0; color:#92400e;">
  {{observaciones}}
</div>
<p>Si necesitas adjuntar información o tienes alguna consulta, ingresa a tu portal de WintonCoin o escribe a nuestro equipo de soporte.</p>`,
                variables: 'nombre, expediente, observaciones'
            },

            // ── SOS VENEZUELA: Ayuda Aprobada ──
            {
                key: 'sos_victim_aid_approved',
                category: 'sos_venezuela',
                subject: '[WintonCoin SOS] ¡Solicitud de Ayuda Aprobada! - Expediente #{{expediente}}',
                body: `<h2 style="color:#10b981;">¡Ayuda Aprobada! 🇻🇪</h2>
<p>Hola <strong>{{nombre}}</strong>,</p>
<p>Tu expediente <strong>#{{expediente}}</strong> ha sido auditado y <strong>APROBADO</strong> para la asignación de asistencia humanitaria.</p>
<div style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:15px; text-align:center; margin:20px 0;">
  <span style="font-size:1.2rem; font-weight:bold; color:#065f46;">Asignación: {{monto_blue}} BLUE IOU</span>
</div>
<p>Los fondos han sido acreditados a tu cuenta de WintonCoin. Puedes ingresar a la aplicación para gestionarlos.</p>`,
                variables: 'nombre, expediente, monto_blue'
            }
        ];

        // 4. Insertar cada plantilla de forma idempotente (ON CONFLICT DO NOTHING)
        for (const t of seedTemplates) {
            await client.query(`
                INSERT INTO email_templates (template_key, category, subject, body_html, available_variables, updated_by)
                VALUES ($1, $2, $3, $4, $5, 'migration_104')
                ON CONFLICT (template_key) DO NOTHING;
            `, [t.key, t.category, t.subject, t.body, t.variables]);
        }

        // 5. Actualizar la plantilla victim_info_requested en email_templates_sos
        //    para corregir la frase que solicitaba responder al correo
        await client.query(`
            UPDATE email_templates_sos
            SET html_body = REPLACE(
                html_body,
                'Por favor responde a este correo o ingresa a tu portal para adjuntar los datos requeridos.',
                'Si necesitas adjuntar información o tienes alguna consulta, ingresa a tu portal de WintonCoin o escribe a nuestro equipo de soporte. Por favor no respondas a este correo automático.'
            ),
            updated_at = NOW()
            WHERE template_key = 'victim_info_requested';
        `);

        console.log('[MIGRATION 104] ✅ Tabla email_templates creada y plantillas sembradas.');
        console.log('[MIGRATION 104] ✅ Plantilla victim_info_requested (SOS) corregida (No-Reply).');
    },

    down: async (client) => {
        console.log('[MIGRATION 104] Revirtiendo tabla email_templates...');
        await client.query('DROP TABLE IF EXISTS email_templates;');
        console.log('[MIGRATION 104] ✅ Migración 104 revertida.');
    }
};
