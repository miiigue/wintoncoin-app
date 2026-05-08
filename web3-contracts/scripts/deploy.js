/**
 * @title Script de Despliegue Completo — WintonCoin Ecosystem
 * @author WintonCoin Protocol Team
 * @notice Despliega y conecta los 4 contratos del ecosistema en Optimism Sepolia.
 * 
 * ORDEN DE DESPLIEGUE (crítico — no cambiar):
 * 1. BlueToken (sin dependencias)
 * 2. RedToken (sin dependencias)
 * 3. WintonProtocol (necesita: dirección del Relayer)
 * 4. WintonTreasury (necesita: dirección de BlueToken)
 * 
 * LINKING POST-DESPLIEGUE (configuración irreversible):
 * - BlueToken.setWintonProtocol(protocolAddress) ← IRREVERSIBLE
 * - RedToken.setWintonProtocol(protocolAddress) ← IRREVERSIBLE
 * - WintonProtocol.setContracts(blue, red, treasury) ← configurable por Owner
 * - BlueToken.setExemptFromAmortization(treasury, true) ← ahorro de gas
 * 
 * SEGURIDAD:
 * - Cero secretos hardcoded (todo viene de variables de entorno .env)
 * - Verificación de saldo antes de iniciar
 * - Confirmación de cada paso antes de continuar
 * - Registro completo de direcciones al finalizar
 * 
 * USO:
 *   npx hardhat run scripts/deploy.js --network optimismSepolia
 */

const hre = require("hardhat");

async function main() {
    console.log("=".repeat(70));
    console.log("  WINTONCOIN — Despliegue del Ecosistema Completo");
    console.log("  Red: Optimism Sepolia (Testnet) | EIP-7702 Ready");
    console.log("=".repeat(70));

    // ====================================================================
    // PASO 0: Verificar el entorno del Deployer
    // ====================================================================

    // Obtener la cuenta del Deployer (la llave privada viene del .env).
    const [deployer] = await hre.ethers.getSigners();
    console.log("\n📋 Deployer:", deployer.address);

    // Verificar que el Deployer tenga fondos suficientes para el gas.
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const balanceETH = hre.ethers.formatEther(balance);
    console.log("💰 Saldo:", balanceETH, "ETH");

    // SEGURIDAD: Abortar si no hay fondos (previene errores a mitad del despliegue).
    if (balance === 0n) {
        console.error("\n❌ ERROR: Saldo insuficiente. Necesitas ETH de prueba en Optimism Sepolia.");
        console.error("   Faucet: https://www.alchemy.com/faucets/optimism-sepolia");
        process.exit(1);
    }

    console.log("\n" + "-".repeat(70));

    // ====================================================================
    // PASO 1: Desplegar BlueToken (Activo líquido)
    // ====================================================================

    console.log("\n🔵 [1/4] Desplegando BlueToken...");
    const BlueToken = await hre.ethers.getContractFactory("BlueToken");
    // BlueToken no tiene parámetros de constructor (solo ERC20 name/symbol + Ownable).
    const blueToken = await BlueToken.deploy();
    await blueToken.waitForDeployment();
    const blueAddress = await blueToken.getAddress();
    console.log("   ✅ BlueToken desplegado en:", blueAddress);

    // ====================================================================
    // PASO 2: Desplegar RedToken (Registro de deuda)
    // ====================================================================

    console.log("\n🔴 [2/4] Desplegando RedToken...");
    const RedToken = await hre.ethers.getContractFactory("RedToken");
    // RedToken no tiene parámetros de constructor.
    const redToken = await RedToken.deploy();
    await redToken.waitForDeployment();
    const redAddress = await redToken.getAddress();
    console.log("   ✅ RedToken desplegado en:", redAddress);

    // ====================================================================
    // PASO 3: Desplegar WintonProtocol (Motor Central)
    // ====================================================================

    console.log("\n⚙️  [3/4] Desplegando WintonProtocol...");
    const Protocol = await hre.ethers.getContractFactory("WintonProtocol");
    // Constructor recibe: _relayer (el Deployer actúa como Relayer inicial).
    const protocol = await Protocol.deploy(deployer.address);
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    console.log("   ✅ WintonProtocol desplegado en:", protocolAddress);
    console.log("   📡 Relayer configurado:", deployer.address);

    // ====================================================================
    // PASO 4: Desplegar WintonTreasury (Bóveda de comisiones)
    // ====================================================================

    console.log("\n🏦 [4/4] Desplegando WintonTreasury...");
    const Treasury = await hre.ethers.getContractFactory("WintonTreasury");
    // Constructor recibe: _blueToken (para poder transferir BLUE a los reclamantes).
    const treasury = await Treasury.deploy(blueAddress);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log("   ✅ WintonTreasury desplegado en:", treasuryAddress);

    console.log("\n" + "-".repeat(70));
    console.log("   📦 Los 4 contratos han sido desplegados exitosamente.");
    console.log("-".repeat(70));

    // ====================================================================
    // PASO 5: LINKING — Conectar los contratos entre sí
    // ====================================================================

    console.log("\n🔗 Iniciando linking de contratos...\n");

    // 5a. BlueToken → WintonProtocol (IRREVERSIBLE: protocolLocked = true)
    console.log("   🔵→⚙️  BlueToken.setWintonProtocol(Protocol)...");
    const txBlue = await blueToken.setWintonProtocol(protocolAddress);
    await txBlue.wait();
    console.log("   ✅ BlueToken vinculado a WintonProtocol (IRREVERSIBLE)");

    // 5b. RedToken → WintonProtocol (IRREVERSIBLE: protocolLocked = true)
    console.log("   🔴→⚙️  RedToken.setWintonProtocol(Protocol)...");
    const txRed = await redToken.setWintonProtocol(protocolAddress);
    await txRed.wait();
    console.log("   ✅ RedToken vinculado a WintonProtocol (IRREVERSIBLE)");

    // 5c. WintonProtocol → BlueToken + RedToken + Treasury
    console.log("   ⚙️→🔵🔴🏦 WintonProtocol.setContracts(Blue, Red, Treasury)...");
    const txContracts = await protocol.setContracts(blueAddress, redAddress, treasuryAddress);
    await txContracts.wait();
    console.log("   ✅ WintonProtocol configurado con los 3 contratos");

    // 5d. Exentar la Treasury del Vigilante de Auto-Amortización (ahorro de gas)
    console.log("   🏦→🛡️  BlueToken.setExemptFromAmortization(Treasury, true)...");
    const txExempt = await blueToken.setExemptFromAmortization(treasuryAddress, true);
    await txExempt.wait();
    console.log("   ✅ Treasury exenta del Vigilante (nunca tendrá deuda RED)");

    // ====================================================================
    // PASO 6: Resumen final
    // ====================================================================

    console.log("\n" + "=".repeat(70));
    console.log("  🎉 DESPLIEGUE COMPLETO — Ecosistema WintonCoin Activo");
    console.log("=".repeat(70));
    console.log("\n  📋 DIRECCIONES DE CONTRATOS (guardar en el backend .env):\n");
    console.log(`     BLUE_TOKEN_ADDRESS=${blueAddress}`);
    console.log(`     RED_TOKEN_ADDRESS=${redAddress}`);
    console.log(`     WINTON_PROTOCOL_ADDRESS=${protocolAddress}`);
    console.log(`     WINTON_TREASURY_ADDRESS=${treasuryAddress}`);
    console.log(`     RELAYER_ADDRESS=${deployer.address}`);
    console.log("\n  🔍 VERIFICACIÓN EN ETHERSCAN:");
    console.log(`     npx hardhat verify --network optimismSepolia ${blueAddress}`);
    console.log(`     npx hardhat verify --network optimismSepolia ${redAddress}`);
    console.log(`     npx hardhat verify --network optimismSepolia ${protocolAddress} ${deployer.address}`);
    console.log(`     npx hardhat verify --network optimismSepolia ${treasuryAddress} ${blueAddress}`);
    console.log("\n  🌐 EXPLORADOR:");
    console.log(`     https://sepolia-optimism.etherscan.io/address/${protocolAddress}`);
    console.log("\n" + "=".repeat(70));
}

// Ejecutar el despliegue con manejo de errores profesional.
main().catch((error) => {
    console.error("\n❌ ERROR DURANTE EL DESPLIEGUE:");
    console.error(error);
    process.exitCode = 1;
});
