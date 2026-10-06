# DIAGRAMAS DE FLUJO VISUALES E INTEGRALES - WINTONCOIN PROTOCOL

> [!NOTE]
> **Visor Gráfico Interactivo**: Para explorar estos diagramas en formato web vectorial interactivo con pestañas de navegación y zoom, puedes abrir el archivo [`docs/DIAGRAMAS_VISUALES_PROYECTO.html`](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/docs/DIAGRAMAS_VISUALES_PROYECTO.html) directamente en tu navegador.

---

## 1. Protocolo Económico Fundamental: Generación, Compromiso RED y Paridad BLUE/RED

### 1.1 Diagrama Visual: Transacción de Pago y Emisión de COMPROMISO RED (`financialCoreService.processPayment`)
Este diagrama representa visualmente la paridad 1:1 entre el token **BLUE** y el **COMPROMISO RED** asumido por el pagador.

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;
    classDef error fill:#ef4444,color:#fff,stroke:#f87171,stroke-width:2px;

    A(["Inicio: Usuario Solicita Pago / Transferencia"]):::startEnd --> B{"¿Saldo y Límite RED Disponibles?"}:::decision
    B -- "No" --> C(["Error 403: Saldo Insuficiente"]):::error
    B -- "Sí" --> D["Calcular Comisión de Plataforma e Importe Neto"]:::process
    D --> E["Acreditar Tokens BLUE con Parking al Beneficiario"]:::process
    D --> F["Registrar COMPROMISO RED en Cuenta del Pagador"]:::process
    E --> G["Acreditar Tokens BLUE de Comisión a Tesorería"]:::process
    F --> H{"¿Invariante TotalSupply BLUE == TotalSupply RED?"}:::decision
    H -- "No" --> I(["REVERT CRÍTICO: Reversión Auditada"]):::error
    H -- "Sí" --> J["Registrar Audit Log de Trazabilidad SOC 2"]:::process
    J --> K(["Transacción Notificada y Completada Exitosamente"]):::success
```

---

### 1.2 Diagrama Visual: Dogfooding Protocolar de Tesorería (Incentivos sin Excepciones P2P)

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;

    TA(["Inicio: Dispersión de Incentivo / Bono de Tesorería"]):::startEnd --> TB["Tesorería Invoca CoreProtocol como Pagador Ordinario"]:::process
    TB --> TC["Emitir Tokens BLUE de Recompensa al Usuario"]:::process
    TB --> TD["Tesorería Asume el COMPROMISO RED Correspondiente"]:::process
    TC --> TE["Tesorería Recibe Tokens BLUE por Comisiones de Plataforma"]:::process
    TD --> TF["Tesorería Amortiza su COMPROMISO RED con Tokens BLUE Acumulados"]:::process
    TF --> TG["Verificar Variación Neta Cero en la Masa Monetaria"]:::process
    TG --> TH(["Incentivo Procesado con Paridad Estricta Manteniéndose"]):::success
```

---

## 2. Autenticación, Seguridad Zero-Trust & Registro de Cuentas

### 2.1 Diagrama Visual: Autenticación WebAuthn (Passkeys) & JWT (`authController` + `webauthnService`)

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;
    classDef error fill:#ef4444,color:#fff,stroke:#f87171,stroke-width:2px;

    UA(["Inicio: Solicitud de Login App/Admin"]):::startEnd --> UB{"¿Método Seleccionado?"}:::decision
    UB -- "Passkey Biométrica" --> UC["Backend Genera Challenge Criptográfico"]:::process
    UC --> UD["Dispositivo Hardware Autentica Huella / Rostro"]:::process
    UD --> UE{"¿Firma Biométrica Válida?"}:::decision
    UE -- "No" --> UF(["Error: Autenticación Denegada"]):::error
    UE -- "Sí" --> UG["Validar Firma en webauthnService"]:::process

    UB -- "Credenciales / PIN" --> UH{"¿Consultar pinAttemptsPool?"}:::decision
    UH -- "Intentos Excedidos" --> UI(["Error 429: Cuenta Bloqueada Temporalmente"]):::error
    UH -- "Permitido" --> UJ["Verificar Hash Bcrypt con Pepper"]:::process
    UJ --> UK{"¿Credenciales Correctas?"}:::decision
    UK -- "No" --> UL["Incrementar Fallos en Pool"]:::process
    UL --> UF
    UK -- "Sí" --> UM["Resetear Contador de Intentos Fallidos"]:::process

    UG --> UN["Generar JWT Alta Seguridad + Cookie Refresh HttpOnly"]:::process
    UM --> UN
    UN --> UO(["Sesión Iniciada con Éxito"]):::success
```

---

## 3. Motor P2P / Marketplace & Algoritmo FIFO

### 3.1 Diagrama Visual: Publicación con Estaca de Garantía (`publicationController.create`)

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;
    classDef error fill:#ef4444,color:#fff,stroke:#f87171,stroke-width:2px;

    PA(["Inicio: Usuario Crea Publicación P2P"]):::startEnd --> PB["Ingresar Monto, Tasa de Cambio y Moneda FIAT"]:::process
    PB --> PC{"¿Es Publicación de Venta de BLUE?"}:::decision
    PC -- "Sí" --> PD["Bloquear Tokens BLUE en Escrow / Custodia"]:::process
    PC -- "No" --> PE["Verificar Scoring Crediticio y Reputación"]:::process
    PD --> PF{"¿Fondos Suficientes para Escrow?"}:::decision
    PF -- "No" --> PG(["Error: Fondos Insuficientes para Estaca"]):::error
    PF -- "Sí" --> PH["Registrar Publicación en Estado ACTIVA"]:::process
    PE --> PH
    PH --> PI["Agregar Oferta al Orderbook FIFO"]:::process
    PI --> PJ(["Publicación Visible en Mercado"]):::success
```

---

### 3.2 Diagrama Visual: Algoritmo Matching FIFO & Confirmación FIAT (`p2pController.matchOrder`)

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;

    MA(["Inicio: Usuario Toma Oferta del Orderbook"]):::startEnd --> MB["Evaluar Prioridad FIFO por Timestamp Exacto"]:::process
    MB --> MC["Bloquear Porción Solicitada en la Orden"]:::process
    MC --> MD["Comprador Envía Pago FIAT por Canal Bancario"]:::process
    MD --> ME["Comprador Adjunta Comprobante y Marca Pagado"]:::process
    ME --> MF{"¿Vendedor Confirma Pago Recibido?"}:::decision
    MF -- "Sí" --> MG["Liberar Tokens BLUE del Escrow al Comprador"]:::process
    MG --> MH["Acreditar Comisión y Actualizar Reputación"]:::process
    MH --> MI(["Transacción P2P Completada Exitosamente"]):::success
```

---

### 3.3 Diagrama Visual: Disputas y Arbitraje P2P (`p2pController.disputeOrder`)

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;
    classDef error fill:#ef4444,color:#fff,stroke:#f87171,stroke-width:2px;

    DA(["Inicio: Apertura de Disputa P2P"]):::startEnd --> DB["Congelar Tokens en Escrow de la Orden"]:::process
    DB --> DC["Asignar Árbitro de Administración de WintonCoin"]:::process
    DC --> DD["Recopilar Comprobantes Bancarios y Chat de Auditoría"]:::process
    DD --> DE{"¿Fueron Válidos los Fondos FIAT Transmitidos?"}:::decision
    DE -- "Sí, Pago Confirmado" --> DF["Árbitro Libera Tokens BLUE al Comprador"]:::process
    DF --> DG(["Orden Resuelta a Favor del Comprador"]):::success
    DE -- "No, Pago Falso/Incompleto" --> DH["Árbitro Devuelve Escrow al Vendedor"]:::process
    DH --> DI["Sancionar / Suspender Cuenta del Comprador"]:::process
    DI --> DJ(["Orden Resuelta a Favor del Vendedor"]):::error
```

---

## 4. Gobernanza y Creador de Proyectos Solidarios

### 4.1 Diagrama Visual: Votación con BLUE en Parking (`governanceService`)

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;

    GA(["Inicio: Usuario Vota en Propuesta Comunitarias"]):::startEnd --> GB["Verificar Balance Disponible de BLUE"]:::process
    GB --> GC["Congelar Tokens BLUE en Parking de Gobernanza"]:::process
    GC --> GD["Registrar Voto con Hash Criptográfico en BD"]:::process
    GD --> GE{"¿Concluyó el Período de Votación?"}:::decision
    GE -- "No" --> GF["Seguir Recibiendo Votos Comunitarios"]:::process
    GE -- "Sí" --> GG{"¿Propuesta Aprobada por Quórum?"}:::decision
    GG -- "Aprobada" --> GH["Financiar Causa / Ejecutar Decisión Comunitarias"]:::process
    GG -- "Rechazada" --> GI["Archivar Propuesta Desestimada"]:::process
    GH --> GJ["Descongelar Tokens BLUE de los Votantes"]:::process
    GI --> GJ
    GJ --> GK(["Proceso de Votación Finalizado Exitosamente"]):::success
```

---

## 5. Credit Scoring, Halving & Subsidio de Gas

### 5.1 Diagrama Visual: Scoring Crediticio y Halving por Mora RED (`creditScoringService`)

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;
    classDef error fill:#ef4444,color:#fff,stroke:#f87171,stroke-width:2px;

    SA(["Inicio: Evaluación de Scoring Crediticio"]):::startEnd --> SB["Calcular Puntuación por Historial y Cumplimiento"]:::process
    SB --> SC{"¿Usuario Registra Mora Protocolar RED?"}:::decision
    SC -- "No" --> SD["Calcular Límite Base por Mérito"]:::process
    SD --> SE["Aplicar Trinquete: Preservar Límite Adquirido"]:::process
    SE --> SF(["Límite Manteniéndose o Aumentando"]):::success
    SC -- "Sí" --> SG["Aplicar Halving Estricto: Recortar Límite al 50%"]:::process
    SG --> SH["Desactivar Trinquete por Riesgo de Mora"]:::process
    SH --> SI["Sincronizar Límite Recortado On-Chain"]:::process
    SI --> SJ(["Límite Reducido por Penalización de Mora"]):::error
```

---

## 6. Pipeline de Auditoría Bancaria SOC 2 & Trazabilidad Log

### 6.1 Diagrama Visual: Auditoría Inmutable (`auditService`) y Reconciliación

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,color:#fff,stroke:#60a5fa,stroke-width:2px;
    classDef decision fill:#8b5cf6,color:#fff,stroke:#c084fc,stroke-width:2px;
    classDef process fill:#1f2937,color:#fff,stroke:#4b5563,stroke-width:2px;
    classDef success fill:#10b981,color:#fff,stroke:#34d399,stroke-width:2px;
    classDef error fill:#ef4444,color:#fff,stroke:#f87171,stroke-width:2px;

    AA(["Inicio: Evento en Controlador o Servicio"]):::startEnd --> AB["Invocar auditService.logEvent"]:::process
    AB --> AC["Insertar Registro Inmutable en Tabla audit_logs"]:::process
    AB --> AD["Despachar Evento a notificationEventBus"]:::process
    AD --> AE["Enviar Notificación WebSocket a la UI React"]:::process
    AC --> AF["Worker Periodic Reconciliation Compara BD vs On-Chain"]:::process
    AF --> AG{"¿Saldos BD y On-Chain Coinciden 100%?"}:::decision
    AG -- "Sí" --> AH(["Auditoría Aprobada: Estado Saludable"]):::success
    AG -- "No" --> AI(["Alerta Crítica de Discrepancia Emitida"]):::error
```
