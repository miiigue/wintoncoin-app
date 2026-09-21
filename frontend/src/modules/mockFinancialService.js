/**
 * ============================================================================
 * [WINTONCOIN] - MOTOR FINANCIERO REACTIVO (Mock FinTech Service)
 * ============================================================================
 * Simula el comportamiento on-chain del protocolo WintonCoin 2026:
 * - Emisión pareada 1:1 (BLUE / RED).
 * - Período de Parking de 30 días con trazabilidad de lotes individuales.
 * - Desglose justo de garantías USDT: solo se pignora max(0, Deuda - Límite).
 * - Lógica de Superpoder LIFO para Nivel 4+ (Club Oro) en Ruta A.
 * - Simulación de Smart Accounts ERC-4337 con Paymaster (gas $0.00 patrocinado).
 * - Recompensas y bonificaciones del Club Winton en BLUE IOU.
 * ============================================================================
 */

class MockFinancialService {
  constructor() {
    this.listeners = new Set();
    this.state = this.getInitialState();
    this.isProcessing = false;
  }

  /**
   * Retorna el estado inicial canónico del perfil de prueba para reinicios.
   */
  getInitialState() {
    return {
      user: {
        id: 'usr_789421',
        name: 'Miguel (VIP Tester)',
        smartAccountAddress: '0x8849...B71F',
        tierLevel: 4,
        tierName: 'Especialista',
        clubMembership: 'Club Oro 🏆',
        clubBonusPercent: 1.0, // 1% adicional en BLUE IOU por cada movimiento
        accumulatedBonusIou: 14.50, // BLUE IOU acumulado por estatus de club
        dailyGasQuota: 8,
        dailyGasUsed: 2,
      },
      // Balances en BLUE
      blue: {
        unlocked: 15.00, // Saldo líquido listo para vender en el Exchange
        // Lotes actualmente en Parking de 30 días
        parkingLots: [
          {
            id: 'lot_01',
            amount: 40.00,
            daysRemaining: 3, // Madura en 3 días (muy cercano)
            dateIssued: '2026-08-22',
            taskTitle: 'Desarrollo de Módulo de Pagos',
            unlockDate: '2026-09-22',
          },
          {
            id: 'lot_02',
            amount: 60.00,
            daysRemaining: 22, // Madura en 22 días (lejano)
            dateIssued: '2026-09-11',
            taskTitle: 'Auditoría de Seguridad Smart Contracts',
            unlockDate: '2026-10-11',
          },
        ],
      },
      // Línea y Compromisos RED
      credit: {
        effectiveLimitRed: 100.00, // Límite aprobado Nivel 4
        debtRed: 60.00, // Compromisos vivos totales
        dueAmountRed: 60.00, // Monto del próximo vencimiento
        overdueDebtRed: 0.00, // Compromisos vencidos
        daysUntilDue: 18,
      },
      // Garantías en USDT (Vault de Colateral)
      collateral: {
        totalDepositedUsdt: 100.00,
      },
      // Registro de transacciones recientes
      transactions: [
        {
          id: 'tx_01',
          type: 'Cobro de Tarea (Marketplace)',
          amount: '+60.00 BLUE',
          status: 'En Parking (22d restantes)',
          timestamp: '2026-09-11 14:32',
          gasSponsored: true,
        },
        {
          id: 'tx_02',
          type: 'Depósito de Garantía USDT',
          amount: '+100.00 USDT',
          status: 'Completado (Smart Account)',
          timestamp: '2026-09-08 09:15',
          gasSponsored: true,
        },
      ],
    };
  }

  /**
   * Reinicia todos los balances y transacciones del simulador a su estado original.
   */
  resetToDefault() {
    this.state = this.getInitialState();
    this.notify();
    return this.getCalculatedState();
  }

  /**
   * Suscribe un componente de React a los cambios de estado.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifica a todos los componentes suscritos.
   */
  notify() {
    this.listeners.forEach((listener) => listener(this.getCalculatedState()));
  }

  /**
   * Calcula en tiempo real las métricas financieras según las reglas canónicas de WintonCoin 2026.
   * Fórmula de tres variables: Reserva = max(Vencidos, max(0, Totales - Límite_Base)).
   */
  getCalculatedState() {
    const { blue, credit, collateral, user } = this.state;

    // 1. Total de saldo en parking
    const totalParkingBlue = blue.parkingLots.reduce((acc, lot) => acc + lot.amount, 0);
    const totalBlueBalance = blue.unlocked + totalParkingBlue;

    // 2. Cálculo canónico de pignoración de USDT:
    // Reserva necesaria = mayor entre (deuda vencida) y (deuda total que supere el límite base).
    const overdueDebt = credit.overdueDebtRed || 0;
    const excessDebt = Math.max(0, credit.debtRed - credit.effectiveLimitRed);
    const requiredReservation = Math.max(overdueDebt, excessDebt);
    const pignoratedUsdt = Math.min(collateral.totalDepositedUsdt, requiredReservation);
    const freeUsdtToWithdraw = Math.max(0, collateral.totalDepositedUsdt - pignoratedUsdt);

    // 3. Capacidad de crédito total aditiva:
    // Capacidad Total = Límite Base + Garantía en Vault.
    // Capacidad Disponible = max(0, Capacidad Total - Deuda RED Total).
    const totalCreditCapacity = credit.effectiveLimitRed + collateral.totalDepositedUsdt;
    const availableCreditCapacity = Math.max(0, totalCreditCapacity - credit.debtRed);

    return {
      ...this.state,
      computed: {
        totalParkingBlue,
        totalBlueBalance,
        totalCreditCapacity,
        pignoratedUsdt,
        freeUsdtToWithdraw,
        availableCreditCapacity,
        gasTxsRemaining: Math.max(0, user.dailyGasQuota - user.dailyGasUsed),
      },
    };
  }

  /**
  /**
   * Ejecuta la liquidación de deuda usando saldo ganado en Parking.
   * Aplica Superpoder LIFO para Nivel 4+: descuenta primero el lote con fecha más lejana.
   */
  async repayWithRouteA(amountToRepay) {
    if (this.isProcessing) throw new Error('Operación en curso. Por favor espera.');
    this.isProcessing = true;

    try {
      const calculated = this.getCalculatedState();
      const amount = Number(amountToRepay);

      if (amount <= 0) throw new Error('El monto a liquidar debe ser mayor a 0');
      if (amount > calculated.credit.debtRed) throw new Error('El monto supera los compromisos RED activos');
      if (amount > calculated.computed.totalParkingBlue) throw new Error('No posees suficiente saldo BLUE ganado en parking');

      // Simulación de latencia de bloque en Optimism con Account Abstraction (1.2 segundos)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      let remainingToDeduct = amount;
      const isLifo = this.state.user.tierLevel >= 4;

      // Ordenar lotes: Si es LIFO (Nivel 4+), ordena de mayor a menor días restantes (quema el más lejano)
      // Si es FIFO (Nivel 1-3), ordena de menor a mayor (quema el más próximo)
      const sortedLots = [...this.state.blue.parkingLots].sort((a, b) => {
        return isLifo ? b.daysRemaining - a.daysRemaining : a.daysRemaining - b.daysRemaining;
      });

      const updatedLots = [];
      for (const lot of sortedLots) {
        if (remainingToDeduct <= 0) {
          updatedLots.push(lot);
          continue;
        }

        if (lot.amount <= remainingToDeduct) {
          remainingToDeduct -= lot.amount;
        } else {
          updatedLots.push({
            ...lot,
            amount: Number((lot.amount - remainingToDeduct).toFixed(2)),
          });
          remainingToDeduct = 0;
        }
      }

      // Actualizar deuda total y vencida prioritariamente
      const newDebt = Number((this.state.credit.debtRed - amount).toFixed(2));
      const overdueDeduction = Math.min(this.state.credit.overdueDebtRed || 0, amount);
      const newOverdueDebt = Number(((this.state.credit.overdueDebtRed || 0) - overdueDeduction).toFixed(2));
      const newDueAmount = Number(Math.min(newDebt, Math.max(0, (this.state.credit.dueAmountRed || this.state.credit.debtRed) - amount)).toFixed(2));

      // Bonificación de Club Winton: 1.0% en BLUE IOU
      const bonusIou = Number(((amount * this.state.user.clubBonusPercent) / 100).toFixed(2));
      const newBonusTotal = Number((this.state.user.accumulatedBonusIou + bonusIou).toFixed(2));

      this.state = {
        ...this.state,
        user: {
          ...this.state.user,
          accumulatedBonusIou: newBonusTotal,
          dailyGasUsed: this.state.user.dailyGasUsed + 1,
        },
        blue: {
          ...this.state.blue,
          parkingLots: updatedLots,
        },
        credit: {
          ...this.state.credit,
          debtRed: newDebt,
          overdueDebtRed: newOverdueDebt,
          dueAmountRed: newDueAmount,
        },
        transactions: [
          {
            id: `tx_${Date.now()}`,
            type: `Compensación de Compromiso con Saldo Ganado (${isLifo ? 'Optimizado LIFO' : 'Estándar'})`,
            amount: `-${amount.toFixed(2)} BLUE (Ganado) ➔ -${amount.toFixed(2)} RED`,
            status: `Completado (+${bonusIou.toFixed(2)} BLUE IOU Bono Club)`,
            timestamp: new Date().toLocaleString(),
            gasSponsored: true,
          },
          ...this.state.transactions,
        ],
      };

      this.notify();
      return { success: true, bonusIou, isLifo };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * OPCIÓN C: Liquidación Atómica de Compromisos usando la Garantía USDT del Vault (repayWithCollateral)
   * Resuelve la trampa de liquidez: compra BLUE en el Exchange y quema RED en 1 solo paso sin doble capital.
   */
  async repayWithCollateral(amountToRepay) {
    if (this.isProcessing) throw new Error('Operación en curso. Por favor espera.');
    this.isProcessing = true;

    try {
      const calculated = this.getCalculatedState();
      const amount = Number(amountToRepay);

      if (amount <= 0) throw new Error('Monto inválido');
      if (amount > calculated.credit.debtRed) throw new Error('El monto supera tus compromisos RED');
      if (amount > calculated.collateral.totalDepositedUsdt) {
        throw new Error('No posees suficiente USDT en garantía en el Vault');
      }

      // Latencia de transacción atómica
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const newDebt = Number((this.state.credit.debtRed - amount).toFixed(2));
      const overdueDeduction = Math.min(this.state.credit.overdueDebtRed || 0, amount);
      const newOverdueDebt = Number(((this.state.credit.overdueDebtRed || 0) - overdueDeduction).toFixed(2));
      const newDueAmount = Number(Math.min(newDebt, Math.max(0, (this.state.credit.dueAmountRed || this.state.credit.debtRed) - amount)).toFixed(2));
      const newUsdt = Number((this.state.collateral.totalDepositedUsdt - amount).toFixed(2));

      this.state = {
        ...this.state,
        user: {
          ...this.state.user,
          dailyGasUsed: this.state.user.dailyGasUsed + 1,
        },
        credit: {
          ...this.state.credit,
          debtRed: newDebt,
          overdueDebtRed: newOverdueDebt,
          dueAmountRed: newDueAmount,
        },
        collateral: {
          totalDepositedUsdt: newUsdt,
        },
        transactions: [
          {
            id: `tx_${Date.now()}`,
            type: 'Amortización de Compromiso con Garantía (Opción C)',
            amount: `-${amount.toFixed(2)} USDT (Vault) ➔ -${amount.toFixed(2)} RED`,
            status: 'Completado sin Doble Capital ($0.00 Gas)',
            timestamp: new Date().toLocaleString(),
            gasSponsored: true,
          },
          ...this.state.transactions,
        ],
      };

      this.notify();
      return { success: true };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retiro instantáneo del USDT libre no afectado a compromisos.
   */
  async withdrawFreeUsdt(amountToWithdraw) {
    if (this.isProcessing) throw new Error('Operación en curso. Por favor espera.');
    this.isProcessing = true;

    try {
      const calculated = this.getCalculatedState();
      const amount = Number(amountToWithdraw);

      if (amount <= 0) throw new Error('Monto inválido para retiro');
      if (amount > calculated.computed.freeUsdtToWithdraw) {
        throw new Error(`Solo puedes retirar hasta ${calculated.computed.freeUsdtToWithdraw.toFixed(2)} USDT libres`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.state = {
        ...this.state,
        user: {
          ...this.state.user,
          dailyGasUsed: this.state.user.dailyGasUsed + 1,
        },
        collateral: {
          totalDepositedUsdt: Number((this.state.collateral.totalDepositedUsdt - amount).toFixed(2)),
        },
        transactions: [
          {
            id: `tx_${Date.now()}`,
            type: 'Retiro de Garantía USDT',
            amount: `-${amount.toFixed(2)} USDT`,
            status: 'Transferido a Billetera Personal',
            timestamp: new Date().toLocaleString(),
            gasSponsored: true,
          },
          ...this.state.transactions,
        ],
      };

      this.notify();
      return { success: true };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Depósito asistido de USDT en 1 Toque con Smart Account ERC-4337.
   */
  async depositUsdt(amountToDeposit) {
    if (this.isProcessing) throw new Error('Operación en curso. Por favor espera.');
    this.isProcessing = true;

    try {
      const amount = Number(amountToDeposit);
      if (amount <= 0) throw new Error('Monto inválido');

      await new Promise((resolve) => setTimeout(resolve, 1200));

      this.state = {
        ...this.state,
        user: {
          ...this.state.user,
          dailyGasUsed: this.state.user.dailyGasUsed + 1,
        },
        collateral: {
          totalDepositedUsdt: Number((this.state.collateral.totalDepositedUsdt + amount).toFixed(2)),
        },
        transactions: [
          {
            id: `tx_${Date.now()}`,
            type: 'Depósito de Garantía (ERC-4337 Batch)',
            amount: `+${amount.toFixed(2)} USDT`,
            status: 'Completado en 1 Toque',
            timestamp: new Date().toLocaleString(),
            gasSponsored: true,
          },
          ...this.state.transactions,
        ],
      };

      this.notify();
      return { success: true };
    } finally {
      this.isProcessing = false;
    }
  }
}

// Instancia singleton para toda la Single Page Application
export const mockFinancialService = new MockFinancialService();

if (typeof window !== 'undefined') {
  window.resetFinancialDemo = () => mockFinancialService.resetToDefault();
}

export default mockFinancialService;
