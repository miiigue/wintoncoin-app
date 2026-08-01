'use strict';
const pool = require('../src/config/db');

/**
 * Migración 100: Adición de Campos de Edad, Fecha de Nacimiento y Score de Urgencia en Expedientes SOS
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════
 * Adiciona las columnas auditables para el cálculo de urgencia de 4 dígitos y censo de edad.
 * Compatible con migrationRunner.js (up/down).
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Adicionar columnas a disaster_victims_registry
        await client.query(`
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS birth_date DATE;
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS age INT NOT NULL DEFAULT 18;
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS urgency_score INT NOT NULL DEFAULT 0;
        `);

        // Actualizar plantilla por defecto victim_registration_confirm para incluir desglose del censo
        await client.query(`
            UPDATE email_templates_sos
            SET html_body = '
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

                <div style="background: #fff5f5; border: 1px solid #fecdd3; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 0.95rem; color: #1e293b;">
                    <h4 style="margin: 0 0 12px 0; color: #9f1239; font-size: 1rem; border-bottom: 1px solid #fecdd3; padding-bottom: 6px;">📋 Resumen del Censo e Información Registrada:</h4>
                    <p style="margin: 6px 0;"><strong>Nombre Completo:</strong> {{nombre}}</p>
                    <p style="margin: 6px 0;"><strong>Cédula de Identidad:</strong> {{cedula}}</p>
                    <p style="margin: 6px 0;"><strong>Edad:</strong> {{edad}} años</p>
                    <p style="margin: 6px 0;"><strong>Ubicación:</strong> {{ubicacion}}</p>
                    <p style="margin: 6px 0;"><strong>Censo Familiar:</strong> {{censo_familiar}}</p>
                    <p style="margin: 6px 0;"><strong>Nivel de Afectación:</strong> {{afectacion}}</p>
                    <p style="margin: 6px 0;"><strong>Detalles / Relato:</strong> {{descripcion}}</p>
                </div>

                <p>Nuestro equipo de seguridad e inspección de campo está revisando los datos suministrados. Te notificaremos por este medio ante cualquier actualización o aprobación de ayuda.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">Este proceso es 100% gratuito. Nunca te solicitaremos dinero en efectivo, criptomonedas ni transferencias bancarias.</p>
            </div>'
            WHERE template_key = 'victim_registration_confirm';
        `);

        await client.query('COMMIT');
        console.log('[MIGRATION 100] ✅ Columnas birth_date, age y urgency_score añadidas a disaster_victims_registry y plantilla de email actualizada exitosamente.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MIGRATION 100] ❌ Error al ejecutar migración 100:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function down() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE disaster_victims_registry DROP COLUMN IF EXISTS birth_date;
            ALTER TABLE disaster_victims_registry DROP COLUMN IF EXISTS age;
            ALTER TABLE disaster_victims_registry DROP COLUMN IF EXISTS urgency_score;
        `);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up, down };
