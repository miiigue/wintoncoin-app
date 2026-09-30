# Demo: activación coherente de la suite V4

El manifiesto activo de Optimism Sepolia apunta a los contratos desplegados el 30 de septiembre de 2026. El manifiesto anterior del 25 de septiembre queda archivado en `web3-contracts/deployments/optimism-sepolia-legacy-2026-09-25.json`.

## Comprobaciones previas

- Se verificaron por lectura pública los enlaces entre CoreProtocol, CollateralVault, FifoExchange, BLUE, RED, USDT y Treasury.
- Ambas suites tenían suministro BLUE y RED cero, ninguna orden y reservas del Exchange cero al comprobarlas. El historial administrativo público del Core anterior no mostraba aprobaciones KYC ni límites individuales. Esto no equivale a una auditoría de la base de datos de la aplicación.
- La configuración de Demo acepta variables antiguas conocidas, pero usa íntegramente el manifiesto nuevo para evitar mezclar contratos. Las direcciones desconocidas producen error.
- El indexador pasa al Exchange nuevo y su bloque de despliegue; si el proveedor principal todavía no ve ese bloque, consulta la alternativa pública. Conserva el historial anterior separado por dirección.

## Administración

El panel requiere sesión administrativa y una billetera conectada que sea propietaria de los contratos. La clave del propietario no se envía al servidor ni se guarda en el navegador por este flujo. Cada cambio prepara una llamada exacta, solicita la firma en la billetera y compara emisor, destino, datos, valor, red y hash antes de proyectarlo en la base de datos, y solo después de confirmación segura. El panel muestra la referencia y la transacción, además de permitir reanudar su verificación si se perdió la respuesta.

La pausa de emergencia conserva la excepción de gobernanza existente. La verificación de una transacción ya firmada no queda bloqueada si la política de gobernanza cambia después de su envío.

## Validación y límites

- Pruebas dirigidas de administración, selección de suite, preparación del servicio y alternativa RPC: 15 aprobadas.
- Compilación Demo del frontend: correcta. La construcción muestra avisos previos sobre páginas HTML y una imagen no resuelta, sin detenerse.
- La prueba real de firmar desde la billetera propietaria, aprobar KYC y asignar límite a un usuario de Demo sigue pendiente. También sigue pendiente comprobar el estado actual de la base de datos y el indexador tras el despliegue del servidor. No se usó Render por indicación del usuario.
- La asignación automática de límites de crédito existente aún necesita un firmante administrativo operativo o una cola aprobada por el propietario. Mientras no exista, el administrador puede aprobar KYC y límite manualmente desde el panel; no se debe prometer habilitación automática al registrarse.
- La sincronización con producción y los fondos reales no forman parte de este cambio de Demo.
