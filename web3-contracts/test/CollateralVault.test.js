const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Suite V4: CollateralVault — Pruebas Unitarias de Bóveda y Solvencia", function () {
    let owner, user1, user2, protocolMock, exchangeMock;
    let mockUsdt, vault;
    const ONE_TOKEN = 1_000_000n; // 6 decimales

    beforeEach(async function () {
        [owner, user1, user2, protocolMock, exchangeMock] = await ethers.getSigners();

        // 1. Desplegar MockUSDT con 6 decimales
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockUsdt = await MockERC20Factory.deploy("Tether USDT", "USDT", 6);
        await mockUsdt.waitForDeployment();

        // 2. Desplegar CollateralVault V4
        const VaultFactory = await ethers.getContractFactory("CollateralVault");
        vault = await VaultFactory.deploy(await mockUsdt.getAddress());
        await vault.waitForDeployment();

        // 3. Fondear usuarios
        await mockUsdt.mint(user1.address, 10_000n * ONE_TOKEN);
        await mockUsdt.mint(user2.address, 10_000n * ONE_TOKEN);

        // 4. Approvals
        await mockUsdt.connect(user1).approve(await vault.getAddress(), ethers.MaxUint256);
        await mockUsdt.connect(user2).approve(await vault.getAddress(), ethers.MaxUint256);
    });

    // ========================================================================
    // PRUEBAS DE DEPÓSITO
    // ========================================================================
    describe("Depósitos de Garantía", function () {
        it("Debe registrar depósitos e incrementar el colateral bloqueado", async function () {
            const depositAmount = 500n * ONE_TOKEN;

            await expect(vault.connect(user1).deposit(depositAmount))
                .to.emit(vault, "CollateralDeposited")
                .withArgs(user1.address, depositAmount, depositAmount, depositAmount);

            expect(await vault.userCollateral(user1.address)).to.equal(depositAmount);
            expect(await vault.totalCollateralLocked()).to.equal(depositAmount);
            expect(await mockUsdt.balanceOf(await vault.getAddress())).to.equal(depositAmount);
        });

        it("Revierte si el monto es cero", async function () {
            await expect(vault.connect(user1).deposit(0))
                .to.be.revertedWith("Vault: Deposit amount must be greater than zero");
        });
    });

    // ========================================================================
    // GOBERNANZA Y ENLACE DE CONTRATOS
    // ========================================================================
    describe("Enlace de Contratos Centrales", function () {
        it("Permite enlazar CoreProtocol y Exchange una única vez", async function () {
            await expect(vault.linkCoreContracts(protocolMock.address, exchangeMock.address))
                .to.emit(vault, "CoreContractsLinked")
                .withArgs(protocolMock.address, exchangeMock.address);

            expect(await vault.coreProtocol()).to.equal(protocolMock.address);
            expect(await vault.exchange()).to.equal(exchangeMock.address);
            expect(await vault.protocolLocked()).to.be.true;

            // Segundo intento revierte
            await expect(vault.linkCoreContracts(user1.address, user2.address))
                .to.be.revertedWith("Vault: Core contracts are already locked");
        });

        it("Prohíbe renunciar a la propiedad", async function () {
            await expect(vault.renounceOwnership())
                .to.be.revertedWith("Vault: Ownership renunciation is permanently disabled");
        });
    });

    // ========================================================================
    // CÁLCULO DE COLATERAL LIBRE Y RETIROS
    // ========================================================================
    describe("Retiro de Colateral Libre vs Comprometido", function () {
        it("Permite retirar el 100% si no hay compromisos activos", async function () {
            const depositAmount = 1_000n * ONE_TOKEN;
            await vault.connect(user1).deposit(depositAmount);

            expect(await vault.getFreeCollateral(user1.address)).to.equal(depositAmount);

            await expect(vault.connect(user1).withdraw(400n * ONE_TOKEN))
                .to.emit(vault, "CollateralWithdrawn")
                .withArgs(user1.address, 400n * ONE_TOKEN, 600n * ONE_TOKEN, 600n * ONE_TOKEN);

            expect(await vault.userCollateral(user1.address)).to.equal(600n * ONE_TOKEN);
            expect(await vault.totalCollateralLocked()).to.equal(600n * ONE_TOKEN);
        });

        it("Revierte si el retiro supera el colateral libre", async function () {
            const depositAmount = 200n * ONE_TOKEN;
            await vault.connect(user1).deposit(depositAmount);

            await expect(vault.connect(user1).withdraw(250n * ONE_TOKEN))
                .to.be.revertedWith("Vault: Requested amount exceeds free collateral");
        });
    });

    // ========================================================================
    // PAUSA DE EMERGENCIA
    // ========================================================================
    describe("Pausable de Emergencia", function () {
        it("Pausa suspende depósitos y retiros", async function () {
            await vault.connect(user1).deposit(100n * ONE_TOKEN);
            await vault.pause();

            await expect(vault.connect(user1).deposit(50n * ONE_TOKEN))
                .to.be.revertedWithCustomError(vault, "EnforcedPause");

            await expect(vault.connect(user1).withdraw(50n * ONE_TOKEN))
                .to.be.revertedWithCustomError(vault, "EnforcedPause");

            await vault.unpause();
            await expect(vault.connect(user1).withdraw(50n * ONE_TOKEN))
                .to.emit(vault, "CollateralWithdrawn");
        });
    });
});
