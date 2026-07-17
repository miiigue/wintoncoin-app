/**
 * scripts/generate_tge_merkle_tree.js
 * 
 * ============================================================================
 * SCRIPT DE PREPARACIÓN PARA EL TGE (TOKEN GENERATION EVENT)
 * ============================================================================
 * 
 * USO Y PROPÓSITO:
 * Este script NO se utiliza durante la fase de pre-lanzamiento. Está diseñado
 * específicamente para el día del Lanzamiento Oficial (o para las liquidaciones
 * mensuales post-lanzamiento).
 * 
 * FUNCIONAMIENTO:
 * 1. Conecta a la base de datos de producción (o réplica).
 * 2. Suma todos los saldos Off-Chain (`booster_blue_ledger`) agrupados por
 *    la billetera Web3 (`web3_wallet_address`) de cada usuario.
 * 3. Utiliza la librería estándar de la industria `@openzeppelin/merkle-tree`
 *    para generar un Árbol de Merkle que coincide criptográficamente con el
 *    contrato inteligente `WintonTreasury.sol` (Doble Hashing).
 * 4. Guarda todo el árbol (incluyendo las Pruebas de Merkle que necesitará
 *    el Frontend) en un archivo JSON `tge_merkle_tree.json`.
 * 5. Muestra en pantalla el "Merkle Root" (La Raíz), que es la única cadena
 *    de texto que debes subir a la blockchain llamando a `setMerkleRoot()`
 *    en el contrato WintonTreasury.
 * 
 * EJECUCIÓN (El día del lanzamiento):
 * node scripts/generate_tge_merkle_tree.js
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const { StandardMerkleTree } = require('@openzeppelin/merkle-tree');
const fs = require('fs');
const path = require('path');
// Importar ethers para convertir números a formato wei (18 decimales) estándar EVM
const { ethers } = require('ethers');

// Conexión a la Base de Datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    console.log("=========================================================");
    console.log("🌲 WINTONCOIN TGE: GENERADOR DE ÁRBOL DE MERKLE");
    console.log("=========================================================\n");

    const client = await pool.connect();

    try {
        console.log("[1/4] Fotografía (Snapshot) de los saldos Off-Chain...");

        // Query: Sumar todos los balances del ledger por cada billetera web3 conectada.
        // Se excluyen usuarios que no hayan conectado una billetera Web3.
        const snapshotQuery = `
            SELECT 
                u.web3_wallet_address, 
                SUM(bbl.amount) as total_iou_balance
            FROM booster_blue_ledger bbl
            JOIN users u ON bbl.user_id = u.id
            WHERE u.web3_wallet_address IS NOT NULL
            GROUP BY u.web3_wallet_address
            HAVING SUM(bbl.amount) > 0
        `;
        
        const { rows } = await client.query(snapshotQuery);

        if (rows.length === 0) {
            console.log("❌ No se encontraron usuarios con saldo IOU y billetera conectada.");
            return;
        }

        console.log(`✅ Snapshot completado. Se encontraron ${rows.length} billeteras elegibles para el Claim.\n`);
        console.log("[2/4] Formateando datos para el contrato inteligente...");

        // Formato para @openzeppelin/merkle-tree: Array de Arrays [['Direccion', 'MontoEnWei']]
        const values = [];
        
        for (const row of rows) {
            const wallet = row.web3_wallet_address;
            const balanceStr = parseFloat(row.total_iou_balance).toString();
            
            // Convertir el balance legible (ej: "100.5") a Wei (18 decimales para Solidity)
            const balanceWei = ethers.parseEther(balanceStr).toString();
            
            values.push([wallet, balanceWei]);
        }

        console.log("[3/4] Calculando Árbol de Merkle (Standard Double-Hashing)...");

        // Crea el árbol utilizando los tipos de datos que el contrato espera (address, uint256)
        // Internamente @openzeppelin/merkle-tree hace el doble hash necesario para evitar colisiones
        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        
        const rootHash = tree.root;
        
        console.log("✅ Árbol generado con éxito.\n");
        console.log("=========================================================");
        console.log(`🔥 MERKLE ROOT: ${rootHash}`);
        console.log("=========================================================");
        console.log("👉 IMPORTANTE: Copia este Merkle Root y pégalo en la función");
        console.log("   setMerkleRoot() de tu contrato WintonTreasury.sol");
        console.log("=========================================================\n");

        console.log("[4/4] Guardando árbol en archivo JSON para uso del Frontend...");
        
        const outputPath = path.join(__dirname, 'tge_merkle_tree.json');
        fs.writeFileSync(outputPath, JSON.stringify(tree.dump(), null, 2));

        console.log(`✅ Archivo guardado en: ${outputPath}`);
        console.log(`El Backend (API) ahora deberá leer este archivo cuando los usuarios pidan su Merkle Proof para reclamar.\n`);

    } catch (error) {
        console.error("❌ Error inesperado durante la generación:", error);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

main();
