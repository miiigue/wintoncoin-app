# Resultados del Bloque A no económico — Demo

Fecha: 9 de noviembre de 2026.  
Entorno: `https://demo.wintoncoin.com`, exclusivamente Demo.  
Versiones verificadas: frontend `f2bd451`; backend `3aa66d0`.  
Alcance: recorridos públicos y autenticados sin pagos, fondos, firmas ni transacciones blockchain.

## Resultado ejecutivo

- Pruebas E2E públicas: **5/5 aprobadas**.
- Pruebas E2E autenticadas con una cuenta QA normal: **2/2 aprobadas**.
- Pruebas E2E multiusuario con QA-01 a QA-04: **2/2 aprobadas**.
- Suite backend: **501 aprobadas**, 46 omitidas por diseño.
- Compilación Demo e aislamiento de backend, CRM y orígenes: aprobados.
- Prelanzamiento: activo; operaciones económicas del backend deshabilitadas.
- Contratos: Core, Bóveda, Exchange y Tesorería observados pausados en Demo.
- Producción, fondos y blockchain: sin cambios ni transacciones.

## Correcciones verificadas

1. El recorrido heredado muestra `Prelanzamiento activo` y bloquea la creación antes de KYC.
2. Las pruebas toleran el despertar de la instancia gratuita sin confundir latencia con un defecto lógico.
3. El asistente de notificaciones se comprueba por estado visible y no espera botones ya eliminados.
4. El backend falla cerrado si cualquiera de sus marcadores declara Demo y los marcadores no coinciden.
5. Base de datos, RPC, manifiesto contractual y CORS permanecen vinculados a la identidad autorizada de Demo.
6. Cuatro cuentas conservan identidades y tokens de sesión distintos en contextos aislados, incluso después de recargar.
7. Una cuenta normal no puede abrir el panel administrativo.

## Límite de seguridad pendiente

La suite V5 desplegada está pausada, pero su bytecode aún permite algunas mutaciones directas que no tienen `whenNotPaused`, como cambios de consentimiento, cancelaciones, reclamación de devoluciones o retiro de comisiones. Por ello:

- se permiten pruebas públicas y autenticadas **no económicas**;
- continúan prohibidas firmas, órdenes, cancelaciones, retiros, reclamaciones, garantías y cualquier transacción blockchain;
- no se declara todavía una contención on-chain integral.

La candidata contractual local que corrige esas rutas aprobó **197 pruebas**, con 37 integraciones externas omitidas. No fue desplegada ni firmada.

## Próximo bloque

1. Completar la revisión independiente de la semántica de pausa integral.
2. Ampliar E2E autenticado: aislamiento de cuatro cuentas, recarga, cierre de sesión, botón Atrás y rechazo administrativo.
3. Ejecutar la matriz manual no económica en escritorio y móvil.
4. Preparar una nueva suite contractual Demo; su despliegue requerirá autorización expresa para transacciones blockchain.

Este informe no certifica seguridad, cumplimiento regulatorio ni funcionamiento económico. Registra únicamente las verificaciones realizadas en Demo dentro del alcance indicado.
