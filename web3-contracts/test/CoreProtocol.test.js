const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Suite V4: CoreProtocol — Pruebas Unitarias de Emisión Dual, Agenda y Solvencia", function () {
    let owner, relayer, payer, payee, treasuryWallet;
    let blueToken, redToken, treasury, vault, protocol, mockUsdt;
    const ONE_TOKEN = 1_000_000n; // 6 decimales

    beforeEach(async function () {
        [owner, relayer, payer, payee, treasuryWallet] = await ethers.getSigners();

        // 1. Desplegar BlueToken V4
        const BlueFactory = await ethers.getContractFactory("BlueToken");
        blueToken = await BlueFactory.deploy();
        await blueToken.waitForDeployment();

        // 2. Desplegar RedToken V4
        const RedFactory = await ethers.getContractFactory("RedToken");
        redToken = await RedFactory.deploy();
        await redToken.waitForDeployment();

        // 3. Desplegar ProtocolTreasury V4
        const TreasuryFactory = await ethers.getContractFactory("ProtocolTreasury");
        treasury = await TreasuryFactory.deploy(await blueToken.getAddress());
        await treasury.waitForDeployment();

        // 4. Desplegar MockUSDT y CollateralVault V4
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockUsdt = await MockERC20Factory.deploy("Tether USDT", "USDT", 6);
        await mockUsdt.waitForDeployment();

        const VaultFactory = await ethers.getContractFactory("CollateralVault");
        vault = await VaultFactory.deploy(await mockUsdt.getAddress());
        await vault.waitForDeployment();

        // 5. Desplegar CoreProtocol V4
        const ProtocolFactory = await ethers.getContractFactory("CoreProtocol");
        protocol = await ProtocolFactory.deploy();
        await protocol.waitForDeployment();

        // 6. Enlazar contratos
        const protocolAddress = await protocol.getAddress();
        const treasuryAddress = await treasury.getAddress();
        const vaultAddress = await vault.getAddress();
        const blueAddress = await blueToken.getAddress();
        const redAddress = await redToken.getAddress();

        await blueToken.setCoreProtocol(protocolAddress);
        await redToken.setCoreProtocol(protocolAddress);
        await vault.linkCoreContracts(protocolAddress, treasuryAddress);

        await protocol.setContracts(blueAddress, redAddress, treasuryAddress, vaultAddress);
        await protocol.setRelayer(relayer.address);

        // 7. KYC y límites iniciales
        await protocol.setKYCStatus(payer.address, true);
        await protocol.setKYCStatus(payee.address, true);
        await protocol.setCreditLimit(payer.address, 1_000n * ONE_TOKEN);
    });

    // ========================================================================
    // MURO KYC Y CIRCUIT BREAKERS
    // ========================================================================
    describe("Muro KYC y Validaciones de Entrada", function () {
        it("Rechaza pagos si el pagador no tiene KYC", async function () {
            await protocol.setKYCStatus(payer.address, false);
            await expect(protocol.connect(relayer).processPayment(payer.address, payee.address, 100n * ONE_TOKEN))
                .to.be.revertedWith("Protocol: Payer KYC not verified");
        });

        it("Rechaza pagos si el beneficiario no tiene KYC", async function () {
            await protocol.setKYCStatus(payee.address, false);
            await expect(protocol.connect(relayer).processPayment(payer.address, payee.address, 100n * ONE_TOKEN))
                .to.be.revertedWith("Protocol: Payee KYC not verified");
        });

        it("Rechaza auto-pagos", async function () {
            await expect(protocol.connect(relayer).processPayment(payer.address, payer.address, 100n * ONE_TOKEN))
                .to.be.revertedWith("Protocol: Self payment not permitted");
        });

        it("Rechaza pagos que superan el límite de transacción (circuit breaker)", async function () {
            await protocol.setMaxTransactionAmount(50n * ONE_TOKEN);
            await expect(protocol.connect(relayer).processPayment(payer.address, payee.address, 100n * ONE_TOKEN))
                .to.be.revertedWith("Protocol: Exceeds max transaction limit");
        });
    });

    // ========================================================================
    // EMISIÓN DUAL Y AGENDA DE COMPROMISOS
    // ========================================================================
    describe("Emisión Dual y Agenda de Lotes (DebtLots)", function () {
        it("Procesa un pago y distribuye fondos respetando la paridad 1:1", async function () {
            const grossAmount = 200n * ONE_TOKEN;
            // Comisión del 5% = 10 tokens; Neto = 190 tokens
            const expectedFee = 10n * ONE_TOKEN;
            const expectedNet = 190n * ONE_TOKEN;

            await expect(protocol.connect(relayer).processPayment(payer.address, payee.address, grossAmount))
                .to.emit(protocol, "PaymentProcessed");

            // Saldos
            expect(await redToken.balanceOf(payer.address)).to.equal(grossAmount);
            expect(await blueToken.balanceOf(payee.address)).to.equal(expectedNet);
            expect(await blueToken.balanceOf(await treasury.getAddress())).to.equal(expectedFee);

            // Registro de lote de compromiso
            expect(await protocol.getUserDebtLotsCount(payer.address)).to.equal(1);
            const lot = await protocol.userDebtLots(payer.address, 0);
            expect(lot.id).to.equal(1n);
            expect(lot.amount).to.equal(grossAmount);
            expect(lot.remainingAmount).to.equal(grossAmount);
            expect(lot.repaid).to.be.false;
        });

        it("Rechaza pagos que exceden la capacidad de crédito disponible", async function () {
            // Límite es 1,000. Intentar pagar 1,001 debe revertir
            await expect(protocol.connect(relayer).processPayment(payer.address, payee.address, 1_001n * ONE_TOKEN))
                .to.be.revertedWith("Protocol: Insufficient credit capacity");
        });

        it("El colateral depositado en la bóveda aumenta la capacidad de crédito", async function () {
            // Usuario utiliza sus 1,000 de crédito base
            await protocol.connect(relayer).processPayment(payer.address, payee.address, 1_000n * ONE_TOKEN);
            expect(await protocol.getAvailableCreditCapacity(payer.address)).to.equal(0n);

            // Depositar 500 USDT en la bóveda cubre 500 de deuda y restaura 500 de capacidad
            await mockUsdt.mint(payer.address, 500n * ONE_TOKEN);
            await mockUsdt.connect(payer).approve(await vault.getAddress(), 500n * ONE_TOKEN);
            await vault.connect(payer).deposit(500n * ONE_TOKEN);

            expect(await protocol.getAvailableCreditCapacity(payer.address)).to.equal(500n * ONE_TOKEN);

            // Ahora puede procesar otro pago por hasta 500
            await expect(protocol.connect(relayer).processPayment(payer.address, payee.address, 500n * ONE_TOKEN))
                .to.emit(protocol, "PaymentProcessed");
        });
    });

    // ========================================================================
    // AMORTIZACIÓN Y EXTINCIÓN DETERMINISTA (FIFO)
    // ========================================================================
    describe("Amortización de Compromisos con BLUE", function () {
        it("Permite amortizar compromisos extinguiendo tokens BLUE y RED simultáneamente", async function () {
            // Payer origina compromiso de 200 (Neto: 190, Fee: 10)
            await protocol.connect(relayer).processPayment(payer.address, payee.address, 200n * ONE_TOKEN);

            // Payee transfiere 100 BLUE al payer
            await blueToken.connect(payee).transfer(payer.address, 100n * ONE_TOKEN);

            // Payer amortiza 100
            await expect(protocol.connect(payer).amortizeWithBlue(100n * ONE_TOKEN))
                .to.emit(protocol, "DebtAmortized")
                .withArgs(payer.address, 100n * ONE_TOKEN, 100n * ONE_TOKEN);

            expect(await redToken.balanceOf(payer.address)).to.equal(100n * ONE_TOKEN);
            expect(await blueToken.balanceOf(payer.address)).to.equal(0n);

            const lot = await protocol.userDebtLots(payer.address, 0);
            expect(lot.remainingAmount).to.equal(100n * ONE_TOKEN);
            expect(lot.repaid).to.be.false;
        });

        it("Poda lotes en estricto orden FIFO cuando una amortización cubre múltiples lotes", async function () {
            // Lote 1: 50
            await protocol.connect(relayer).processPayment(payer.address, payee.address, 50n * ONE_TOKEN);
            // Lote 2: 70
            await protocol.connect(relayer).processPayment(payer.address, payee.address, 70n * ONE_TOKEN);

            // Transferir 100 BLUE para amortizar
            await blueToken.connect(payee).transfer(payer.address, 100n * ONE_TOKEN);

            // Amortizar 100 (cubre los 50 del Lote 1 y 50 de los 70 del Lote 2)
            await protocol.connect(payer).amortizeWithBlue(100n * ONE_TOKEN);

            const lot1 = await protocol.userDebtLots(payer.address, 0);
            expect(lot1.remainingAmount).to.equal(0n);
            expect(lot1.repaid).to.be.true;

            const lot2 = await protocol.userDebtLots(payer.address, 1);
            expect(lot2.remainingAmount).to.equal(20n * ONE_TOKEN);
            expect(lot2.repaid).to.be.false;

            // Cabezal FIFO avanzó a 1
            expect(await protocol.userActiveLotHead(payer.address)).to.equal(1n);
        });
    });

    // ========================================================================
    // AGENDA DETERMINISTA: VENCIMIENTOS Y MOROSIDAD
    // ========================================================================
    describe("Determinismo Temporal: Vencimientos y Morosidad", function () {
        it("Identifica compromisos vencidos y calcula la garantía requerida con precisión", async function () {
            // Payer toma compromiso de 300 con límite 1,000
            await protocol.connect(relayer).processPayment(payer.address, payee.address, 300n * ONE_TOKEN);

            // Antes del vencimiento (día 1), no se requiere colateral porque 300 <= límite
            expect(await protocol.getRequiredCollateral(payer.address)).to.equal(0n);
            expect(await protocol.isDelinquent(payer.address)).to.be.false;

            // Avanzar el tiempo 31 días (supera COMMITMENT_DURATION de 30 días)
            await time.increase(31 * 24 * 3600);

            // Ahora el compromiso de 300 está vencido, requiriendo 300 de colateral
            expect(await protocol.getRequiredCollateral(payer.address)).to.equal(300n * ONE_TOKEN);
            // Pero aún no está en mora ejecutiva (período de gracia de 30 días)
            expect(await protocol.isDelinquent(payer.address)).to.be.false;

            // Avanzar otros 31 días (total 62 días > 60 días)
            await time.increase(31 * 24 * 3600);

            // Ahora el usuario está formalmente moroso
            expect(await protocol.isDelinquent(payer.address)).to.be.true;
        });
    });
});
