# Correcciones administrativas, identidad y PIN — 2026-09-26

## Alcance y estado

Cambios locales autorizados por Miguel. No constituyen despliegue, ejecución de migraciones reales, certificación de seguridad ni aprobación de lanzamiento. No se modificó Solidity. Se integró el dashboard añadido por Antigravity en 491674b sin sustituir sus componentes. QA_TEST_CATALOG.md se preservó.

## Comportamiento corregido

- Los cuatro alias React de administración requieren sesión administrativa antes de mostrar el panel. Wallet y Exchange no ofrecen enlaces de administración. El backend verifica firma independiente, rol, cuenta activa, versión de contraseña y origen exacto en escrituras. Un auditor no puede modificar. Fallos al comprobar sesión/gobernanza bloquean la operación.
- Las rutas Web3 respetan la comprobación existente de guardianes; pausar por emergencia sigue permitido, reanudar no omite gobernanza. Esto no añade un sistema multisig on-chain.
- Comisión y plazo se leen del contrato. El espejo local se escribe después de confirmación, nunca tras un rechazo. Un fallo posterior de DB se informa como sincronización pendiente con hash. No reenviar automáticamente una transacción ya confirmada.
- Configuración económica centralizada en Contratos: comisión, plazo y reglas generales RED. La sección antigua rechaza sus escrituras. Las excepciones, KYC y beneficios se seleccionan por nombre de usuario y se resuelve su billetera en servidor; se comprueba unicidad y correspondencia. El laboratorio también resuelve usuarios; las firmas económicas siguen verificándose en contrato.
- Pagos no aprueban KYC ni aumentan límites para lograr ejecutarse. El cálculo del límite respeta cero, no vuelve a sumar la garantía del Vault y no asigna un límite predeterminado cuando falla una consulta. Una excepción individual confirmada se conserva al recalcular.
- La billetera mostrada procede de la cuenta autenticada. Un proveedor externo con otra dirección no puede firmar desde estos flujos. Una dirección existente sin material de clave se deriva a recuperación; no se reemplaza silenciosamente.
- El contador PIN tiene transacción y pool independientes: errores de pago y rollback no borran intentos, tampoco intentos concurrentes. Cinco fallos bloquean 15 minutos. Hay además limitación HTTP. El nuevo cifrado autenticado y el hash PIN incorporan un secreto del servidor; falta de secreto bloquea generación/cifrado. No hay clave literal de respaldo.
- La migración a PIN comprueba la dirección y el descifrado antes de retirar la copia antigua. Cambiar PIN conserva dirección. Un keystore v1 se actualiza a v2 después de autorización válida. Las migraciones no ofrecen una reversión automática que borre material de recuperación.
- Administración queda fuera de precaché y navegación offline; se eliminan entradas administrativas antiguas. El fallback SPA solo cubre rutas migradas, no todas las páginas HTML. La regla Apache de JS genérico ya no sobreescribe la política del actualizador PWA con un año de caché. No se ha reproducido la caché concreta del navegador de Miguel ni comprobado el CDN remoto.

## Pruebas ejecutadas

- 10 suites Jest seleccionadas: 90/90 aprobadas. transactionPinSelfCustody, web3Corrections, publicationPayment, adminSubmodulesIntegrity, governanceBypass, adminUserDossier, exchangeSnapshotRoute, platformFormFields, sosRegistrationFlow y volunteerSystem.
- scripts/security-hardening-test.cjs: 27/27 comprobaciones; incluye PostgreSQL 17 real aislado, esquemas sintéticos, migraciones 113–115, rollback, concurrencia, identidad y actualización v1. No usa fondos ni claves reales. Requiere ALLOW_LOCAL_SECURITY_DB=true y la instancia local de revisión indicada en el script; se niega a usar otra ubicación de DB.
- frontend/tests/wallet-identity.test.mjs: 4/4 pruebas de selección de identidad y rechazo de firma ajena.
- Compilación frontend Demo aprobada tras integrar 491674b. Persisten avisos previos de scripts legacy sin type=module, una imagen no resuelta y chunk vendor vacío. No es una compilación sin advertencias.
- Navegador local con API sintética: visitante ve acceso administrativo sin formularios; administrador ve configuración, comisión cero y error concreto de operación rechazada. Ninguna escritura ni transacción real.
- La ejecución amplia del backend no quedó completamente verde: suites fuera de la selección necesitan servidor/DB/configuración de prueba (publication y boosterPaymentsReconciliation). No presentar los 90 casos como toda la suite. No se repitió Hardhat: Solidity no cambió.

## Preparación obligatoria antes de publicar

1. Respaldar DB y material de recuperación; verificar restauración. Aplicar migraciones 114 y 115 mediante el runner real del servidor, backend/scripts/migrationRunner.js. Es un módulo programático; no asumir que ejecutarlo directamente aplica migraciones. Revisar previamente billeteras duplicadas: el índice único rechaza duplicados, no mueve fondos ni fusiona personas. Dimensionar bloqueo del índice para el tamaño real de users.
2. ADMIN_SECRET_KEY debe existir y diferir de JWT_SECRET. Mantener origen administrativo correcto. ENCRYPTION_SECRET debe tener al menos 32 caracteres y ser secreto aleatorio administrado con respaldo. No cambiar arbitrariamente el secreto existente: claves antiguas y keystores v2 dependen de él. Si el despliegue antiguo usó un respaldo inseguro literal, preparar migración supervisada antes de activar este código; no reinstalar ese respaldo como solución.
3. Las copias históricas de DB pueden conservar claves antiguas. Proteger respaldos y planificar recuperación/rotación. El modelo sigue siendo firma asistida por servidor: este recibe PIN y descifra para firmar. No llamarlo autocustodia exclusiva ni inferir exenciones legales/certificaciones a partir del cifrado.
4. Publicar backend/migraciones/frontend coordinadamente. No arrancar contra DB sin las columnas nuevas. Validar que el hosting entrega .htaccess y las cabeceras, actualización desde versión anterior sin borrar sesión y las rutas admin con/sin extensión.
5. Verificar roles on-chain reales del operador, gas, red, direcciones y recibos. Las pruebas locales no demuestran que las credenciales de Demo tengan permisos ni que los contratos desplegados correspondan al código revisado.

## Pendientes que impiden declarar terminado el ecosistema

- El PIN de pagos de tareas no autoriza aún todas las funciones Vault/Exchange. Algunas operaciones necesitan el proveedor externo con la misma dirección. No se añadió un relayer con libertad para mover fondos ni un destino de retiro que el contrato no soporte.
- Las reglas generales RED siguen siendo política calculada en backend y aplicada por usuario al contrato. Guardar una regla no modifica inmediatamente todos los límites on-chain. Métricas de quizzes y pago temprano no están implementadas. Falta versionado/aplicación masiva acotada y serialización integral entre cálculo automático, excepción manual y otras escrituras administrativas.
- Si el contrato confirma una excepción pero falla guardar su espejo, se devuelve 202 y hash; falta conciliación automática durable. Detener recálculos de esa cuenta hasta conciliar. Esto no debe presentarse como resistencia completa a caídas entre blockchain y DB.
- Las direcciones frontend siguen fijadas al despliegue actual de Optimism Sepolia; falta un manifiesto compartido validado antes de publicar otra suite. No publicar para otra red sin alinear ambos lados.
- Siguen abiertos los hallazgos CODEX-073 de RPC congelado/logs omitidos y la amortización masiva por gas. Estos cambios no los resuelven.

## Corrección de atribución de CODEX-074

adminRoutes ya usaba authenticateAdmin de authMiddleware, con validación DB fuera de test. El verificador antiguo vulnerable era adminAuthMiddleware, utilizado en otros caminos. CODEX-074 no probó un bypass de escritura en las rutas de contratos de Demo. La unificación elimina la divergencia; se conserva esta precisión.
