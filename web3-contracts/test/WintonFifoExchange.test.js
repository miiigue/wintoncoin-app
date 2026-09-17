const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WintonFifoExchange — Suite de Pruebas Unitarias y de Integración (V3.3.6)", function () {
    let owner, user1, user2, user3, treasury, attacker;
    let blueToken, usdtToken, redToken, exchange;
    const initialFeeBps = 0; // 0 BPS inicial conforme a V3.3.6
    const ONE_TOKEN = 1_000_000n; // 1e6 (6 decimales)

    beforeEach(async function () {
        [owner, user1, user2, user3, treasury, attacker] = await ethers.getSigners();

        // 1. Desplegar Mocks con 6 decimales exactos
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        blueToken = await MockERC20Factory.deploy("Winton BLUE", "BLUE", 6);
        await blueToken.waitForDeployment();

        usdtToken = await MockERC20Factory.deploy("Tether USDT", "USDT", 6);
        await usdtToken.waitForDeployment();

        // 2. Desplegar WintonFifoExchange
        const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
        exchange = await ExchangeFactory.deploy(
            await blueToken.getAddress(),
            await usdtToken.getAddress(),
            treasury.address,
            initialFeeBps
        );
        await exchange.waitForDeployment();

        // 3. Fondear usuarios de prueba
        await blueToken.mint(user1.address, 100_000n * ONE_TOKEN);
        await blueToken.mint(user2.address, 100_000n * ONE_TOKEN);
        await usdtToken.mint(user1.address, 100_000n * ONE_TOKEN);
        await usdtToken.mint(user2.address, 100_000n * ONE_TOKEN);

        // 4. Approvals
        await blueToken.connect(user1).approve(await exchange.getAddress(), ethers.MaxUint256);
        await blueToken.connect(user2).approve(await exchange.getAddress(), ethers.MaxUint256);
        await usdtToken.connect(user1).approve(await exchange.getAddress(), ethers.MaxUint256);
        await usdtToken.connect(user2).approve(await exchange.getAddress(), ethers.MaxUint256);
    });

    // =========================================================================
    // 1. INICIALIZACIÓN Y CONSTRUCTOR
    // =========================================================================
    describe("1. Constructor y Validaciones Iniciales", function () {
        it("Debe inicializarse con los parámetros correctos y sin órdenes", async function () {
            expect(await exchange.blueToken()).to.equal(await blueToken.getAddress());
            expect(await exchange.usdtToken()).to.equal(await usdtToken.getAddress());
            expect(await exchange.treasury()).to.equal(treasury.address);
            expect(await exchange.feeBps()).to.equal(0);
            expect(await exchange.nextOrderId()).to.equal(1);
            expect(await exchange.nextSequenceId()).to.equal(1);
            expect(await exchange.blueHeadIndex()).to.equal(0);
            expect(await exchange.usdtHeadIndex()).to.equal(0);
        });

        it("Debe revertir si BLUE o USDT tienen dirección zero", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            await expect(
                ExchangeFactory.deploy(ethers.ZeroAddress, await usdtToken.getAddress(), treasury.address, 0)
            ).to.be.revertedWithCustomError(exchange, "ZeroAddress");

            await expect(
                ExchangeFactory.deploy(await blueToken.getAddress(), ethers.ZeroAddress, treasury.address, 0)
            ).to.be.revertedWithCustomError(exchange, "ZeroAddress");
        });

        it("Debe revertir si BLUE y USDT son el mismo token", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            await expect(
                ExchangeFactory.deploy(await blueToken.getAddress(), await blueToken.getAddress(), treasury.address, 0)
            ).to.be.revertedWithCustomError(exchange, "IdenticalTokens");
        });

        it("Debe revertir si la tesorería es address(0) o address(this)", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            await expect(
                ExchangeFactory.deploy(await blueToken.getAddress(), await usdtToken.getAddress(), ethers.ZeroAddress, 0)
            ).to.be.revertedWithCustomError(exchange, "ZeroAddress");
        });

        it("Debe revertir si initialFeeBps > MAX_FEE_BPS (500)", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            await expect(
                ExchangeFactory.deploy(await blueToken.getAddress(), await usdtToken.getAddress(), treasury.address, 501)
            ).to.be.revertedWithCustomError(exchange, "FeeExceedsMax");
        });

        it("Debe revertir si los tokens no tienen 6 decimales", async function () {
            const Mock18 = await ethers.getContractFactory("MockERC20");
            const token18 = await Mock18.deploy("18 Dec", "DEC18", 18);
            await token18.waitForDeployment();

            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            await expect(
                ExchangeFactory.deploy(await token18.getAddress(), await usdtToken.getAddress(), treasury.address, 0)
            ).to.be.revertedWithCustomError(exchange, "InvalidDecimals");
        });
    });

    // =========================================================================
    // 2. CREACIÓN DE ÓRDENES (DEPOSITOS Y FIFO)
    // =========================================================================
    describe("2. Creación de Órdenes y Prelación FIFO", function () {
        it("test_createOrder_Blue: Debe crear orden BLUE->USDT con sequenceId correlativo", async function () {
            const amount = 100n * ONE_TOKEN;
            const tx = await exchange.connect(user1).createBlueOrder(amount);
            const receipt = await tx.wait();

            expect(await exchange.totalDepositedBlue()).to.equal(amount);
            expect(await exchange.totalReservedBlue()).to.equal(amount);
            expect(await exchange.nextOrderId()).to.equal(2);
            expect(await exchange.nextSequenceId()).to.equal(2);
            expect(await exchange.getBlueOrderIdsLength()).to.equal(1);

            const order = await exchange.orders(1);
            expect(order.id).to.equal(1);
            expect(order.sequenceId).to.equal(1);
            expect(order.remainingAmount).to.equal(amount);
            expect(order.originalAmount).to.equal(amount);
            expect(order.user).to.equal(user1.address);
            expect(order.status).to.equal(1); // OPEN
            expect(order.side).to.equal(0);   // BLUE_FOR_USDT
        });

        it("test_createOrder_Usdt: Debe crear orden USDT->BLUE con sequenceId correlativo", async function () {
            const amount = 50n * ONE_TOKEN;
            await exchange.connect(user2).createUsdtOrder(amount);

            expect(await exchange.totalDepositedUsdt()).to.equal(amount);
            expect(await exchange.totalReservedUsdt()).to.equal(amount);
            expect(await exchange.nextOrderId()).to.equal(2);
            expect(await exchange.nextSequenceId()).to.equal(2);

            const order = await exchange.orders(1);
            expect(order.id).to.equal(1);
            expect(order.sequenceId).to.equal(1);
            expect(order.side).to.equal(1); // USDT_FOR_BLUE
            expect(order.status).to.equal(1); // OPEN
        });

        it("test_minOrderAmount_Revert: Debe revertir depósitos inferiores a MIN_ORDER_AMOUNT (1e6)", async function () {
            await expect(
                exchange.connect(user1).createBlueOrder(999_999n)
            ).to.be.revertedWithCustomError(exchange, "OrderAmountTooLow");

            await expect(
                exchange.connect(user2).createUsdtOrder(0n)
            ).to.be.revertedWithCustomError(exchange, "OrderAmountTooLow");
        });

        it("test_strictFifoPriority: Monotonía estricta de sequenceId entre órdenes intercaladas", async function () {
            await exchange.connect(user1).createBlueOrder(10n * ONE_TOKEN); // ID 1, Seq 1
            await exchange.connect(user2).createUsdtOrder(20n * ONE_TOKEN); // ID 2, Seq 2
            await exchange.connect(user1).createBlueOrder(30n * ONE_TOKEN); // ID 3, Seq 3

            const o1 = await exchange.orders(1);
            const o2 = await exchange.orders(2);
            const o3 = await exchange.orders(3);

            expect(o1.sequenceId).to.equal(1);
            expect(o2.sequenceId).to.equal(2);
            expect(o3.sequenceId).to.equal(3);
        });
    });

    // =========================================================================
    // 3. MATCHING ENGINE Y LIQUIDACIÓN (PARIDAD 1:1)
    // =========================================================================
    describe("3. Motor de Matching y Liquidación Bilateral", function () {
        it("test_exactMatch: Cruce exacto 1:1 sin comisión (feeBps = 0)", async function () {
            const amount = 100n * ONE_TOKEN;
            await exchange.connect(user1).createBlueOrder(amount); // deposita BLUE, espera USDT
            await exchange.connect(user2).createUsdtOrder(amount); // deposita USDT, espera BLUE

            const u1UsdtBefore = await usdtToken.balanceOf(user1.address);
            const u2BlueBefore = await blueToken.balanceOf(user2.address);

            // Ejecutar match bilateral (1 match, 2 órdenes escaneadas)
            const tx = await exchange.matchOrders(10, 10);
            await tx.wait();

            // Verificaciones post-match
            const u1UsdtAfter = await usdtToken.balanceOf(user1.address);
            const u2BlueAfter = await blueToken.balanceOf(user2.address);

            expect(u1UsdtAfter - u1UsdtBefore).to.equal(amount);
            expect(u2BlueAfter - u2BlueBefore).to.equal(amount);

            // Ambas órdenes pasan a FILLED
            const o1 = await exchange.orders(1);
            const o2 = await exchange.orders(2);
            expect(o1.status).to.equal(3); // FILLED
            expect(o1.remainingAmount).to.equal(0);
            expect(o2.status).to.equal(3); // FILLED
            expect(o2.remainingAmount).to.equal(0);

            // Contabilidad
            expect(await exchange.totalReservedBlue()).to.equal(0);
            expect(await exchange.totalReservedUsdt()).to.equal(0);
            expect(await exchange.totalMatchedGrossBlue()).to.equal(amount);
            expect(await exchange.totalMatchedGrossUsdt()).to.equal(amount);
            expect(await exchange.blueHeadIndex()).to.equal(1);
            expect(await exchange.usdtHeadIndex()).to.equal(1);
        });

        it("test_partialFill_BlueGreater: BLUE mayor que USDT deja orden BLUE en cabeza como PARTIALLY_FILLED", async function () {
            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(40n * ONE_TOKEN);

            await exchange.matchOrders(1, 2);

            const o1 = await exchange.orders(1);
            const o2 = await exchange.orders(2);

            expect(o1.status).to.equal(2); // PARTIALLY_FILLED
            expect(o1.remainingAmount).to.equal(60n * ONE_TOKEN);
            expect(await exchange.getExecutedAmount(1)).to.equal(40n * ONE_TOKEN);

            expect(o2.status).to.equal(3); // FILLED
            expect(o2.remainingAmount).to.equal(0);

            // Punteros de cola: blueHeadIndex permanece en 0; usdtHeadIndex avanza a 1
            expect(await exchange.blueHeadIndex()).to.equal(0);
            expect(await exchange.usdtHeadIndex()).to.equal(1);
            expect(await exchange.totalReservedBlue()).to.equal(60n * ONE_TOKEN);
            expect(await exchange.totalReservedUsdt()).to.equal(0);
        });

        it("test_partialFill_UsdtGreater: USDT mayor que BLUE deja orden USDT en cabeza", async function () {
            await exchange.connect(user1).createBlueOrder(30n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(100n * ONE_TOKEN);

            await exchange.matchOrders(1, 2);

            const o1 = await exchange.orders(1);
            const o2 = await exchange.orders(2);

            expect(o1.status).to.equal(3); // FILLED
            expect(o2.status).to.equal(2); // PARTIALLY_FILLED
            expect(o2.remainingAmount).to.equal(70n * ONE_TOKEN);

            expect(await exchange.blueHeadIndex()).to.equal(1);
            expect(await exchange.usdtHeadIndex()).to.equal(0);
        });

        it("test_multiplePartialFills: Orden grande de 100 liquidada por 5 órdenes de 20 consecutivas", async function () {
            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);

            for (let i = 0; i < 5; i++) {
                await exchange.connect(user2).createUsdtOrder(20n * ONE_TOKEN);
            }

            // Cascada de cruces
            await exchange.matchOrders(10, 20);

            const o1 = await exchange.orders(1);
            expect(o1.status).to.equal(3); // FILLED
            expect(o1.remainingAmount).to.equal(0);
            expect(await exchange.getExecutedAmount(1)).to.equal(100n * ONE_TOKEN);

            expect(await exchange.blueHeadIndex()).to.equal(1);
            expect(await exchange.usdtHeadIndex()).to.equal(5);
            expect(await exchange.totalReservedBlue()).to.equal(0);
            expect(await exchange.totalReservedUsdt()).to.equal(0);
        });

        it("test_feeCalculation_500Bps: Cruce con comisión máxima de 500 BPS (5.00%)", async function () {
            // Configurar fee a 500 BPS vía timelock simulado
            await exchange.connect(owner).proposeFeeUpdate(500);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();
            expect(await exchange.feeBps()).to.equal(500);

            const gross = 100n * ONE_TOKEN;
            await exchange.connect(user1).createBlueOrder(gross);
            await exchange.connect(user2).createUsdtOrder(gross);

            const u1UsdtBefore = await usdtToken.balanceOf(user1.address);
            const u2BlueBefore = await blueToken.balanceOf(user2.address);

            await exchange.matchOrders(1, 2);

            // Comisión = floor(100 * 500 / 10000) = 5 tokens
            // Neto = 95 tokens
            const expectedFee = 5n * ONE_TOKEN;
            const expectedNet = 95n * ONE_TOKEN;

            expect((await usdtToken.balanceOf(user1.address)) - u1UsdtBefore).to.equal(expectedNet);
            expect((await blueToken.balanceOf(user2.address)) - u2BlueBefore).to.equal(expectedNet);

            expect(await exchange.accumulatedFeesBlue()).to.equal(expectedFee);
            expect(await exchange.accumulatedFeesUsdt()).to.equal(expectedFee);
            expect(await exchange.totalFeesGeneratedBlue()).to.equal(expectedFee);
            expect(await exchange.totalFeesGeneratedUsdt()).to.equal(expectedFee);
        });
    });

    // =========================================================================
    // 4. PRESUPUESTO DE INSPECCIÓN (MAXORDERSSCANNED)
    // =========================================================================
    describe("4. Presupuesto de Inspección maxOrdersScanned (Límites 0, 1, 2)", function () {
        beforeEach(async function () {
            await exchange.connect(user1).createBlueOrder(50n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(50n * ONE_TOKEN);
        });

        it("test_maxOrdersScanned_0: Límite 0 detiene el bucle sin ejecutar nada", async function () {
            const tx = await exchange.matchOrders(10, 0);
            await tx.wait();

            expect(await exchange.blueHeadIndex()).to.equal(0);
            expect(await exchange.usdtHeadIndex()).to.equal(0);
            expect(await exchange.totalMatchedGrossBlue()).to.equal(0);
        });

        it("test_maxOrdersScanned_1: Con límite 1, solo se inspecciona BLUE; si está activa no mira USDT", async function () {
            const tx = await exchange.matchOrders(10, 1);
            await tx.wait();

            // No se ejecuta match porque se requieren 2 cabezas activas
            expect(await exchange.totalMatchedGrossBlue()).to.equal(0);
            expect(await exchange.blueHeadIndex()).to.equal(0);
            expect(await exchange.usdtHeadIndex()).to.equal(0);
        });

        it("test_maxOrdersScanned_1_con_cabeza_cancelada: Poda cabeza cancelada y para de inmediato", async function () {
            // Cancelar orden en cabeza de BLUE
            await exchange.connect(user1).cancelOrder(1);

            // Llamar con presupuesto 1: debe podar BLUE y detenerse sin mirar USDT
            await exchange.matchOrders(10, 1);

            expect(await exchange.blueHeadIndex()).to.equal(1);
            expect(await exchange.usdtHeadIndex()).to.equal(0);
        });

        it("test_maxOrdersScanned_2: Con límite 2, inspecciona ambas y liquida el match", async function () {
            await exchange.matchOrders(10, 2);

            expect(await exchange.totalMatchedGrossBlue()).to.equal(50n * ONE_TOKEN);
            expect(await exchange.blueHeadIndex()).to.equal(1);
            expect(await exchange.usdtHeadIndex()).to.equal(1);
        });
    });

    // =========================================================================
    // 5. CANCELACIÓN DE ÓRDENES Y LAZY PRUNING
    // =========================================================================
    describe("5. Cancelación de Órdenes y Lazy Pruning", function () {
        it("test_cancelOrder_Open: Cancelación de orden virgen reembolsa el 100%", async function () {
            const amount = 50n * ONE_TOKEN;
            await exchange.connect(user1).createBlueOrder(amount);

            const u1Before = await blueToken.balanceOf(user1.address);
            await exchange.connect(user1).cancelOrder(1);
            const u1After = await blueToken.balanceOf(user1.address);

            expect(u1After - u1Before).to.equal(amount);
            const o = await exchange.orders(1);
            expect(o.status).to.equal(4); // CANCELLED
            expect(o.remainingAmount).to.equal(0);

            expect(await exchange.totalReservedBlue()).to.equal(0);
            expect(await exchange.totalRefundedBlue()).to.equal(amount);
        });

        it("test_cancelOrder_PartiallyFilled: Solo reembolsa el saldo remanente", async function () {
            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(40n * ONE_TOKEN);
            await exchange.matchOrders(1, 2);

            // Remanente activo = 60
            const u1Before = await blueToken.balanceOf(user1.address);
            await exchange.connect(user1).cancelOrder(1);
            const u1After = await blueToken.balanceOf(user1.address);

            expect(u1After - u1Before).to.equal(60n * ONE_TOKEN);
            const o = await exchange.orders(1);
            expect(o.status).to.equal(4); // CANCELLED
            expect(o.remainingAmount).to.equal(0);
            expect(await exchange.getExecutedAmount(1)).to.equal(40n * ONE_TOKEN);
        });

        it("test_cancelOrder_Unauthorized_Revert: Revert si un tercero intenta cancelar", async function () {
            await exchange.connect(user1).createBlueOrder(50n * ONE_TOKEN);
            await expect(
                exchange.connect(user2).cancelOrder(1)
            ).to.be.revertedWithCustomError(exchange, "Unauthorized");
        });

        it("test_cancelOrder_Terminal_Revert: Revert si la orden ya está FILLED o CANCELLED", async function () {
            await exchange.connect(user1).createBlueOrder(50n * ONE_TOKEN);
            await exchange.connect(user1).cancelOrder(1);

            await expect(
                exchange.connect(user1).cancelOrder(1)
            ).to.be.revertedWithCustomError(exchange, "OrderNotCancellable");
        });

        it("test_pause_AllowsCancellation: La cancelación opera normalmente durante pausa", async function () {
            await exchange.connect(user1).createBlueOrder(50n * ONE_TOKEN);
            await exchange.connect(owner).pause();
            expect(await exchange.paused()).to.be.true;

            // Intentar crear orden debe fallar en pausa
            await expect(
                exchange.connect(user1).createBlueOrder(50n * ONE_TOKEN)
            ).to.be.revertedWithCustomError(exchange, "EnforcedPause");

            // Cancelar orden debe ser exitoso en pausa
            await expect(exchange.connect(user1).cancelOrder(1)).to.not.be.reverted;
            const o = await exchange.orders(1);
            expect(o.status).to.equal(4); // CANCELLED
        });
    });

    // =========================================================================
    // 6. TIMELOCK Y GOBERNANZA (FEE Y TREASURY)
    // =========================================================================
    describe("6. Timelocks de Comisión y Tesorería (48 Horas)", function () {
        it("test_timelock_FeeUpdate_Completo: Flujo de propuesta, espera y ejecución", async function () {
            // Proponer fee de 250 BPS (2.50%)
            await exchange.connect(owner).proposeFeeUpdate(250);
            expect(await exchange.pendingFeeBps()).to.equal(250);

            // No se puede proponer otra si ya hay una pendiente (rechazo concurrente)
            await expect(
                exchange.connect(owner).proposeFeeUpdate(300)
            ).to.be.revertedWithCustomError(exchange, "FeeProposalAlreadyPending");

            // Intentar ejecutar antes de 48h revierte
            await expect(
                exchange.executeFeeUpdate()
            ).to.be.revertedWithCustomError(exchange, "TimelockNotExpired");

            // Avanzar 48 horas exactas
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");

            // Ejecución permissionless exitosa
            await exchange.connect(user1).executeFeeUpdate();
            expect(await exchange.feeBps()).to.equal(250);
            expect(await exchange.pendingFeeBps()).to.equal(0);
            expect(await exchange.feeUnlockTimestamp()).to.equal(0);
        });

        it("test_timelock_Cancellation: Cancelar propuesta pendiente libera el slot", async function () {
            await exchange.connect(owner).proposeFeeUpdate(200);
            await exchange.connect(owner).cancelFeeProposal();

            expect(await exchange.feeUnlockTimestamp()).to.equal(0);
            expect(await exchange.pendingFeeBps()).to.equal(0);

            // Ahora sí se puede proponer un nuevo valor
            await expect(exchange.connect(owner).proposeFeeUpdate(300)).to.not.be.reverted;
        });

        it("test_timelock_TreasuryUpdate: Actualización de tesorería y preservación de fees", async function () {
            const newTreasury = user3.address;
            await exchange.connect(owner).proposeTreasuryUpdate(newTreasury);

            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");

            await exchange.executeTreasuryUpdate();
            expect(await exchange.treasury()).to.equal(newTreasury);
        });

        it("test_claimFees_Execution: Reclamo transfiere únicamente a la tesorería activa", async function () {
            // Generar comisiones (fee = 500 BPS)
            await exchange.connect(owner).proposeFeeUpdate(500);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();

            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(100n * ONE_TOKEN);
            await exchange.matchOrders(1, 2);

            const treasuryBlueBefore = await blueToken.balanceOf(treasury.address);
            const treasuryUsdtBefore = await usdtToken.balanceOf(treasury.address);

            // Reclamo permissionless
            await exchange.connect(attacker).claimFees();

            expect((await blueToken.balanceOf(treasury.address)) - treasuryBlueBefore).to.equal(5n * ONE_TOKEN);
            expect((await usdtToken.balanceOf(treasury.address)) - treasuryUsdtBefore).to.equal(5n * ONE_TOKEN);
            expect(await exchange.accumulatedFeesBlue()).to.equal(0);
            expect(await exchange.accumulatedFeesUsdt()).to.equal(0);
        });
    });

    // =========================================================================
    // 7. SEGURIDAD Y CASOS EXTREMOS
    // =========================================================================
    describe("7. Seguridad, Rescate y Solvencia", function () {
        it("test_rescueForeignToken_RevertPairTokens: Prohibido rescatar BLUE o USDT", async function () {
            await expect(
                exchange.connect(owner).rescueForeignToken(await blueToken.getAddress(), owner.address, 100n)
            ).to.be.revertedWithCustomError(exchange, "CannotRescuePairToken");

            await expect(
                exchange.connect(owner).rescueForeignToken(await usdtToken.getAddress(), owner.address, 100n)
            ).to.be.revertedWithCustomError(exchange, "CannotRescuePairToken");
        });

        it("test_rescueForeignToken_Success: Rescate exitoso de token ajeno", async function () {
            const MockFactory = await ethers.getContractFactory("MockERC20");
            const foreignToken = await MockFactory.deploy("Foreign DAI", "DAI", 18);
            await foreignToken.waitForDeployment();

            await foreignToken.mint(await exchange.getAddress(), 1000n);
            await exchange.connect(owner).rescueForeignToken(await foreignToken.getAddress(), owner.address, 1000n);

            expect(await foreignToken.balanceOf(owner.address)).to.equal(1000n);
        });

        it("test_directTransfer_PreservesSolvency: Transferencia externa directa incrementa superávit sin romper solvencia", async function () {
            // Usuario envía directamente 50 BLUE al contrato
            await blueToken.mint(await exchange.getAddress(), 50n * ONE_TOKEN);

            const [surplus, isSolvent] = await exchange.freeSurplus(true);
            expect(isSolvent).to.be.true;
            expect(surplus).to.equal(50n * ONE_TOKEN);

            // Depósitos y reservas no se alteran
            expect(await exchange.totalDepositedBlue()).to.equal(0);
            expect(await exchange.totalReservedBlue()).to.equal(0);
        });

        it("test_unpause_IndependentOfExemption: unpause no depende de llamadas externas", async function () {
            await exchange.connect(owner).pause();
            expect(await exchange.paused()).to.be.true;

            await exchange.connect(owner).unpause();
            expect(await exchange.paused()).to.be.false;
        });

        it("test_invariants_Equivalencia_Contable: Ecuación totalDeposited == totalReserved + totalMatchedGross + totalRefunded", async function () {
            // Orden 1: 100 BLUE
            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            // Orden 2: 40 USDT
            await exchange.connect(user2).createUsdtOrder(40n * ONE_TOKEN);
            // Match parcial: 40
            await exchange.matchOrders(1, 2);
            // Cancelación del remanente de BLUE (60)
            await exchange.connect(user1).cancelOrder(1);

            // Verificar ecuación para BLUE:
            // totalDeposited (100) == totalReserved (0) + totalMatchedGross (40) + totalRefunded (60)
            const depB = await exchange.totalDepositedBlue();
            const resB = await exchange.totalReservedBlue();
            const matB = await exchange.totalMatchedGrossBlue();
            const refB = await exchange.totalRefundedBlue();

            expect(depB).to.equal(100n * ONE_TOKEN);
            expect(resB).to.equal(0n);
            expect(matB).to.equal(40n * ONE_TOKEN);
            expect(refB).to.equal(60n * ONE_TOKEN);
            expect(depB).to.equal(resB + matB + refB);

            // Verificar ecuación para USDT:
            // totalDeposited (40) == totalReserved (0) + totalMatchedGross (40) + totalRefunded (0)
            const depU = await exchange.totalDepositedUsdt();
            const resU = await exchange.totalReservedUsdt();
            const matU = await exchange.totalMatchedGrossUsdt();
            const refU = await exchange.totalRefundedUsdt();

            expect(depU).to.equal(40n * ONE_TOKEN);
            expect(resU).to.equal(0n);
            expect(matU).to.equal(40n * ONE_TOKEN);
            expect(refU).to.equal(0n);
            expect(depU).to.equal(resU + matU + refU);
        });
    });

    // =========================================================================
    // 8. BATERÍA DE PRUEBAS ADVERSARIALES, INVARIANTES Y EDGE CASES
    // =========================================================================
    describe("8. Batería de Pruebas Adversariales, Invariantes y Edge Cases", function () {
        it("test_adversarial_multipleConsecutiveCancellations: Poda perezosa de 5 órdenes canceladas consecutivas", async function () {
            // Crear 5 órdenes de BLUE (10 c/u)
            for (let i = 0; i < 5; i++) {
                await exchange.connect(user1).createBlueOrder(10n * ONE_TOKEN);
            }
            // Cancelar las 5 órdenes creadas (IDs 1 al 5)
            for (let i = 1; i <= 5; i++) {
                await exchange.connect(user1).cancelOrder(i);
            }

            // Crear una sexta orden activa de BLUE de 50
            await exchange.connect(user1).createBlueOrder(50n * ONE_TOKEN);

            // Crear una orden activa de USDT de 50
            await exchange.connect(user2).createUsdtOrder(50n * ONE_TOKEN);

            // Ejecutar match con presupuesto suficiente para podar y cruzar (maxMatches: 5, maxOrdersScanned: 20)
            const tx = await exchange.matchOrders(5, 20);
            const receipt = await tx.wait();

            // La cabeza de BLUE debe haber avanzado hasta la orden 6 y haber quedado en 6 (index 6, que es la siguiente o vacía)
            expect(await exchange.blueHeadIndex()).to.equal(6n);
            expect(await exchange.usdtHeadIndex()).to.equal(1n);

            // La orden 6 de BLUE y la orden 1 de USDT deben quedar FILLED
            const bOrder6 = await exchange.orders(6);
            const uOrder1 = await exchange.orders(7); // USDT order is ID 7
            expect(bOrder6.status).to.equal(3n); // FILLED
            expect(uOrder1.status).to.equal(3n); // FILLED
        });

        it("test_adversarial_dustExecution_1MicroUnit: Ejecución de 1 micro-unidad no produce net==0", async function () {
            // Inicializar comisión máxima de 500 BPS (5.00%)
            await exchange.connect(owner).proposeFeeUpdate(500);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();
            expect(await exchange.feeBps()).to.equal(500);

            // Orden 1: 1,000,000 BLUE (mínimo permitido)
            await exchange.connect(user1).createBlueOrder(1_000_000n);
            // Orden 2: 1,000,001 USDT (1 micro-unidad más)
            await exchange.connect(user2).createUsdtOrder(1_000_001n);

            // Primer cruce: liquida 1,000,000. Queda 1 micro-unidad remanente en USDT
            await exchange.matchOrders(1, 2);
            let uOrder = await exchange.orders(2);
            expect(uOrder.remainingAmount).to.equal(1n);
            expect(uOrder.status).to.equal(2n); // PARTIALLY_FILLED

            // Crear nueva orden de BLUE por el mínimo (1,000,000) para cruzar con el remanente de 1
            await exchange.connect(user1).createBlueOrder(1_000_000n);

            const user2UsdtBefore = await usdtToken.balanceOf(user2.address);
            const user2BlueBefore = await blueToken.balanceOf(user2.address);

            // Segundo cruce: liquida exactamente gross = 1
            // Con gross = 1 y feeBps = 500: fee = (1 * 500) / 10000 = 0. net = 1 - 0 = 1.
            await exchange.matchOrders(1, 2);

            const user2BlueAfter = await blueToken.balanceOf(user2.address);
            // User2 debe haber recibido exactamente 1 micro-unidad de BLUE
            expect(user2BlueAfter - user2BlueBefore).to.equal(1n);

            // La orden de USDT debe estar ahora FILLED
            uOrder = await exchange.orders(2);
            expect(uOrder.status).to.equal(3n); // FILLED
            expect(uOrder.remainingAmount).to.equal(0n);
        });

        it("test_adversarial_timelockGracePeriod_Boundary: Revert antes de 48h y revert después del grace period", async function () {
            await exchange.connect(owner).proposeFeeUpdate(150);

            // 1. Antes de 48h -> revert
            await expect(exchange.executeFeeUpdate()).to.be.revertedWithCustomError(
                exchange,
                "TimelockNotExpired"
            );

            // 2. Exactamente tras 48h -> éxito
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await expect(exchange.executeFeeUpdate()).to.not.be.reverted;
            expect(await exchange.feeBps()).to.equal(150);

            // 3. Proponer nueva comisión y esperar más allá del grace period (7 días)
            await exchange.connect(owner).proposeFeeUpdate(200);
            const TIMELOCK_DELAY = 48 * 3600;
            const GRACE_PERIOD = 7 * 24 * 3600;

            // Avanzar más allá de unlockTime + GRACE_PERIOD
            await ethers.provider.send("evm_increaseTime", [TIMELOCK_DELAY + GRACE_PERIOD + 10]);
            await ethers.provider.send("evm_mine");

            // Intento de ejecución debe revertir con ProposalExpired
            await expect(exchange.executeFeeUpdate()).to.be.revertedWithCustomError(
                exchange,
                "ProposalExpired"
            );
        });

        it("test_adversarial_claimFeesDuringPause: La tesorería puede reclamar comisiones durante pausa de emergencia", async function () {
            // Proponer y activar fee de 100 BPS (1.00%) para generar comisiones
            await exchange.connect(owner).proposeFeeUpdate(100);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();

            // Generar comisiones
            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(100n * ONE_TOKEN);
            await exchange.matchOrders(1, 2);

            const accBlue = await exchange.accumulatedFeesBlue();
            const accUsdt = await exchange.accumulatedFeesUsdt();
            expect(accBlue).to.be.gt(0n);
            expect(accUsdt).to.be.gt(0n);

            // Activar pausa de emergencia
            await exchange.connect(owner).pause();
            expect(await exchange.paused()).to.be.true;

            // Intentar crear orden en pausa debe revertir
            await expect(
                exchange.connect(user1).createBlueOrder(10n * ONE_TOKEN)
            ).to.be.revertedWithCustomError(exchange, "EnforcedPause");

            // Intentar match en pausa debe revertir
            await expect(
                exchange.matchOrders(1, 2)
            ).to.be.revertedWithCustomError(exchange, "EnforcedPause");

            // claimFees() DEBE operar con éxito aun bajo pausa
            const treasuryAddr = await exchange.treasury();
            const blueTreasuryBefore = await blueToken.balanceOf(treasuryAddr);
            const usdtTreasuryBefore = await usdtToken.balanceOf(treasuryAddr);

            await exchange.claimFees();

            const blueTreasuryAfter = await blueToken.balanceOf(treasuryAddr);
            const usdtTreasuryAfter = await usdtToken.balanceOf(treasuryAddr);

            expect(blueTreasuryAfter - blueTreasuryBefore).to.equal(accBlue);
            expect(usdtTreasuryAfter - usdtTreasuryBefore).to.equal(accUsdt);
            expect(await exchange.accumulatedFeesBlue()).to.equal(0n);
            expect(await exchange.accumulatedFeesUsdt()).to.equal(0n);
        });

        it("test_adversarial_cannotRescuePairsUnderAnyCondition: El owner no puede retirar reservas bajo rescueForeignToken", async function () {
            await expect(
                exchange.connect(owner).rescueForeignToken(await blueToken.getAddress(), owner.address, 100n)
            ).to.be.revertedWithCustomError(exchange, "CannotRescuePairToken");

            await expect(
                exchange.connect(owner).rescueForeignToken(await usdtToken.getAddress(), owner.address, 100n)
            ).to.be.revertedWithCustomError(exchange, "CannotRescuePairToken");
        });

        it("test_adversarial_feeBounds_InvalidFeeBps_Revert: Proponer más de 500 BPS es rechazado", async function () {
            await expect(
                exchange.connect(owner).proposeFeeUpdate(501)
            ).to.be.revertedWithCustomError(exchange, "FeeExceedsMax");
        });
    });

    // =========================================================================
    // 9. ENDURECIMIENTO V3.3.6 (HARDENING, SOLVENCIA Y GOBERNANZA)
    // =========================================================================
    describe("9. Endurecimiento V3.3.6 (Hardening, Solvencia y Gobernanza)", function () {
        let feeTokenMock;

        beforeEach(async function () {
            const MockFeeFactory = await ethers.getContractFactory("MockFeeOnTransferERC20");
            feeTokenMock = await MockFeeFactory.deploy("Fee Token", "FEE", 6);
            await feeTokenMock.waitForDeployment();
            await feeTokenMock.mint(user1.address, 100_000n * ONE_TOKEN);
        });

        // 1 & 2. Depósitos exactos
        it("1. Depósito BLUE exacto verifica incremento exacto de balance y registro contable", async function () {
            const amount = 50n * ONE_TOKEN;
            const balBefore = await blueToken.balanceOf(await exchange.getAddress());
            await exchange.connect(user1).createBlueOrder(amount);
            const balAfter = await blueToken.balanceOf(await exchange.getAddress());
            expect(balAfter - balBefore).to.equal(amount);
            expect(await exchange.totalReservedBlue()).to.equal(amount);
        });

        it("2. Depósito USDT exacto verifica incremento exacto de balance y registro contable", async function () {
            const amount = 75n * ONE_TOKEN;
            const balBefore = await usdtToken.balanceOf(await exchange.getAddress());
            await exchange.connect(user2).createUsdtOrder(amount);
            const balAfter = await usdtToken.balanceOf(await exchange.getAddress());
            expect(balAfter - balBefore).to.equal(amount);
            expect(await exchange.totalReservedUsdt()).to.equal(amount);
        });

        // 3 & 4. Revert ante depósito con discrepancia de monto recibido
        it("3. Revert por depósito que recibe menos de amount en BLUE (DepositAmountMismatch)", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            const badExchange = await ExchangeFactory.deploy(
                await feeTokenMock.getAddress(),
                await usdtToken.getAddress(),
                treasury.address,
                0
            );
            await badExchange.waitForDeployment();
            await feeTokenMock.connect(user1).approve(await badExchange.getAddress(), ethers.MaxUint256);

            await expect(
                badExchange.connect(user1).createBlueOrder(10n * ONE_TOKEN)
            ).to.be.revertedWithCustomError(badExchange, "DepositAmountMismatch");
        });

        it("4. Revert por depósito que recibe menos de amount en USDT (DepositAmountMismatch)", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            const badExchange = await ExchangeFactory.deploy(
                await blueToken.getAddress(),
                await feeTokenMock.getAddress(),
                treasury.address,
                0
            );
            await badExchange.waitForDeployment();
            await feeTokenMock.connect(user1).approve(await badExchange.getAddress(), ethers.MaxUint256);

            await expect(
                badExchange.connect(user1).createUsdtOrder(10n * ONE_TOKEN)
            ).to.be.revertedWithCustomError(badExchange, "DepositAmountMismatch")
             .withArgs(10n * ONE_TOKEN, 10n * ONE_TOKEN - 10000n);
        });

        // 5. claimFees() con solvencia correcta
        it("5. claimFees() transfiere comisiones con éxito si el contrato es solvente", async function () {
            // Activar fee de 100 BPS (1.00%)
            await exchange.connect(owner).proposeFeeUpdate(100);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();

            // Ejecutar match para generar comisiones
            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(100n * ONE_TOKEN);
            await exchange.matchOrders(1, 2);

            const accBlue = await exchange.accumulatedFeesBlue();
            const accUsdt = await exchange.accumulatedFeesUsdt();
            expect(accBlue).to.be.gt(0n);
            expect(accUsdt).to.be.gt(0n);

            const treasuryBlueBefore = await blueToken.balanceOf(treasury.address);
            const treasuryUsdtBefore = await usdtToken.balanceOf(treasury.address);

            await expect(exchange.claimFees()).to.emit(exchange, "FeesClaimed");

            expect(await blueToken.balanceOf(treasury.address) - treasuryBlueBefore).to.equal(accBlue);
            expect(await usdtToken.balanceOf(treasury.address) - treasuryUsdtBefore).to.equal(accUsdt);
            expect(await exchange.accumulatedFeesBlue()).to.equal(0n);
            expect(await exchange.accumulatedFeesUsdt()).to.equal(0n);
        });

        // 6. claimFees() revierte si BLUE no cubre reservas + fees
        it("6. claimFees() revierte si BLUE no cubre reservas + fees (InsufficientContractFees)", async function () {
            await exchange.connect(owner).proposeFeeUpdate(100);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();

            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(100n * ONE_TOKEN);
            await exchange.matchOrders(1, 2);

            // Simular déficit en balance BLUE del exchange quemando 1 micro-token
            await blueToken.burn(await exchange.getAddress(), 1n);

            await expect(
                exchange.claimFees()
            ).to.be.revertedWithCustomError(exchange, "InsufficientContractFees");
        });

        // 7. claimFees() revierte si USDT no cubre reservas + fees
        it("7. claimFees() revierte si USDT no cubre reservas + fees (InsufficientContractFees)", async function () {
            await exchange.connect(owner).proposeFeeUpdate(100);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();

            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(100n * ONE_TOKEN);
            await exchange.matchOrders(1, 2);

            // Simular déficit en balance USDT del exchange quemando 1 micro-token
            await usdtToken.burn(await exchange.getAddress(), 1n);

            await expect(
                exchange.claimFees()
            ).to.be.revertedWithCustomError(exchange, "InsufficientContractFees");
        });

        // 8. renounceOwnership() deshabilitado
        it("8. renounceOwnership() revierte incondicionalmente para owner y para no-owner", async function () {
            await expect(
                exchange.connect(owner).renounceOwnership()
            ).to.be.revertedWithCustomError(exchange, "RenounceOwnershipDisabled");

            await expect(
                exchange.connect(attacker).renounceOwnership()
            ).to.be.revertedWithCustomError(exchange, "RenounceOwnershipDisabled");
        });

        // 9. Treasury no puede ser BLUE
        it("9. Treasury no puede ser BLUE (constructor y proposeTreasuryUpdate)", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            await expect(
                ExchangeFactory.deploy(await blueToken.getAddress(), await usdtToken.getAddress(), await blueToken.getAddress(), 0)
            ).to.be.revertedWithCustomError(exchange, "InvalidTreasuryAddress");

            await expect(
                exchange.connect(owner).proposeTreasuryUpdate(await blueToken.getAddress())
            ).to.be.revertedWithCustomError(exchange, "InvalidTreasuryAddress");
        });

        // 10. Treasury no puede ser USDT
        it("10. Treasury no puede ser USDT (constructor y proposeTreasuryUpdate)", async function () {
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            await expect(
                ExchangeFactory.deploy(await blueToken.getAddress(), await usdtToken.getAddress(), await usdtToken.getAddress(), 0)
            ).to.be.revertedWithCustomError(exchange, "InvalidTreasuryAddress");

            await expect(
                exchange.connect(owner).proposeTreasuryUpdate(await usdtToken.getAddress())
            ).to.be.revertedWithCustomError(exchange, "InvalidTreasuryAddress");
        });

        // 11. Treasury no puede ser Exchange
        it("11. Treasury no puede ser la dirección del Exchange (proposeTreasuryUpdate)", async function () {
            await expect(
                exchange.connect(owner).proposeTreasuryUpdate(await exchange.getAddress())
            ).to.be.revertedWithCustomError(exchange, "InvalidTreasuryAddress");
        });

        // 12. executeFeeUpdate() funciona con éxito tras 48h y posee nonReentrant
        it("12. executeFeeUpdate() funciona normalmente tras 48h con nonReentrant", async function () {
            await exchange.connect(owner).proposeFeeUpdate(250);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");

            await expect(exchange.executeFeeUpdate())
                .to.emit(exchange, "FeeProposalExecuted")
                .withArgs(0, 250);

            expect(await exchange.feeBps()).to.equal(250);
        });

        // 13. executeTreasuryUpdate() funciona con éxito tras 48h y posee nonReentrant
        it("13. executeTreasuryUpdate() funciona normalmente tras 48h con nonReentrant", async function () {
            const newTreasury = user3.address;
            await exchange.connect(owner).proposeTreasuryUpdate(newTreasury);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");

            await expect(exchange.executeTreasuryUpdate())
                .to.emit(exchange, "TreasuryProposalExecuted")
                .withArgs(treasury.address, newTreasury);

            expect(await exchange.treasury()).to.equal(newTreasury);
        });

        // 14. Prueba Adversarial Real de Reentrancia contra Timelocks
        it("14. Intento adversarial de reentrancia contra executeFeeUpdate() durante transferFrom es bloqueado por nonReentrant", async function () {
            // Desplegar MockReentrantERC20 como token BLUE
            const ReentrantMockFactory = await ethers.getContractFactory("MockReentrantERC20");
            const reentrantBlue = await ReentrantMockFactory.deploy("Reentrant BLUE", "RBLUE", 6);
            await reentrantBlue.waitForDeployment();

            // Desplegar instancia de Exchange con reentrantBlue y usdtToken normal
            const ExchangeFactory = await ethers.getContractFactory("WintonFifoExchange");
            const attackExchange = await ExchangeFactory.deploy(
                await reentrantBlue.getAddress(),
                await usdtToken.getAddress(),
                treasury.address,
                0
            );
            await attackExchange.waitForDeployment();

            // Fondear al usuario y aprobar
            const amount = 50n * ONE_TOKEN;
            await reentrantBlue.mint(user1.address, amount);
            await reentrantBlue.connect(user1).approve(await attackExchange.getAddress(), ethers.MaxUint256);

            // 1. Crear propuesta de Fee Update a 200 BPS y madurarla completamente (48 horas)
            await attackExchange.connect(owner).proposeFeeUpdate(200);
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");

            // Si se llamara executeFeeUpdate() en frío, tendría éxito porque está madura.
            // Configuramos el token para atacar reentrantemente durante transferFrom:
            await reentrantBlue.setAttackConfig(await attackExchange.getAddress(), true, false);

            // 2. Ejecutar createBlueOrder -> dispara transferFrom en reentrantBlue
            // reentrantBlue intercepta la llamada e intenta llamar a executeFeeUpdate() reentrantemente
            await attackExchange.connect(user1).createBlueOrder(amount);

            // 3. Verificaciones de seguridad:
            // a) El ataque de reentrancia fue intentado
            expect(await reentrantBlue.reentrancyAttempted()).to.be.true;
            // b) El ataque de reentrancia falló específicamente por la guarda nonReentrant
            expect(await reentrantBlue.reentrancyFailed()).to.be.true;
            // c) El feeBps del exchange NO fue alterado durante la reentrancia (sigue siendo 0)
            expect(await attackExchange.feeBps()).to.equal(0);
            // d) El selector del error devuelto corresponde exactamente a ReentrancyGuardReentrantCall() (0x3ee5aeb5)
            const expectedReentrancySelector = ethers.id("ReentrancyGuardReentrantCall()").slice(0, 10);
            const actualErrorData = await reentrantBlue.reentrancyErrorData();
            expect(actualErrorData.slice(0, 10)).to.equal(expectedReentrancySelector);

            // 4. Fuera de la llamada reentrante (llamada limpia), executeFeeUpdate() es permissionless y se ejecuta normalmente por user2
            expect(await attackExchange.owner()).to.equal(owner.address);
            expect(await reentrantBlue.getAddress()).to.not.equal(owner.address);
            expect(user2.address).to.not.equal(owner.address);

            await expect(attackExchange.connect(user2).executeFeeUpdate())
                .to.emit(attackExchange, "FeeProposalExecuted")
                .withArgs(0, 200);
            expect(await attackExchange.feeBps()).to.equal(200);
        });

        it("14b. Gobernanza estricta de Treasury: executeTreasuryUpdate() requiere obligatoriamente autorización de Owner tras 48h", async function () {
            // 1. Propuesta de Tesorería creada por el Owner
            const newTreasury = user3.address;
            await exchange.connect(owner).proposeTreasuryUpdate(newTreasury);

            // Transcurren las 48 horas obligatorias de timelock
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");

            // 2 y 3. Un usuario no-owner (user2) intenta ejecutar la propuesta madura y es rechazado por OwnableUnauthorizedAccount
            await expect(exchange.connect(user2).executeTreasuryUpdate())
                .to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount")
                .withArgs(user2.address);

            // 4. La dirección de Treasury permanece intacta (sin alteración por llamada no autorizada)
            expect(await exchange.treasury()).to.equal(treasury.address);

            // 5, 6 y 7. El Owner ejecuta conscientemente la propuesta madura
            await expect(exchange.connect(owner).executeTreasuryUpdate())
                .to.emit(exchange, "TreasuryProposalExecuted")
                .withArgs(treasury.address, newTreasury);

            // Treasury pasa exactamente a newTreasury (pendingTreasury)
            expect(await exchange.treasury()).to.equal(newTreasury);
        });

        // 15. Restricción Estricta de Fee 0 en Lanzamiento Oficial
        it("15. El proceso de lanzamiento oficial aborta si initialFeeBps !== 0", async function () {
            // Comprobación de regla estricta de lanzamiento oficial
            function validateOfficialDeploymentFee(feeBps) {
                if (feeBps !== 0) {
                    throw new Error(
                        `ERROR CRÍTICO: El lanzamiento oficial de WintonCoin exige INITIAL_FEE_BPS = 0 (detectado: ${feeBps} BPS). ` +
                        `No se permite desplegar la instancia oficial con comisiones iniciales activas.`
                    );
                }
                return true;
            }

            // Acepta 0
            expect(validateOfficialDeploymentFee(0)).to.be.true;

            // Rechaza explícitamente cualquier valor distinto de 0
            expect(() => validateOfficialDeploymentFee(1)).to.throw("ERROR CRÍTICO");
            expect(() => validateOfficialDeploymentFee(10)).to.throw("ERROR CRÍTICO");
            expect(() => validateOfficialDeploymentFee(100)).to.throw("ERROR CRÍTICO");
            expect(() => validateOfficialDeploymentFee(500)).to.throw("ERROR CRÍTICO");

            // En el contrato de la instancia oficial, el fee inicial activo es 0
            expect(await exchange.feeBps()).to.equal(0);
        });

        // 16. Violación de invariante: matchOrders revierte con InvalidMatchAmount si gross == 0
        it("16. matchOrders revierte formalmente con InvalidMatchAmount() si una orden activa tiene gross == 0", async function () {
            const HarnessFactory = await ethers.getContractFactory("WintonFifoExchangeHarness");
            const harness = await HarnessFactory.deploy(
                await blueToken.getAddress(),
                await usdtToken.getAddress(),
                treasury.address,
                0
            );
            await harness.waitForDeployment();

            // Fondear y aprobar
            await blueToken.mint(user1.address, 10n * ONE_TOKEN);
            await usdtToken.mint(user2.address, 10n * ONE_TOKEN);
            await blueToken.connect(user1).approve(await harness.getAddress(), ethers.MaxUint256);
            await usdtToken.connect(user2).approve(await harness.getAddress(), ethers.MaxUint256);

            await harness.connect(user1).createBlueOrder(10n * ONE_TOKEN);
            await harness.connect(user2).createUsdtOrder(10n * ONE_TOKEN);

            // Corromper artificialmente remainingAmount a 0 simulando una violación de invariante
            await harness.setOrderRemainingAmount(1, 0);

            // matchOrders debe revertir inmediatamente con InvalidMatchAmount en lugar de salida silenciosa
            await expect(harness.matchOrders(1, 10))
                .to.be.revertedWithCustomError(harness, "InvalidMatchAmount");
        });


        // 17. Invariantes FIFO preservados
        it("17. Invariantes y lógica FIFO de cruces y partial fills continúan intactos", async function () {
            await exchange.connect(user1).createBlueOrder(100n * ONE_TOKEN);
            await exchange.connect(user2).createUsdtOrder(40n * ONE_TOKEN);

            await exchange.matchOrders(10, 10);

            const o1 = await exchange.orders(1);
            const o2 = await exchange.orders(2);

            expect(o1.status).to.equal(2); // PARTIALLY_FILLED
            expect(o1.remainingAmount).to.equal(60n * ONE_TOKEN);
            expect(o2.status).to.equal(3); // FILLED
            expect(o2.remainingAmount).to.equal(0n);
        });
    });

    // =========================================================================
    // 9. FUZZ TESTING DE INVARIANTES Y PROPIEDADES CONTINUAS
    // =========================================================================
    describe("9. Fuzz Testing de Invariantes y Propiedades Continuas (Property-Based Sequence Fuzzing)", function () {
        async function assertAllAccountingInvariants(ex, bToken, uToken) {
            const depB = await ex.totalDepositedBlue();
            const resB = await ex.totalReservedBlue();
            const matB = await ex.totalMatchedGrossBlue();
            const refB = await ex.totalRefundedBlue();
            expect(depB).to.equal(resB + matB + refB, "INV-BLUE: totalDeposited == totalReserved + totalMatchedGross + totalRefunded");

            const depU = await ex.totalDepositedUsdt();
            const resU = await ex.totalReservedUsdt();
            const matU = await ex.totalMatchedGrossUsdt();
            const refU = await ex.totalRefundedUsdt();
            expect(depU).to.equal(resU + matU + refU, "INV-USDT: totalDeposited == totalReserved + totalMatchedGross + totalRefunded");

            const genB = await ex.totalFeesGeneratedBlue();
            const accB = await ex.accumulatedFeesBlue();
            const claB = await ex.totalFeesClaimedBlue();
            expect(genB).to.equal(accB + claB, "INV-FEE-BLUE: totalFeesGenerated == accumulatedFees + totalFeesClaimed");

            const genU = await ex.totalFeesGeneratedUsdt();
            const accU = await ex.accumulatedFeesUsdt();
            const claU = await ex.totalFeesClaimedUsdt();
            expect(genU).to.equal(accU + claU, "INV-FEE-USDT: totalFeesGenerated == accumulatedFees + totalFeesClaimed");

            const balB = await bToken.balanceOf(await ex.getAddress());
            const balU = await uToken.balanceOf(await ex.getAddress());
            expect(balB).to.be.gte(resB + accB, "SOLVENCY-BLUE: balanceBlue >= totalReservedBlue + accumulatedFeesBlue");
            expect(balU).to.be.gte(resU + accU, "SOLVENCY-USDT: balanceUsdt >= totalReservedUsdt + accumulatedFeesUsdt");

            const [surplusB, solventB] = await ex.freeSurplus(true);
            const [surplusU, solventU] = await ex.freeSurplus(false);
            expect(solventB).to.be.true;
            expect(solventU).to.be.true;
            expect(surplusB).to.equal(balB - (resB + accB));
            expect(surplusU).to.equal(balU - (resU + accU));
        }

        it("test_fuzz_continuous_sequence_invariants: Secuencia aleatoria multivariante de 50 operaciones preserva el 100% de invariantes", async function () {
            // Activar comisión para que los cruces generen fees
            await exchange.connect(owner).proposeFeeUpdate(50); // 0.50%
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
            await exchange.executeFeeUpdate();

            const activeOrderIds = [];
            // Semilla determinista pseudo-aleatoria
            let seed = 123456789;
            function pseudoRandom(min, max) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return min + (seed % (max - min + 1));
            }

            for (let step = 1; step <= 50; step++) {
                const action = pseudoRandom(1, 5);
                const randomAmount = BigInt(pseudoRandom(1, 50)) * ONE_TOKEN;

                if (action === 1) {
                    // Crear orden BLUE
                    await exchange.connect(user1).createBlueOrder(randomAmount);
                    const nextId = await exchange.nextOrderId();
                    activeOrderIds.push(nextId - 1n);
                } else if (action === 2) {
                    // Crear orden USDT
                    await exchange.connect(user2).createUsdtOrder(randomAmount);
                    const nextId = await exchange.nextOrderId();
                    activeOrderIds.push(nextId - 1n);
                } else if (action === 3) {
                    // Match con presupuesto variable
                    const maxM = pseudoRandom(1, 5);
                    const maxS = pseudoRandom(2, 10);
                    await exchange.matchOrders(maxM, maxS);
                } else if (action === 4) {
                    // Cancelar una orden si hay candidatas
                    if (activeOrderIds.length > 0) {
                        const idx = pseudoRandom(0, activeOrderIds.length - 1);
                        const targetId = activeOrderIds[idx];
                        const order = await exchange.orders(targetId);
                        if (order.status === 1n || order.status === 2n) { // OPEN or PARTIALLY_FILLED
                            const caller = order.user === user1.address ? user1 : user2;
                            await exchange.connect(caller).cancelOrder(targetId);
                        }
                    }
                } else if (action === 5) {
                    // Reclamar comisiones o inyección directa de tokens
                    if (step % 2 === 0) {
                        await exchange.claimFees();
                    } else {
                        // Inyección externa directa que incrementa superávit libre
                        await blueToken.mint(await exchange.getAddress(), 5n * ONE_TOKEN);
                        await usdtToken.mint(await exchange.getAddress(), 5n * ONE_TOKEN);
                    }
                }

                // ASERCIÓN CONTINUA: Los 6 invariantes contables y de solvencia se comprueban tras CADA paso
                await assertAllAccountingInvariants(exchange, blueToken, usdtToken);
            }
        });
    });
});

