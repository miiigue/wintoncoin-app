/**
 * backend/migrations/060_add_booster_custom_frequency_settings.js
 * 
 * PROPÓSITO: Insertar en la tabla 'app_settings' las variables de configuración
 * que controlan la frecuencia de pago personalizada de los impulsores.
 * Esto permite al administrador elegir entre el cobro mensual clásico
 * o un cobro por intervalos personalizados (días, horas, minutos).
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia y Trazabilidad de Auditoría.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 060] Iniciando inserción de variables de configuración de frecuencia de pagos...');

    // 1. Insertar la variable que habilita/deshabilita la frecuencia personalizada (Switch)
    await client.query(`
        INSERT INTO app_settings (setting_key, setting_value, description) 
        VALUES (
            'booster_custom_frequency_enabled', 
            'false', 
            'Si se activa, el sistema pagará a los impulsores en el intervalo personalizado de días/horas/minutos en lugar de hacerlo mensualmente el día 1.'
        )
        ON CONFLICT (setting_key) DO NOTHING
    `);

    // 2. Insertar la variable para el intervalo en Días
    await client.query(`
        INSERT INTO app_settings (setting_key, setting_value, description) 
        VALUES (
            'booster_payment_frequency_days', 
            '0', 
            'Frecuencia personalizada de pagos: Días.'
        )
        ON CONFLICT (setting_key) DO NOTHING
    `);

    // 3. Insertar la variable para el intervalo en Horas
    await client.query(`
        INSERT INTO app_settings (setting_key, setting_value, description) 
        VALUES (
            'booster_payment_frequency_hours', 
            '0', 
            'Frecuencia personalizada de pagos: Horas.'
        )
        ON CONFLICT (setting_key) DO NOTHING
    `);

    // 4. Insertar la variable para el intervalo en Minutos
    await client.query(`
        INSERT INTO app_settings (setting_key, setting_value, description) 
        VALUES (
            'booster_payment_frequency_minutes', 
            '5', 
            'Frecuencia personalizada de pagos: Minutos. Por defecto se establece en 5 minutos para facilidad de pruebas UAT.'
        )
        ON CONFLICT (setting_key) DO NOTHING
    `);

    console.log('[MIGRATION 060] Variables de configuración de frecuencia insertadas correctamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 060] Revirtiendo migración: Eliminando variables de configuración de frecuencia...');
    
    // Eliminamos las variables introducidas
    await client.query(`
        DELETE FROM app_settings 
        WHERE setting_key IN (
            'booster_custom_frequency_enabled',
            'booster_payment_frequency_days',
            'booster_payment_frequency_hours',
            'booster_payment_frequency_minutes'
        )
    `);

    console.log('[MIGRATION 060] Reversión finalizada.');
};
