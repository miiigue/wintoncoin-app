# Cancelación de recuperación: emergencia

Implementación CODEX-108, 2026-10-06. Código integrado; no desplegado ni financiado por Codex.

## Recorrido normal de emergencia
La cancelación autorizada por el titular usa un ejecutor distinto y un presupuesto separado. No consulta las cuotas de pagos normales. Solo admite la llamada cancelRecovery al módulo configurado, ejecutada por la Safe, sin importe, delegatecall ni reembolso desde el usuario. Se conserva el registro durable y bloqueo de nonce del ejecutor; no se ignoran conflictos de nonce.

Configurar en el gestor de secretos del servidor:
- RECOVERY_RELAYER_PRIVATE_KEY: clave institucional dedicada, distinta de RELAYER_PRIVATE_KEY. No es una clave de usuario. No incluirla en archivos publicados.
- RECOVERY_GAS_MAX_WEI: máximo por cancelación, incluyendo gas L2 y estimación conservadora de costes L1/operador.
- RECOVERY_GAS_DAILY_WEI: presupuesto diario separado, al menos el máximo por operación. Pendientes/conflictos siguen reservados.

Sin configuración o fondos no se promete enviar. No se ha establecido ni gastado un presupuesto real. Medir costes en la red objetivo y configurar importes adecuados antes de habilitar. Rotar la clave solo conciliando operaciones pendientes; una clave nueva no debe dejar evidencia firmada sin seguimiento.

## Alternativa desde otra billetera
La interfaz incluye Cancelación de emergencia con otra billetera, visible para cuenta activa incluso si falla consultar el estado del servidor. Usa contexto de cuenta ya cargado y RPC público; no usa endpoints de cotización ni presupuesto de WintonCoin. Comprueba red y código, lee solicitud y nonce, firma con el dispositivo actual y solicita a la billetera externa enviar execTransaction. La billetera externa paga ETH, no obtiene permisos sobre BLUE/RED. Se fija chainId y se simula antes de enviar. Mostrar hash de envío no equivale a confirmación.

Límites: necesita página/contexto ya cargados, credencial disponible, RPC y billetera inyectada compatible con fondos ETH en la red correcta. No garantiza recuperación ante pérdida total de acceso, backend caído antes de cargar contexto o sitio inaccesible. Falta probar navegadores/teléfonos físicos y proveedores; no se añadió WalletConnect. Los avisos externos de recuperación siguen pendientes.

Pruebas: 9 pruebas backend específicas de presupuesto/control de destino más 21 de cuentas; 9 de integración Safe, incluyendo otro ejecutor que cancela con firma del titular y rechazo de repetición. Build Demo aprobado. No se probó configuración pública ni billetera física.
