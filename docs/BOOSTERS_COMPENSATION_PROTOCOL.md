# Protocolo de Compensación para Impulsores (Boosters) en Web3

Este documento consolida las reglas, matemáticas y lógica de negocio para la transición de los **BLUE IOU (Pagarés)** hacia la economía On-Chain mediante los tokens **BLUE (ERC-20)**. Delinea el funcionamiento técnico del contrato inteligente `WintonTreasury.sol` que ejecutará la **Prelación de Pagos en Cascada**.

## 1. Visión y Naturaleza de los Tokens
*   **Token BLUE (ERC-20):** Es el activo líquido y funcional del ecosistema WintonCoin, operando bajo la red de Capa 2 (ej. Optimism). 1 Token BLUE buscará la paridad de valoración proyectada a $1 USD.
*   **BLUE IOU (Off-Chain):** Es el registro auditable (pre-minado a precio cero con esfuerzo y trabajo) alojado en la base de datos PostgreSQL, sometido a estrictos controles Anti-Fraude (KYC Biométrico y Anti-Sybil). Su límite de emisión global (Pool) está fijado inviolablemente en **100,000,000 BLUE IOU**. 
*   **Naturaleza Educativa y No Laboral:** La acumulación de BLUE IOU obedece a un esfuerzo voluntario en etapa de pre-lanzamiento, no a un salario.

## 2. Niveles de Reputación y Prioridad
El Smart Contract debe reconocer los siguientes "Tiers" o Niveles de los Impulsores, determinados por la cantidad final de BLUE IOU acumulada antes de la fotografía (Snapshot) de TGE (Token Generation Event):

1.  **Nivel 1 (Visionario):** 1 a 5,000 BLUE IOU. 
    *   Prioridad Alta en la Cascada de Pagos. (20% OFF en fees por 1 Año).
2.  **Nivel 2 (Pionero):** 5,001 a 25,000 BLUE IOU.
    *   Prioridad Media (Tras Nivel 1). (50% OFF en fees por 2 Años). Bono de Referidos del 20%.
3.  **Nivel 3 (Guardian):** +25,001 BLUE IOU.
    *   Prioridad Baja (Último eslabón de la cascada). 
    *   Bono automático de 50,000 BLUE IOU upon upgrade.
    *   *Excepción Inversores SAFE:* Socios estratégicos de capital entran aquí automáticamente con BLUE IOU multiplicados x2.

## 3. Algoritmo de Liberación: "Prelación de Pagos en Cascada"
El flujo de liquidez que ingresa al contrato `WintonTreasury` proviene entera y genuinamente de las **Comisiones** mensuales. No hay creación colateral de la nada. 

El Smart Contract ejecutará mensualmente el siguiente flujo matemático estructurado cuando haya `F_TOTAL` (Fondos de Comisiones) disponibles:

La regla de agotamiento es **universal para todas las capas**:
*   **Si los fondos se agotan ANTES de llegar a tu capa:** Esa capa y todas las inferiores cobran `0 BLUE` ese mes y mantienen su posición en espera (`Hold`) al no recibir inyección de liquidez.
*   **Si los fondos se agotan DURANTE tu capa:** No alcanza para pagar el 100%. Todos los miembros de esa capa reciben un pago fraccionado (Prorrateo) equitativo, y las capas inferiores quedan en `Hold`.
*   **Si los fondos superan la deuda de tu capa:** Toda la capa cobra el `100%` de manera íntegra, y el líquido remanente pasa a la siguiente prioridad.

**El orden estricto de derrame de liquidez es:**
1.  **Capa Prioritaria 0 (Casos Humanitarios):** Cobra primero. Deja un `F_REMANENTE_1 = F_TOTAL - DEUDA_HUMANITARIA`.
2.  **Capa Prioritaria 1 (Nivel 1 - Visionarios):** Fluye del `F_REMANENTE_1`. Deja un `F_REMANENTE_2`.
3.  **Capa Prioritaria 2 (Nivel 2 - Pioneros):** Fluye del `F_REMANENTE_2`. Deja un `F_REMANENTE_3`.
4.  **Capa Prioritaria 3 (Nivel 3 - Guardianes):** Último eslabón. Cobran exclusivamente de `F_REMANENTE_3` si es que el derrame alcanza a llegar hasta el fondo.

### 3.1 El Prorrateo (Pro-Rata Formula)
Si en cualquier capa el `F_REMANENTE` no es suficiente para cubrir la `DEUDA` total de la capa, se activa el algoritmo de Prorrateo Criptográfico. 

**Fórmula de Liquidación:**
`Porcentaje_de_Pago = (Fondos_Restantes / Deuda_Total_Nivel) * 100`

Cada usuario de ese nivel tendrá habilitado para hacer `Claim` equivalente a:
`User_Claim_Amount = Deuda_Usuario * Porcentaje_de_Pago`

## 4. Auditoría de Seguridad e Integridad de Reclamaciones
*   **Condicionales Pre-Claim (KYC):** El contrato no permitirá reclamos sin un oráculo de identidad verificada al 100%. Todas las recompensas de origen en granjas de teléfonos, VPNs repetidas, o multicuentas serán denegadas mediante el puente API, inhabilitando su address para `claim`.
*   **Inmutabilidad de Multiplicadores:** La deuda (IOU) se congelará al momento de pasar a la red según su etapa histórica, impidiendo alteraciones de saldo post-lanzamiento.

---
*Documento estructurado acorde con la reglamentación estipulada en www.boosters.wintoncoin.com y los estándares Fintech de Silicon Valley.*
