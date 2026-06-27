/**
 * backend/scripts/backup_demo_audit_trail.js
 * 
 * PROPÓSITO: Extraer una copia de seguridad legal inmutable (Audit Trail Archiving)
 * de las tablas fiduciarias de Demo antes de ejecutar el reinicio masivo del Día Cero.
 * 
 * TABLAS RESPALDADAS:
 * 1. demo_reward_exports: Message Archive de los votos de guardianes firmados con HMAC-SHA256.
 * 2. audit_log: Pista de auditoría inmutable de eventos del sistema.
 * 3. app_settings: Configuraciones maestras de reglas económicas y gobernanza.
 * 
 * CIBERSEGURIDAD & COMPLIANCE (SOC 2 / FinCEN):
 * - Guarda los datos en un archivo JSON estructurado y genera un hash SHA-256 notarial.
 * - Conexión SSL encriptada hacia Render.com.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

// Cargar variables de entorno de Demo
require('dotenv').config({ path: path.join(__dirname, '../.env.demo.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('⛔ ERROR DE CONFIGURACIÓN: No se encontró DATABASE_URL en .env.demo.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function backupDemoAuditTrail() {
    console.log('=' .repeat(70));
    console.log(' 🛡️  [AUDIT TRAIL ARCHIVING] Extrayendo Respaldo Fiduciario de Demo');
    console.log('=' .repeat(70));
    
    let client;
    try {
        client = await pool.connect();
        console.log('🔌 Conectado exitosamente a la Base de Datos Demo en Render...');

        // 1. Extraer demo_reward_exports
        console.log('📦 Extrayendo tabla [demo_reward_exports] (Message Archive)...');
        const exportsRes = await client.query('SELECT * FROM demo_reward_exports ORDER BY id ASC;');
        console.log(`   ✅ Se encontraron ${exportsRes.rowCount} registros de exportación firmados.`);

        // 2. Extraer audit_log
        console.log('📦 Extrayendo tabla [audit_log] (Pista de auditoría)...');
        const auditRes = await client.query('SELECT * FROM audit_log ORDER BY id ASC;');
        console.log(`   ✅ Se encontraron ${auditRes.rowCount} registros de auditoría.`);

        // 3. Extraer app_settings
        console.log('📦 Extrayendo tabla [app_settings] (Configuraciones maestras)...');
        const settingsRes = await client.query('SELECT * FROM app_settings ORDER BY setting_key ASC;');
        console.log(`   ✅ Se encontraron ${settingsRes.rowCount} configuraciones maestras.`);

        // Estructurar el paquete de auditoría
        const auditPackage = {
            metadata: {
                environment: 'demo',
                backed_up_at: new Date().toISOString(),
                protocol_version: '1.0.0-genesis-cut',
                description: 'Respaldo legal fiduciario previo a Go-Live Clean Slate (SOC 2 Compliance)'
            },
            tables: {
                demo_reward_exports: exportsRes.rows,
                audit_log: auditRes.rows,
                app_settings: settingsRes.rows
            }
        };

        const jsonContent = JSON.stringify(auditPackage, null, 2);
        const backupPath = path.join(__dirname, '../demo_audit_backup_genesis.json');

        fs.writeFileSync(backupPath, jsonContent, 'utf8');
        console.log(`\n💾 Archivo guardado exitosamente en: ${backupPath}`);

        // Generar Hash Notarial SHA-256
        const fileHash = crypto.createHash('sha256').update(jsonContent, 'utf8').digest('hex');
        console.log('=' .repeat(70));
        console.log(`  🔗 HASH NOTARIAL SHA-256 (Guardar para auditoría SOC 2):`);
        console.log(`     ${fileHash}`);
        console.log('=' .repeat(70));

    } catch (error) {
        console.error('❌ ERROR CRÍTICO durante la extracción del respaldo:', error);
        process.exitCode = 1;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

backupDemoAuditTrail();
