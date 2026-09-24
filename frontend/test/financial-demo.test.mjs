import test from 'node:test';
import assert from 'node:assert/strict';
import {MockFinancialService} from '../src/modules/mockFinancialService.js';
import {MockExchangeService} from '../src/modules/mockExchangeService.js';
import {units,feeFor,DAY} from '../src/modules/financialUnits.js';
const setup=()=>{const f=new MockFinancialService({clock:()=>Date.UTC(2026,8,23),latency:0});return {f,e:new MockExchangeService(f)};};
test('Seis decimales: suma exacta, comisión cero y rechazo de precisión sobrante',()=>{
 assert.equal(units('0.000001'),1n);assert.equal(feeFor(100,0),0);assert.throws(()=>units('1.0000001'));
});
for(const level of [1,2,3,4,5]) test(`Prórroga nivel ${level}`,async()=>{
 const {f}=setup();f.state.user.tierLevel=level;const q=f.quoteExtension('red_1',30);
 if(level<3) await assert.rejects(f.requestCommitmentExtension(q));
 else {await f.requestCommitmentExtension(q);assert.equal(f.state.credit.lots[0].remaining,63);assert.equal(f.state.accounting.mintedBlue,3);assert.equal(f.state.accounting.mintedRed,3);}
});
test('Recargo sobre compromiso seleccionado y parking del trabajador sin cambio',async()=>{
 const {f}=setup();const parking=structuredClone(f.state.blue.parkingLots);
 f.state.credit.lots.push({id:'red_2',remaining:100,extensionFee:0,marginUsed:0,dueAt:f.now()+25*DAY,extensionCount:0,firstExtendedAt:null});
 await f.requestCommitmentExtension(f.quoteExtension('red_1',30));
 assert.equal(f.state.credit.lots[1].remaining,100);assert.deepEqual(f.state.blue.parkingLots,parking);
});
test('Nivel 5 no recibe margen implícito; el margen configurado solo cubre recargo',async()=>{
 const {f}=setup();f.state.user.tierLevel=5;f.state.credit.effectiveLimitRed=60;f.state.collateral.totalDepositedUsdt=0;
 await assert.rejects(f.requestCommitmentExtension(f.quoteExtension('red_1',30)));
 f.state.credit.extensionMarginLimit=3;await f.requestCommitmentExtension(f.quoteExtension('red_1',30));
 assert.equal(f.getCalculatedState().computed.availableCreditCapacity,0);assert.equal(f.state.credit.extensionMarginUsed,3);
});
test('Cotización expirada o KYC revocado no modifica saldos',async()=>{
 const {f}=setup();const q=f.quoteExtension('red_1',30);f.offset+=16*60_000;
 await assert.rejects(f.requestCommitmentExtension(q));assert.equal(f.state.credit.lots[0].remaining,60);
 f.state.user.kycApproved=false;await assert.rejects(f.depositUsdt(10));assert.equal(f.state.walletUsdt,500);
});
test('Respetar FIFO: David compra antes; cancelación devuelve solo el resto a Vault',async()=>{
 const {f,e}=setup();e.state.sellOrders[1].remainingBlue=50;e.state.sellOrders[1].amountBlue=50;
 await e.queueAmortization(60);
 assert.equal(e.state.externalBalances.David.blue,80);assert.equal(f.state.credit.debtRed,40);
 assert.equal(f.state.exchangeReservedUsdt,40);assert.equal(f.state.collateral.totalDepositedUsdt,40);
 const id=f.state.amortizationQueue.activeOrder.id;await e.cancelOrder(id);
 assert.equal(f.state.exchangeReservedUsdt,0);assert.equal(f.state.collateral.totalDepositedUsdt,80);
 assert.equal(f.state.walletUsdt,500);assert.equal(f.state.accounting.burnedBlue,f.state.accounting.burnedRed);
});
test('Sin vendedor reserva no equivale a amortización; no se cuenta garantía dos veces',async()=>{
 const {f,e}=setup();e.state.sellOrders=[];e.state.buyOrders=[];
 await e.queueAmortization(60);assert.equal(f.state.credit.debtRed,60);
 assert.equal(f.getCalculatedState().computed.totalCreditCapacity,200);
 await assert.rejects(f.withdrawFreeUsdt(41));
});
test('Compra usa USDT de billetera; error no inventa fondos ni deja una orden',async()=>{
 const {f,e}=setup();await e.createBuyOrder(10);assert.equal(f.state.walletUsdt,490);
 const before=structuredClone(e.state);await assert.rejects(e.createBuyOrder(1000));assert.deepEqual(e.state,before);
});
test('Operaciones simultáneas no gastan dos veces; cuota no impide pago no patrocinado',async()=>{
 const {f}=setup();f.state.user.dailyGasQuota=0;
 const results=await Promise.allSettled([f.depositUsdt(10),f.depositUsdt(10)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state.walletUsdt,490);
 assert.equal(results.find(r=>r.status==='fulfilled').value.gasSponsored,false);
});
test('Reloj libera parking una sola vez y reinicia cuota diaria',()=>{
 const {f}=setup();f.state.user.dailyGasUsed=8;f.advanceDays(3);
 assert.equal(f.state.blue.unlocked,55);f.getCalculatedState();assert.equal(f.state.blue.unlocked,55);assert.equal(f.state.user.dailyGasUsed,0);
});
