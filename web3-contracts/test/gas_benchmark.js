const { ethers } = require("hardhat");

async function main() {
    console.log("========================================================================");
    console.log("   WINTON FIFO EXCHANGE V3.3.4 — BENCHMARK DE GAS EMPÍRICO (gasUsed)   ");
    console.log("========================================================================");

    const [owner, alice, bob, treasury] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const blue = await MockERC20.deploy("Winton Blue", "BLUE", 6);
    await blue.waitForDeployment();
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6);
    await usdt.waitForDeployment();

    const Exchange = await ethers.getContractFactory("FifoExchange");
    const exchange = await Exchange.deploy(
        await blue.getAddress(),
        await usdt.getAddress(),
        treasury.address,
        10 // 0.10% (10 BPS)
    );
    await exchange.waitForDeployment();

    const parseUnits = (val) => ethers.parseUnits(val.toString(), 6);

    // Fondear
    await blue.mint(alice.address, parseUnits(1000000));
    await usdt.mint(bob.address, parseUnits(1000000));
    await blue.connect(alice).approve(await exchange.getAddress(), ethers.MaxUint256);
    await usdt.connect(bob).approve(await exchange.getAddress(), ethers.MaxUint256);

    const results = {};

    // 1. createBlueOrder
    let tx = await exchange.connect(alice).createBlueOrder(parseUnits(100));
    let receipt = await tx.wait();
    results["createBlueOrder (100 BLUE)"] = receipt.gasUsed.toString();

    // 2. createUsdtOrder
    tx = await exchange.connect(bob).createUsdtOrder(parseUnits(100));
    receipt = await tx.wait();
    results["createUsdtOrder (100 USDT)"] = receipt.gasUsed.toString();

    // 3. match exact (orden 1 y orden 2)
    tx = await exchange.connect(owner).matchOrders(10, 20);
    receipt = await tx.wait();
    results["matchOrders (Exact Match 100 vs 100)"] = receipt.gasUsed.toString();

    // 4. match partial (crear 100 BLUE y 40 USDT -> partial fill)
    await exchange.connect(alice).createBlueOrder(parseUnits(100));
    await exchange.connect(bob).createUsdtOrder(parseUnits(40));
    tx = await exchange.connect(owner).matchOrders(10, 20);
    receipt = await tx.wait();
    results["matchOrders (Partial Fill 100 BLUE vs 40 USDT)"] = receipt.gasUsed.toString();

    // 5. cascade matching (1 orden restante de 60 BLUE contra 3 ordenes de 20 USDT)
    await exchange.connect(bob).createUsdtOrder(parseUnits(20));
    await exchange.connect(bob).createUsdtOrder(parseUnits(20));
    await exchange.connect(bob).createUsdtOrder(parseUnits(20));
    tx = await exchange.connect(owner).matchOrders(20, 50);
    receipt = await tx.wait();
    results["matchOrders (Cascade Matching 1x3)"] = receipt.gasUsed.toString();

    // 6. cancelOrder (head)
    await exchange.connect(alice).createBlueOrder(parseUnits(50));
    const headOrderId = await exchange.nextOrderId() - 1n;
    tx = await exchange.connect(alice).cancelOrder(headOrderId);
    receipt = await tx.wait();
    results["cancelOrder (Head of Queue)"] = receipt.gasUsed.toString();

    // 7. cancelOrder (non-head)
    await exchange.connect(alice).createBlueOrder(parseUnits(50));
    await exchange.connect(alice).createBlueOrder(parseUnits(50));
    const nonHeadOrderId = await exchange.nextOrderId() - 1n;
    tx = await exchange.connect(alice).cancelOrder(nonHeadOrderId);
    receipt = await tx.wait();
    results["cancelOrder (Non-Head / Middle)"] = receipt.gasUsed.toString();

    // 8. claimFees
    tx = await exchange.connect(owner).claimFees();
    receipt = await tx.wait();
    results["claimFees (BLUE + USDT a Tesorería)"] = receipt.gasUsed.toString();

    // 9. proposeFeeUpdate
    tx = await exchange.connect(owner).proposeFeeUpdate(25);
    receipt = await tx.wait();
    results["proposeFeeUpdate (25 BPS)"] = receipt.gasUsed.toString();

    // Avanzar tiempo 48h
    await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
    await ethers.provider.send("evm_mine");

    // 10. executeFeeUpdate
    tx = await exchange.connect(owner).executeFeeUpdate();
    receipt = await tx.wait();
    results["executeFeeUpdate"] = receipt.gasUsed.toString();

    // 11. pause
    tx = await exchange.connect(owner).pause();
    receipt = await tx.wait();
    results["pause()"] = receipt.gasUsed.toString();

    // 12. unpause
    tx = await exchange.connect(owner).unpause();
    receipt = await tx.wait();
    results["unpause()"] = receipt.gasUsed.toString();

    console.table(
        Object.entries(results).map(([Operacion, GasUsado]) => ({
            "Operación": Operacion,
            "gasUsed Real": GasUsado
        }))
    );
    console.log("========================================================================");
}

if (require.main === module) main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
