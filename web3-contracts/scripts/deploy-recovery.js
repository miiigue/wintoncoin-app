/**
 * @title Script de Recuperación — Completar despliegue interrumpido
 * @notice Despliega WintonTreasury y ejecuta el linking de los 4 contratos.
 * 
 * USAR SOLO SI el deploy.js principal falló después de desplegar los primeros 3 contratos.
 * 
 * USO:
 *   npx hardhat run scripts/deploy-recovery.js --network optimismSepolia
 */

const hre = require("hardhat");

async function main() {
    console.log("=".repeat(70));
    console.log("  WINTONCOIN — Recuperación del Despliegue");
    console.log("=".repeat(70));

    // Direcciones de los contratos ya desplegados (del intento anterior).
    const blueAddress = "0x192fbc07534c657E4712e338C363ba18dEE610A9";
    const redAddress = "0xDaD9861Fc3b9bF47d36FEEBCF3960779280A0F04";
    const protocolAddress = "0xef8A0cA1ACf5fFd05C4F66F0e1daD6A304d30ca6";

    const [deployer] = await hre.ethers.getSigners();
    console.log("\n📋 Deployer:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Saldo:", hre.ethers.formatEther(balance), "ETH");

    // Conectar a los contratos ya desplegados.
    const blueToken = await hre.ethers.getContractAt("BlueToken", blueAddress);
    const redToken = await hre.ethers.getContractAt("RedToken", redAddress);
    const protocol = await hre.ethers.getContractAt("WintonProtocol", protocolAddress);

    // ====================================================================
    // PASO 1: Desplegar WintonTreasury (el que falló)
    // ====================================================================

    console.log("\n🏦 Desplegando WintonTreasury...");
    const Treasury = await hre.ethers.getContractFactory("WintonTreasury");
    const treasury = await Treasury.deploy(blueAddress);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log("   ✅ WintonTreasury desplegado en:", treasuryAddress);

    // ====================================================================
    // PASO 2: LINKING — Conectar los contratos entre sí
    // ====================================================================

    console.log("\n🔗 Iniciando linking de contratos...\n");

    // Verificar si BlueToken ya tiene el protocolo configurado.
    const currentProtocol = await blueToken.wintonProtocol();
    if (currentProtocol === "0x0000000000000000000000000000000000000000") {
        console.log("   🔵→⚙️  BlueToken.setWintonProtocol(Protocol)...");
        const tx1 = await blueToken.setWintonProtocol(protocolAddress);
        await tx1.wait();
        console.log("   ✅ BlueToken vinculado (IRREVERSIBLE)");
    } else {
        console.log("   🔵 BlueToken ya está vinculado a:", currentProtocol);
    }

    // Verificar si RedToken ya tiene el protocolo configurado.
    const currentRedProtocol = await redToken.wintonProtocol();
    if (currentRedProtocol === "0x0000000000000000000000000000000000000000") {
        console.log("   🔴→⚙️  RedToken.setWintonProtocol(Protocol)...");
        const tx2 = await redToken.setWintonProtocol(protocolAddress);
        await tx2.wait();
        console.log("   ✅ RedToken vinculado (IRREVERSIBLE)");
    } else {
        console.log("   🔴 RedToken ya está vinculado a:", currentRedProtocol);
    }

    // Configurar WintonProtocol con las 3 direcciones.
    console.log("   ⚙️→🔵🔴🏦 WintonProtocol.setContracts(Blue, Red, Treasury)...");
    const tx3 = await protocol.setContracts(blueAddress, redAddress, treasuryAddress);
    await tx3.wait();
    console.log("   ✅ WintonProtocol configurado");

    // Exentar Treasury del Vigilante.
    console.log("   🏦→🛡️  BlueToken.setExemptFromAmortization(Treasury, true)...");
    const tx4 = await blueToken.setExemptFromAmortization(treasuryAddress, true);
    await tx4.wait();
    console.log("   ✅ Treasury exenta del Vigilante");

    // ====================================================================
    // RESUMEN FINAL
    // ====================================================================

    console.log("\n" + "=".repeat(70));
    console.log("  🎉 DESPLIEGUE COMPLETO — Ecosistema WintonCoin Activo");
    console.log("=".repeat(70));
    console.log("\n  📋 DIRECCIONES DE CONTRATOS:\n");
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
    console.log("\n" + "=".repeat(70));
}

main().catch((error) => {
    console.error("\n❌ ERROR:", error);
    process.exitCode = 1;
});
