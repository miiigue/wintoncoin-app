const { ethers, network } = require("hardhat");

/**
 * Script de Deployment Profesional para WintonFifoExchange (V3.3.4)
 * Estándares FinTech & SOC 2: Verificación de red, bytecode on-chain, decimales y configuración inicial.
 */
async function main() {
    console.log("========================================================================");
    console.log("   INICIANDO DESPLIEGUE AUDITADO: WintonFifoExchange (V3.3.4)          ");
    console.log("========================================================================");

    const [deployer] = await ethers.getSigners();
    console.log(`[Deployer] Dirección: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`[Deployer] Saldo ETH: ${ethers.formatEther(balance)} ETH`);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    console.log(`[Network] Chain ID detectado: ${chainId.toString()}`);

    let blueAddress = process.env.BLUE_TOKEN_ADDRESS;
    let usdtAddress = process.env.USDT_TOKEN_ADDRESS;
    let treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
    const initialFeeBps = parseInt(process.env.INITIAL_FEE_BPS || "0", 10);

    // REGLA DE LANZAMIENTO OFICIAL WINTONCOIN:
    // El constructor técnico permite 0..500 BPS para flexibilidad de futuras instancias institucionales.
    // Sin embargo, para el lanzamiento oficial de WintonCoin, el fee inicial debe ser OBLIGATORIAMENTE 0 BPS (0.00%).
    // Se aborta la ejecución si initialFeeBps !== 0.
    if (initialFeeBps !== 0) {
        throw new Error(
            `ERROR CRÍTICO: El lanzamiento oficial de WintonCoin exige INITIAL_FEE_BPS = 0 (detectado: ${initialFeeBps} BPS). ` +
            `No se permite desplegar la instancia oficial con comisiones iniciales activas.`
        );
    }

    // Si es Optimism Mainnet (Chain ID 10)
    if (chainId === 10n) {
        console.log(">>> Entorno: OPTIMISM MAINNET (Chain ID 10)");
        // Dirección USDT / representación estable seleccionada para OP Mainnet, pendiente de verificación final de deployment
        if (!usdtAddress) {
            usdtAddress = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58";
            console.log(`[Info] Usando representación USDT en OP Mainnet (Bridged USDT, pendiente de verificación final): ${usdtAddress}`);
        }
    } else if (chainId === 11155420n) {
        console.log(">>> Entorno: OPTIMISM SEPOLIA TESTNET (Chain ID 11155420)");
    } else {
        console.log(`>>> Entorno Local / Desarrollo (Chain ID: ${chainId.toString()})`);
    }

    if (!blueAddress || !usdtAddress) {
        throw new Error(
            "ERROR CRÍTICO: Debe configurar BLUE_TOKEN_ADDRESS y USDT_TOKEN_ADDRESS en las variables de entorno."
        );
    }

    console.log(`[Config] BLUE Address: ${blueAddress}`);
    console.log(`[Config] USDT Address: ${usdtAddress}`);
    console.log(`[Config] Treasury:     ${treasuryAddress}`);
    console.log(`[Config] Fee inicial:  ${initialFeeBps} BPS (${(initialFeeBps / 100).toFixed(2)}%)`);

    // 1. Verificación de Bytecode on-chain (code.length > 0)
    const blueCode = await ethers.provider.getCode(blueAddress);
    if (blueCode === "0x" || blueCode === "0x0") {
        throw new Error(`ERROR: No existe contrato desplegado para BLUE en la dirección: ${blueAddress}`);
    }

    const usdtCode = await ethers.provider.getCode(usdtAddress);
    if (usdtCode === "0x" || usdtCode === "0x0") {
        throw new Error(`ERROR: No existe contrato desplegado para USDT en la dirección: ${usdtAddress}`);
    }

    // 2. Verificación de Decimales on-chain (decimals() == 6)
    const erc20Abi = [
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function name() view returns (string)"
    ];

    const blueContract = new ethers.Contract(blueAddress, erc20Abi, deployer);
    const usdtContract = new ethers.Contract(usdtAddress, erc20Abi, deployer);

    const blueDecimals = await blueContract.decimals();
    const usdtDecimals = await usdtContract.decimals();

    console.log(`[Validación] BLUE decimals(): ${blueDecimals}`);
    console.log(`[Validación] USDT decimals(): ${usdtDecimals}`);

    if (blueDecimals !== 6) {
        throw new Error(`ERROR: BLUE debe tener exactamente 6 decimales. Detectado: ${blueDecimals}`);
    }
    if (usdtDecimals !== 6) {
        throw new Error(`ERROR: USDT debe tener exactamente 6 decimales. Detectado: ${usdtDecimals}`);
    }

    // 3. Despliegue del Contrato WintonFifoExchange
    console.log("\n>>> Desplegando WintonFifoExchange...");
    const Exchange = await ethers.getContractFactory("WintonFifoExchange");
    const exchange = await Exchange.deploy(
        blueAddress,
        usdtAddress,
        treasuryAddress,
        initialFeeBps
    );

    await exchange.waitForDeployment();
    const exchangeAddress = await exchange.getAddress();

    console.log(`[Éxito] WintonFifoExchange desplegado en: ${exchangeAddress}`);
    console.log(`[Tx Hash] Despliegue: ${exchange.deploymentTransaction().hash}`);

    // 4. Verificación de Post-Deployment (Invariantes Iniciales)
    console.log("\n>>> Verificando invariantes iniciales de arranque...");
    const nextOrderId = await exchange.nextOrderId();
    const nextSeqId = await exchange.nextSequenceId();
    const matchId = await exchange.matchId();
    const blueHead = await exchange.blueHeadIndex();
    const usdtHead = await exchange.usdtHeadIndex();
    const paused = await exchange.paused();
    const owner = await exchange.owner();

    console.log(`- nextOrderId:     ${nextOrderId} (Esperado: 1)`);
    console.log(`- nextSequenceId:  ${nextSeqId} (Esperado: 1)`);
    console.log(`- matchId:         ${matchId} (Esperado: 1)`);
    console.log(`- blueHeadIndex:   ${blueHead} (Esperado: 0)`);
    console.log(`- usdtHeadIndex:   ${usdtHead} (Esperado: 0)`);
    console.log(`- Pausado:         ${paused} (Esperado: false)`);
    console.log(`- Owner:           ${owner}`);

    if (nextOrderId !== 1n || nextSeqId !== 1n || matchId !== 1n || blueHead !== 0n || usdtHead !== 0n) {
        throw new Error("ERROR GRAVE: Falló la verificación de invariantes iniciales.");
    }

    console.log("\n========================================================================");
    console.log("   DESPLIEGUE Y VERIFICACIÓN ON-CHAIN COMPLETADOS CON ÉXITO            ");
    console.log("========================================================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
