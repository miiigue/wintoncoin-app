const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Suite V4: Tokens (BLUE, RED) y ProtocolTreasury — Pruebas Unitarias", function () {
    let owner, protocolSigner, user1, user2, corporateWallet;
    let blueToken, redToken, treasury;
    const ONE_TOKEN = 1_000_000n; // 6 decimales (1 token = 1,000,000 unidades base)

    beforeEach(async function () {
        [owner, protocolSigner, user1, user2, corporateWallet] = await ethers.getSigners();

        // 1. Desplegar BlueToken V4
        const BlueTokenFactory = await ethers.getContractFactory("BlueToken");
        blueToken = await BlueTokenFactory.deploy();
        await blueToken.waitForDeployment();

        // 2. Desplegar RedToken V4
        const RedTokenFactory = await ethers.getContractFactory("RedToken");
        redToken = await RedTokenFactory.deploy();
        await redToken.waitForDeployment();

        // 3. Desplegar ProtocolTreasury V4 enlazando BlueToken
        const TreasuryFactory = await ethers.getContractFactory("ProtocolTreasury");
        treasury = await TreasuryFactory.deploy(await blueToken.getAddress());
        await treasury.waitForDeployment();

        // Configurar corporateTreasuryWallet
        await treasury.setCorporateTreasuryWallet(corporateWallet.address);
    });

    // ========================================================================
    // PRUEBAS DE BLUETOKEN V4
    // ========================================================================
    describe("BlueToken V4 — Estándar y Reglas de Emisión", function () {
        it("Debe inicializarse con nombre, símbolo y 6 decimales exactos", async function () {
            expect(await blueToken.name()).to.equal("BLUE Token");
            expect(await blueToken.symbol()).to.equal("BLUE");
            expect(await blueToken.decimals()).to.equal(6);
            expect(await blueToken.totalSupply()).to.equal(0n);
        });

        it("Permite enlazar el protocolo central una única vez (Patrón de Bloqueo Inmutable)", async function () {
            await expect(blueToken.setCoreProtocol(protocolSigner.address))
                .to.emit(blueToken, "ProtocolSet")
                .withArgs(protocolSigner.address);

            expect(await blueToken.coreProtocol()).to.equal(protocolSigner.address);
            expect(await blueToken.protocolLocked()).to.be.true;

            // Intentar reconfigurar debe revertir
            await expect(blueToken.setCoreProtocol(user1.address))
                .to.be.revertedWith("BLUE: Protocol reference is already locked");
        });

        it("Solo el protocolo enlazado puede mintear tokens BLUE", async function () {
            await blueToken.setCoreProtocol(protocolSigner.address);

            // Llamada no autorizada revierte
            await expect(blueToken.connect(user1).mint(user1.address, 100n * ONE_TOKEN))
                .to.be.revertedWith("BLUE: Unauthorized. Caller is not core protocol");

            // Llamada autorizada tiene éxito
            await blueToken.connect(protocolSigner).mint(user1.address, 100n * ONE_TOKEN);
            expect(await blueToken.balanceOf(user1.address)).to.equal(100n * ONE_TOKEN);
            expect(await blueToken.totalSupply()).to.equal(100n * ONE_TOKEN);
        });

        it("Solo el protocolo enlazado puede quemar tokens BLUE", async function () {
            await blueToken.setCoreProtocol(protocolSigner.address);
            await blueToken.connect(protocolSigner).mint(user1.address, 100n * ONE_TOKEN);

            // Quema no autorizada revierte
            await expect(blueToken.connect(user1).burn(user1.address, 40n * ONE_TOKEN))
                .to.be.revertedWith("BLUE: Unauthorized. Caller is not core protocol");

            // Quema autorizada
            await blueToken.connect(protocolSigner).burn(user1.address, 40n * ONE_TOKEN);
            expect(await blueToken.balanceOf(user1.address)).to.equal(60n * ONE_TOKEN);
            expect(await blueToken.totalSupply()).to.equal(60n * ONE_TOKEN);
        });

        it("Permite transferencias ordinarias limpias sin llamadas económicas externas", async function () {
            await blueToken.setCoreProtocol(protocolSigner.address);
            await blueToken.connect(protocolSigner).mint(user1.address, 100n * ONE_TOKEN);

            // Transferencia ordinaria entre user1 y user2
            await blueToken.connect(user1).transfer(user2.address, 35n * ONE_TOKEN);
            expect(await blueToken.balanceOf(user1.address)).to.equal(65n * ONE_TOKEN);
            expect(await blueToken.balanceOf(user2.address)).to.equal(35n * ONE_TOKEN);
        });

        it("Prohíbe renunciar a la propiedad (renounceOwnership deshabilitado)", async function () {
            await expect(blueToken.renounceOwnership())
                .to.be.revertedWith("BLUE: Ownership renunciation is permanently disabled");
        });
    });

    // ========================================================================
    // PRUEBAS DE REDTOKEN V4 (COMPROMISOS NO TRANSFERIBLES)
    // ========================================================================
    describe("RedToken V4 — Compromisos No Transferibles", function () {
        it("Debe inicializarse con nombre, símbolo y 6 decimales exactos", async function () {
            expect(await redToken.name()).to.equal("RED Commitment Token");
            expect(await redToken.symbol()).to.equal("RED");
            expect(await redToken.decimals()).to.equal(6);
            expect(await redToken.totalSupply()).to.equal(0n);
        });

        it("Permite enlazar el protocolo central una única vez y bloquea reconfiguraciones", async function () {
            await expect(redToken.setCoreProtocol(protocolSigner.address))
                .to.emit(redToken, "ProtocolSet")
                .withArgs(protocolSigner.address);

            expect(await redToken.protocolLocked()).to.be.true;

            await expect(redToken.setCoreProtocol(user1.address))
                .to.be.revertedWith("RED: Protocol reference is already locked");
        });

        it("Solo el protocolo puede originar (mintCommitment) y extinguir (burnCommitment)", async function () {
            await redToken.setCoreProtocol(protocolSigner.address);

            // Originación autorizada
            await redToken.connect(protocolSigner).mintCommitment(user1.address, 50n * ONE_TOKEN);
            expect(await redToken.balanceOf(user1.address)).to.equal(50n * ONE_TOKEN);
            expect(await redToken.totalSupply()).to.equal(50n * ONE_TOKEN);

            // Extinción autorizada
            await redToken.connect(protocolSigner).burnCommitment(user1.address, 20n * ONE_TOKEN);
            expect(await redToken.balanceOf(user1.address)).to.equal(30n * ONE_TOKEN);
            expect(await redToken.totalSupply()).to.equal(30n * ONE_TOKEN);

            // Intentos no autorizados revierten
            await expect(redToken.connect(user1).mintCommitment(user1.address, 10n * ONE_TOKEN))
                .to.be.revertedWith("RED: Unauthorized. Caller is not core protocol");
            await expect(redToken.connect(user1).burnCommitment(user1.address, 10n * ONE_TOKEN))
                .to.be.revertedWith("RED: Unauthorized. Caller is not core protocol");
        });

        it("BLOQUEA transferencias P2P entre usuarios (No transferibilidad estricta)", async function () {
            await redToken.setCoreProtocol(protocolSigner.address);
            await redToken.connect(protocolSigner).mintCommitment(user1.address, 50n * ONE_TOKEN);

            // Intento de transferencia directa de user1 a user2
            await expect(redToken.connect(user1).transfer(user2.address, 10n * ONE_TOKEN))
                .to.be.revertedWith("RED: Commitment tokens are strictly non-transferable between accounts");

            // Intento vía transferFrom
            await redToken.connect(user1).approve(user2.address, 10n * ONE_TOKEN);
            await expect(redToken.connect(user2).transferFrom(user1.address, user2.address, 10n * ONE_TOKEN))
                .to.be.revertedWith("RED: Commitment tokens are strictly non-transferable between accounts");
        });

        it("Prohíbe renunciar a la propiedad", async function () {
            await expect(redToken.renounceOwnership())
                .to.be.revertedWith("RED: Ownership renunciation is permanently disabled");
        });
    });

    // ========================================================================
    // PRUEBAS DE PROTOCOLTREASURY V4 (MERKLE CLAIMS Y TIMELOCK 48H)
    // ========================================================================
    describe("ProtocolTreasury V4 — Distribución Merkle y Timelock de 48h", function () {
        beforeEach(async function () {
            // Fondear la tesorería con tokens BLUE
            await blueToken.setCoreProtocol(protocolSigner.address);
            await blueToken.connect(protocolSigner).mint(await treasury.getAddress(), 10_000n * ONE_TOKEN);
        });

        it("Permite configurar Merkle root y cobrar bonos con prueba válida", async function () {
            const amountToClaim = 150n * ONE_TOKEN;

            // Construir Merkle leaf de 1 solo elemento (root = leaf, proof = [])
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const innerHash = ethers.keccak256(abiCoder.encode(["address", "uint256"], [user1.address, amountToClaim]));
            const leaf = ethers.keccak256(innerHash);

            await treasury.setMerkleRoot(leaf);

            // Ejecutar reclamo con prueba vacía (árbol de 1 hoja)
            await expect(treasury.connect(user1).claimBoosterReward(amountToClaim, []))
                .to.emit(treasury, "BoosterRewardClaimed")
                .withArgs(user1.address, amountToClaim);

            expect(await blueToken.balanceOf(user1.address)).to.equal(amountToClaim);
            expect(await treasury.hasClaimed(user1.address)).to.be.true;

            // Intento de doble reclamo revierte
            await expect(treasury.connect(user1).claimBoosterReward(amountToClaim, []))
                .to.be.revertedWith("Treasury: Reward already claimed for this period");
        });

        it("Permite resetear reclamos en lotes acotados", async function () {
            const amountToClaim = 50n * ONE_TOKEN;
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const innerHash = ethers.keccak256(abiCoder.encode(["address", "uint256"], [user1.address, amountToClaim]));
            const leaf = ethers.keccak256(innerHash);

            await treasury.setMerkleRoot(leaf);
            await treasury.connect(user1).claimBoosterReward(amountToClaim, []);
            expect(await treasury.hasClaimed(user1.address)).to.be.true;

            // Resetear lista
            await expect(treasury.resetClaims([user1.address]))
                .to.emit(treasury, "ClaimsReset")
                .withArgs(1);

            expect(await treasury.hasClaimed(user1.address)).to.be.false;
        });

        it("Flujo de Retiro de Excedentes: Requiere Timelock de 48 Horas", async function () {
            const surplusAmount = 1_000n * ONE_TOKEN;

            // 1. Proponer retiro
            await expect(treasury.proposeSurplusWithdrawal(surplusAmount))
                .to.emit(treasury, "SurplusWithdrawalProposed");

            // 2. Intentar ejecutar inmediatamente debe revertir (no han pasado 48h)
            await expect(treasury.executeSurplusWithdrawal())
                .to.be.revertedWith("Treasury: Timelock period has not elapsed yet (48h)");

            // 3. Avanzar el tiempo 47 horas (aún insuficiente)
            await time.increase(47 * 3600);
            await expect(treasury.executeSurplusWithdrawal())
                .to.be.revertedWith("Treasury: Timelock period has not elapsed yet (48h)");

            // 4. Avanzar 2 horas adicionales (49 horas transcurridas > 48h)
            await time.increase(2 * 3600);

            // 5. Ejecución exitosa
            const initialBalance = await blueToken.balanceOf(corporateWallet.address);
            await expect(treasury.executeSurplusWithdrawal())
                .to.emit(treasury, "SurplusWithdrawalExecuted")
                .withArgs(corporateWallet.address, surplusAmount);

            expect(await blueToken.balanceOf(corporateWallet.address)).to.equal(initialBalance + surplusAmount);
        });

        it("Permite cancelar una propuesta de retiro activa", async function () {
            const surplusAmount = 500n * ONE_TOKEN;
            await treasury.proposeSurplusWithdrawal(surplusAmount);

            await expect(treasury.cancelSurplusProposal())
                .to.emit(treasury, "SurplusWithdrawalCancelled")
                .withArgs(corporateWallet.address, surplusAmount);

            // Avanzar el tiempo
            await time.increase(50 * 3600);

            // Ejecución posterior a cancelación revierte
            await expect(treasury.executeSurplusWithdrawal())
                .to.be.revertedWith("Treasury: Proposal was cancelled");
        });

        it("Pausa de emergencia suspende los reclamos de recompensas", async function () {
            await treasury.pause();
            await expect(treasury.connect(user1).claimBoosterReward(10n * ONE_TOKEN, []))
                .to.be.revertedWithCustomError(treasury, "EnforcedPause");

            await treasury.unpause();
            // Ya no revierte por pausa
        });
    });
});
