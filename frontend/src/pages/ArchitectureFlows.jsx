import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './ArchitectureFlows.module.css';

/**
 * ============================================================================
 * [WINTONCOIN] - ARCHITECTURE FLOWS (React SPA Component 2026)
 * ============================================================================
 * Visualizador Interactivo de Arquitectura y Procesos de WintonCoin.
 * - Estética oficial de WintonCoin: Logotipo de alta resolución, paleta de colores
 *   azul marino / zafiro / esmeralda, y tipografía bancaria 'Inter' / 'Outfit'.
 * - Cero botones de Play: Interactividad 100% reactiva por hover (mouse) y toque (pantalla táctil).
 * - Scroll vertical natural y fluido en toda la página (desktop y móvil sin bloqueos).
 * - Inspector de pasos en vivo con explicaciones técnicas detalladas de cómo
 *   funciona realmente cada proceso en el backend, smart contracts y base de datos.
 * - Cumplimiento estricto: COMPROMISO RED (cero palabra "deuda"), invariante
 *   TotalSupply(BLUE) == TotalSupply(RED), SOC 2 y Zero-Trust.
 * ============================================================================
 */

export const PROCESS_CATEGORIES = [
  {
    id: 'cat-core',
    name: 'Core Protocol & FinTech',
    icon: '💰',
    items: ['sec-economic', 'sec-treasury']
  },
  {
    id: 'cat-security',
    name: 'Seguridad & Identidad',
    icon: '🔐',
    items: ['sec-auth', 'sec-recovery']
  },
  {
    id: 'cat-p2p',
    name: 'Marketplace & Engine FIFO',
    icon: '⚡',
    items: ['sec-p2p-create', 'sec-p2p-match', 'sec-p2p-dispute']
  },
  {
    id: 'cat-impact',
    name: 'Gobernanza & Impacto',
    icon: '🏛️',
    items: ['sec-gov', 'sec-humanitarian']
  },
  {
    id: 'cat-credit',
    name: 'Crédito & Web3 Engine',
    icon: '📊',
    items: ['sec-scoring', 'sec-gas']
  },
  {
    id: 'cat-audit',
    name: 'Auditoría & Cumplimiento',
    icon: '📜',
    items: ['sec-audit']
  }
];

export const PROCESS_CATALOG = {
  'sec-economic': {
    title: 'Protocolo Económico: BLUE / COMPROMISO RED',
    category: 'Core Protocol & FinTech',
    icon: '💰',
    desc: 'Mapeo integral de financialCoreService.processPayment. Por cada transferencia, se acredita el activo BLUE con parking diferido al beneficiario y se registra el COMPROMISO RED en el pagador, verificando la invariante TotalSupply(BLUE) == TotalSupply(RED).',
    modules: 'CoreProtocol.sol, RedToken.sol, financialCoreService.js',
    rule: 'Paridad 1:1 Invariable, Masa Monetaria Neta Cero',
    audit: 'Trazabilidad Bancaria SOC 2 en tabla audit_logs',
    steps: [
      {
        num: 1,
        title: 'Solicitud de Pago o Transferencia',
        desc: 'El usuario envía la orden desde la aplicación. El backend valida la sesión bajo principios Zero-Trust y autentica la firma criptográfica antes de despachar a CoreProtocol.sol.',
        module: 'financialCoreService.js / CoreProtocol.sol',
        security: 'Validación de firma y token de sesión activo'
      },
      {
        num: 2,
        title: 'Evaluación de Límite Crediticio RED',
        desc: 'El Smart Contract y el servicio calculan la capacidad crediticia: se evalúa que el nuevo compromiso RED no exceda el límite asignado y que el usuario no esté en mora protocolar.',
        module: 'CoreProtocol.sol: getCreditLimit() / isDelinquent()',
        security: 'Guarda estricta de solvencia contra sobre-endeudamiento'
      },
      {
        num: 3,
        title: 'Cálculo de Comisión e Importe Neto',
        desc: 'Se descuenta la comisión de plataforma (2%) y se determina el monto neto a acreditar. Los cálculos operan con precisión fija a 6 decimales para evitar desvíos contables.',
        module: 'financialCoreService.js: calculateFeeAndNet()',
        security: 'Precisión matemática bancaria sin punto flotante'
      },
      {
        num: 4,
        title: 'Acreditación de BLUE con Parking Diferido',
        desc: 'Se emiten los tokens BLUE netos a favor del beneficiario con un bloqueo temporal en parking. Esto protege ambas partes contra disputas inmediatas o cancelaciones fraudulentas.',
        module: 'BlueToken.sol / CoreProtocol.sol: mintWithParking()',
        security: 'Retención programada con liberación gradual auditable'
      },
      {
        num: 5,
        title: 'Registro de COMPROMISO RED en el Pagador',
        desc: 'Se emite la cantidad equivalente de tokens RED a la billetera del pagador. Esto formaliza su COMPROMISO RED con la plataforma, sin usar la palabra deuda.',
        module: 'RedToken.sol: mintRedCommitment()',
        security: 'Emisión simétrica atómica vinculada al lote de pago'
      },
      {
        num: 6,
        title: 'Comisión a la Tesorería',
        desc: 'Los tokens BLUE correspondientes al 2% de comisión se transfieren directamente a la bóveda de la Tesorería para el sostenimiento del protocolo y cobertura de gas.',
        module: 'ProtocolTreasury.sol',
        security: 'Fondos asignados a la reserva protocolar verificable'
      },
      {
        num: 7,
        title: 'Verificación Criptográfica de Invariante',
        desc: 'El protocolo comprueba de forma obligatoria que TotalSupply(BLUE) == TotalSupply(RED). Si no coincide con precisión exacta, la transacción ejecuta REVERT.',
        module: 'CoreProtocol.sol: assertParityInvariant()',
        security: 'Invariante matemática estricta: Masa monetaria neta cero'
      },
      {
        num: 8,
        title: 'Inserción Inmutable en audit_logs SOC 2',
        desc: 'Se asienta un registro forense en la base de datos con hash SHA-256 de la operación, timestamp UTC, dirección de billetera y balances resultantes.',
        module: 'auditService.js: logEvent() / tabla audit_logs',
        security: 'Estándar bancario SOC 2 de inmutabilidad y no-repudio'
      },
      {
        num: 9,
        title: 'Pago Confirmado y Liquidado',
        desc: 'Se notifica en tiempo real a los clientes mediante WebSockets y se actualizan los balances en el Dashboard de React.',
        module: 'notificationEventBus.js / Frontend React SPA',
        security: 'Confirmación instantánea al usuario sin recarga'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph S1 [" 1. Solicitud & Crédito "]
        A(["1. Solicitud de Pago<br/>(Transferencia)"]):::startEnd --> B{"2. ¿Límite RED<br/>Disponible?"}:::decision
        B -- "Insuficiente" --> C(["Error 403:<br/>Saldo Insuficiente"]):::error
    end

    subgraph S2 [" 2. Emisión Dual Paritaria "]
        B -- "Aprobado" --> D["3. Calcular Comisión<br/>e Importe Neto"]:::process
        D --> E["4. Acreditar BLUE<br/>(Parking Diferido)"]:::process
        D --> F["5. Registrar<br/>COMPROMISO RED"]:::process
        E --> G["6. Comisión a<br/>la Tesorería"]:::process
    end

    subgraph S3 [" 3. Verificación de Invariante & Auditoría "]
        F --> H{"7. ¿Invariante<br/>BLUE == RED?"}:::decision
        G --> H
        H -- "Fallo" --> I(["REVERT:<br/>Fallo de Paridad"]):::error
        H -- "Conforme" --> J["8. Inserción en<br/>audit_logs SOC 2"]:::process
        J --> K(["9. Pago Confirmado<br/>y Liquidado"]):::success
    end
`
  },
  'sec-treasury': {
    title: 'Dogfooding Protocolar de Tesorería',
    category: 'Core Protocol & FinTech',
    icon: '🏛️',
    desc: 'La Tesorería NUNCA transfiere tokens BLUE directamente por fuera del protocolo. Todo incentivo opera bajo el flujo estándar idéntico al de cualquier usuario: asume el COMPROMISO RED y amortiza con comisiones acumuladas.',
    modules: 'ProtocolTreasury.sol, CoreProtocol.sol, RedToken.sol',
    rule: 'Cero transferencias P2P directas de Tesorería',
    audit: 'Amortización Contable con Comisiones Acumuladas',
    steps: [
      {
        num: 1,
        title: 'Dispersión de Recompensa o Incentivo',
        desc: 'La plataforma aprueba un pago de incentivo para un colaborador comunitario o creador de contenido.',
        module: 'adminPublicationsController.js',
        security: 'Autorización administrativa multirrol'
      },
      {
        num: 2,
        title: 'Invocación como Pagador Estándar',
        desc: 'La Tesorería llama al método canónico de pago actuando como un usuario común, sin puertas traseras ni privilegios de evasión de reglas.',
        module: 'CoreProtocol.sol: processPayment()',
        security: 'Dogfooding estricto: La Tesorería sigue las mismas reglas que los usuarios'
      },
      {
        num: 3,
        title: 'Emisión de BLUE con Parking al Usuario',
        desc: 'Se transfieren los tokens BLUE correspondientes al beneficiario con el respectivo calendario de parking.',
        module: 'BlueToken.sol',
        security: 'Custodia programada simétrica'
      },
      {
        num: 4,
        title: 'Tesorería Asume COMPROMISO RED',
        desc: 'La Tesorería contrae el COMPROMISO RED ordinario, registrando el débito contable sin excepciones.',
        module: 'RedToken.sol',
        security: 'Trazabilidad de compromisos sin saldos virtuales ocultos'
      },
      {
        num: 5,
        title: 'Recepción Ordinaria de BLUE por Comisión',
        desc: 'Como cualquier operación económica, se genera la comisión protocolar que entra a la cuenta de comisiones.',
        module: 'ProtocolTreasury.sol: feeRecipient',
        security: 'Auditoría de ingresos operativos'
      },
      {
        num: 6,
        title: 'Amortización con BLUE de Comisiones',
        desc: 'La Tesorería quema sus tokens BLUE ganados legítimamente por comisiones para amortizar su COMPROMISO RED.',
        module: 'CoreProtocol.sol: burnBlueToSettleRed()',
        security: 'Aniquilación bilateral materia-antimateria'
      },
      {
        num: 7,
        title: 'Verificación de Variación Neta Cero',
        desc: 'La cantidad total de tokens circulantes no sufre inflación artificial; la paridad se mantiene exacta.',
        module: 'CoreProtocol.sol',
        security: 'Garantía matemática anti-inflacionaria'
      },
      {
        num: 8,
        title: 'Incentivo Liquidado con Paridad 1:1',
        desc: 'El pago concluye exitosamente con balance neto cero para el ecosistema monetario.',
        module: 'audit_logs',
        security: 'Registro inmutable de recompensa'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;

    subgraph T1 [" 1. Origen del Incentivo "]
        TA(["1. Dispersión de<br/>Recompensa"]):::startEnd --> TB["2. Invocación como<br/>Pagador Estándar"]:::process
    end

    subgraph T2 [" 2. Flujo Protocolar Ordinario "]
        TB --> TC["3. Emitir Tokens BLUE<br/>con Parking al Usuario"]:::process
        TB --> TD["4. Tesorería Asume<br/>COMPROMISO RED"]:::process
        TC --> TE["5. Recepción Ordinaria de<br/>BLUE por Comisión"]:::process
    end

    subgraph T3 [" 3. Amortización & Paridad "]
        TD --> TF["6. Amortización con<br/>BLUE de Comisiones"]:::process
        TE --> TF
        TF --> TG["7. Verificación:<br/>Masa Neta Cero"]:::process
        TG --> TH(["8. Incentivo Liquidado<br/>con Paridad 1:1"]):::success
    end
`
  },
  'sec-auth': {
    title: 'Autenticación WebAuthn & JWT Zero-Trust',
    category: 'Seguridad & Identidad',
    icon: '🔐',
    desc: 'Autenticación multifactorial y biométrica. Incluye generación de challenge criptográfico con WebAuthn/Passkeys, y protección estricta contra ataques de fuerza bruta mediante pinAttemptsPool.',
    modules: 'authController.js, webauthnService.js, pinAttemptsPool.js',
    rule: 'Principio de Cero Confianza (Zero-Trust) & Passkeys',
    audit: 'Bloqueo tras 5 intentos fallidos y logs inmutables',
    steps: [
      {
        num: 1,
        title: 'Solicitud de Login en la Aplicación',
        desc: 'El usuario inicia el acceso desde el navegador o la aplicación móvil.',
        module: 'authController.js: login()',
        security: 'Canal seguro TLS 1.3 con sanitización estricta'
      },
      {
        num: 2,
        title: 'Selección de Método de Autenticación',
        desc: 'El cliente elige entre Biometría de Hardware (Passkeys) o Clave/Frase Secreta de autocustodia.',
        module: 'passkeyAuthorization.js',
        security: 'Compatibilidad FIDO2 / WebAuthn W3C'
      },
      {
        num: 3,
        title: 'Challenge Criptográfico de Servidor',
        desc: 'El servidor emite un nonce aleatorio criptográfico con expiración de 60 segundos para evitar replay attacks.',
        module: 'webauthnService.js: generateChallenge()',
        security: 'Entropía criptográfica CSPRNG'
      },
      {
        num: 4,
        title: 'Biometría de Hardware en Dispositivo',
        desc: 'El chip de seguridad del teléfono (Secure Enclave o TPM) firma el challenge mediante huella o reconocimiento facial.',
        module: 'Hardware Authenticator (FIDO2)',
        security: 'Clave privada nunca sale del hardware del usuario'
      },
      {
        num: 5,
        title: 'Validación en Servidor & Control de Intentos',
        desc: 'El backend valida la firma de clave pública y verifica el pool de intentos en pinAttemptsPool.js.',
        module: 'pinAttemptsPool.js / webauthnService.js',
        security: 'Bloqueo preventivo de 15 minutos tras 5 fallos'
      },
      {
        num: 6,
        title: 'Generación de JWT Seguro + Refresh HttpOnly',
        desc: 'Se emite un token de sesión de corta duración y un Refresh Token en cookie HttpOnly con SameSite=Strict.',
        module: 'authMiddleware.js',
        security: 'Prevención total contra ataques XSS y CSRF'
      },
      {
        num: 7,
        title: 'Sesión Zero-Trust Iniciada',
        desc: 'El usuario ingresa al sistema y se inicializa la telemetría segura de la sesión.',
        module: 'Dashboard.jsx',
        security: 'Auditoría de inicio de sesión en audit_logs'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph A1 [" 1. Acceso a Plataforma "]
        UA(["1. Solicitud de Login<br/>App / Admin"]):::startEnd --> UB{"2. ¿Método de<br/>Autenticación?"}:::decision
    end

    subgraph A2 [" 2a. Hardware Passkey "]
        UB -- "Passkey" --> UC["3. Challenge<br/>Criptográfico"]:::process
        UC --> UD["4. Biometría de<br/>Hardware"]:::process
        UD --> UE{"¿Firma<br/>Válida?"}:::decision
        UE -- "No" --> UF(["Error:<br/>Autenticación Denegada"]):::error
    end

    subgraph A3 [" 2b. Contraseña / PIN "]
        UB -- "PIN / Clave" --> UH{"¿pinAttemptsPool<br/>Permitido?"}:::decision
        UH -- "Excedido" --> UI(["Error 429:<br/>Intentos Excedidos"]):::error
        UH -- "Permitido" --> UJ["Hash Argon2<br/>+ Pepper"]:::process
        UJ --> UK{"¿Credenciales<br/>Válidas?"}:::decision
        UK -- "No" --> UF
    end

    subgraph A4 [" 3. Sesión Segura "]
        UE -- "Sí" --> UG["5. Validar en<br/>webauthnService"]:::process
        UK -- "Sí" --> UG
        UG --> UN["6. Generar JWT Seguro<br/>+ Refresh HttpOnly"]:::process
        UN --> UO(["7. Sesión Zero-Trust<br/>Iniciada"]):::success
    end
`
  },
  'sec-recovery': {
    title: 'Recuperabilidad Social de Cuentas',
    category: 'Seguridad & Identidad',
    icon: '🔑',
    desc: 'Permite a los usuarios restaurar el acceso a su billetera de autocustodia mediante un quórum distribuido de tutores autorizados y una ventana de seguridad TimeLock.',
    modules: 'personalRecovery.js, recoverableAccounts.js',
    rule: 'Quórum M-de-N de Tutores con TimeLock de Seguridad',
    audit: 'Cancelación inmediata ante intento no autorizado',
    steps: [
      {
        num: 1,
        title: 'Solicitud de Recuperación de Cuenta',
        desc: 'El usuario que perdió el acceso a su clave privada inicia el proceso indicando su identificador.',
        module: 'recoverableAccountRoutes.js',
        security: 'Comprobación de estado activo y no-suspendido'
      },
      {
        num: 2,
        title: 'Ingreso de Nueva Dirección de Billetera',
        desc: 'Se especifica la nueva dirección Web3 que asumirá el control tras la verificación.',
        module: 'recoverableAccounts.js',
        security: 'Sanitización de dirección checksum EVM'
      },
      {
        num: 3,
        title: 'Notificación Criptográfica a Guardianes',
        desc: 'Se envía un aviso encriptado a los tutores configurados previamente por el usuario.',
        module: 'personalRecovery.js',
        security: 'Comunicaciones blindadas sin intermediarios'
      },
      {
        num: 4,
        title: 'Firmas Criptográficas de los Guardianes',
        desc: 'Cada tutor autoriza la recuperación firmando el paquete con su propia clave privada.',
        module: 'SafeAccountPolicy.sol',
        security: 'Firmas ECDSA verificadas on-chain'
      },
      {
        num: 5,
        title: 'Comprobación de Quórum M-de-N',
        desc: 'Se evalúa si se alcanzó la cantidad mínima de firmas configurada (por ejemplo, 3 de 5).',
        module: 'safeAccountPolicy.js',
        security: 'Quórum descentralizado sin punto único de falla'
      },
      {
        num: 6,
        title: 'Ventana de Espera TimeLock (48 horas)',
        desc: 'Se activa un período de seguridad donde el propietario legítimo puede vetar la recuperación si fue víctima de coacción.',
        module: 'recoveryEmergency.js',
        security: 'Ventana de rescate de 48 horas inmutable'
      },
      {
        num: 7,
        title: 'Verificación de Ausencia de Cancelación',
        desc: 'Si no hubo oposición del titular durante el TimeLock, se procede con la migración.',
        module: 'recoverableAccounts.js',
        security: 'Chequeo defensivo anti-usurpación'
      },
      {
        num: 8,
        title: 'Traspaso de Control a la Nueva Billetera',
        desc: 'Se actualizan las credenciales y el contrato Safe asigna los derechos a la nueva clave.',
        module: 'SafeContract.sol',
        security: 'Rotación segura de llaves en blockchain'
      },
      {
        num: 9,
        title: 'Cuenta Restaurada con Éxito',
        desc: 'El usuario recupera el control íntegro de sus fondos y compromisos sin perder saldos.',
        module: 'audit_logs',
        security: 'Cierre auditable en base de datos'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph R1 [" 1. Convocatoria de Tutores "]
        RA(["1. Solicitud de<br/>Recuperación"]):::startEnd --> RB["2. Ingresar Identificador<br/>y Nueva Dirección"]:::process
        RB --> RC["3. Notificar a Tutores<br/>Autorizados"]:::process
        RC --> RD["4. Firma Criptográfica<br/>de Guardianes"]:::process
        RD --> RE{"5. ¿Quórum M-de-N<br/>Alcanzado?"}:::decision
        RE -- "No" --> RF(["En Espera de<br/>Confirmación"]):::error
    end

    subgraph R2 [" 2. Salvaguarda TimeLock "]
        RE -- "Sí" --> RG["6. Iniciar TimeLock<br/>(Ventana 48h)"]:::process
        RG --> RH{"7. ¿Sin Cancelación<br/>del Propietario?"}:::decision
        RH -- "Cancelado" --> RI(["Recuperación<br/>Abortada"]):::error
    end

    subgraph R3 [" 3. Migración Definitiva "]
        RH -- "Exitoso" --> RJ["8. Traspaso de Control<br/>a Nueva Billetera"]:::process
        RJ --> RK(["9. Cuenta Restaurada<br/>con Éxito"]):::success
    end
`
  },
  'sec-p2p-create': {
    title: 'Publicación P2P con Retención en Escrow',
    category: 'Marketplace & Engine FIFO',
    icon: '📝',
    desc: 'Creación de ofertas de compra o venta en el marketplace. En ventas de tokens BLUE, se retiene inmediatamente la estaca en custodia segura (Escrow) para blindar al comprador.',
    modules: 'publicationController.js, publicationService.js',
    rule: 'Estaca de Garantía Previa Obligatoria en Venta',
    audit: 'Bloqueo de fondos en Escrow verificable on-chain/DB',
    steps: [
      {
        num: 1,
        title: 'Creación de Publicación P2P',
        desc: 'El comerciante define la cantidad, el precio por token y los métodos bancarios aceptados.',
        module: 'publish.js / PublicationTypeModal.jsx',
        security: 'Sanitización de precios y límites mínimos'
      },
      {
        num: 2,
        title: 'Configuración de Parámetros y Moneda FIAT',
        desc: 'Se establecen los términos de liquidación y los tiempos máximos de respuesta para el pago.',
        module: 'publicationController.js',
        security: 'Control de monedas bancarias admitidas'
      },
      {
        num: 3,
        title: 'Detección de Tipo de Oferta',
        desc: 'El sistema valida si se trata de una venta de tokens BLUE o una solicitud de compra de liquidez.',
        module: 'publicationService.js',
        security: 'Enrutamiento según perfil de riesgo'
      },
      {
        num: 4,
        title: 'Retención Inmediata en Custodia Escrow',
        desc: 'En ventas de BLUE, la plataforma bloquea de forma preventiva los tokens ofrecidos para evitar ventas en corto.',
        module: 'EscrowVault.sol / marketplacePayments.js',
        security: 'Bloqueo 100% colateralizado de la orden'
      },
      {
        num: 5,
        title: 'Comprobación de Solvencia de Fondos',
        desc: 'Se verifica que el balance líquido cubra el total más las comisiones de intermediación.',
        module: 'walletService.js: getLiquidBalance()',
        security: 'Protección contra doble gasto'
      },
      {
        num: 6,
        title: 'Registro de Oferta como ACTIVA',
        desc: 'La oferta es validada y cambia a estatus activo en la base de datos de publicaciones.',
        module: 'publicationController.js: createPublication()',
        security: 'Transacción ACID en PostgreSQL'
      },
      {
        num: 7,
        title: 'Incorporación al Libro de Órdenes FIFO',
        desc: 'Se inserta con timestamp de alta precisión en la cola pública First-In-First-Out.',
        module: 'FifoExchange.sol / fifoExchangeService.js',
        security: 'Ordenamiento cronológico determinista'
      },
      {
        num: 8,
        title: 'Oferta Visible en el Marketplace',
        desc: 'Aparece disponible en el feed de los demás usuarios con insignias de reputación y garantía.',
        module: 'PublicationsFeed.jsx',
        security: 'Difusión reactiva en tiempo real'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph P1 [" 1. Configuración de Oferta "]
        PA(["1. Crear Publicación<br/>P2P"]):::startEnd --> PB["2. Ingresar Monto, Tasa<br/>y Moneda FIAT"]:::process
        PB --> PC{"3. ¿Es Oferta de<br/>Venta de BLUE?"}:::decision
    end

    subgraph P2 [" 2. Verificación y Custodia "]
        PC -- "Venta" --> PD["4. Retención en<br/>Escrow de Seguridad"]:::process
        PD --> PF{"5. ¿Fondos Suficientes<br/>para Garantía?"}:::decision
        PF -- "No" --> PG(["Error:<br/>Balance Insuficiente"]):::error
        PC -- "Compra" --> PE["Verificar Scoring<br/>y Reputación"]:::process
    end

    subgraph P3 [" 3. Visibilidad en Mercado "]
        PF -- "Sí" --> PH["6. Registrar Oferta<br/>como ACTIVA"]:::process
        PE --> PH
        PH --> PI["7. Incorporar al Libro<br/>de Órdenes FIFO"]:::process
        PI --> PJ(["8. Oferta Visible<br/>en el Mercado"]):::success
    end
`
  },
  'sec-p2p-match': {
    title: 'Algoritmo de Matching FIFO (First-In-First-Out)',
    category: 'Marketplace & Engine FIFO',
    icon: '⚡',
    desc: 'Coincidencia determinista por tiempo y precio. Las órdenes más antiguas se ejecutan primero de forma estricta. El pago se liquida en 2 fases con verificación bilateral.',
    modules: 'FifoExchange.sol, p2pController.js',
    rule: 'Prioridad Cronológica Determinista FIFO',
    audit: 'Liberación de Escrow solo tras confirmación bilateral',
    steps: [
      {
        num: 1,
        title: 'Selección de Orden en el Orderbook',
        desc: 'El tomador de la orden elige el monto a intercambiar dentro del libro de órdenes.',
        module: 'Exchange.jsx / contractInteraction.js',
        security: 'Comprobación de disponibilidad en vivo'
      },
      {
        num: 2,
        title: 'Evaluación de Prioridad FIFO',
        desc: 'El motor asigna la ejecución a la orden más antigua al mejor precio según la cola temporal.',
        module: 'FifoExchange.sol: matchOrder()',
        security: 'Transparencia de precios sin front-running'
      },
      {
        num: 3,
        title: 'Bloqueo de Fracción en Custodia Escrow',
        desc: 'Los tokens seleccionados quedan asignados a la orden en curso y se activa el cronómetro de pago.',
        module: 'EscrowVault.sol',
        security: 'Temporizador estricto de liquidación'
      },
      {
        num: 4,
        title: 'Transferencia Bancaria FIAT Externa',
        desc: 'El comprador efectúa la transferencia bancaria tradicional directamente a la cuenta del vendedor.',
        module: 'Banca Tradicional (Fuera de Cadena)',
        security: 'Cero intermediación de fondos bancarios'
      },
      {
        num: 5,
        title: 'Marcado de Pago y Comprobante',
        desc: 'El comprador notifica que completó la transferencia y adjunta la referencia de la operación.',
        module: 'p2pController.js: markPaid()',
        security: 'Sellado de tiempo UTC inmutable'
      },
      {
        num: 6,
        title: 'Confirmación Bilateral del Vendedor',
        desc: 'El vendedor valida la acreditación efectiva en su extracto bancario y confirma la recepción.',
        module: 'p2pController.js: confirmPayment()',
        security: 'Requisito de confirmación explícita del receptor'
      },
      {
        num: 7,
        title: 'Liberación de Tokens BLUE de Escrow',
        desc: 'El contrato inteligente transfiere los tokens BLUE retenidos directamente a la billetera del comprador.',
        module: 'FifoExchange.sol / CoreProtocol.sol',
        security: 'Liberación criptográfica atómica'
      },
      {
        num: 8,
        title: 'Liquidación de Comisión y Reputación',
        desc: 'Se acredita la comisión del protocolo y se incrementan las puntuaciones de mérito de los participantes.',
        module: 'reputationService.js',
        security: 'Actualización de scoring de confiabilidad'
      },
      {
        num: 9,
        title: 'Liquidación P2P Completada',
        desc: 'Ambas partes reciben la confirmación final y la orden se archiva como completada.',
        module: 'audit_logs',
        security: 'Cierre auditable SOC 2'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;

    subgraph M1 [" 1. Emparejamiento FIFO "]
        MA(["1. Selección en el<br/>Orderbook"]):::startEnd --> MB["2. Algoritmo Evalúa<br/>Prioridad FIFO"]:::process
        MB --> MC["3. Bloquear Fracción<br/>en Custodia Escrow"]:::process
    end

    subgraph M2 [" 2. Transferencia Externa "]
        MC --> MD["4. Transferencia Bancaria<br/>FIAT Externa"]:::process
        MD --> ME["5. Comprador Marca Pagado<br/>+ Adjunta Comprobante"]:::process
        ME --> MF{"6. ¿Vendedor Confirma<br/>Recepción Bancaria?"}:::decision
    end

    subgraph M3 [" 3. Cierre y Liquidación "]
        MF -- "Confirmado" --> MG["7. Liberar BLUE de<br/>Escrow a Comprador"]:::process
        MG --> MH["8. Liquidar Comisión<br/>y Subir Reputación"]:::process
        MH --> MI(["9. Liquidación P2P<br/>Completada"]):::success
    end
`
  },
  'sec-p2p-dispute': {
    title: 'Arbitraje y Resolución de Disputas P2P',
    category: 'Marketplace & Engine FIFO',
    icon: '⚖️',
    desc: 'Protección antifraude con mediación arbitral ante discrepancias en transferencias bancarias o vencimiento del temporizador de pago.',
    modules: 'p2pController.js, adminController.js',
    rule: 'Resolución Arbitral Auditable con Comprobantes Bancarios',
    audit: 'Historial de auditoría completo y penalización de reputación',
    steps: [
      {
        num: 1,
        title: 'Apertura de Disputa en Orden P2P',
        desc: 'Una de las partes solicita arbitraje oficial por retraso de fondos, comprobante falso o falta de respuesta.',
        module: 'disputeService.js: openDispute()',
        security: 'Bloqueo automático de cancelaciones unilaterales'
      },
      {
        num: 2,
        title: 'Congelamiento Cautelar en Escrow',
        desc: 'Los tokens permanecen en la bóveda de custodia y se prohíbe cualquier retiro hasta el veredicto.',
        module: 'EscrowVault.sol',
        security: 'Medida cautelar criptográfica inmutable'
      },
      {
        num: 3,
        title: 'Asignación de Árbitro de Cumplimiento',
        desc: 'Un operador de soporte certificado asume el expediente con rol de mediación imparcial.',
        module: 'adminPanel.js / disputeController.js',
        security: 'Registro de operador en logs de cumplimiento'
      },
      {
        num: 4,
        title: 'Cotejo de Extractos Bancarios Oficiales',
        desc: 'Las partes aportan comprobantes en PDF con número de referencia bancaria y sellos de origen.',
        module: 'disputeEvidenceStore.js',
        security: 'Verificación forense de comprobantes bancarios'
      },
      {
        num: 5,
        title: 'Evaluación de Prueba de Fondos',
        desc: 'El árbitro comprueba si el dinero ingresó efectivamente a la cuenta bancaria del vendedor.',
        module: 'adminAuditService.js',
        security: 'Criterio bancario estricto de recepción'
      },
      {
        num: 6,
        title: 'Sentencia Arbitral y Liberación de Custodia',
        desc: 'Si el pago fue acreditado, se liberan los tokens al comprador. Si fue falso, se restituyen al vendedor y se suspende al infractor.',
        module: 'p2pController.js: resolveDispute()',
        security: 'Resolución final con penalización de scoring'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph D1 [" 1. Bloqueo & Asignación "]
        DA(["1. Apertura de Disputa<br/>en Orden P2P"]):::startEnd --> DB["2. Congelar Tokens<br/>en Escrow"]:::process
        DB --> DC["3. Asignar Árbitro<br/>de Administración"]:::process
    end

    subgraph D2 [" 2. Verificación de Extractos "]
        DC --> DD["4. Cotejar Extractos<br/>Bancarios Oficiales"]:::process
        DD --> DE{"5. ¿Pago FIAT Válido<br/>y Acreditado?"}:::decision
    end

    subgraph D3 [" 3. Sentencia Arbitral "]
        DE -- "Acreditado" --> DF["6. Árbitro Libera BLUE<br/>al Comprador"]:::process
        DF --> DG(["Resolución a Favor<br/>del Comprador"]):::success
        DE -- "No Acreditado" --> DH["6. Árbitro Devuelve<br/>Escrow al Vendedor"]:::process
        DH --> DI["Sancionar Cuenta del<br/>Comprador Infractor"]:::process
        DI --> DJ(["Resolución a Favor<br/>del Vendedor"]):::error
    end
`
  },
  'sec-gov': {
    title: 'Gobernanza Comunitaria & Votación',
    category: 'Gobernanza & Impacto',
    icon: '🏛️',
    desc: 'Participación directa con poder de voto derivado del saldo de tokens BLUE. Al emitir un voto, los tokens se congelan temporalmente en parking para prevenir doble voto.',
    modules: 'governanceController.js, governanceService.js',
    rule: 'Poder de Voto 1:1 con BLUE en Parking',
    audit: 'Hash criptográfico inmutable por cada voto emitido',
    steps: [
      {
        num: 1,
        title: 'Emisión de Voto en Causa Comunitaria',
        desc: 'El miembro de la comunidad elige la propuesta activa y emite su sufragio.',
        module: 'GovernancePanel.jsx / governance-panel.js',
        security: 'Firma de voto con clave de usuario'
      },
      {
        num: 2,
        title: 'Comprobación de Balance Disponible de BLUE',
        desc: 'El sistema valida que el votante posea saldo suficiente sin gravar compromisos.',
        module: 'governanceService.js: getVotingPower()',
        security: 'Cálculo de poder de voto no comprometido'
      },
      {
        num: 3,
        title: 'Congelamiento Temporal en Parking de Votación',
        desc: 'Los tokens quedan en parking durante la ventana electoral para impedir transferencias dobles.',
        module: 'BlueToken.sol: lockForVoting()',
        security: 'Prevención de ataques de doble voto'
      },
      {
        num: 4,
        title: 'Generación de Hash Criptográfico del Voto',
        desc: 'Se genera un hash de voto que vincula la papeleta, la dirección y el bloque para certificar autenticidad.',
        module: 'governanceController.js',
        security: 'Registro de voto a prueba de manipulaciones'
      },
      {
        num: 5,
        title: 'Monitoreo de Período de Escrutinio',
        desc: 'Se computan los votos hasta la fecha y hora límite establecida en la propuesta.',
        module: 'governanceService.js: tallyVotes()',
        security: 'Cierre automático programado por bloque'
      },
      {
        num: 6,
        title: 'Evaluación de Quórum y Mayoría Calificada',
        desc: 'Se verifica que la propuesta cumpla con los umbrales mínimos comunitarios para su aprobación.',
        module: 'GovernanceRules.sol',
        security: 'Reglas de mayoría inmutables en código'
      },
      {
        num: 7,
        title: 'Descongelamiento de Tokens de Parking',
        desc: 'Finalizado el proceso, los tokens BLUE vuelven íntegramente al saldo líquido de los votantes.',
        module: 'BlueToken.sol: unlockFromVoting()',
        security: 'Liberación simétrica y garantizada'
      },
      {
        num: 8,
        title: 'Votación Finalizada y Auditada',
        desc: 'La resolución se asienta formalmente en el histórico de gobernanza.',
        module: 'audit_logs',
        security: 'Transparencia democrática total'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;

    subgraph G1 [" 1. Emisión de Voto "]
        GA(["1. Emitir Voto en<br/>Propuesta Común"]):::startEnd --> GB["2. Comprobar Balance<br/>Disponible de BLUE"]:::process
        GB --> GC["3. Congelar Poder en<br/>Parking de Votación"]:::process
        GC --> GD["4. Hash Criptográfico<br/>de Voto en Base Datos"]:::process
    end

    subgraph G2 [" 2. Escrutinio "]
        GD --> GE{"5. ¿Finalizó Período<br/>de Escrutinio?"}:::decision
        GE -- "En Curso" --> GF["Recepción Continua<br/>de Votos"]:::process
        GE -- "Finalizado" --> GG{"6. ¿Aprobada por<br/>Quórum y Mayoría?"}:::decision
    end

    subgraph G3 [" 3. Conclusión "]
        GG -- "Aprobada" --> GH["Ejecutar Acción /<br/>Financiar Proyecto"]:::process
        GG -- "Rechazada" --> GI["Archivar Decisión<br/>Desestimada"]:::process
        GH --> GJ["7. Descongelar Tokens<br/>del Parking"]:::process
        GI --> GJ
        GJ --> GK(["8. Votación Finalizada<br/>y Auditada"]):::success
    end
`
  },
  'sec-humanitarian': {
    title: 'Causas Solidarias SOS Venezuela',
    category: 'Gobernanza & Impacto',
    icon: '🇻🇪',
    desc: 'Canalización directa de donaciones y proyectos de impacto social comunitario con emisión de comprobantes y certificados auditables.',
    modules: 'humanitarianController.js, humanitarianService.js',
    rule: 'Trazabilidad 100% de Fondos y Certificados de Donación',
    audit: 'Certificado criptográfico de donación generado al instante',
    steps: [
      {
        num: 1,
        title: 'Causa Humanitaria SOS Venezuela',
        desc: 'Identificación y registro formal de una emergencia o proyecto humanitario en territorio venezolano.',
        module: 'sos-venezuela.html / causa-solidaria.html',
        security: 'Auditoría previa del caso y beneficiario'
      },
      {
        num: 2,
        title: 'Validación y Registro de Proyecto Social',
        desc: 'El comité de auditoría verifica la legitimidad de la causa y activa el canal de recaudación.',
        module: 'humanitarianController.js',
        security: 'Comprobación de identidad y necesidad comprobable'
      },
      {
        num: 3,
        title: 'Donación Directa en Tokens BLUE',
        desc: 'Los donantes aportan tokens BLUE desde su saldo de recompensas o liquidez ganada.',
        module: 'humanitarianService.js: donate()',
        security: 'Aportes transparentes sin comisiones ocultas'
      },
      {
        num: 4,
        title: 'Registro en Libro Contable de Donaciones',
        desc: 'Se asienta cada aporte en la tabla auditada de donaciones solidarias.',
        module: 'humanitarian_donations (PostgreSQL)',
        security: 'Trazabilidad pública de cada céntimo'
      },
      {
        num: 5,
        title: 'Emisión de Certificado de Impacto Social',
        desc: 'Se genera un diploma criptográfico descargable en PDF con código QR de verificación.',
        module: 'certificateGenerator.js',
        security: 'Sello criptográfico de autenticidad'
      },
      {
        num: 6,
        title: 'Canalización de Insumos al Beneficiario',
        desc: 'La Tesorería y los colaboradores en terreno entregan víveres, medicinas o asistencia.',
        module: 'ProtocolTreasury.sol',
        security: 'Rendición de cuentas con evidencias fotográficas'
      },
      {
        num: 7,
        title: 'Donación Auditada y Certificada',
        desc: 'El proyecto alcanza su meta y queda archivado en el histórico permanente de solidaridad.',
        module: 'audit_logs',
        security: 'Auditoría social abierta a la comunidad'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;

    subgraph H1 [" 1. Causa & Verificación "]
        HA(["1. Causa Humanitaria<br/>SOS Venezuela"]):::startEnd --> HB["2. Validación y Registro<br/>de Proyecto Social"]:::process
    end

    subgraph H2 [" 2. Donación Directa "]
        HB --> HC["3. Donante Transfiere<br/>Aportes en BLUE"]:::process
        HC --> HD["4. Registro en Libro<br/>Contable de Donaciones"]:::process
    end

    subgraph H3 [" 3. Impacto & Certificado "]
        HD --> HE["5. Generar Certificado<br/>de Impacto Social"]:::process
        HE --> HF["6. Tesorería Canaliza<br/>Insumos Directos"]:::process
        HF --> HG(["7. Donación Auditada<br/>y Certificada"]):::success
    end
`
  },
  'sec-scoring': {
    title: 'Credit Scoring & Halving de Compromiso RED',
    category: 'Crédito & Web3 Engine',
    icon: '📊',
    desc: 'Evaluación crediticia dinámica con trinquete (*High-Water Mark*). El trinquete protege límites adquiridos por mérito, pero ante mora protocolar aplica halving inmediato (50% de recorte acumulativo).',
    modules: 'creditScoringService.js, creditPolicyJobs.js',
    rule: 'Halving 50% por Mora RED con Trinquete Desacoplado',
    audit: 'Verificación on-chain de mora con isDelinquent()',
    steps: [
      {
        num: 1,
        title: 'Evaluación Periódica de Scoring Crediticio',
        desc: 'El motor analiza el historial transaccional y cumplimiento del usuario.',
        module: 'creditScoringService.js: computeEffectiveCreditLimit()',
        security: 'Algoritmo determinista sin sesgo discrecional'
      },
      {
        num: 2,
        title: 'Cómputo de Méritos y Cumplimiento',
        desc: 'Se evalúa volumen comercializado, antigüedad y cumplimiento de amortizaciones.',
        module: 'creditScoringService.js',
        security: 'Mérito basado en actividad económica verificable'
      },
      {
        num: 3,
        title: 'Verificación On-Chain de Mora Protocolar RED',
        desc: 'Se consulta el contrato CoreProtocol.sol: isDelinquent(walletAddress) y el cabezal de lotes activos.',
        module: 'CoreProtocol.sol: isDelinquent()',
        security: 'Detección automática de incumplimiento a 30 días'
      },
      {
        num: 4,
        title: 'Sin Mora: Protección por Trinquete (High-Water Mark)',
        desc: 'Si no hay mora, el trinquete impide que recortes administrativos bajen el límite alcanzado por mérito.',
        module: 'creditScoringService.js (Ratchet)',
        security: 'Garantía de protección de límite adquirido'
      },
      {
        num: 5,
        title: 'Con Mora: Halving 50% y Desacople del Trinquete',
        desc: 'Ante mora protocolar, el trinquete se desactiva y el límite sufre un halving inmediato del 50%.',
        module: 'creditScoringService.js (Halving)',
        security: 'Penalización de riesgo crediticio estricta'
      },
      {
        num: 6,
        title: 'Sincronización On-Chain en CoreProtocol',
        desc: 'El nuevo límite crediticio resultante se escribe en blockchain mediante syncCreditLimitOnChain().',
        module: 'CoreProtocol.sol: setCreditLimit()',
        security: 'Actualización atómica en Optimism Sepolia'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph S1 [" 1. Evaluación de Comportamiento "]
        SA(["1. Evaluar Scoring<br/>Crediticio"]):::startEnd --> SB["2. Computar Méritos<br/>y Cumplimiento"]:::process
        SB --> SC{"3. ¿Usuario en Mora<br/>Protocolar RED?"}:::decision
    end

    subgraph S2 [" 2a. Sin Mora: Trinquete "]
        SC -- "No" --> SD["4. Calcular Límite<br/>Base Adquirido"]:::process
        SD --> SE["5. Trinquete Protege<br/>Límite Adquirido"]:::process
        SE --> SF(["Límite Preservado<br/>o Incrementado"]):::success
    end

    subgraph S3 [" 2b. Con Mora: Halving 50% "]
        SC -- "Sí" --> SG["4. Halving 50% Estricto<br/>por Incumplimiento"]:::process
        SG --> SH["5. Trinquete Desacoplado<br/>por Riesgo de Mora"]:::process
        SH --> SI["6. Sincronizar Límite<br/>Recortado On-Chain"]:::process
        SI --> SJ(["Límite Reducido<br/>por Penalización"]):::error
    end
`
  },
  'sec-gas': {
    title: 'Subsidio de Gas & Durable Relayer Web3',
    category: 'Crédito & Web3 Engine',
    icon: '⛽',
    desc: 'Permite transaccionar en la Blockchain sin fricción de gas nativo mediante Meta-Transacciones EIP-712 procesadas por un relayer seguro con cuotas presupuestarias.',
    modules: 'demoGasPolicy.js, durableRelayer.js, safeExecution.js',
    rule: 'Meta-Transacciones EIP-712 con Cuotas de Presupuesto',
    audit: 'Límite de gas por usuario controlado en gasBudgetUsage',
    steps: [
      {
        num: 1,
        title: 'Solicitud de Operación en Red Web3',
        desc: 'El usuario desea ejecutar una transacción on-chain (ej. depósito o compensación) sin poseer ETH para gas.',
        module: 'Wallet.jsx / web3BridgeService.js',
        security: 'UX sin fricción para adopción masiva'
      },
      {
        num: 2,
        title: 'Consulta de Cupo de Gas en gasBudgetUsage',
        desc: 'El backend evalúa si la billetera tiene cuota de transacciones patrocinadas disponible en el día.',
        module: 'gasBudgetUsage.js',
        security: 'Control de presupuesto anti-spam'
      },
      {
        num: 3,
        title: 'Verificación de Subsidio de Gas Activo',
        desc: 'Si la cuota es positiva, se aprueba el patrocinio. Si expiró, el usuario debe proveer su propio gas.',
        module: 'demoGasPolicy.js',
        security: 'Políticas configurables por gobernanza'
      },
      {
        num: 4,
        title: 'Firma de Meta-Transacción EIP-712',
        desc: 'El cliente firma un mensaje estructurado typed-data con su clave privada sin emitir una transacción directa.',
        module: 'chainSigning.js / EIP-712',
        security: 'Criptografía de firma off-chain segura'
      },
      {
        num: 5,
        title: 'Durable Relayer Paga el Gas en Optimism',
        desc: 'El servicio de servidor asume el coste en ETH y remite la transacción a la mempool de Optimism Sepolia.',
        module: 'durableRelayer.js',
        security: 'Clave de servidor aislada (GAS_SPONSOR_KEY)'
      },
      {
        num: 6,
        title: 'Minado y Confirmación en Blockchain',
        desc: 'Los validadores de la red minan el bloque y el contrato ejecuta la operación en nombre del usuario.',
        module: 'Optimism Sepolia L2',
        security: 'Finalidad criptográfica L2'
      },
      {
        num: 7,
        title: 'Registro de Consumo en Base de Datos',
        desc: 'Se incrementa el contador de gas utilizado en la tabla de consumo y se guarda el hash en chain_operations.',
        module: 'chainOperationStore.js',
        security: 'Trazabilidad de costes de infraestructura'
      },
      {
        num: 8,
        title: 'Operación Confirmada sin Fricción',
        desc: 'El usuario recibe la confirmación con cero coste de comisión nativa.',
        module: 'OperationAuthorization.jsx',
        security: 'Experiencia Web3 de nivel bancario'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph G1 [" 1. Chequeo de Presupuesto "]
        GA(["1. Solicitud de Operación<br/>en Red Web3"]):::startEnd --> GB["2. Consultar Cupo de Gas<br/>en gasBudgetUsage"]:::process
        GB --> GC{"3. ¿Tiene Subsidio<br/>de Gas Activo?"}:::decision
        GC -- "No" --> GD(["Usuario Paga Gas<br/>Directamente"]):::error
    end

    subgraph G2 [" 2. Meta-Transacción EIP-712 "]
        GC -- "Sí" --> GE["4. Usuario Firma Meta-<br/>Transacción EIP-712"]:::process
        GE --> GF["5. Durable Relayer Paga<br/>el Gas de la Red"]:::process
    end

    subgraph G3 [" 3. Liquidación On-Chain "]
        GF --> GG["6. Envío y Minado en<br/>Optimism Sepolia"]:::process
        GG --> GH["7. Registrar Consumo en<br/>Base de Datos"]:::process
        GH --> GI(["8. Operación Confirmada<br/>sin Fricción"]):::success
    end
`
  },
  'sec-audit': {
    title: 'Pipeline de Auditoría Bancaria & Trazabilidad SOC 2',
    category: 'Auditoría & Cumplimiento',
    icon: '📜',
    desc: 'Trazabilidad de cada evento sensible con emisión de logs inmutables en PostgreSQL y worker de reconciliación periódica entre balances SQL y saldos on-chain.',
    modules: 'auditService.js, reconciliationService.js',
    rule: 'Estándar Bancario SOC 2 de Inmutabilidad',
    audit: 'Reconciliación periódica con alerta automática de desvío',
    steps: [
      {
        num: 1,
        title: 'Evento Sensible en la Plataforma',
        desc: 'Se produce una transferencia, liquidación, cambio de límites o acceso administrativo.',
        module: 'Todos los controladores de backend',
        security: 'Intercepción universal obligatoria'
      },
      {
        num: 2,
        title: 'Invocación Centralizada de auditService',
        desc: 'El controlador invoca auditService.logEvent() con los parámetros completos y contexto de seguridad.',
        module: 'auditService.js',
        security: 'Cero eventos financieros no auditados'
      },
      {
        num: 3,
        title: 'Inserción Inmutable en audit_logs SQL',
        desc: 'Se inserta una fila con timestamp UTC, dirección IP, hash de payload y usuario.',
        module: 'audit_logs (PostgreSQL)',
        security: 'Permisos de base de datos APPEND-ONLY'
      },
      {
        num: 4,
        title: 'Despacho a Bus de Notificaciones',
        desc: 'Se emite el evento al bus central para alimentar alertas administrativas y telemetría.',
        module: 'notificationEventBus.js',
        security: 'Monitoreo en vivo de actividad'
      },
      {
        num: 5,
        title: 'Notificación WebSocket en la UI React',
        desc: 'La interfaz del usuario se refresca inmediatamente mostrando el estado de la operación.',
        module: 'DashboardHeader.jsx',
        security: 'Actualización en tiempo real sin polling ciego'
      },
      {
        num: 6,
        title: 'Worker Reconcilia Saldos BD vs On-Chain',
        desc: 'Un proceso en segundo plano suma todos los saldos de base de datos y los contrasta con totalSupply() de los Smart Contracts.',
        module: 'reconciliationService.js',
        security: 'Detección automática de inconsistencias'
      },
      {
        num: 7,
        title: 'Comprobación de Invariantes 100%',
        desc: 'Se evalúa que la diferencia sea cero. Si se detecta un desvío, se emite una alerta crítica para intervención inmediata.',
        module: 'reconciliationService.js',
        security: 'Certificación contable bancaria continua'
      },
      {
        num: 8,
        title: 'Auditoría Aprobada: Estado Saludable',
        desc: 'El sistema certifica la integridad del 100% de los libros contables y la paridad del protocolo.',
        module: 'SOC 2 Compliance Log',
        security: 'Informe de auditoría inmutable'
      }
    ],
    mermaid: `
flowchart LR
    classDef startEnd fill:#1d4ed8,color:#ffffff,stroke:#3b82f6,stroke-width:2px;
    classDef decision fill:#6d28d9,color:#ffffff,stroke:#8b5cf6,stroke-width:2px;
    classDef process fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:1.8px;
    classDef success fill:#047857,color:#ffffff,stroke:#10b981,stroke-width:2px;
    classDef error fill:#b91c1c,color:#ffffff,stroke:#ef4444,stroke-width:2px;

    subgraph AU1 [" 1. Captura Inmutable "]
        AA(["1. Evento Sensible en<br/>la Plataforma"]):::startEnd --> AB["2. Invocación de<br/>auditService.logEvent"]:::process
        AB --> AC["3. Inserción Inmutable<br/>en audit_logs SQL"]:::process
        AB --> AD["4. Despacho a Bus de<br/>notificationEventBus"]:::process
    end

    subgraph AU2 [" 2. Notificación y Monitoreo "]
        AD --> AE["5. Notificación WebSocket<br/>en la UI React"]:::process
        AC --> AF["6. Worker Reconcilia<br/>Saldos BD vs On-Chain"]:::process
    end

    subgraph AU3 [" 3. Verificación de Integridad "]
        AF --> AG{"7. ¿Coincidencia de<br/>Invariantes 100%?"}:::decision
        AG -- "Sí" --> AH(["Auditoría Aprobada:<br/>Estado Saludable"]):::success
        AG -- "No" --> AI(["Alerta Crítica de<br/>Discrepancia"]):::error
    end
`
  }
};

export default function ArchitectureFlows() {
  const [activeKey, setActiveKey] = useState('sec-economic');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mermaidReady, setMermaidReady] = useState(false);

  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const activeProcess = PROCESS_CATALOG[activeKey] || PROCESS_CATALOG['sec-economic'];

  // Reiniciar selección de paso y vista al cambiar de diagrama
  useEffect(() => {
    setActiveStepIndex(0);
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  }, [activeKey]);

  // Manejo de Pan (arrastrar) con el ratón
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom con rueda de ratón (preservando el scroll general de página si no está sobre el diagrama)
  const handleWheel = (e) => {
    // Si presiona Ctrl o está haciendo zoom enfocado
    if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom(prev => Math.min(Math.max(prev * factor, 0.3), 3.0));
    }
  };

  // Ajuste matemático al viewport del contenedor
  const fitToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    const svg = containerRef.current?.querySelector('svg');
    if (!viewport || !svg) return;

    let svgWidth = 0;
    let svgHeight = 0;

    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
      svgWidth = svg.viewBox.baseVal.width;
      svgHeight = svg.viewBox.baseVal.height;
    } else {
      const bbox = svg.getBBox ? svg.getBBox() : { width: 900, height: 450 };
      svgWidth = bbox.width;
      svgHeight = bbox.height;
    }

    const vWidth = viewport.clientWidth - 32;
    const vHeight = viewport.clientHeight - 32;

    if (svgWidth <= 0 || svgHeight <= 0 || vWidth <= 0 || vHeight <= 0) return;

    const scaleX = vWidth / svgWidth;
    const scaleY = vHeight / svgHeight;
    const fitScale = Math.min(scaleX, scaleY);

    setZoom(Math.min(Math.max(fitScale * 0.96, 0.35), 1.6));
    setPan({ x: 0, y: 0 });
  }, []);

  // Inicializar Mermaid esperando tipografías
  useEffect(() => {
    const initMermaidEngine = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
          nodeSpacing: 40,
          rankSpacing: 50,
          padding: 14
        },
        themeVariables: {
          darkMode: true,
          background: '#0c1220',
          primaryColor: '#1e293b',
          primaryTextColor: '#ffffff',
          primaryBorderColor: '#38bdf8',
          lineColor: '#38bdf8',
          secondaryColor: '#8b5cf6',
          tertiaryColor: '#10b981',
          fontSize: '13px',
          fontFamily: 'Inter, system-ui, sans-serif'
        }
      });

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => setMermaidReady(true));
      } else {
        setMermaidReady(true);
      }
    };

    if (window.mermaid) {
      initMermaidEngine();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.onload = initMermaidEngine;
      document.head.appendChild(script);
    }

    const handleResize = () => {
      fitToViewport();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitToViewport]);

  // Función para resaltar nodo visual en el SVG
  const highlightNodeInSvg = useCallback((stepNum) => {
    if (!containerRef.current) return;
    const nodes = containerRef.current.querySelectorAll('svg .node');
    nodes.forEach(node => {
      node.classList.remove('node-active-step');
      const text = node.textContent || '';
      // Si el texto del nodo comienza con el número del paso (ej: "1.", "2.", "3.")
      if (text.trim().startsWith(`${stepNum}.`) || text.includes(`${stepNum}.`)) {
        node.classList.add('node-active-step');
      }
    });
  }, []);

  // Renderizar diagrama al cambiar de proceso o cuando Mermaid esté listo
  useEffect(() => {
    if (!mermaidReady || !containerRef.current) return;

    const data = activeProcess;
    if (!data) return;

    const el = containerRef.current;
    el.removeAttribute('data-processed');
    el.innerHTML = data.mermaid;

    window.mermaid
      .run({ nodes: [el] })
      .then(() => {
        requestAnimationFrame(() => {
          fitToViewport();

          // Conectar interactividad a los nodos de Mermaid para hover y click/touch
          const svg = el.querySelector('svg');
          if (svg) {
            const nodes = svg.querySelectorAll('.node');
            nodes.forEach((node, idx) => {
              node.style.cursor = 'pointer';
              const text = node.textContent || '';
              const match = text.match(/(\d+)/);
              const stepNum = match ? parseInt(match[1], 10) : idx + 1;

              // Hover (computadora)
              node.onmouseenter = () => {
                setActiveStepIndex(stepNum - 1);
                highlightNodeInSvg(stepNum);
              };

              // Click / Toque táctil (teléfonos móviles y tablets)
              node.onclick = (e) => {
                e.stopPropagation();
                setActiveStepIndex(stepNum - 1);
                highlightNodeInSvg(stepNum);
              };
            });
          }

          // Resaltar el primer paso por defecto
          highlightNodeInSvg(1);
        });
      })
      .catch(err => {
        console.error('Error al renderizar diagrama en React:', err);
      });
  }, [activeKey, mermaidReady, activeProcess, fitToViewport, highlightNodeInSvg]);

  // Handler para cuando el usuario toca un paso en la lista o timeline
  const handleSelectStep = (idx) => {
    setActiveStepIndex(idx);
    highlightNodeInSvg(idx + 1);
  };

  const currentStep = activeProcess.steps[activeStepIndex] || activeProcess.steps[0];

  return (
    <div className={styles.pageContainer}>
      {/* 1. Header Oficial de WintonCoin */}
      <header className={styles.headerNavbar}>
        <div className={styles.brandGroup}>
          <img
            src="/assets/icons/logo-high-res.png"
            alt="WintonCoin"
            className={styles.brandLogoImg}
            onError={(e) => {
              // Fallback seguro si la ruta de ícono es relativa a la raíz
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'assets/icons/logo-high-res.png';
            }}
          />
          <div className={styles.brandMeta}>
            <h1 className={styles.brandTitle}>
              <span className="logo-winton">Winton</span>
              <span className="logo-coin">Coin</span>
            </h1>
            <p className={styles.brandSubtitle}>Arquitectura de Protocolo & Diagramas de Procesos</p>
          </div>
        </div>

        <div className={styles.headerMetrics}>
          <div className={styles.metricBadge}>
            <span>⚖️</span>
            <span>Invariante: <strong>TotalSupply(BLUE) == TotalSupply(RED)</strong></span>
          </div>
          <div className={styles.metricBadge}>
            <span>🛡️</span>
            <span>Seguridad: <strong>SOC 2 / Zero-Trust</strong></span>
          </div>
          <Link to="/dashboard" className={styles.backBtn}>
            ← Volver al Dashboard
          </Link>
        </div>
      </header>

      {/* 2. Barra de Categorías y Selector de Procesos (Horizontal y Adaptable a Móvil) */}
      <nav className={styles.categoryNav} aria-label="Categorías de Procesos">
        <div className={styles.categoryNavScroll}>
          {PROCESS_CATEGORIES.map(cat => (
            <div key={cat.id} className={styles.categorySection}>
              <span className={styles.categoryLabel}>
                <span className={styles.categoryIcon}>{cat.icon}</span>
                <span>{cat.name}</span>
              </span>
              <div className={styles.categoryChips}>
                {cat.items.map(procKey => {
                  const proc = PROCESS_CATALOG[procKey];
                  if (!proc) return null;
                  const isActive = activeKey === procKey;
                  return (
                    <button
                      key={procKey}
                      className={`${styles.processChip} ${isActive ? styles.chipActive : ''}`}
                      onClick={() => setActiveKey(procKey)}
                    >
                      <span className={styles.chipIcon}>{proc.icon}</span>
                      <span className={styles.chipTitle}>{proc.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* 3. Contenedor Principal con Scroll Natural */}
      <main className={styles.mainContent}>
        {/* Ficha Técnica del Proceso Activo */}
        <section className={styles.processCard}>
          <div className={styles.processHeaderRow}>
            <div className={styles.processTitleGroup}>
              <span className={styles.processIconBig}>{activeProcess.icon}</span>
              <div>
                <span className={styles.processCategoryBadge}>{activeProcess.category}</span>
                <h2 className={styles.processTitleText}>{activeProcess.title}</h2>
              </div>
            </div>
          </div>

          <p className={styles.processDescription}>{activeProcess.desc}</p>

          <div className={styles.metadataGrid}>
            <div className={styles.metadataBox}>
              <span className={styles.metadataLabel}>Módulos & Smart Contracts</span>
              <span className={styles.metadataValue}>{activeProcess.modules}</span>
            </div>
            <div className={styles.metadataBox}>
              <span className={styles.metadataLabel}>Regla Económica Bancaria</span>
              <span className={styles.metadataValue}>{activeProcess.rule}</span>
            </div>
            <div className={styles.metadataBox}>
              <span className={styles.metadataLabel}>Garantía de Auditoría</span>
              <span className={styles.metadataValue}>{activeProcess.audit}</span>
            </div>
          </div>
        </section>

        {/* Lienzo del Diagrama con Controles de Zoom */}
        <section className={styles.diagramSection}>
          <div className={styles.diagramToolbar}>
            <div className={styles.toolbarPrompt}>
              <span className={styles.promptPulse}></span>
              <span>Posa el cursor sobre un nodo o tócalo en tu teléfono para ver qué ocurre en el código</span>
            </div>

            <div className={styles.zoomButtonsGroup}>
              <button
                className={styles.controlBtn}
                title="Ajustar a Pantalla (100% Visible)"
                onClick={fitToViewport}
              >
                🎯 Ajustar
              </button>
              <button
                className={styles.controlBtn}
                title="Aumentar Zoom"
                onClick={() => setZoom(prev => Math.min(prev * 1.15, 3.0))}
              >
                ＋
              </button>
              <button
                className={styles.controlBtn}
                title="Reducir Zoom"
                onClick={() => setZoom(prev => Math.max(prev * 0.85, 0.3))}
              >
                －
              </button>
              <button
                className={styles.controlBtn}
                title="Centrar Vista"
                onClick={() => {
                  setPan({ x: 0, y: 0 });
                  fitToViewport();
                }}
              >
                ↺ Centrar
              </button>
            </div>
          </div>

          {/* Área de Visualización Panorámica */}
          <div
            className={styles.viewportArea}
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              className={`${styles.mermaidCanvas} mermaid`}
              ref={containerRef}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
              }}
            >
              {!mermaidReady && (
                <div className={styles.loadingPlaceholder}>
                  Iniciando tipografía bancaria y motor gráfico vectorial...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. Inspector de Pasos Técnico (Explicación por Hover o Toque) */}
        {currentStep && (
          <section className={styles.stepInspectorCard}>
            <div className={styles.inspectorHeader}>
              <div className={styles.inspectorStepBadge}>
                Paso {currentStep.num} de {activeProcess.steps.length}
              </div>
              <h3 className={styles.inspectorStepTitle}>{currentStep.title}</h3>
            </div>

            <p className={styles.inspectorStepDesc}>{currentStep.desc}</p>

            <div className={styles.inspectorMetaRow}>
              <div className={styles.inspectorMetaItem}>
                <span className={styles.metaLabel}>Módulo / Función en Ejecución:</span>
                <code className={styles.metaCode}>{currentStep.module}</code>
              </div>
              <div className={styles.inspectorMetaItem}>
                <span className={styles.metaLabel}>Garantía de Seguridad / Auditoría:</span>
                <span className={styles.metaSecurity}>{currentStep.security}</span>
              </div>
            </div>
          </section>
        )}

        {/* 5. Desglose Secuencial Completo (Timeline Interactivo) */}
        <section className={styles.stepsTimelineSection}>
          <div className={styles.timelineHeader}>
            <h3>Secuencia Paso a Paso del Proceso</h3>
            <span className={styles.timelineHint}>
              Toca o pasa el cursor por cualquier tarjeta para seleccionarla en el diagrama
            </span>
          </div>

          <div className={styles.stepsGrid}>
            {activeProcess.steps.map((step, idx) => {
              const isCurrent = activeStepIndex === idx;
              return (
                <div
                  key={step.num}
                  className={`${styles.stepCard} ${isCurrent ? styles.stepCardActive : ''}`}
                  onMouseEnter={() => handleSelectStep(idx)}
                  onClick={() => handleSelectStep(idx)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.stepCardTop}>
                    <span className={styles.stepNumberBadge}>Paso {step.num}</span>
                    {isCurrent && <span className={styles.activePill}>Activo</span>}
                  </div>
                  <h4 className={styles.stepCardTitle}>{step.title}</h4>
                  <p className={styles.stepCardSummary}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
