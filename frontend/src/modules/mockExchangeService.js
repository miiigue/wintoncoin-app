/**
 * ============================================================================
 * [WINTONCOIN] - SERVICIO REACTIVO DE EXCHANGE FIFO (MOCK 2026)
 * ============================================================================
 * Simula el comportamiento del contrato inteligente `WintonFifoExchange.sol` en Optimism:
 * - Paridad Inmutable: 1 BLUE = 1 USDT.
 * - Cola FIFO estricta: Las órdenes se cruzan por orden cronológico de llegada.
 * - Auto-Amortización Opcional: El comprador puede comprar BLUE y quemarlo de
 *   inmediato para cancelar su compromiso RED en 1 sola transacción atómica.
 * - Cancelación Justa: El usuario puede retirar sus fondos si no tiene deuda vencida.
 * ============================================================================
 */

import { mockFinancialService } from './mockFinancialService.js';

class MockExchangeService {
  constructor() {
    this.listeners = new Set();
    this.isProcessing = false;

    // Estado inicial del libro de órdenes del Exchange
    this.state = {
      exchangeRate: 1.00, // 1 BLUE = 1 USDT
      // Cola FIFO de Venta (Vendedores que ofrecen BLUE liberado)
      sellOrders: [
        {
          id: 'ord_sell_101',
          sellerName: 'Carlos M.',
          sellerAddress: '0x3a4...8f1',
          amountBlue: 50.00,
          remainingBlue: 50.00,
          timestamp: 'Hoy, 10:14',
          isMyOrder: false,
        },
        {
          id: 'ord_sell_102',
          sellerName: 'Elena R.',
          sellerAddress: '0x9b2...4c7',
          amountBlue: 120.00,
          remainingBlue: 120.00,
          timestamp: 'Hoy, 11:30',
          isMyOrder: false,
        },
      ],
      // Cola FIFO de Compra (Compradores que ofrecen USDT esperando BLUE)
      buyOrders: [
        {
          id: 'ord_buy_201',
          buyerName: 'David K.',
          buyerAddress: '0x1c8...3d5',
          amountUsdt: 80.00,
          remainingUsdt: 80.00,
          timestamp: 'Hoy, 12:05',
          isMyOrder: false,
        },
      ],
      // Estadísticas globales del Exchange
      stats: {
        totalVolume24h: 14500.00,
        completedMatchesCount: 428,
        averageMatchTimeMinutes: 12,
      },
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  getState() {
    // Calcular totales del libro
    const totalBlueForSale = this.state.sellOrders.reduce((acc, o) => acc + o.remainingBlue, 0);
    const totalUsdtWaiting = this.state.buyOrders.reduce((acc, o) => acc + o.remainingUsdt, 0);

    return {
      ...this.state,
      totalBlueForSale,
      totalUsdtWaiting,
    };
  }

  /**
   * Publica una orden de VENTA de BLUE liberado en la cola FIFO.
   */
  async createSellOrder(amountBlue) {
    if (this.isProcessing) throw new Error('Operación en curso en el Exchange');
    this.isProcessing = true;

    try {
      const amount = Number(amountBlue);
      if (amount <= 0) throw new Error('El monto a vender debe ser mayor a 0');

      const finState = mockFinancialService.getCalculatedState();
      if (amount > finState.blue.unlocked) {
        throw new Error(`Saldo disponible insuficiente. Tienes ${finState.blue.unlocked.toFixed(2)} BLUE líquidos.`);
      }

      // Latencia de bloque
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Descontar el BLUE del saldo disponible del usuario
      mockFinancialService.state.blue.unlocked = Number((mockFinancialService.state.blue.unlocked - amount).toFixed(2));

      // Verificar si hay órdenes de compra en espera para cruce inmediato
      let remainingToSell = amount;
      const updatedBuyOrders = [];

      for (const buyOrd of this.state.buyOrders) {
        if (remainingToSell <= 0) {
          updatedBuyOrders.push(buyOrd);
          continue;
        }

        const matchAmount = Math.min(remainingToSell, buyOrd.remainingUsdt);
        buyOrd.remainingUsdt -= matchAmount;
        remainingToSell -= matchAmount;

        // El vendedor cobra sus USDT de inmediato por el cruce
        mockFinancialService.state.collateral.totalDepositedUsdt = Number(
          (mockFinancialService.state.collateral.totalDepositedUsdt + matchAmount).toFixed(2)
        );

        if (buyOrd.remainingUsdt > 0) {
          updatedBuyOrders.push(buyOrd);
        }
      }

      this.state.buyOrders = updatedBuyOrders;

      // Si aún queda BLUE sin cruzar, entra a la cola FIFO
      if (remainingToSell > 0) {
        const newSellOrder = {
          id: `ord_sell_${Date.now()}`,
          sellerName: 'Tú (Billetera Conectada)',
          sellerAddress: '0xTú...SmartAccount',
          amountBlue: remainingToSell,
          remainingBlue: remainingToSell,
          timestamp: 'Justo ahora',
          isMyOrder: true,
        };
        this.state.sellOrders.push(newSellOrder);
      }

      mockFinancialService.state.transactions.unshift({
        id: `tx_${Date.now()}`,
        type: 'Orden de Venta en Exchange FIFO',
        amount: `-${amount.toFixed(2)} BLUE ➔ +${(amount - remainingToSell).toFixed(2)} USDT`,
        status: remainingToSell === 0 ? 'Cruzada 100% al Instante' : `En Cola FIFO (#${this.state.sellOrders.length} en fila)`,
        timestamp: new Date().toLocaleString(),
        gasSponsored: true,
      });

      mockFinancialService.notify();
      this.notify();
      return { success: true, instantMatch: remainingToSell === 0 };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Ejecuta una orden de COMPRA de BLUE con USDT.
   * Permite auto-quemar contra la deuda RED del usuario de forma atómica.
   */
  async createBuyOrder(amountUsdt, autoBurnRed = false) {
    if (this.isProcessing) throw new Error('Operación en curso en el Exchange');
    this.isProcessing = true;

    try {
      const amount = Number(amountUsdt);
      if (amount <= 0) throw new Error('El monto a comprar debe ser mayor a 0');

      await new Promise((resolve) => setTimeout(resolve, 1200));

      let remainingToBuy = amount;
      const updatedSellOrders = [];
      let totalBlueMatched = 0;

      // Buscar vendedores en la cola FIFO (orden de llegada)
      for (const sellOrd of this.state.sellOrders) {
        if (remainingToBuy <= 0) {
          updatedSellOrders.push(sellOrd);
          continue;
        }

        const matchAmount = Math.min(remainingToBuy, sellOrd.remainingBlue);
        sellOrd.remainingBlue -= matchAmount;
        remainingToBuy -= matchAmount;
        totalBlueMatched += matchAmount;

        if (sellOrd.remainingBlue > 0) {
          updatedSellOrders.push(sellOrd);
        }
      }

      this.state.sellOrders = updatedSellOrders;

      // Procesar el BLUE adquirido
      if (totalBlueMatched > 0) {
        if (autoBurnRed) {
          // Opción Atómica: Quema el BLUE directamente contra la deuda RED
          const debtRed = mockFinancialService.state.credit.debtRed;
          const burnAmount = Math.min(totalBlueMatched, debtRed);
          mockFinancialService.state.credit.debtRed = Number((debtRed - burnAmount).toFixed(2));
          
          // Si sobró BLUE después de pagar la deuda, va al saldo líquido
          const surplusBlue = totalBlueMatched - burnAmount;
          if (surplusBlue > 0) {
            mockFinancialService.state.blue.unlocked = Number((mockFinancialService.state.blue.unlocked + surplusBlue).toFixed(2));
          }
        } else {
          // Entrega normal al saldo líquido del comprador
          mockFinancialService.state.blue.unlocked = Number((mockFinancialService.state.blue.unlocked + totalBlueMatched).toFixed(2));
        }
      }

      // Si no hubo suficientes vendedores, el remanente entra a la cola de compra con estatus de Buena Fe
      if (remainingToBuy > 0) {
        const newBuyOrder = {
          id: `ord_buy_${Date.now()}`,
          buyerName: 'Tú (Billetera Conectada)',
          buyerAddress: '0xTú...SmartAccount',
          amountUsdt: remainingToBuy,
          remainingUsdt: remainingToBuy,
          timestamp: 'Justo ahora',
          isMyOrder: true,
          autoBurnRed,
        };
        this.state.buyOrders.push(newBuyOrder);
      }

      mockFinancialService.state.transactions.unshift({
        id: `tx_${Date.now()}`,
        type: autoBurnRed ? 'Compra de BLUE y Pago de Deuda' : 'Compra de BLUE en Exchange',
        amount: `-${amount.toFixed(2)} USDT ➔ +${totalBlueMatched.toFixed(2)} BLUE`,
        status: remainingToBuy === 0 ? 'Completado al Instante' : `En Cola de Espera (Buena Fe - Posición #${this.state.buyOrders.length})`,
        timestamp: new Date().toLocaleString(),
        gasSponsored: true,
      });

      mockFinancialService.notify();
      this.notify();
      return { success: true, matchedAmount: totalBlueMatched, inQueueAmount: remainingToBuy };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancela una orden activa del usuario en el Exchange.
   */
  async cancelOrder(orderId) {
    if (this.isProcessing) throw new Error('Operación en curso');
    this.isProcessing = true;

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Buscar en órdenes de venta
      const sellIndex = this.state.sellOrders.findIndex((o) => o.id === orderId && o.isMyOrder);
      if (sellIndex !== -1) {
        const [removed] = this.state.sellOrders.splice(sellIndex, 1);
        // Devolver el BLUE no cruzado a su saldo disponible
        mockFinancialService.state.blue.unlocked = Number((mockFinancialService.state.blue.unlocked + removed.remainingBlue).toFixed(2));
        mockFinancialService.notify();
        this.notify();
        return { success: true, refunded: `${removed.remainingBlue.toFixed(2)} BLUE` };
      }

      // Buscar en órdenes de compra
      const buyIndex = this.state.buyOrders.findIndex((o) => o.id === orderId && o.isMyOrder);
      if (buyIndex !== -1) {
        const order = this.state.buyOrders[buyIndex];
        // Validar si tiene deuda vencida pendiente
        const overdue = mockFinancialService.state.credit.overdueDebtRed || 0;
        if (overdue > 0 && order.autoBurnRed) {
          throw new Error('Esta orden está retenida como Garantía de Buena Fe por deuda vencida. Primero salda tu deuda con tareas.');
        }

        const [removed] = this.state.buyOrders.splice(buyIndex, 1);
        mockFinancialService.notify();
        this.notify();
        return { success: true, refunded: `${removed.remainingUsdt.toFixed(2)} USDT` };
      }

      throw new Error('Orden no encontrada');
    } finally {
      this.isProcessing = false;
    }
  }
}

export const mockExchangeService = new MockExchangeService();
export default mockExchangeService;
