const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Suite V4: Integración End-to-End del Ecosistema Completo (Leyes Económicas y Flujo de Vida)", function () {
    let deployer, relayer, alice, bob, charlie;
    let blueToken, redToken, treasury, vault, protocol, exchange, mockUsdt;

    const ONE_TOKEN = 1_000_000n; // 6 decimales nativos
    const BASE_CREDIT_LIMIT = 2_000n * ONE_TOKEN; // Límite de crédito 2,000 unidades

    beforeEach(async function () {
        [deployer, relayer, alice, bob, charlie] = await ethers.getSigners();

        // ====================================================================
        // 1. DESPLIEGUE DE TOKEN MOCK USDT (6 DECIMALES)
        // ====================================================================
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockUsdt = await MockERC20Factory.deploy("Tether USD", "USDT", 6);
        await mockUsdt.waitForDeployment();

        // ====================================================================
        // 2. DESPLIEGUE DE LA SUITE DE SMART CONTRACTS V4
        // ====================================================================
        const BlueFactory = await ethers.getContractFactory("BlueToken");
        blueToken = await BlueFactory.deploy();
        await blueToken.waitForDeployment();

        const RedFactory = await ethers.getContractFactory("RedToken");
        redToken = await RedFactory.deploy();
        await redToken.waitForDeployment();

        const TreasuryFactory = await ethers.getContractFactory("ProtocolTreasury");
        treasury = await TreasuryFactory.deploy(await blueToken.getAddress());
        await treasury.waitForDeployment();

        const VaultFactory = await ethers.getContractFactory("CollateralVault");
        vault = await VaultFactory.deploy(await mockUsdt.getAddress());
        await vault.waitForDeployment();

        const ProtocolFactory = await ethers.getContractFactory("CoreProtocol");
        protocol = await ProtocolFactory.deploy();
        await protocol.waitForDeployment();

        const ExchangeFactory = await ethers.getContractFactory("FifoExchange");
        exchange = await ExchangeFactory.deploy(
            await blueToken.getAddress(),
            await mockUsdt.getAddress(),
            await treasury.getAddress(),
            0 // Initial fee BPS = 0
        );
        await exchange.waitForDeployment();

        // ====================================================================
        // 3. CONFIGURACIÓN Y ENLACES ATÓMICOS
        // ====================================================================
        const blueAddr = await blueToken.getAddress();
        const redAddr = await redToken.getAddress();
        const treasuryAddr = await treasury.getAddress();
        const vaultAddr = await vault.getAddress();
        const protocolAddr = await protocol.getAddress();

        // Enlace irreversible de tokens
        await blueToken.setCoreProtocol(protocolAddr);
        await redToken.setCoreProtocol(protocolAddr);

        // Enlace de Bóveda
        await vault.linkCoreContracts(protocolAddr, treasuryAddr);

        // Enlace del Motor Central
        await protocol.setContracts(blueAddr, redAddr, treasuryAddr, vaultAddr);
        await protocol.setRelayer(relayer.address);

        // Registro KYC
        await protocol.setKYCStatus(alice.address, true);
        await protocol.setKYCStatus(bob.address, true);
        await protocol.setKYCStatus(charlie.address, true);

        // Asignación de Límite de Crédito
        await protocol.setCreditLimit(alice.address, BASE_CREDIT_LIMIT);
        await protocol.setCreditLimit(bob.address, BASE_CREDIT_LIMIT);
    });

    it("Flujo 1: Emisión Dual -> Custodia en Bóveda -> Venta en Exchange -> Amortización y Cierre Contable", async function () {
        // --------------------------------------------------------------------
        // FASE 1: Alice contrata un servicio a Bob por 500 unidades
        // Comisión de plataforma: 5% (25 unidades). Monto neto para Bob: 475 unidades.
        // --------------------------------------------------------------------
        const grossAmount = 500n * ONE_TOKEN;
        const expectedFee = 25n * ONE_TOKEN;
        const expectedNet = 475n * ONE_TOKEN;

        await protocol.connect(relayer).processPayment(alice.address, bob.address, grossAmount);

        // Comprobación de Balances
        expect(await redToken.balanceOf(alice.address)).to.equal(grossAmount);
        expect(await blueToken.balanceOf(bob.address)).to.equal(expectedNet);
        expect(await blueToken.balanceOf(await treasury.getAddress())).to.equal(expectedFee);

        // Capacidad restante de Alice: 2,000 - 500 = 1,500
        expect(await protocol.getAvailableCreditCapacity(alice.address)).to.equal(1_500n * ONE_TOKEN);

        // --------------------------------------------------------------------
        // FASE 2: Bob coloca sus 475 BLUE en venta en el FifoExchange
        // --------------------------------------------------------------------
        await blueToken.connect(bob).approve(await exchange.getAddress(), expectedNet);
        await exchange.connect(bob).createBlueOrder(expectedNet);

        expect(await blueToken.balanceOf(bob.address)).to.equal(0n);
        expect(await exchange.totalReservedBlue()).to.equal(expectedNet);

        // --------------------------------------------------------------------
        // FASE 3: Charlie entra con USDT para comprar 475 BLUE en el Exchange
        // --------------------------------------------------------------------
        await mockUsdt.mint(charlie.address, expectedNet);
        await mockUsdt.connect(charlie).approve(await exchange.getAddress(), expectedNet);
        await exchange.connect(charlie).createUsdtOrder(expectedNet);

        // Se ejecuta el matching bilateral 1:1
        await exchange.matchOrders(10, 10);

        // Bob ahora tiene 475 USDT líquidos
        expect(await mockUsdt.balanceOf(bob.address)).to.equal(expectedNet);
        // Charlie tiene 475 BLUE
        expect(await blueToken.balanceOf(charlie.address)).to.equal(expectedNet);

        // --------------------------------------------------------------------
        // FASE 4: Alice deposita 200 USDT en la CollateralVault
        // --------------------------------------------------------------------
        const collateralAmount = 200n * ONE_TOKEN;
        await mockUsdt.mint(alice.address, collateralAmount);
        await mockUsdt.connect(alice).approve(await vault.getAddress(), collateralAmount);
        await vault.connect(alice).deposit(collateralAmount);

        expect(await vault.userCollateral(alice.address)).to.equal(collateralAmount);
        // La deuda descubierta de Alice baja de 500 a 300
        // Su capacidad crediticia sube de 1,500 a 1,700 (2,000 - 300)
        expect(await protocol.getAvailableCreditCapacity(alice.address)).to.equal(1_700n * ONE_TOKEN);

        // --------------------------------------------------------------------
        // FASE 5: Alice utiliza su colateral para amortizar 200 unidades de su compromiso
        // (Resolución de la trampa de liquidez con repayWithCollateral)
        // --------------------------------------------------------------------
        await vault.connect(alice).repayWithCollateral(alice.address, collateralAmount);

        // El compromiso RED de Alice se redujo de 500 a 300
        expect(await redToken.balanceOf(alice.address)).to.equal(300n * ONE_TOKEN);
        expect(await vault.userCollateral(alice.address)).to.equal(0n);

        // --------------------------------------------------------------------
        // FASE 6: Charlie transfiere 300 BLUE a Alice, y Alice amortiza el saldo final
        // --------------------------------------------------------------------
        await blueToken.connect(charlie).transfer(alice.address, 300n * ONE_TOKEN);
        await protocol.connect(alice).amortizeWithBlue(300n * ONE_TOKEN);

        // Balance de compromiso RED de Alice queda en CERO absoluto
        expect(await redToken.balanceOf(alice.address)).to.equal(0n);
        // Capacidad restaurada al 100% de su límite base
        expect(await protocol.getAvailableCreditCapacity(alice.address)).to.equal(BASE_CREDIT_LIMIT);
    });

    it("Flujo 2: Vencimiento de Lotes, Garantía Exigible y Liquidación Proporcional de Morosidad", async function () {
        // Alice toma un compromiso de 800 unidades
        const amount = 800n * ONE_TOKEN;
        await protocol.connect(relayer).processPayment(alice.address, bob.address, amount);

        // Deposita 500 USDT en la bóveda
        await mockUsdt.mint(alice.address, 500n * ONE_TOKEN);
        await mockUsdt.connect(alice).approve(await vault.getAddress(), 500n * ONE_TOKEN);
        await vault.connect(alice).deposit(500n * ONE_TOKEN);

        // Día 1: No está vencido y 800 <= 2000 (límite base), por ende requiredCollateral = 0
        expect(await protocol.getRequiredCollateral(alice.address)).to.equal(0n);
        expect(await vault.getFreeCollateral(alice.address)).to.equal(500n * ONE_TOKEN);

        // Avanzar el tiempo 35 días (supera COMMITMENT_DURATION de 30 días)
        await time.increase(35 * 24 * 3600);

        // Ahora el compromiso de 800 está vencido. Garantía requerida = 800.
        expect(await protocol.getRequiredCollateral(alice.address)).to.equal(800n * ONE_TOKEN);
        // Garantía libre para retiro en la bóveda = max(0, 500 - 800) = 0 (bloqueo protector)
        expect(await vault.getFreeCollateral(alice.address)).to.equal(0n);

        // Intento de retirar colateral revierte por exceder garantia libre
        await expect(vault.connect(alice).withdraw(100n * ONE_TOKEN))
            .to.be.revertedWith("Vault: Requested amount exceeds free collateral");

        // Aún no está en mora formal (período de gracia de 30 días adicionales)
        expect(await protocol.isDelinquent(alice.address)).to.be.false;

        // Avanzar el tiempo otros 30 días (total 65 días > 60 días)
        await time.increase(30 * 24 * 3600);

        // Ahora Alice está formalmente morosa
        expect(await protocol.isDelinquent(alice.address)).to.be.true;

        // La bóveda ejecuta liquidación proporcional de morosidad
        await expect(vault.liquidateDelinquent(alice.address, 500n * ONE_TOKEN))
            .to.emit(vault, "DelinquentLiquidated");

        // El colateral liquidado extinguió 500 unidades del compromiso RED
        expect(await redToken.balanceOf(alice.address)).to.equal(300n * ONE_TOKEN);
        expect(await vault.userCollateral(alice.address)).to.equal(0n);
    });
});
