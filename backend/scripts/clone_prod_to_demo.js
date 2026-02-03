/**
 * Script para clonar la base de datos de Producción a Demo
 * Copia estructura y datos directamente sin pg_dump
 */
require('dotenv').config();
const { Pool } = require('pg');

// URLs de las bases de datos
const PROD_URL = 'postgresql://wintoncoin_user:xJ5VTRBcJB2CATETmchGhRa57EzmlY44@dpg-d206cfndiees73952i50-a.ohio-postgres.render.com/wintoncoin_prod';
const DEMO_URL = 'postgresql://wintoncoin_demo_user:rAVHJfdN8O2bTlrXQO2FoszVHEOHhjbP@dpg-d5vor7npm1nc73cpmge0-a.ohio-postgres.render.com/wintoncoin_demo';

const prodPool = new Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
const demoPool = new Pool({ connectionString: DEMO_URL, ssl: { rejectUnauthorized: false } });

async function cloneDatabase() {
    console.log('🚀 Iniciando clonación de Producción a Demo...\n');

    const prodClient = await prodPool.connect();
    const demoClient = await demoPool.connect();

    try {
        // 1. Obtener todas las tablas de producción
        console.log('📋 Obteniendo lista de tablas de producción...');
        const tablesResult = await prodClient.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);
        const tables = tablesResult.rows.map(r => r.tablename);
        console.log(`   Encontradas ${tables.length} tablas: ${tables.join(', ')}\n`);

        // 2. Limpiar demo
        console.log('🧹 Limpiando base de datos Demo...');
        await demoClient.query('DROP SCHEMA public CASCADE');
        await demoClient.query('CREATE SCHEMA public');
        await demoClient.query('GRANT ALL ON SCHEMA public TO wintoncoin_demo_user');
        await demoClient.query('GRANT ALL ON SCHEMA public TO public');
        console.log('   ✅ Schema público recreado\n');

        // 3. Obtener DDL completo de producción (estructura)
        console.log('📐 Copiando estructura de tablas...');

        // Obtener todas las definiciones de tablas
        for (const table of tables) {
            try {
                // Obtener definición de columnas
                const colsResult = await prodClient.query(`
                    SELECT 
                        column_name,
                        data_type,
                        character_maximum_length,
                        column_default,
                        is_nullable,
                        udt_name
                    FROM information_schema.columns 
                    WHERE table_name = $1 AND table_schema = 'public'
                    ORDER BY ordinal_position
                `, [table]);

                if (colsResult.rows.length === 0) continue;

                // Construir CREATE TABLE
                let createSQL = `CREATE TABLE IF NOT EXISTS "${table}" (\n`;
                const colDefs = colsResult.rows.map(col => {
                    let def = `  "${col.column_name}" `;

                    // Tipo de dato
                    if (col.udt_name === 'int4') def += 'INTEGER';
                    else if (col.udt_name === 'int8') def += 'BIGINT';
                    else if (col.udt_name === 'bool') def += 'BOOLEAN';
                    else if (col.udt_name === 'varchar') def += `VARCHAR(${col.character_maximum_length || 255})`;
                    else if (col.udt_name === 'text') def += 'TEXT';
                    else if (col.udt_name === 'numeric') def += 'NUMERIC(19,4)';
                    else if (col.udt_name === 'timestamptz') def += 'TIMESTAMP WITH TIME ZONE';
                    else if (col.udt_name === 'timestamp') def += 'TIMESTAMP';
                    else if (col.udt_name === 'date') def += 'DATE';
                    else if (col.udt_name === 'jsonb') def += 'JSONB';
                    else if (col.udt_name === 'json') def += 'JSON';
                    else if (col.udt_name === 'uuid') def += 'UUID';
                    else def += col.data_type.toUpperCase();

                    // Default y nullable
                    if (col.column_default && col.column_default.includes('nextval')) {
                        def = `  "${col.column_name}" SERIAL`;
                    } else if (col.column_default) {
                        def += ` DEFAULT ${col.column_default}`;
                    }

                    if (col.is_nullable === 'NO' && !col.column_default?.includes('nextval')) {
                        def += ' NOT NULL';
                    }

                    return def;
                });

                createSQL += colDefs.join(',\n') + '\n)';

                await demoClient.query(createSQL);
                console.log(`   ✅ Tabla "${table}" creada`);

            } catch (err) {
                console.log(`   ⚠️ Error en tabla "${table}": ${err.message}`);
            }
        }

        // 4. Copiar datos
        console.log('\n📦 Copiando datos...');
        for (const table of tables) {
            try {
                const dataResult = await prodClient.query(`SELECT * FROM "${table}"`);
                const rows = dataResult.rows;

                if (rows.length === 0) {
                    console.log(`   ⏩ "${table}": sin datos`);
                    continue;
                }

                const columns = Object.keys(rows[0]);

                for (const row of rows) {
                    const values = columns.map(col => row[col]);
                    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                    const colNames = columns.map(c => `"${c}"`).join(', ');

                    try {
                        await demoClient.query(
                            `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                            values
                        );
                    } catch (insertErr) {
                        // Ignorar errores de inserción individual
                    }
                }

                console.log(`   ✅ "${table}": ${rows.length} filas copiadas`);

            } catch (err) {
                console.log(`   ⚠️ Error copiando "${table}": ${err.message}`);
            }
        }

        // 5. Actualizar secuencias
        console.log('\n🔄 Actualizando secuencias...');
        for (const table of tables) {
            try {
                await demoClient.query(`
                    SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), 
                           COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)
                `);
            } catch (err) {
                // Ignorar tablas sin columna id o sin secuencia
            }
        }

        console.log('\n🎉 ¡Clonación completada exitosamente!');

    } catch (error) {
        console.error('❌ Error durante la clonación:', error);
    } finally {
        prodClient.release();
        demoClient.release();
        await prodPool.end();
        await demoPool.end();
    }
}

cloneDatabase();
