---
name: v6-canonical-architecture
description: Estándar obligatorio de arquitectura V6 para WintonCoin. Asegura que todo el backend, frontend y scripts usen los contratos modulares V6 y marketplaceDeployment, evitando referencias obsoletas a V4/V5.
---

# Arquitectura Canónica V6 de WintonCoin

Siempre que se modifique o cree código Web3 en WintonCoin, se deben cumplir obligatoriamente estas reglas:

## 1. Selector de Despliegue Único
- Usar **siempre** `backend/src/services/marketplaceDeployment.js` (`configuration()`, `validate()`, `provider()`, `isV6Epoch(epoch)`).
- **Prohibido** importar `chainDeployment.js` en módulos nuevos o actualizados de Demo/V6.

## 2. Contratos Modulares V6 (Sin Monolito `CoreProtocol`)
- **Identidad KYC, Nivel y Límite RED:** `RiskRegistry` (`profile(address)`, `isKYCVerified(address)`, `setProfile(address, bool, uint128, uint8)`).
  - Prohibido llamar a `CoreProtocol.creditLimits()`, `CoreProtocol.isDelinquent()` o `CoreProtocol.setUserBenefits()`.
- **Compromisos RED y Vencimientos:** `CommitmentLedger` (`outstanding(address)`, `matured(address)`, `lot(address, uint256)`).
- **Pagos y Amortizaciones:** `PaymentEngine` (`settleMatured(address)`, `requiredCollateral(address)`).
- **Bóveda de Garantías:** `CollateralVaultV6` (`collateralBalance`, `freeCollateral`, `exchangeReserved`, `protectOverdue`).
- **Exchange FIFO:** `ExchangeRouter` (`matchNext`), `FifoOrderBook`, `ExchangeCustody`.
- **Control de Modo y Emergencia:** `ProtocolModeController` (`mode()`, `setMode(0|1|2)`).

## 3. Regla de Activación de Billetera (`RecoverableAccounts`)
- Toda billetera nueva que se active en V6 (o reciba alta KYC) debe sincronizar su perfil inicial en `RiskRegistry` con la política vigente (`red_credit_base_limit`, nivel y verificación KYC) **confirmada on-chain**, sin emitir BLUE ni RED.
- En Demo (`chainId === '11155420'`), `RecoverableAccounts` usa confirmación L2 verificada (`{ finality: null, confirmations: 2 }`); en otras redes conserva `finality: 'safe'`.
