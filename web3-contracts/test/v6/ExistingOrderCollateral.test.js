const {expect}=require('chai');
const {ethers}=require('hardhat');
const {loadFixture,time}=require('@nomicfoundation/hardhat-network-helpers');
const U=1_000_000n;

async function fixture(exchangeFeeBps = 0) {
  const [owner,guardian,treasury,debtor,seller,outsider]=await ethers.getSigners();
  const deploy=async(name,args=[])=>{const c=await(await ethers.getContractFactory(name)).deploy(...args);await c.waitForDeployment();return c;};
  const modes=await deploy('ProtocolModeController',[guardian.address]);
  const risk=await deploy('RiskRegistry',[owner.address]);
  const config=await deploy('ProtocolConfig',[1000n*U,30*86400,0]);
  const auth=await deploy('PaymentAuthorization'),ledger=await deploy('CommitmentLedger');
  const blue=await deploy('BlueTokenV6',[risk.target]),red=await deploy('RedTokenV6');
  const pairs=await deploy('PairedSupplyController',[blue.target,red.target,modes.target]);
  const engine=await deploy('PaymentEngine',[modes.target,risk.target,config.target,auth.target,ledger.target,pairs.target,blue.target,red.target,treasury.address]);
  const usdt=await deploy('MockERC20',['Demo USDT','USDT',6]);
  const ecfg=await deploy('ExchangeConfig',[treasury.address,exchangeFeeBps]);
  const book=await deploy('FifoOrderBook'),custody=await deploy('ExchangeCustody',[blue.target,usdt.target]);
  const adapter=await deploy('AmortizationAdapter',[modes.target,book.target,custody.target]);
  const router=await deploy('ExchangeRouter',[modes.target,risk.target,book.target,custody.target,ecfg.target,adapter.target]);
  const vault=await deploy('CollateralVaultV6',[usdt.target,modes.target,risk.target,engine.target,router.target,adapter.target,custody.target]);
  await blue.setSupplyController(pairs.target);await red.setSupplyController(pairs.target);await blue.setExchange(custody.target);
  await auth.setPaymentEngine(engine.target);await ledger.setPaymentEngine(engine.target);await pairs.setOperator(engine.target,true);
  await engine.setCollateralVault(vault.target);await book.setRouter(router.target);await custody.setIntegration(router.target,ecfg.target);await adapter.setIntegration(router.target,vault.target);
  for(const a of [owner,treasury,debtor,seller,outsider])await risk.setProfile(a.address,true,1000n*U,3);
  await risk.setProfile(vault.target,true,0,3);await modes.setMode(0);
  await usdt.mint(debtor.address,200n*U);await usdt.connect(debtor).approve(custody.target,ethers.MaxUint256);
  await engine.connect(debtor).processPayment(seller.address,100n*U);
  await router.connect(debtor).createOrder(1,100n*U);
  return {owner,guardian,treasury,debtor,seller,outsider,modes,risk,blue,red,pairs,engine,ledger,usdt,ecfg,book,custody,adapter,router,vault};
}

describe('V6: garantía sobre órdenes USDT existentes',function(){
  it('sin consentimiento ni reserva la cancelación devuelve la orden íntegra y conserva paridad',async()=>{
    const f=await loadFixture(fixture);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.usdt.balanceOf(f.debtor.address)).eq(200n*U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('permite al dueño reservar parte sin duplicar USDT y al cancelar la mantiene como garantía',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).collateralizeExisting(1,60n*U);
    expect(await f.adapter.reservation(1)).deep.eq([f.debtor.address,60n*U]);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(60n*U);
    expect(await f.usdt.balanceOf(f.custody.target)).eq(100n*U);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(0);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.usdt.balanceOf(f.debtor.address)).eq(140n*U);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(60n*U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(60n*U);
    expect(await f.vault.solvent()).eq(true);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('impide reservar una orden de otro usuario o más del importe remanente',async()=>{
    const f=await loadFixture(fixture);
    await expect(f.vault.connect(f.outsider).collateralizeExisting(1,10n*U)).reverted;
    await expect(f.vault.connect(f.debtor).collateralizeExisting(1,101n*U)).reverted;
    expect(await f.adapter.totalCollateralReserved()).eq(0);
  });
  it('consentimiento vencido reserva deuda residual antes de cancelar',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).setAutomaticExchangeCollateral(true);
    await time.increase(30*86400+1);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.usdt.balanceOf(f.debtor.address)).eq(100n*U);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(100n*U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(100n*U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('revocar consentimiento antes del vencimiento evita la nueva reserva',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).setAutomaticExchangeCollateral(true);
    await f.vault.connect(f.debtor).setAutomaticExchangeCollateral(false);
    await time.increase(30*86400+1);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.usdt.balanceOf(f.debtor.address)).eq(200n*U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
  });
  it('revocar consentimiento no libera garantía ya protegida',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).setAutomaticExchangeCollateral(true);
    await time.increase(30*86400+1);
    await f.vault.connect(f.outsider).protectOverdue(f.debtor.address,1);
    await f.vault.connect(f.debtor).setAutomaticExchangeCollateral(false);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(100n*U);
    expect(await f.vault.freeCollateral(f.debtor.address)).eq(0);
    await expect(f.vault.connect(f.debtor).withdraw(1)).reverted;
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('quema primero BLUE en parking y solo protege el RED vencido residual',async()=>{
    const f=await loadFixture(fixture);
    await f.engine.connect(f.seller).processPayment(f.debtor.address,40n*U);
    await f.vault.connect(f.debtor).setAutomaticExchangeCollateral(true);
    await time.increase(30*86400+1);
    await f.vault.connect(f.outsider).protectOverdue(f.debtor.address,1);
    expect(await f.red.balanceOf(f.debtor.address)).eq(60n*U);
    expect(await f.blue.balanceOf(f.debtor.address)).eq(0);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(60n*U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('cruzar una orden protegida amortiza 1:1 y mantiene cuentas solventes',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).collateralizeExisting(1,100n*U);
    await time.increase(30*86400+1);
    await f.blue.connect(f.seller).approve(f.custody.target,100n*U);
    await f.router.connect(f.seller).createOrder(0,100n*U);
    await f.router.matchNext(10);
    expect(await f.red.balanceOf(f.debtor.address)).eq(0);
    expect(await f.ledger.outstanding(f.debtor.address)).eq(0);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    expect(await f.vault.solvent()).eq(true);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('permite cruzar sin pérdida cuando la deuda cae por otra amortización después de reservar',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).collateralizeExisting(1,100n*U);
    await f.engine.connect(f.seller).processPayment(f.debtor.address,60n*U);
    await time.increase(30*86400+1);
    await f.engine.connect(f.debtor).amortizeWithBlue(60n*U);
    await f.blue.connect(f.seller).approve(f.custody.target,100n*U);
    await f.router.connect(f.seller).createOrder(0,100n*U);
    await f.router.matchNext(10);
    expect(await f.red.balanceOf(f.debtor.address)).eq(0);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
    expect(await f.vault.solvent()).eq(true);
  });
  it('conversión manual quema primero BLUE aún en parking y bloquea exclusivamente el compromiso residual',async()=>{
    const f=await loadFixture(fixture);
    await time.increase(20*86400);
    // Debtor receives 40 BLUE still actively parked when commitment #1 matures at day 30.
    await f.engine.connect(f.seller).processPayment(f.debtor.address,40n*U);
    await time.increase(10*86400+1);
    expect(await f.blue.lockedBalanceOf(f.debtor.address)).eq(40n*U);
    await f.vault.connect(f.debtor).collateralizeExisting(1,100n*U);
    expect(await f.blue.balanceOf(f.debtor.address)).eq(0);
    expect(await f.red.balanceOf(f.debtor.address)).eq(60n*U);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(60n*U);
    expect((await f.adapter.reservation(1))[1]).eq(60n*U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
    expect(await f.vault.solvent()).eq(true);
  });
  it('cancelación tras amortizar parcialmente libera excedente al usuario y protege residual en bóveda',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).collateralizeExisting(1,100n*U);
    await f.engine.connect(f.seller).processPayment(f.debtor.address,60n*U);
    await f.engine.connect(f.debtor).amortizeWithBlue(60n*U);
    const usdtBefore=await f.usdt.balanceOf(f.debtor.address);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.usdt.balanceOf(f.debtor.address)).eq(usdtBefore+60n*U);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(40n*U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(40n*U);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    expect(await f.adapter.totalCollateralReserved()).eq(0);
    expect(await f.vault.solvent()).eq(true);
    expect(await f.custody.solvent(0)).eq(true);
    expect(await f.custody.solvent(1)).eq(true);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('ejecución parcial con comisión y caída previa de compromiso mantiene FIFO, comisiones y solvencia',async()=>{
    const f=await fixture(100);
    await f.vault.connect(f.debtor).collateralizeExisting(1,100n*U);
    await f.engine.connect(f.seller).processPayment(f.debtor.address,60n*U);
    await time.increase(30*86400+1);
    await f.engine.connect(f.debtor).amortizeWithBlue(60n*U);
    await f.blue.connect(f.seller).approve(f.custody.target,ethers.MaxUint256);
    await f.router.connect(f.seller).createOrder(0,25n*U);
    await f.router.connect(f.seller).createOrder(0,75n*U);
    // Match 1: partial 25 USDT gross -> 0.25 USDT fee, 24.75 net BLUE burned.
    await f.router.matchNext(10);
    expect(await f.red.balanceOf(f.debtor.address)).eq(15_250_000n);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(15_404_040n);
    // Match 2: remaining residual 15_404_040 USDT gross -> 154_040 fee, 15_250_000 net BLUE burned.
    await f.router.matchNext(10);
    expect(await f.red.balanceOf(f.debtor.address)).eq(0);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    // Ordinary remainder of order #1 settles toward debtor directly on Match 3.
    await f.router.matchNext(10);
    expect(await f.blue.balanceOf(f.debtor.address)).eq(59_000_001n);
    await f.router.claimFees();
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
    expect(await f.custody.solvent(0)).eq(true);
    expect(await f.custody.solvent(1)).eq(true);
    expect(await f.vault.solvent()).eq(true);
  });
  it('el mero transcurso del tiempo no genera reservas hasta que actúa el trabajador y respeta conflictos',async()=>{
    const f=await loadFixture(fixture);
    await f.vault.connect(f.debtor).setAutomaticExchangeCollateral(true);
    await time.increase(30*86400+1);
    // Time alone does not execute any on-chain state transition.
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    // External partial amortization before worker runs.
    await f.engine.connect(f.seller).processPayment(f.debtor.address,35n*U);
    await f.vault.connect(f.outsider).protectOverdue(f.debtor.address,1);
    expect(await f.red.balanceOf(f.debtor.address)).eq(65n*U);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(65n*U);
    // Cancel after worker protection refunds only the unreserved 35 USDT and moves 65 USDT to Vault.
    const usdtBefore=await f.usdt.balanceOf(f.debtor.address);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.usdt.balanceOf(f.debtor.address)).eq(usdtBefore+35n*U);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(65n*U);
    expect(await f.vault.solvent()).eq(true);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('permite cubrir y liquidar remanentes de compromiso RED menores a 1 unidad sobre una orden existente',async()=>{
    const f=await fixture(100); // 1% comisión en Exchange
    // El vendedor origina un pago hacia debtor para que debtor tenga BLUE y amortice 99.50 RED con amortizeWithBlue
    await f.engine.connect(f.seller).processPayment(f.debtor.address,99_500_000n);
    await f.engine.connect(f.debtor).amortizeWithBlue(99_500_000n);
    expect(await f.red.balanceOf(f.debtor.address)).eq(500_000n);
    // Al afectar manualmente la orden existente #1 (100 USDT), bloquea exactamente 505_050 micro-unidades (< MIN_ORDER_AMOUNT) para cubrir 0.50 RED al 1%
    await f.vault.connect(f.debtor).collateralizeExisting(1,100n*U);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(505_050n);
    await time.increase(30*86400+1);
    await f.blue.connect(f.seller).approve(f.custody.target,ethers.MaxUint256);
    await f.router.connect(f.seller).createOrder(0,100n*U);
    // Primer match consume solo la fracción reservada (505_050 USDT -> 500_000 BLUE netos) y deja compromiso RED en 0
    await f.router.matchNext(10);
    expect(await f.red.balanceOf(f.debtor.address)).eq(0n);
    expect(await f.ledger.outstanding(f.debtor.address)).eq(0n);
    // Segundo match ejecuta el resto ordinario (99_494_950 USDT) a favor de debtor manteniendo FIFO y solvencia
    await f.router.matchNext(10);
    expect((await f.book.order(1)).remaining).eq(0n);
    expect(await f.vault.solvent()).eq(true);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
});
