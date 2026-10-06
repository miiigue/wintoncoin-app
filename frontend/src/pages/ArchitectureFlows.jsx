import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './ArchitectureFlows.module.css';

/**
 * ============================================================================
 * [WINTONCOIN] - ARCHITECTURE FLOWS (React SPA Component)
 * ============================================================================
 * Tablero de Arquitectura y Simulador de Flujos Transaccionales Dinámicos.
 * Cumple con Zero-Trust, SOC 2, paridad TotalSupply(BLUE) == TotalSupply(RED),
 * y el principio de no utilizar la palabra "deuda", sino COMPROMISO RED.
 * Orientación Panorámica Horizontal (LR) para máxima legibilidad y estética FinTech.
 * ============================================================================
 */

const PROCESS_CATALOG = {
  'sec-economic': {
    title: 'Protocolo Económico: BLUE / COMPROMISO RED',
    desc: 'Mapeo integral de financialCoreService.processPayment. Por cada transferencia, se acredita el activo BLUE con parking diferido al beneficiario y se registra el COMPROMISO RED en el pagador, verificando la invariante TotalSupply(BLUE) == TotalSupply(RED).',
    modules: 'CoreProtocol.sol, RedToken.sol, financialCoreService.js',
    rule: 'Paridad 1:1 Invariable, Masa Monetaria Neta Cero',
    audit: 'Trazabilidad Bancaria SOC 2 en tabla audit_logs',
    steps: [
      '1. Solicitud de pago o transferencia enviada por el usuario',
      '2. Smart Contract evalúa límite crediticio y balance disponible',
      '3. Cálculo de comisión de protocolo (2%) e importe neto a liquidar',
      '4. Generación de tokens BLUE con parking diferido al beneficiario',
      '5. Emisión de tokens RED al pagador: Registro de COMPROMISO RED',
      '6. Acreditación de tokens BLUE de comisión a la Tesorería',
      '7. Verificación criptográfica: TotalSupply(BLUE) == TotalSupply(RED)',
      '8. Inserción inmutable en tabla audit_logs y confirmación final'
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
    desc: 'La Tesorería NUNCA transfiere tokens BLUE directamente por fuera del protocolo. Todo incentivo opera bajo el flujo estándar idéntico al de cualquier usuario: asume el COMPROMISO RED y amortiza con comisiones acumuladas.',
    modules: 'ProtocolTreasury.sol, CoreProtocol.sol, RedToken.sol',
    rule: 'Cero transferencias P2P directas de Tesorería',
    audit: 'Amortización Contable con Comisiones Acumuladas',
    steps: [
      '1. Evento de dispersión de incentivo o recompensa comunitaria',
      '2. Tesorería invoca CoreProtocol actuando como pagador estándar',
      '3. Emisión de tokens BLUE al usuario beneficiario con parking',
      '4. Tesorería asume el COMPROMISO RED correspondiente sin privilegios',
      '5. Tesorería recibe tokens BLUE ordinarios por comisión de plataforma',
      '6. Tesorería amortiza su COMPROMISO RED con sus tokens BLUE de comisión',
      '7. Verificación de variación neta cero en la masa monetaria circulante'
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
    desc: 'Autenticación multifactorial y biométrica. Incluye generación de challenge criptográfico con WebAuthn/Passkeys, y protección estricta contra ataques de fuerza bruta mediante pinAttemptsPool.',
    modules: 'authController.js, webauthnService.js, pinAttemptsPool.js',
    rule: 'Principio de Cero Confianza (Zero-Trust) & Passkeys',
    audit: 'Bloqueo tras 5 intentos fallidos y logs inmutables',
    steps: [
      '1. Solicitud de inicio de sesión en frontend SPA',
      '2. Selección de método: Biometría Passkey o Credenciales',
      '3. Backend genera challenge criptográfico único',
      '4. Dispositivo de hardware verifica huella dactilar o rostro',
      '5. Validación de firma de clave pública en webauthnService',
      '6. Emisión de JWT de alta seguridad y Refresh Token HttpOnly'
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
    desc: 'Permite a los usuarios restaurar el acceso a su billetera de autocustodia mediante un quórum distribuido de tutores autorizados y una ventana de seguridad TimeLock.',
    modules: 'personalRecovery.js, recoverableAccounts.js',
    rule: 'Quórum M-de-N de Tutores con TimeLock de Seguridad',
    audit: 'Cancelación inmediata ante intento no autorizado',
    steps: [
      '1. Usuario reporta pérdida de credenciales y solicita recuperación',
      '2. Notificación encriptada a tutores autorizados',
      '3. Tutores aprueban y firman criptográficamente la solicitud',
      '4. Verificación de quórum de firmas alcanzado',
      '5. Activación de TimeLock de seguridad (48 horas)',
      '6. Traspaso de control seguro a la nueva dirección'
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
    desc: 'Creación de ofertas de compra o venta en el marketplace. En ventas de tokens BLUE, se retiene inmediatamente la estaca en custodia segura (Escrow) para blindar al comprador.',
    modules: 'publicationController.js, publicationService.js',
    rule: 'Estaca de Garantía Previa Obligatoria en Venta',
    audit: 'Bloqueo de fondos en Escrow verificable on-chain/DB',
    steps: [
      '1. Usuario define precio, volumen y moneda bancaria en la orden',
      '2. Verificación del tipo de operación (Venta o Compra de BLUE)',
      '3. Bloqueo preventivo de la masa de tokens BLUE en contrato de Escrow',
      '4. Comprobación de solvencia de la estaca de garantía',
      '5. Activación de la publicación en el Libro de Órdenes FIFO'
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
    desc: 'Coincidencia determinista por tiempo y precio. Las órdenes más antiguas se ejecutan primero de forma estricta. El pago se liquida en 2 fases con verificación bilateral.',
    modules: 'FifoExchange.sol, p2pController.js',
    rule: 'Prioridad Cronológica Determinista FIFO',
    audit: 'Liberación de Escrow solo tras confirmación bilateral',
    steps: [
      '1. Comprador selecciona orden disponible en el mercado',
      '2. Algoritmo confirma prioridad estricta por fecha/hora de creación',
      '3. Bloqueo transaccional de los tokens BLUE seleccionados',
      '4. Comprador transfiere fondos bancarios fuera de cadena',
      '5. Vendedor verifica acreditación bancaria y confirma recepción',
      '6. Contrato inteligente libera los tokens BLUE al comprador'
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
    desc: 'Protección antifraude con mediación arbitral ante discrepancias en transferencias bancarias o vencimiento del temporizador de pago.',
    modules: 'p2pController.js, adminController.js',
    rule: 'Resolución Arbitral Auditable con Comprobantes Bancarios',
    audit: 'Historial de auditoría completo y penalización de reputación',
    steps: [
      '1. Apertura de disputa por discrepancia de pago',
      '2. Congelamiento de tokens en escrow',
      '3. Asignación de árbitro de administración',
      '4. Evaluación de extractos bancarios oficiales',
      '5. Emisión de dictamen arbitral y resolución de custodia'
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
    title: 'Gobernanza Comunitarias & Votación',
    desc: 'Participación directa con poder de voto derivado del saldo de tokens BLUE. Al emitir un voto, los tokens se congelan temporalmente en parking para prevenir doble voto.',
    modules: 'governanceController.js, governanceService.js',
    rule: 'Poder de Voto 1:1 con BLUE en Parking',
    audit: 'Hash criptográfico inmutable por cada voto emitido',
    steps: [
      '1. Usuario emite voto en causa comunitaria activa',
      '2. Verificación de saldo de tokens BLUE del votante',
      '3. Congelamiento temporal de poder de voto en parking',
      '4. Cómputo criptográfico de quórum y mayoría calificada',
      '5. Liberación de tokens de parking al finalizar el escrutinio'
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
    desc: 'Canalización directa de donaciones y proyectos de impacto social comunitario con emisión de comprobantes y certificados auditables.',
    modules: 'humanitarianController.js, humanitarianService.js',
    rule: 'Trazabilidad 100% de Fondos y Certificados de Donación',
    audit: 'Certificado criptográfico de donación generado al instante',
    steps: [
      '1. Registro y verificación de proyecto humanitario de impacto',
      '2. Donante transfiere aportes en tokens BLUE',
      '3. Registro inmutable en libro contable de donaciones',
      '4. Generación de certificado criptográfico de impacto social',
      '5. Tesorería canaliza los insumos al beneficiario'
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
    desc: 'Evaluación crediticia dinámica con trinquete (*High-Water Mark*). El trinquete protege límites adquiridos por mérito, pero ante mora protocolar aplica halving inmediato (50% de recorte acumulativo).',
    modules: 'creditScoringService.js, creditPolicyJobs.js',
    rule: 'Halving 50% por Mora RED con Trinquete Desacoplado',
    audit: 'Verificación on-chain de mora con isDelinquent()',
    steps: [
      '1. Ejecución periódica de evaluación de riesgo crediticio',
      '2. Consulta de méritos por volumen y cumplimiento histórico',
      '3. Verificación de mora protocolar en compromisos RED',
      '4. Si no hay mora: se preserva límite adquirido mediante trinquete',
      '5. Si existe mora: se aplica halving estricto del 50% y sincroniza on-chain'
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
    desc: 'Permite transaccionar en la Blockchain sin fricción de gas nativo mediante Meta-Transacciones EIP-712 procesadas por un relayer seguro con cuotas presupuestarias.',
    modules: 'demoGasPolicy.js, durableRelayer.js, safeExecution.js',
    rule: 'Meta-Transacciones EIP-712 con Cuotas de Presupuesto',
    audit: 'Límite de gas por usuario controlado en gasBudgetUsage',
    steps: [
      '1. Solicitud de operación en la red Web3',
      '2. Comprobación de cupo de gas gratuito disponible',
      '3. Firma digital de Meta-Transacción EIP-712 en cliente',
      '4. Durable Relayer asume el coste del gas de la red',
      '5. Transmisión y confirmación en Optimism Sepolia'
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
    desc: 'Trazabilidad de cada evento sensible con emisión de logs inmutables en PostgreSQL y worker de reconciliación periódica entre balances SQL y saldos on-chain.',
    modules: 'auditService.js, reconciliationService.js',
    rule: 'Estándar Bancario SOC 2 de Inmutabilidad',
    audit: 'Reconciliación periódica con alerta automática de desvío',
    steps: [
      '1. Evento de operación crítica en la plataforma',
      '2. Invocación centralizada de auditService.logEvent',
      '3. Inserción inmutable en tabla audit_logs de base de datos',
      '4. Worker periódico de reconciliación compara saldos BD vs Contratos',
      '5. Certificación del 100% de coherencia o emisión de alerta'
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
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(900);
  const [telemetryMessage, setTelemetryMessage] = useState('');
  const [telemetryProgress, setTelemetryProgress] = useState(0);
  const [mermaidReady, setMermaidReady] = useState(false);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const simIntervalRef = useRef(null);
  const stepIndexRef = useRef(0);

  // Reiniciar pan y zoom al cambiar de diagrama
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  }, [activeKey]);

  // Handlers para arrastrar (Pan) con el mouse y zoom con rueda
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

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => Math.min(Math.max(prev * factor, 0.2), 3.0));
  };

  const fitToViewport = () => {
    const viewport = containerRef.current?.parentElement;
    const svg = containerRef.current?.querySelector('svg');
    if (!viewport || !svg) return;

    let svgWidth = 0;
    let svgHeight = 0;

    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
      svgWidth = svg.viewBox.baseVal.width;
      svgHeight = svg.viewBox.baseVal.height;
    } else {
      const bbox = svg.getBBox();
      svgWidth = bbox.width;
      svgHeight = bbox.height;
    }

    const vWidth = viewport.clientWidth - 24;
    const vHeight = viewport.clientHeight - 24;

    if (svgWidth <= 0 || svgHeight <= 0 || vWidth <= 0 || vHeight <= 0) return;

    const scaleX = vWidth / svgWidth;
    const scaleY = vHeight / svgHeight;
    const fitScale = Math.min(scaleX, scaleY);

    setZoom(Math.min(Math.max(fitScale * 0.95, 0.2), 1.8));
    setPan({ x: 0, y: 0 });
  };

  const resetTransform = () => {
    fitToViewport();
  };

  // 1. Inicialización de Mermaid esperando a que las tipografías estén listas
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
          nodeSpacing: 45,
          rankSpacing: 55,
          padding: 16
        },
        themeVariables: {
          darkMode: true,
          background: '#121b2f',
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
      // Esperar que la tipografía Inter termine de medirse en pantalla
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
  }, []);

  // 2. Renderizado reactivo del diagrama activo
  useEffect(() => {
    if (!mermaidReady || !containerRef.current) return;

    stopSimulation();

    const data = PROCESS_CATALOG[activeKey];
    if (!data) return;

    const el = containerRef.current;
    el.removeAttribute('data-processed');
    el.innerHTML = data.mermaid;

    window.mermaid
      .run({ nodes: [el] })
      .then(() => {
        requestAnimationFrame(() => {
          fitToViewport();
        });
      })
      .catch(err => {
        console.error('Error al renderizar diagrama en React:', err);
      });
  }, [activeKey, mermaidReady]);

  // 3. Malla interactiva de partículas de fondo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles = [];
    const count = 35;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.6 + 1
      });
    }

    let animationFrameId;

    const renderMesh = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderMesh);
    };

    renderMesh();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 4. Lógica de Simulación Paso a Paso
  const startSimulation = () => {
    setIsSimulating(true);
    const data = PROCESS_CATALOG[activeKey];
    const steps = data.steps || [];
    stepIndexRef.current = 0;

    const nodes = containerRef.current?.querySelectorAll('svg .node') || [];

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);

    simIntervalRef.current = setInterval(() => {
      if (stepIndexRef.current >= nodes.length || stepIndexRef.current >= steps.length) {
        stepIndexRef.current = 0;
      }

      nodes.forEach(n => n.classList.remove('node-active-step'));

      if (nodes[stepIndexRef.current]) {
        nodes[stepIndexRef.current].classList.add('node-active-step');
      }

      const pct = ((stepIndexRef.current + 1) / steps.length) * 100;
      setTelemetryProgress(pct);
      setTelemetryMessage(
        `[Paso ${stepIndexRef.current + 1}/${steps.length}]: ${steps[stepIndexRef.current] || 'Ejecutando nodo...'}`
      );

      stepIndexRef.current++;
    }, simSpeed);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    if (containerRef.current) {
      const nodes = containerRef.current.querySelectorAll('svg .node');
      nodes.forEach(n => n.classList.remove('node-active-step'));
    }
  };

  const toggleSimulation = () => {
    if (isSimulating) {
      stopSimulation();
    } else {
      startSimulation();
    }
  };

  const changeSpeed = (ms) => {
    setSimSpeed(ms);
    if (isSimulating) {
      stopSimulation();
      setTimeout(startSimulation, 50);
    }
  };

  const activeProcess = PROCESS_CATALOG[activeKey];

  return (
    <div className={styles.pageContainer}>
      <canvas ref={canvasRef} className={styles.bgCanvas} />

      {/* Top Bar Ejecutiva */}
      <header className={styles.headerNavbar}>
        <div className={styles.brandGroup}>
          <div className={styles.brandLogo}>W</div>
          <div className={styles.brandMeta}>
            <h1>WintonCoin Protocol</h1>
            <p>Simulador Dinámico de Arquitectura (React 19)</p>
          </div>
        </div>

        <div className={styles.headerMetrics}>
          <div className={`${styles.metricBadge} ${styles.activeStream}`}>
            <span className={styles.liveIndicator}></span>
            <span>Streaming React: <strong>EN VIVO</strong></span>
          </div>
          <div className={styles.metricBadge}>
            <span>⚖️</span>
            <span>Invariante: <strong>TotalSupply(BLUE) == TotalSupply(RED)</strong></span>
          </div>
          <div className={styles.metricBadge}>
            <span>🛡️</span>
            <span>Seguridad: <strong>SOC 2 / Zero-Trust</strong></span>
          </div>
          <Link to="/dashboard" className={styles.backBtn}>
            Volver al Dashboard
          </Link>
        </div>
      </header>

      {/* Main Layout */}
      <div className={styles.mainLayout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>
              <span>Core Protocol & FinTech</span>
              <span style={{ color: '#38bdf8' }}>(2)</span>
            </div>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-economic' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-economic')}
            >
              <span>💰</span>
              <span>BLUE / COMPROMISO RED</span>
            </button>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-treasury' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-treasury')}
            >
              <span>🏛️</span>
              <span>Dogfooding de Tesorería</span>
            </button>
          </div>

          <div className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>
              <span>Seguridad & Identidad</span>
              <span style={{ color: '#38bdf8' }}>(2)</span>
            </div>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-auth' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-auth')}
            >
              <span>🔐</span>
              <span>WebAuthn & Autenticación</span>
            </button>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-recovery' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-recovery')}
            >
              <span>🔑</span>
              <span>Recuperabilidad Social</span>
            </button>
          </div>

          <div className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>
              <span>Marketplace & Engine FIFO</span>
              <span style={{ color: '#38bdf8' }}>(3)</span>
            </div>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-p2p-create' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-p2p-create')}
            >
              <span>📝</span>
              <span>Publicación con Escrow</span>
            </button>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-p2p-match' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-p2p-match')}
            >
              <span>⚡</span>
              <span>Matching FIFO & Pago</span>
            </button>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-p2p-dispute' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-p2p-dispute')}
            >
              <span>⚖️</span>
              <span>Disputas y Arbitraje</span>
            </button>
          </div>

          <div className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>
              <span>Gobernanza & Impacto</span>
              <span style={{ color: '#38bdf8' }}>(2)</span>
            </div>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-gov' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-gov')}
            >
              <span>🗳️</span>
              <span>Votación con Parking BLUE</span>
            </button>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-humanitarian' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-humanitarian')}
            >
              <span>🇻🇪</span>
              <span>Proyectos SOS Venezuela</span>
            </button>
          </div>

          <div className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>
              <span>Crédito & Web3 Engine</span>
              <span style={{ color: '#38bdf8' }}>(2)</span>
            </div>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-scoring' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-scoring')}
            >
              <span>📊</span>
              <span>Credit Scoring & Mora</span>
            </button>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-gas' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-gas')}
            >
              <span>⛽</span>
              <span>Subsidio Gas & Relayer</span>
            </button>
          </div>

          <div className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>
              <span>Auditoría & Compliance</span>
              <span style={{ color: '#38bdf8' }}>(1)</span>
            </div>
            <button
              className={`${styles.sidebarItem} ${activeKey === 'sec-audit' ? styles.active : ''}`}
              onClick={() => setActiveKey('sec-audit')}
            >
              <span>📜</span>
              <span>Logs SOC 2 & Reconciliación</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className={styles.contentArea}>
          {/* Process Metadata Card */}
          <div className={styles.processCard}>
            <div className={styles.processTitleRow}>
              <h2>{activeProcess.title}</h2>
            </div>
            <p className={styles.processDesc}>{activeProcess.desc}</p>

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
          </div>

          {/* Diagram Viewport */}
          <div className={styles.diagramViewport}>
            <div className={styles.toolbar}>
              <div className={styles.simControls}>
                <button className={styles.btnSimPlay} onClick={toggleSimulation}>
                  <span>{isSimulating ? '⏸' : '▶'}</span>
                  <span>{isSimulating ? 'Pausar Simulación' : 'Reproducir Flujo en Vivo'}</span>
                </button>
                <div className={styles.speedSelector}>
                  <button
                    className={`${styles.speedBtn} ${simSpeed === 1500 ? styles.active : ''}`}
                    onClick={() => changeSpeed(1500)}
                  >
                    0.5x
                  </button>
                  <button
                    className={`${styles.speedBtn} ${simSpeed === 900 ? styles.active : ''}`}
                    onClick={() => changeSpeed(900)}
                  >
                    1x
                  </button>
                  <button
                    className={`${styles.speedBtn} ${simSpeed === 450 ? styles.active : ''}`}
                    onClick={() => changeSpeed(450)}
                  >
                    2x
                  </button>
                </div>
              </div>

              <div className={styles.zoomControls}>
                <button
                  className={styles.controlBtn}
                  title="Ajustar a Pantalla (100% Visible)"
                  onClick={fitToViewport}
                >
                  🎯
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
                  onClick={() => setZoom(prev => Math.max(prev * 0.85, 0.2))}
                >
                  －
                </button>
                <button
                  className={styles.controlBtn}
                  title="Centrar y Ajustar"
                  onClick={resetTransform}
                >
                  ↺
                </button>
              </div>
            </div>

            {/* Telemetry Bar */}
            {isSimulating && (
              <div className={styles.telemetryBox}>
                <div className={styles.telemetryLeft}>
                  <div className={styles.telemetryPulse}></div>
                  <div className={styles.telemetryText}>{telemetryMessage}</div>
                </div>
                <div className={styles.telemetryTrack}>
                  <div
                    className={styles.telemetryBar}
                    style={{ width: `${telemetryProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Render Area Interactivo con Pan & Zoom */}
            <div
              className={styles.renderArea}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <div
                className={`${styles.mermaidWrapper} mermaid`}
                ref={containerRef}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                }}
              >
                {!mermaidReady && <div style={{ color: '#94a3b8' }}>Cargando tipografía y motor gráfico...</div>}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
