# Habilitación de autocustodia en Demo — CODEX-117

## Trabajo ejecutado el 7 de octubre de 2026
- Nueve contratos auxiliares desplegados en Optimism Sepolia (11155420). Sin cambios a BLUE/RED, Exchange, Vault ni direcciones de usuarios.
- Versiones: Safe 1.4.1-2, passkey 0.2.0, recovery 0.1.0. Los diez artefactos usados (incluido SafeProxy para hash) se contrastaron byte por byte con ABI/creation/runtime de paquetes oficiales descargados por npm.
- Cada despliegue se simuló, recibió dos confirmaciones y su runtime se comparó con el resultado de ejecutar su constructor. Posteriormente, los nueve códigos se verificaron también mediante https://sepolia.optimism.io.
- La espera de recuperación usada para Demo es 86400 segundos, igual al caso de integración existente; no es una decisión de producción. Cambiarla posteriormente exige un módulo/configuración nuevos y tratar expresamente cuentas ya activadas.
- Configuración pública: backend/config/accounts/optimism-sepolia.json.
- Evidencia: optimism-sepolia-evidence.json y artifact-audit.json en esa misma carpeta. No contienen claves.
- Hash del manifiesto: 0xf61c5738b85ba5e5884b8d6c6d2fe51b4bfe35f0c854c9678e7e3f39a6673a1c.

## Publicación por el operador
1. Publicar los archivos de backend y configuración juntos. Comprobar que backend/config/accounts se incluya en la entrega.
2. Confirmar WINTON_CHAIN_ID=11155420 en el backend de Demo. Con esa selección explícita no hace falta configurar SMART_ACCOUNT_MANIFEST: el backend utiliza el manifiesto versionado. Si ya existe SMART_ACCOUNT_MANIFEST, tiene prioridad; debe apuntar a un archivo válido de la misma red. Una ruta incorrecta no se ignora.
3. Verificar RPC de Demo, migración 121, relayer autorizado y financiado, presupuestos de patrocinio. Comprobar también HMAC de identidad y ejecutor de emergencia independiente financiado con presupuestos válidos. No copiar secretos a este documento ni al puente. No usar una clave compartida para sortear el diagnóstico.
4. Ejecutar backend/scripts/check_recoverable_accounts.js con el entorno del servicio cargado y el diagnóstico administrativo de preparación. Deben pasar antes de anunciar operación completa.
5. Probar /api/me/account/status autenticado: ya debe devolver configuración válida y estado, en lugar del 503 de manifiesto ausente.
6. Completar una cuenta nueva de prueba, respaldo, registro del dispositivo y activación. Confirmar estado active y propietario/módulo/guardián en blockchain. Después probar una operación firmada y cancelación de recuperación con cuota normal agotada.

## Dirección anterior de test8
La cuenta de la captura ya muestra una dirección anterior. El bloqueo LEGACY_MIGRATION_REQUIRED permanece intencionalmente: habilitar infraestructura no autoriza a borrar la dirección. Revisar fondos, compromisos, lotes, órdenes y operaciones pendientes por cuenta y red antes de una migración controlada. Este cambio no implementa esa migración ni declara test8 activada.

## Validación
53/53 pruebas backend: safeAccountManifest, recoverableAccounts, web3Readiness y recoveryEmergency. Se verifica selección explícita Demo, rechazo de redes equivocadas, ruta inválida sin fallback y rechazo de contratos inexistentes. Verificación de infraestructura real por RPC público aprobada. No hubo acceso a Render ni publicación de backend en este turno. Preparación remota y prueba de teléfono pendientes: no declarar el servicio completo disponible por el solo despliegue de contratos.

## Actualización CODEX-120 — 8 de octubre de 2026
Sustituye el requisito de variable adicional indicado arriba: safeAccountPolicy obtiene siempre la red canónica de chainDeployment.configuration(env). Si esa red es Optimism Sepolia carga el manifiesto versionado; una ruta SMART_ACCOUNT_MANIFEST explícita conserva prioridad y su red se compara siempre con la canónica. Mainnet/local no adoptan automáticamente el manifiesto Demo. La red real y los códigos siguen verificándose contra RPC.

Antes de generar palabras, la interfaz consulta GET /api/me/account/activation-readiness (autenticado, solo lectura). Comprueba usuario, dirección heredada, tablas de cuentas, contratos económicos y Safe, presupuestos/cuota disponibles para los cuatro pasos, fondos de activación y configuración/fondos de emergencia e identidad. No reserva presupuesto ni garantiza disponibilidad futura; los controles de cada operación siguen vigentes. La interfaz detiene el proceso con un mensaje útil si no está listo. Publicar frontend y backend juntos.

Usuario sin dirección: Wallet presenta pendiente de activar, no error de saldos, y no repite consultas cada cuatro segundos. Las operaciones siguen requiriendo dirección válida; solo la consulta visual admite ausencia. Sesión vencida ofrece iniciar sesión desde Seguridad.

Validación local: 67 pruebas backend, 4 render Wallet, 53 JSX sin referencias inexistentes, compilación Demo/PWA correcta. Prueba Chromium móvil con datos simulados: cuenta nueva sin dirección, sin consultas repetidas, bloqueo de palabras por falta de disponibilidad, reintento y sesión vencida. Esto no acredita recursos remotos ni una activación real de usuario. La comprobación completa en Demo público sigue pendiente tras publicación.
