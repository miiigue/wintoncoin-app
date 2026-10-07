# Autocustodia recuperable: implementación candidata

Fecha: 2026-10-05. Base revisada: `14500eb`. No desplegada ni habilitada en una red pública por esta implementación.

## Qué cambia

Una cuenta Safe 1.4.1 permanece vinculada a la identidad. El dispositivo firma localmente mediante una credencial WebAuthn P-256. Un respaldo BIP39 aleatorio de 12 palabras autoriza solicitar la recuperación con el módulo SocialRecoveryModule. Ese respaldo no es una contraseña elegida por el usuario ni se utiliza para pagar.

El servidor deja de generar, descifrar o firmar claves privadas de usuarios. Conserva la firma institucional del relayer para enviar autorizaciones ya firmadas. Los endpoints heredados de PIN devuelven 410. El material heredado permanece intacto a la espera de una migración verificada.

Activación: registrar dispositivo, crear Safe, autorizar módulo de recuperación y registrar la dirección derivada del respaldo como guardián. Cada envío queda registrado antes de emitirse; una recarga recupera la referencia. Una cuenta no se marca activa antes de comprobar configuración, propietario, módulo, guardián y confirmaciones.

Recuperación personal: crear nueva credencial, comprobar la firma del respaldo, solicitar recuperación, esperar el plazo del módulo y finalizar. La actualización del acceso en base de datos requiere observar el propietario confirmado en blockchain. El dispositivo anterior puede cancelar durante la espera, incluso cuando la solicitud se inició fuera de la aplicación. La credencial de reemplazo usa un identificador distinto para evitar sustituir anticipadamente el acceso anterior en un gestor de passkeys. Se conserva la misma dirección: no se transfieren ni recrean BLUE, RED, parking, órdenes o garantías.

## Identidad y límites reales

Una identidad interna por usuario y una cuenta por identidad y red. Los documentos revisados se vinculan mediante referencias HMAC con país y tipo de documento. Una restricción única impide reutilizar el mismo documento incluso con solicitudes simultáneas. La administración registra la revisión por nombre de usuario; esto no aprueba automáticamente KYC en los contratos.

No existe detección biométrica incorporada ni garantía automática de unicidad mundial. Un pasaporte de otro país necesita revisión contra la identidad existente. No se escriben documentos, fotos ni biometría en blockchain. La evidencia completa debe conservarse en el sistema de verificación autorizado, con control de acceso y retención definidos.

La recuperación asistida está deshabilitada. No hay proveedor independiente ni procedimiento aprobado conectado. No se cobra 10 BLUE, no se genera RED y no se habilitan transferencias BLUE prohibidas para cobrarla. Perder simultáneamente el acceso y el respaldo puede impedir recuperar la cuenta. No anunciar recuperación garantizada.

## Configuración antes de habilitar

1. Ejecutar migración `121_recoverable_accounts.js`, usando el migrador existente. No elimina ni reasigna billeteras.
2. Configurar `IDENTITY_DOCUMENT_HMAC_KEY` con secreto aleatorio independiente de al menos 32 caracteres. Mantenerlo en un gestor de secretos; una rotación requiere migración planificada para no perder detección de duplicados.
3. Preparar un archivo privado de configuración sin claves de usuario y establecer su ruta en `SMART_ACCOUNT_MANIFEST`. Campos: `version:1`, `safeVersion:"1.4.1"`, `chainId`, `publicRpcUrl`, `proxyCodeHash`, `recoveryDelaySeconds`, `recoveryDeploymentEvidence` y `contracts`.
4. Cada entrada de `contracts` contiene `address` y `codeHash` del código ejecutable verificado. Obligatorios: `singleton`, `factory`, `fallbackHandler`, `passkeyFactory`, `passkeyVerifier`, `recoveryModule`. Para infraestructura local/custom incluir también `multiSend`, `multiSendCallOnly`, `passkeySharedSigner`; el SDK los requiere. No habilitar un manifiesto construido solo confiando en la respuesta de un RPC: contrastar registros oficiales, artefactos y argumentos del despliegue.
5. Comprobar el plazo real del módulo contra los argumentos y artefactos del despliegue. No expone un getter de su plazo inmutable. `recoveryDeploymentEvidence` identifica esa evidencia; escribir una etiqueta no sustituye la revisión. La interfaz de una solicitud muestra el plazo que retorna el contrato.
6. `publicRpcUrl` se entrega al navegador: usar un endpoint público o una credencial restringida que se pueda publicar, nunca una clave privada de infraestructura. Configurar orígenes WebAuthn/HTTPS permitidos. Para pruebas locales usar `localhost`, no cambiar entre localhost y 127.0.0.1.
7. Configurar y financiar el relayer, sus cuotas y presupuestos. Esta versión usa patrocinio; aún no entrega un recorrido completo de envío alternativo si el relayer está caído o sin presupuesto. No presentarlo como disponibilidad independiente del operador.
8. Ejecutar `node backend/scripts/check_recoverable_accounts.js` desde un entorno que tenga las variables. También se integra la comprobación en preparación Web3; sin manifiesto verificado no aparece listo.

## Puertas de salida antes de Demo y producción

- Inventario real de direcciones heredadas: tokens, compromisos, órdenes, devoluciones, garantías, permisos y operaciones pendientes. No hay migración automática de direcciones existentes. La autorización de reemplazo no sustituye comprobar cada caso. Diseñar y probar la migración conservando evidencia antes de habilitar usuarios existentes.
- Probar navegador y teléfono reales: crear credencial, cancelar el diálogo, respaldo incorrecto, recarga en cada paso, pérdida del dispositivo, recuperación y cancelación. La simulación criptográfica P-256 no demuestra compatibilidad de todos los autenticadores físicos.
- Completar pruebas HTTP y PostgreSQL del flujo entero con credenciales de dispositivos, reconexión y fallos después de cada confirmación. Adaptar las integraciones heredadas que requieren PIN y que permanecen condicionadas a infraestructura externa.
- Resolver recuperación después de perder también sesión/correo; el recorrido implementado requiere sesión de usuario. No permitir que un administrador reemplace el acceso solo por reconocer un documento.
- Notificaciones verificables de recuperación por canales independientes: pendientes. La interfaz permite consultar y cancelar, pero no garantiza que un usuario ausente vea la alerta a tiempo.
- Actualizar términos y privacidad con revisión jurídica antes de publicar el nuevo método: respaldo, pérdida de acceso, alcance de KYC, proveedores, retención y posibles cargos futuros. Ninguna etiqueta técnica acredita cumplimiento normativo por sí sola.
- Revisión independiente de seguridad, dependencias y configuración antes de manejar fondos reales. No hay certificación ni garantía de ausencia de fallos.

## Pruebas realizadas

- Compilación de la interfaz Demo: correcta; persisten avisos de páginas heredadas, imagen no encontrada y tamaño del SDK.
- Backend: 34 pruebas dirigidas aprobadas sobre recuperación, rechazo de PIN heredado, firmas, confirmaciones, despliegue y preparación.
- PostgreSQL aislado: 3 pruebas aprobadas, incluida competencia simultánea por el mismo documento y restricciones de cuentas/recuperaciones.
- Contratos: suite completa 170 aprobadas, 34 pendientes por condiciones de integración externas. Después se añadió una prueba P-256: suite dirigida final de Safe con 8 aprobadas, utilizando el helper de firma del frontend y contratos oficiales. No se modificaron contratos económicos.
- Suite completa backend: no validada limpiamente; faltan configuración y credenciales de pruebas y existen integraciones heredadas. No confundir este resultado con las pruebas dirigidas aprobadas.

Los artefactos de pruebas proceden de los paquetes oficiales Safe 1.4.1-2, safe-recovery 0.1.0 y safe-passkey 0.2.0. Se conservan sus licencias en `web3-contracts/test/vendor`. Los despliegues públicos deben verificarse por su versión y código exactos; no asumir que un artefacto de pruebas equivale a cualquier versión publicada.


## Corrección de seguridad CODEX-106 (2026-10-06)

Se elimina el reemplazo automático introducido después de CODEX-104. La comprobación de direcciones heredadas ya no consulta la tabla inexistente marketplace_payments ni convierte errores RPC en saldo cero. Cualquier dirección anterior distinta de la misma Safe activa bloquea el alta/reemplazo con LEGACY_MIGRATION_REQUIRED, incluso con saldos aparentes cero. La activación final aplica el mismo control dentro de su transacción. Esto impide abandonar fondos en órdenes abiertas, operaciones en tránsito o depósitos posteriores a una fotografía de balances.

Esta corrección protege las cuentas, pero NO implementa una migración de direcciones heredadas ni cierra los pendientes de configuración, avisos, sesión perdida y revisión independiente. La migración controlada deberá inventariar contratos/redes y operaciones, resolver el acceso a la dirección anterior, impedir operaciones concurrentes y conservar evidencia verificable antes de habilitar cualquier reemplazo. No añadir una excepción basada solamente en saldos cero.

La sección 3.6 de términos describe el alcance disponible y sus límites; permanece pendiente revisión jurídica integral, incluidos el resto del documento y el mecanismo de aceptación versionada antes de publicar.
