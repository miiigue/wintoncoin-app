/**
 * @title Script de Despliegue Consolidado — Suite V4 del Ecosistema
 * @notice Despliega, enlaza y valida los 5 contratos del protocolo en Optimism Sepolia / Local:
 *         1. BlueToken (6 decimales)
 *         2. RedToken (6 decimales, no transferible)
 *         3. ProtocolTreasury (bóveda de comisiones y bonos Merkle)
 *         4. CollateralVault (garantías USDT segregadas)
 *         5. CoreProtocol (motor central de emisión dual y agenda determinista)
 *         6. FifoExchange (mercado de liquidez 1:1 con prelación FIFO pura)
 *
 * ESTÁNDARES FINTECH & ZERO-TRUST:
 * - Detección y verificación de chainId (Optimism Sepolia 11155420 o Local 31337).
 * - Comparación segura de BigInt para decimales (compatible con Ethers v6).
 * - Enlaces atómicos e irreversibles post-despliegue.
 * - Exportación de manifiesto json auditable para frontend y backend.
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("========================================================================");
    console.log("   INICIANDO DESPLIEGUE CONSOLIDADO DE LA SUITE V4 (OPTIMISM SEPOLIA)   ");
    console.log("========================================================================");

    const [deployer] = await ethers.getSigners();
    console.log(`[Deployer] Dirección: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`[Deployer] Saldo: ${ethers.formatEther(balance)} ETH`);

    const net = await ethers.provider.getNetwork();
    const chainId = net.chainId;
    if (![1337n, 31337n, 11155420n].includes(chainId)) throw new Error("Solo redes de prueba autorizadas por este script.");
    if (![1337n,31337n].includes(chainId) && process.env.ALLOW_V4_TESTNET_DEPLOY !== "true") {
        throw new Error("Despliegue remoto deshabilitado por defecto; requiere revisión y autorización explícita.");
    }
    console.log(`[Network] Chain ID: ${chainId.toString()}`);

    // ========================================================================
    // GESTIÓN DE USDT (6 DECIMALES)
    // ========================================================================
    let usdtAddress = process.env.USDT_TOKEN_ADDRESS;

    if (!usdtAddress) {
        console.log("\n>>> Desplegando MockERC20 USDT para entorno de prueba...");
        const MockFactory = await ethers.getContractFactory("MockERC20");
        const mockUsdt = await MockFactory.deploy("Tether USD", "USDT", 6);
        await mockUsdt.waitForDeployment();
        usdtAddress = await mockUsdt.getAddress();
        console.log(`   ✅ Mock USDT desplegado en: ${usdtAddress}`);
    } else {
        console.log(`\n[Config] Usando USDT configurado en: ${usdtAddress}`);
    }

    // ========================================================================
    // 1. DESPLIEGUE DE BLUETOKEN
    // ========================================================================
    console.log("\n🔵 [1/5] Desplegando BlueToken V4...");
    const BlueFactory = await ethers.getContractFactory("BlueToken");
    const blueToken = await BlueFactory.deploy();
    await blueToken.waitForDeployment();
    const blueAddress = await blueToken.getAddress();
    console.log(`   ✅ BlueToken en: ${blueAddress}`);

    // ========================================================================
    // 2. DESPLIEGUE DE REDTOKEN
    // ========================================================================
    console.log("\n🔴 [2/5] Desplegando RedToken V4...");
    const RedFactory = await ethers.getContractFactory("RedToken");
    const redToken = await RedFactory.deploy();
    await redToken.waitForDeployment();
    const redAddress = await redToken.getAddress();
    console.log(`   ✅ RedToken en: ${redAddress}`);

    // ========================================================================
    // 3. DESPLIEGUE DE PROTOCOLTREASURY
    // ========================================================================
    console.log("\n🏦 [3/5] Desplegando ProtocolTreasury V4...");
    const TreasuryFactory = await ethers.getContractFactory("ProtocolTreasury");
    const treasury = await TreasuryFactory.deploy(blueAddress);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log(`   ✅ ProtocolTreasury en: ${treasuryAddress}`);

    // ========================================================================
    // 4. DESPLIEGUE DE COLLATERALVAULT
    // ========================================================================
    console.log("\n🛡️  [4/5] Desplegando CollateralVault V4...");
    const VaultFactory = await ethers.getContractFactory("CollateralVault");
    const vault = await VaultFactory.deploy(usdtAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`   ✅ CollateralVault en: ${vaultAddress}`);

    // ========================================================================
    // 5. DESPLIEGUE DE COREPROTOCOL
    // ========================================================================
    console.log("\n⚙️  [5/5] Desplegando CoreProtocol V4...");
    const ProtocolFactory = await ethers.getContractFactory("CoreProtocol");
    const protocol = await ProtocolFactory.deploy();
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    console.log(`   ✅ CoreProtocol en: ${protocolAddress}`);

    // ========================================================================
    // 6. ENLACES ATÓMICOS IRREVERSIBLES
    // ========================================================================
    console.log("\n🔗 Ejecutando enlaces irreversibles de gobernanza...");

    // Enlace de BlueToken
    const txBlue = await blueToken.setCoreProtocol(protocolAddress);
    await txBlue.wait();
    console.log("   ✅ BlueToken enlazado a CoreProtocol");

    // Enlace de RedToken
    const txRed = await redToken.setCoreProtocol(protocolAddress);
    await txRed.wait();
    console.log("   ✅ RedToken enlazado a CoreProtocol");

    // Enlace de CollateralVault
    // El Vault se enlaza al Exchange después de desplegarlo, no a Treasury.

    // Enlace de CoreProtocol
    const txProtocol = await protocol.setContracts(blueAddress, redAddress, treasuryAddress, vaultAddress);
    await txProtocol.wait();
    console.log("   ✅ CoreProtocol configurado con Blue, Red, Treasury y Vault");

    // Configuración de Relayer
    const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
    const txRelayer = await protocol.setRelayer(relayerAddress);
    await txRelayer.wait();
    console.log(`   ✅ Relayer asignado a: ${relayerAddress}`);

    // ========================================================================
    // 7. DESPLIEGUE DE FIFOEXCHANGE
    // ========================================================================
    console.log("\n💱 Desplegando FifoExchange V4 (Fee Inicial: 0 BPS)...");
    const ExchangeFactory = await ethers.getContractFactory("FifoExchange");
    const exchange = await ExchangeFactory.deploy(
        blueAddress,
        usdtAddress,
        treasuryAddress,
        0 // Regla de lanzamiento oficial: Initial fee BPS = 0
    );
    await exchange.waitForDeployment();
    const exchangeAddress = await exchange.getAddress();
    await (await vault.linkCoreContracts(protocolAddress, exchangeAddress)).wait();
    await (await blueToken.setExchange(exchangeAddress)).wait();
    await (await exchange.setAmortizationVault(vaultAddress)).wait();
    // Opciones y receptor de prórrogas quedan deshabilitados hasta configuración
    // explícita. El script no concede KYC ni inventa financiación del fondo.
    if (await vault.exchange() !== exchangeAddress || await blueToken.exchange() !== exchangeAddress
        || await exchange.coreProtocol() !== protocolAddress || await exchange.feeBps() !== 0n) {
        throw new Error("Enlaces o comisión inicial inconsistentes");
    }
    console.log(`   ✅ FifoExchange en: ${exchangeAddress}`);

    // ========================================================================
    // 8. VERIFICACIÓN DE DECIMALES ON-CHAIN (COMPATIBILIDAD BIGINT ETHERS V6)
    // ========================================================================
    console.log("\n🔎 Verificando decimales on-chain...");
    const blueDecimals = await blueToken.decimals();
    const redDecimals = await redToken.decimals();
    console.log(`   - BLUE decimals(): ${blueDecimals}`);
    console.log(`   - RED decimals():  ${redDecimals}`);

    if (Number(blueDecimals) !== 6 || Number(redDecimals) !== 6) {
        throw new Error("ERROR CRÍTICO: Los tokens deben tener exactamente 6 decimales.");
    }
    console.log("   ✅ Verificación de 6 decimales exitosa.");

    // ========================================================================
    // 9. EXPORTACIÓN DEL MANIFIESTO DE DESPLIEGUE
    // ========================================================================
    const manifest = {
        network: net.name || "optimismSepolia",
        chainId: chainId.toString(),
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        relayer: relayerAddress,
        contracts: {
            BlueToken: blueAddress,
            RedToken: redAddress,
            ProtocolTreasury: treasuryAddress,
            CollateralVault: vaultAddress,
            CoreProtocol: protocolAddress,
            FifoExchange: exchangeAddress,
            USDT: usdtAddress
        }
    };

    const manifestPath = path.join(__dirname, "..", "deployment-manifest-v4.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📄 Manifiesto de despliegue guardado en: ${manifestPath}`);
    console.log("\n========================================================================");
    console.log("   ¡DESPLIEGUE Y ENLACES DE LA SUITE V4 FINALIZADOS CON ÉXITO TOTAL!    ");
    console.log("========================================================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Fallo durante el despliegue:", error);
        process.exit(1);
    });
