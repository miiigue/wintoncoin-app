import { mockFinancialService } from './mockFinancialService.js';
import { units, amount, add, subtract, feeFor } from './financialUnits.js';

/** Finite, funded FIFO demo. All callers share the financial operation lock. */
export class MockExchangeService {
  constructor(financial = mockFinancialService) {
    this.financial = financial;
    this.listeners = new Set();
    this.reset();
    financial.exchangeAdapter = this;
    financial.resetListeners.add(() => { this.reset(); this.notify(); });
  }
  reset() {
    this.sequence = 3;
    this.state = { exchangeRate: 1, feeBps: 0, feeBlue: 0, feeUsdt: 0,
      sellOrders: [
        { id: 'sell_1', sellerName: 'Carlos', remainingBlue: 50, amountBlue: 50, isMyOrder: false },
        { id: 'sell_2', sellerName: 'Elena', remainingBlue: 120, amountBlue: 120, isMyOrder: false }],
      buyOrders: [{ id: 'buy_1', buyerName: 'David', remainingUsdt: 80, amountUsdt: 80, isMyOrder: false }],
      externalBalances: { Carlos: { blue: 0, usdt: 0 }, Elena: { blue: 0, usdt: 0 }, David: { blue: 0, usdt: 0 } },
      stats: { totalVolume24h: 0, completedMatchesCount: 0, averageMatchTimeMinutes: null } };
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { this.listeners.forEach((fn) => fn(this.getState())); }
  syncQueue() {
    const order = this.state.buyOrders.find((entry) => entry.isMyOrder && entry.fromVault);
    Object.assign(this.financial.state.amortizationQueue, { hasActiveOrder: !!order,
      activeOrder: order ? { id: order.id, usdtAmount: order.remainingUsdt,
        positionInQueue: this.state.buyOrders.indexOf(order) + 1, status: 'Pendiente en FIFO' } : null });
  }
  getState() {
    this.syncQueue();
    return { ...this.state,
      totalBlueForSale: this.state.sellOrders.reduce((sum, order) => add(sum, order.remainingBlue), 0),
      totalUsdtWaiting: this.state.buyOrders.reduce((sum, order) => add(sum, order.remainingUsdt), 0) };
  }
  run(action) {
    return this.financial.operation(() => {
      const snapshot = structuredClone(this.state);
      try { const result = action(); this.syncQueue(); this.notify(); return result; }
      catch (error) { this.state = snapshot; throw error; }
    });
  }
  match() {
    const fin = this.financial;
    while (this.state.sellOrders.length && this.state.buyOrders.length) {
      const sell = this.state.sellOrders[0], buy = this.state.buyOrders[0];
      if (buy.fromVault) {
        fin.refresh();
        const max = amount(units(fin.state.credit.debtRed) * 10_000n / BigInt(10_000 - this.state.feeBps));
        if (buy.remainingUsdt > max) {
          const refund = subtract(buy.remainingUsdt, max);
          buy.remainingUsdt = max;
          fin.state.exchangeReservedUsdt = subtract(fin.state.exchangeReservedUsdt, refund);
          fin.state.collateral.totalDepositedUsdt = add(fin.state.collateral.totalDepositedUsdt, refund);
        }
        if (max === 0) { this.state.buyOrders.shift(); continue; }
      }
      const gross = Math.min(sell.remainingBlue, buy.remainingUsdt);
      const fee = feeFor(gross, this.state.feeBps), net = subtract(gross, fee);
      sell.remainingBlue = subtract(sell.remainingBlue, gross);
      buy.remainingUsdt = subtract(buy.remainingUsdt, gross);
      if (sell.isMyOrder) {
        fin.state.walletUsdt = add(fin.state.walletUsdt, net);
        sell.receivedUsdt = add(sell.receivedUsdt || 0, net);
      }
      else this.state.externalBalances[sell.sellerName].usdt = add(this.state.externalBalances[sell.sellerName].usdt, net);
      if (buy.isMyOrder) {
        if (buy.fromVault) fin.state.exchangeReservedUsdt = subtract(fin.state.exchangeReservedUsdt, gross);
        fin.refresh();
        const burn = Math.min(net, buy.autoBurnRed ? fin.state.credit.debtRed : fin.state.credit.overdueDebtRed);
        if (burn) fin.burnCommitments(burn);
        fin.state.blue.unlocked = add(fin.state.blue.unlocked, subtract(net, burn));
        buy.matchedBlue = add(buy.matchedBlue || 0, net);
        buy.burnedRed = add(buy.burnedRed || 0, burn);
      } else this.state.externalBalances[buy.buyerName].blue = add(this.state.externalBalances[buy.buyerName].blue, net);
      this.state.feeBlue = add(this.state.feeBlue, fee);
      this.state.feeUsdt = add(this.state.feeUsdt, fee);
      this.state.stats.totalVolume24h = add(this.state.stats.totalVolume24h, gross);
      this.state.stats.completedMatchesCount++;
      if (!sell.remainingBlue) this.state.sellOrders.shift();
      if (!buy.remainingUsdt) this.state.buyOrders.shift();
    }
    this.syncQueue();
  }
  createSellOrder(value) {
    return this.run(() => {
      const valueBlue = this.financial.positive(value);
      if (valueBlue < 1) throw new Error('El mínimo de una orden nueva es 1 BLUE.');
      this.financial.state.blue.unlocked = subtract(this.financial.state.blue.unlocked, valueBlue);
      const order = { id: 'sell_' + ++this.sequence, sellerName: 'Tú', amountBlue: valueBlue, remainingBlue: valueBlue, isMyOrder: true, timestamp: 'Ahora' };
      this.state.sellOrders.push(order);
      this.match();
      return { success: true, instantMatch: order.remainingBlue === 0,
        receivedUsdt: order.receivedUsdt || 0 };
    });
  }
  createBuyOrder(value, autoBurnRed = false) {
    return this.run(() => {
      const valueUsdt = this.financial.positive(value);
      if (valueUsdt < 1) throw new Error('El mínimo de una orden nueva es 1 USDT.');
      this.financial.state.walletUsdt = subtract(this.financial.state.walletUsdt, valueUsdt);
      const order = this.buy(valueUsdt, { autoBurnRed, fromVault: false });
      this.match();
      return { success: true, matchedAmount: order.matchedBlue || 0, burnedAmount: order.burnedRed || 0, inQueueAmount: order.remainingUsdt };
    });
  }
  buy(value, flags) {
    const order = { id: 'buy_' + ++this.sequence, buyerName: 'Tú', amountUsdt: value, remainingUsdt: value,
      isMyOrder: true, timestamp: 'Ahora', ...flags };
    this.state.buyOrders.push(order);
    return order;
  }
  queueAmortization(value) {
    return this.run(() => {
      const payment = this.financial.positive(value), fin = this.financial.state;
      const q = fin.amortizationQueue;
      const budget = amount(units(fin.credit.debtRed) * 10_000n / BigInt(10_000 - this.state.feeBps));
      if (add(q.bufferedReserveUsdt, payment) > fin.collateral.totalDepositedUsdt
          || add(add(q.bufferedReserveUsdt, fin.exchangeReservedUsdt), payment) > budget) throw new Error('La compra supera la garantía o el compromiso pendiente.');
      q.bufferedReserveUsdt = add(q.bufferedReserveUsdt, payment);
      q.bufferedLotsCount++;
      this.promote();
      this.match();
      return { success: true };
    });
  }
  promote() {
    this.syncQueue();
    const fin = this.financial.state, q = fin.amortizationQueue;
    const budget = amount(units(fin.credit.debtRed) * 10_000n / BigInt(10_000 - this.state.feeBps));
    const available = Math.max(0, subtract(Math.max(budget, fin.exchangeReservedUsdt), fin.exchangeReservedUsdt));
    q.bufferedReserveUsdt = Math.min(q.bufferedReserveUsdt, available);
    if (q.hasActiveOrder || q.bufferedReserveUsdt < 1) return;
    const value = q.bufferedReserveUsdt;
    fin.collateral.totalDepositedUsdt = subtract(fin.collateral.totalDepositedUsdt, value);
    fin.exchangeReservedUsdt = add(fin.exchangeReservedUsdt, value);
    q.bufferedReserveUsdt = 0; q.bufferedLotsCount = 0;
    this.buy(value, { fromVault: true, autoBurnRed: true });
    this.syncQueue();
  }
  processPending() { return this.run(() => { this.promote(); this.match(); return { success: true }; }); }
  cancelOrder(id) {
    return this.run(() => {
      let index = this.state.sellOrders.findIndex((order) => order.id === id && order.isMyOrder);
      if (index >= 0) {
        const [order] = this.state.sellOrders.splice(index, 1);
        this.financial.state.blue.unlocked = add(this.financial.state.blue.unlocked, order.remainingBlue);
        return { success: true, refunded: order.remainingBlue + ' BLUE' };
      }
      index = this.state.buyOrders.findIndex((order) => order.id === id && order.isMyOrder);
      if (index < 0) throw new Error('Orden no encontrada.');
      const [order] = this.state.buyOrders.splice(index, 1);
      const fin = this.financial.state;
      if (order.fromVault) {
        fin.exchangeReservedUsdt = subtract(fin.exchangeReservedUsdt, order.remainingUsdt);
        fin.collateral.totalDepositedUsdt = add(fin.collateral.totalDepositedUsdt, order.remainingUsdt);
      } else fin.walletUsdt = add(fin.walletUsdt, order.remainingUsdt);
      return { success: true, refunded: order.remainingUsdt + (order.fromVault ? ' USDT devueltos a garantía' : ' USDT') };
    });
  }
}
export const mockExchangeService = new MockExchangeService();
export default mockExchangeService;
