/**
 * web3-contracts/scripts/setup-gas-sponsor.js
 * 
 * Script de inicialización y segregación de claves de infraestructura (SOC 2).
 * 
 * PROPÓSITO:
 * Genera una nueva billetera criptográfica dedicada exclusivamente al patrocinio de gas
 * (GAS_SPONSOR_PRIVATE_KEY), separando estrictamente la firma comercial del Relayer
 * de las recargas de gas a los usuarios, cumpliendo con el estándar bancario de
 * segregación de funciones (Segregation of Duties).
 * 
 * Transfiere 0.005 ETH desde la billetera Relayer a la nueva billetera de patrocinio
 * en Optimism Sepolia, y almacena las credenciales de forma segura en `web3-contracts/.env`.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    console.log('================================================================');
    console.log('  CONFIGURACIÓN DE BILLETERA DE PATROCINIO DE GAS (OP SEPOLIA)  ');
    console.log('================================================================');

    // 1. Obtener la URL del proveedor RPC
    const rpcUrl = process.env.ALCHEMY_API_URL || 'https://sepolia.optimism.io';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 2. Verificar conectividad y Chain ID
    const network = await provider.getNetwork();
    console.log(`[RED] Conectado a Chain ID: ${network.chainId} (Esperado: 11155420 - OP Sepolia)`);
    if (network.chainId !== 11155420n) {
        throw new Error(`Chain ID inválido: ${network.chainId}. Se esperaba 11155420.`);
    }

    // 3. Cargar la billetera Relayer existente que fondeará el gas
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerKey) {
        throw new Error('RELAYER_PRIVATE_KEY no está configurada en web3-contracts/.env');
    }
    const relayerWallet = new ethers.Wallet(relayerKey, provider);
    const relayerAddress = await relayerWallet.getAddress();
    const relayerBalance = await provider.getBalance(relayerAddress);
    console.log(`[RELAYER] Dirección: ${relayerAddress}`);
    console.log(`[RELAYER] Saldo actual: ${ethers.formatEther(relayerBalance)} ETH`);

    const transferAmount = ethers.parseEther('0.005');
    if (relayerBalance < transferAmount + ethers.parseEther('0.001')) {
        throw new Error(`Saldo insuficiente en el Relayer (${ethers.formatEther(relayerBalance)} ETH). Se requieren al menos 0.006 ETH para fondear y cubrir comisiones.`);
    }

    // 4. Determinar si ya existe un GAS_SPONSOR_PRIVATE_KEY o si generamos uno nuevo
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    let sponsorWallet;
    if (process.env.GAS_SPONSOR_PRIVATE_KEY) {
        console.log('[SPONSOR] Se detectó una clave de patrocinio existente en .env');
        sponsorWallet = new ethers.Wallet(process.env.GAS_SPONSOR_PRIVATE_KEY, provider);
    } else {
        console.log('[SPONSOR] Generando nueva clave criptográfica dedicada e independiente...');
        sponsorWallet = ethers.Wallet.createRandom().connect(provider);
        const sponsorAddress = await sponsorWallet.getAddress();
        const sponsorKey = sponsorWallet.privateKey;

        // Validar que la nueva dirección no coincida con el relayer ni deployer
        if (sponsorAddress.toLowerCase() === relayerAddress.toLowerCase()) {
            throw new Error('Violación de segregación: la dirección generada coincide con el Relayer.');
        }

        // Agregar de forma segura al archivo .env local
        const entry = `\n# 6. PATROCINADOR DE GAS (Segregación de funciones SOC 2)\nGAS_SPONSOR_ADDRESS="${sponsorAddress}"\nGAS_SPONSOR_PRIVATE_KEY="${sponsorKey}"\n`;
        fs.appendFileSync(envPath, entry, 'utf8');
        console.log('[SEGURIDAD] Nueva clave guardada exitosamente en web3-contracts/.env');
    }

    const sponsorAddress = await sponsorWallet.getAddress();
    const currentSponsorBalance = await provider.getBalance(sponsorAddress);
    console.log(`[SPONSOR] Dirección: ${sponsorAddress}`);
    console.log(`[SPONSOR] Saldo actual: ${ethers.formatEther(currentSponsorBalance)} ETH`);

    // 5. Transferir fondos si el saldo del sponsor es menor a 0.004 ETH
    if (currentSponsorBalance < ethers.parseEther('0.004')) {
        console.log(`[TRANSFERENCIA] Transfiriendo ${ethers.formatEther(transferAmount)} ETH desde Relayer hacia Sponsor...`);
        const tx = await relayerWallet.sendTransaction({
            to: sponsorAddress,
            value: transferAmount
        });
        console.log(`[TX PENDIENTE] Hash: ${tx.hash}`);
        const receipt = await tx.wait(1);
        console.log(`[TX CONFIRMADA] Bloque: ${receipt.blockNumber} (Gas usado: ${receipt.gasUsed.toString()})`);

        const newSponsorBalance = await provider.getBalance(sponsorAddress);
        console.log(`[SPONSOR] Nuevo saldo verificado: ${ethers.formatEther(newSponsorBalance)} ETH`);
    } else {
        console.log('[SPONSOR] La billetera de patrocinio ya cuenta con fondos suficientes.');
    }

    console.log('================================================================');
    console.log('  CONFIGURACIÓN LOCAL COMPLETADA EXITOSAMENTE                  ');
    console.log('  Dirección del Sponsor: ' + sponsorAddress);
    console.log('================================================================');
}

main().catch(err => {
    console.error('[ERROR]', err);
    process.exit(1);
});
