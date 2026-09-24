import { units, amount, add, subtract, feeFor, DAY } from './financialUnits.js';

/** Explicit local demo. Does not sign transactions or update production balances. */
export class MockFinancialService {
  constructor({ clock = () => Date.now(), latency = 300 } = {}) {
    this.clock = clock;
    this.latency = latency;
    this.offset = 0;
    this.listeners = new Set();
    this.resetListeners = new Set();
    this.isProcessing = false;
    this.state = this.getInitialState();
  }
  now() { return this.clock() + this.offset; }
  getInitialState() {
    const now = this.now();
    return {
      isSimulation: true,
      user: { id: 'usr_789421', name: 'Miguel (perfil de demostración)', smartAccountAddress: 'Cuenta simulada',
        tierLevel: 4, tierName: 'Especialista', kycApproved: true, clubMembership: 'Club Oro',
        clubBonusPercent: 0, accumulatedBonusIou: 14.5, dailyGasQuota: 8, dailyGasUsed: 0,
        gasDay: Math.floor(now / DAY) },
      blue: { unlocked: 15, parkingLots: [
        { id: 'blue_1', amount: 40, releaseAt: now + 3 * DAY, taskTitle: 'Desarrollo de módulo', dateIssued: new Date(now - 27 * DAY).toLocaleString() },
        { id: 'blue_2', amount: 60, releaseAt: now + 22 * DAY, taskTitle: 'Auditoría', dateIssued: new Date(now - 8 * DAY).toLocaleString() },
      ] },
      credit: { effectiveLimitRed: 100, extensionMarginLimit: 0, maxExtensions: 2,
        lots: [{ id: 'red_1', remaining: 60, extensionFee: 0, marginUsed: 0,
          dueAt: now + 18 * DAY, extensionCount: 0, firstExtendedAt: null }] },
      policy: { commitmentDays: 30, extensionCooldownDays: 15, minExtensionLevel: 3, minMarginLevel: 5,
        // Illustrative demo catalogue, not a claim about deployed configuration.
        extensionOptions: [{ days: 15, bps: 250 }, { days: 30, bps: 500 }, { days: 60, bps: 1000 }] },
      collateral: { totalDepositedUsdt: 100 },
      walletUsdt: 500,
      exchangeReservedUsdt: 0,
      amortizationQueue: { hasActiveOrder: false, activeOrder: null, bufferedReserveUsdt: 0, bufferedLotsCount: 0 },
      feeRecipient: { name: 'Destino de recargos simulado; fondo pendiente de definición', parkingLots: [] },
      accounting: { mintedBlue: 0, mintedRed: 0, burnedBlue: 0, burnedRed: 0 },
      transactions: [],
    };
  }
  resetToDefault() {
    if (this.isProcessing) throw new Error('Espera a que termine la operación.');
    this.offset = 0;
    this.state = this.getInitialState();
    this.resetListeners.forEach((fn) => fn());
    this.notify();
    return this.getCalculatedState();
  }
  advanceDays(days) {
    if (!Number.isFinite(days) || days < 0 || this.isProcessing) throw new Error('Avance de reloj inválido.');
    this.offset += days * DAY;
    this.notify();
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { const data = this.getCalculatedState(); this.listeners.forEach((fn) => fn(data)); }
  refresh() {
    const now = this.now();
    const user = this.state.user;
    if (user.gasDay !== Math.floor(now / DAY)) { user.gasDay = Math.floor(now / DAY); user.dailyGasUsed = 0; }
    const parking = [];
    for (const lot of this.state.blue.parkingLots) {
      if (lot.releaseAt <= now) this.state.blue.unlocked = add(this.state.blue.unlocked, lot.amount);
      else parking.push(lot);
    }
    this.state.blue.parkingLots = parking;
    const lots = this.state.credit.lots.filter((lot) => lot.remaining > 0).sort((a,b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
    const debtRed = lots.reduce((sum, lot) => add(sum, lot.remaining), 0);
    const overdueDebtRed = lots.filter((lot) => lot.dueAt <= now).reduce((sum, lot) => add(sum, lot.remaining), 0);
    const first = lots[0];
    Object.assign(this.state.credit, { debtRed, overdueDebtRed, dueAmountRed: first?.remaining ?? 0,
      daysUntilDue: first ? Math.max(0, Math.ceil((first.dueAt - now) / DAY)) : 0,
      extensionMarginUsed: lots.reduce((sum, lot) => add(sum, lot.marginUsed), 0) });
    return lots;
  }
  getCalculatedState() {
    this.refresh();
    const { blue, credit, collateral, user } = this.state;
    const totalParkingBlue = blue.parkingLots.reduce((a, b) => add(a, b.amount), 0);
    const totalCollateral = add(collateral.totalDepositedUsdt, this.state.exchangeReservedUsdt);
    const excess = Math.max(0, subtract(Math.max(credit.debtRed, add(credit.effectiveLimitRed, credit.extensionMarginUsed)), add(credit.effectiveLimitRed, credit.extensionMarginUsed)));
    const reserved = add(this.state.exchangeReservedUsdt, this.state.amortizationQueue.bufferedReserveUsdt);
    const required = Math.max(credit.overdueDebtRed, excess, reserved);
    const free = totalCollateral > required ? subtract(totalCollateral, required) : 0;
    const capacity = add(credit.effectiveLimitRed, totalCollateral);
    return { ...this.state, blue: { ...blue, parkingLots: blue.parkingLots.map((lot) => ({ ...lot,
      daysRemaining: Math.ceil((lot.releaseAt - this.now()) / DAY), unlockDate: new Date(lot.releaseAt).toLocaleString() })) },
      computed: { totalParkingBlue, totalBlueBalance: add(blue.unlocked, totalParkingBlue), totalCreditCapacity: capacity,
        pignoratedUsdt: Math.min(totalCollateral, required), freeUsdtToWithdraw: Math.min(free, collateral.totalDepositedUsdt),
        availableCreditCapacity: capacity > credit.debtRed ? subtract(capacity, credit.debtRed) : 0,
        gasTxsRemaining: Math.max(0, user.dailyGasQuota - user.dailyGasUsed) } };
  }
  requireKYC() { if (!this.state.user.kycApproved) throw new Error('Se requiere KYC aprobado.'); }
  positive(value) { const n = amount(units(value)); if (n <= 0) throw new Error('El importe debe ser mayor que cero.'); return n; }
  async operation(action) {
    if (this.isProcessing) throw new Error('Hay una operación en curso.');
    this.isProcessing = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, this.latency));
      this.refresh();
      this.requireKYC();
      const snapshot = structuredClone(this.state);
      try {
        this.settleMatured();
        const result = action();
        const sponsored = this.state.user.dailyGasUsed < this.state.user.dailyGasQuota;
        if (sponsored) this.state.user.dailyGasUsed++;
        this.notify();
        return { ...result, gasSponsored: sponsored };
      } catch (error) { this.state = snapshot; throw error; }
    } finally { this.isProcessing = false; }
  }
  settleMatured() {
    this.refresh();
    const available = add(this.state.blue.unlocked, this.state.blue.parkingLots.reduce((a,b)=>add(a,b.amount),0));
    const value = Math.min(available, this.state.credit.overdueDebtRed);
    if (!value) return;
    const free = Math.min(value, this.state.blue.unlocked);
    this.state.blue.unlocked = subtract(this.state.blue.unlocked,free);
    let left = units(subtract(value,free));
    for (const lot of this.state.blue.parkingLots) {
      const spent = left < units(lot.amount) ? left : units(lot.amount);
      lot.amount = amount(units(lot.amount)-spent); left -= spent;
      if (!left) break;
    }
    this.state.blue.parkingLots = this.state.blue.parkingLots.filter(lot=>lot.amount>0);
    this.burnCommitments(value);
  }
  burnCommitments(value) {
    let left = units(value);
    const lots = this.refresh();
    if (left > units(this.state.credit.debtRed)) throw new Error('El importe supera los compromisos.');
    for (const lot of lots) {
      if (!left) break;
      const applied = left < units(lot.remaining) ? left : units(lot.remaining);
      const paidFee = applied < units(lot.extensionFee) ? applied : units(lot.extensionFee);
      const paidMargin = paidFee < units(lot.marginUsed) ? paidFee : units(lot.marginUsed);
      lot.remaining = amount(units(lot.remaining) - applied);
      lot.extensionFee = amount(units(lot.extensionFee) - paidFee);
      lot.marginUsed = amount(units(lot.marginUsed) - paidMargin);
      left -= applied;
    }
    this.state.accounting.burnedBlue = add(this.state.accounting.burnedBlue, value);
    this.state.accounting.burnedRed = add(this.state.accounting.burnedRed, value);
    this.refresh();
  }
  repayWithRouteA(value) {
    return this.operation(() => {
      const payment = this.positive(value);
      const data = this.getCalculatedState();
      if (payment > data.computed.totalParkingBlue || payment > data.credit.debtRed) throw new Error('Saldo insuficiente para amortizar.');
      let left = units(payment);
      const lots = this.state.blue.parkingLots;
      for (const lot of lots) {
        const used = left < units(lot.amount) ? left : units(lot.amount);
        lot.amount = amount(units(lot.amount) - used); left -= used;
      }
      this.state.blue.parkingLots = lots.filter((lot) => lot.amount > 0);
      this.burnCommitments(payment);
      this.record('Amortización con BLUE', payment + ' BLUE y RED quemados');
      return { success: true, bonusIou: 0, isLifo: false };
    });
  }
  repayWithCollateral(value) {
    if (!this.exchangeAdapter) return Promise.reject(new Error('Abre el Exchange para preparar la compra de amortización.'));
    return this.exchangeAdapter.queueAmortization(value);
  }
  withdrawFreeUsdt(value) {
    return this.operation(() => {
      const payment = this.positive(value);
      // Releasing an unnecessary local buffer does not refund a spent purchase.
      this.refresh();
      const q = this.state.amortizationQueue;
      const requiredPurchase = Math.max(0, this.state.credit.debtRed - this.state.exchangeReservedUsdt);
      q.bufferedReserveUsdt = Math.min(q.bufferedReserveUsdt, requiredPurchase);
      if (payment > this.getCalculatedState().computed.freeUsdtToWithdraw) throw new Error('El importe todavía respalda compromisos u órdenes.');
      this.state.collateral.totalDepositedUsdt = subtract(this.state.collateral.totalDepositedUsdt, payment);
      this.state.walletUsdt = add(this.state.walletUsdt, payment);
      this.record('Retiro solicitado por el usuario', payment + ' USDT');
      return { success: true };
    });
  }
  depositUsdt(value) {
    return this.operation(() => {
      const payment = this.positive(value);
      this.state.walletUsdt = subtract(this.state.walletUsdt, payment);
      this.state.collateral.totalDepositedUsdt = add(this.state.collateral.totalDepositedUsdt, payment);
      this.record('Depósito de garantía', payment + ' USDT');
      return { success: true };
    });
  }
  quoteExtension(lotId, days) {
    this.refresh();
    const lot = this.state.credit.lots.find((entry) => entry.id === lotId && entry.remaining > 0);
    const option = this.state.policy.extensionOptions.find((entry) => entry.days === Number(days));
    if (!lot || !option) throw new Error('Selecciona un compromiso y un plazo habilitado.');
    const fee = feeFor(subtract(lot.remaining, lot.extensionFee), option.bps);
    const available = this.getCalculatedState().computed.availableCreditCapacity;
    return { lotId, days: option.days, bps: option.bps, fee, dueAt: lot.dueAt, remaining: lot.remaining,
      newDueAt: lot.dueAt + option.days * DAY, newLotTotal: add(lot.remaining, fee),
      marginNeeded: fee > available ? subtract(fee, available) : 0,
      expiresAt: this.now() + 15 * 60_000 };
  }
  requestCommitmentExtension(quote) {
    return this.operation(() => {
      if (!quote || typeof quote !== 'object') throw new Error('Se requiere una cotización del compromiso seleccionado.');
      const { user, credit, policy } = this.state;
      if (user.tierLevel < 3) throw new Error('Las prórrogas están disponibles desde el nivel 3.');
      const actual = this.quoteExtension(quote.lotId, quote.days);
      const lot = credit.lots.find((entry) => entry.id === quote.lotId);
      if (this.now() > quote.expiresAt || ['fee','bps','dueAt','remaining'].some((key) => quote[key] !== actual[key])) throw new Error('La cotización cambió o venció. Revísala antes de confirmar.');
      if (credit.overdueDebtRed > 0 || lot.dueAt <= this.now()) throw new Error('No se puede prorrogar estando en mora.');
      if (lot.extensionCount >= credit.maxExtensions) throw new Error('Este compromiso ya utilizó sus dos prórrogas.');
      if (lot.extensionCount && this.now() < lot.firstExtendedAt + policy.extensionCooldownDays * DAY) throw new Error('Deben transcurrir 15 días desde la primera prórroga.');
      if (credit.debtRed > add(this.getCalculatedState().computed.totalCreditCapacity,credit.extensionMarginUsed)) throw new Error('Primero restablece la garantía del compromiso existente.');
      if (actual.marginNeeded > 0 && (user.tierLevel < 5 || add(credit.extensionMarginUsed, actual.marginNeeded) > credit.extensionMarginLimit)) throw new Error('Amortiza o ingresa garantía suficiente para el recargo. El margen especial solo se habilita desde el nivel 5.');
      if (!lot.extensionCount) lot.firstExtendedAt = this.now();
      lot.extensionCount++;
      lot.dueAt = actual.newDueAt;
      lot.remaining = actual.newLotTotal;
      lot.extensionFee = add(lot.extensionFee, actual.fee);
      lot.marginUsed = add(lot.marginUsed, actual.marginNeeded);
      if (actual.fee > 0) this.state.feeRecipient.parkingLots.push({ amount: actual.fee, releaseAt: this.now() + policy.commitmentDays * DAY });
      this.state.accounting.mintedBlue = add(this.state.accounting.mintedBlue, actual.fee);
      this.state.accounting.mintedRed = add(this.state.accounting.mintedRed, actual.fee);
      this.record('Prórroga del compromiso ' + lot.id, '+' + actual.fee + ' RED');
      return { success: true, feeAmount: actual.fee, newDaysRemaining: Math.ceil((lot.dueAt - this.now()) / DAY) };
    });
  }
  record(type, value) {
    this.state.transactions.unshift({ id: 'tx_' + this.now() + '_' + this.state.transactions.length,
      type, amount: value, status: 'Simulado', timestamp: new Date(this.now()).toLocaleString(),
      gasSponsored: this.state.user.dailyGasUsed < this.state.user.dailyGasQuota });
  }
}
export const mockFinancialService = new MockFinancialService();
export default mockFinancialService;
if (typeof window !== 'undefined') window.resetFinancialDemo = () => mockFinancialService.resetToDefault();
