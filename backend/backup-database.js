// Script de Backup para Base de Datos WintonCoin
require('./config'); // Carga la configuración del entorno
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
    
    // Crear directorio de backups si no existe
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    try {
        console.log('🔄 Iniciando backup de la base de datos...');
        
        // Obtener todas las tablas
        const tablesResult = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);
        
        let backupContent = '';
        backupContent += '-- Backup de WintonCoin Database\n';
        backupContent += `-- Fecha: ${new Date().toISOString()}\n`;
        backupContent += '-- ==========================================\n\n';
        
        // Backup de datos de cada tabla
        for (const table of tablesResult.rows) {
            const tableName = table.tablename;
            console.log(`📋 Respaldando tabla: ${tableName}`);
            
            const dataResult = await pool.query(`SELECT * FROM "${tableName}"`);
            
            if (dataResult.rows.length > 0) {
                backupContent += `\n-- Datos de la tabla: ${tableName}\n`;
                backupContent += `DELETE FROM "${tableName}";\n`;
                
                for (const row of dataResult.rows) {
                    const columns = Object.keys(row);
                    const values = columns.map(col => {
                        const value = row[col];
                        if (value === null) return 'NULL';
                        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                        return value;
                    });
                    
                    backupContent += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
                }
            }
        }
        
        // Guardar el backup
        fs.writeFileSync(backupFile, backupContent);
        
        console.log(`✅ Backup completado exitosamente: ${backupFile}`);
        console.log(`📊 Total de tablas respaldadas: ${tablesResult.rows.length}`);
        
        return backupFile;
        
    } catch (error) {
        console.error('❌ Error durante el backup:', error);
        throw error;
    }
}

async function restoreBackup(backupFile) {
    if (!fs.existsSync(backupFile)) {
        throw new Error(`Archivo de backup no encontrado: ${backupFile}`);
    }
    
    try {
        console.log('🔄 Iniciando restauración de backup...');
        
        const backupContent = fs.readFileSync(backupFile, 'utf8');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Ejecutar el contenido del backup
            await client.query(backupContent);
            
            await client.query('COMMIT');
            console.log('✅ Restauración completada exitosamente');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Error durante la restauración:', error);
        throw error;
    }
}

async function listBackups() {
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
        console.log('📁 No hay directorio de backups');
        return [];
    }
    
    const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.sql'))
        .map(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                path: filePath,
                size: stats.size,
                date: stats.mtime
            };
        })
        .sort((a, b) => b.date - a.date);
    
    return files;
}

// Función principal
async function main() {
    const command = process.argv[2];
    
    try {
        switch (command) {
            case 'backup':
                await createBackup();
                break;
                
            case 'restore':
                const backupFile = process.argv[3];
                if (!backupFile) {
                    console.error('❌ Debes especificar el archivo de backup');
                    console.log('Uso: node backup-database.js restore <archivo-backup>');
                    process.exit(1);
                }
                await restoreBackup(backupFile);
                break;
                
            case 'list':
                const backups = await listBackups();
                if (backups.length === 0) {
                    console.log('📁 No hay backups disponibles');
                } else {
                    console.log('📋 Backups disponibles:');
                    backups.forEach(backup => {
                        const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
                        console.log(`  📄 ${backup.name} (${sizeMB} MB) - ${backup.date.toLocaleString()}`);
                    });
                }
                break;
                
            default:
                console.log('🔧 Script de Backup para WintonCoin Database');
                console.log('');
                console.log('Uso:');
                console.log('  node backup-database.js backup     - Crear un nuevo backup');
                console.log('  node backup-database.js restore <archivo> - Restaurar desde backup');
                console.log('  node backup-database.js list       - Listar backups disponibles');
                break;
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main();
}

module.exports = { createBackup, restoreBackup, listBackups }; 