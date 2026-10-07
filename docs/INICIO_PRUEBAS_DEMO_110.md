# Inicio de pruebas Demo — 2026-10-07

Estado: candidata local; no acreditada como desplegada. No usar fondos reales.

## Preparación obligatoria
1. Publicar el mismo conjunto de cambios en frontend y backend. Registrar revisión y comprobarla en ambos servicios; un build local no acredita publicación.
2. Configurar SMART_ACCOUNT_MANIFEST con despliegues y código verificados de Optimism Sepolia, evidencia de plazo y RPC público. No inventar direcciones ni mezclar producción.
3. Configurar IDENTITY_DOCUMENT_HMAC_KEY y RECOVERY_RELAYER_PRIVATE_KEY en el gestor de secretos. El ejecutor de emergencia debe ser distinto de administración, pagos y patrocinio. No compartir claves en el puente.
4. Medir gas y definir RECOVERY_GAS_MAX_WEI y RECOVERY_GAS_DAILY_WEI; financiar el ejecutor con ETH de prueba. Verificar también presupuestos normales y relayer.
5. Aplicar migraciones hasta 121 según el migrador existente. Comprobar preparación administrativa y ejecutar el diagnóstico de cuentas con el entorno cargado. El diagnóstico revisa infraestructura, no sustituye pruebas de teléfono ni certifica seguridad integral.
6. Utilizar una cuenta nueva de pruebas sin dirección heredada. Completar alta, respaldo y KYC. Las cuentas anteriores mantienen LEGACY_MIGRATION_REQUIRED; no borrar direcciones para sortearlo.

## Prueba manual supervisada
- Registrar passkey y respaldo sin enviarlo al servidor. Recargar en cada etapa y completar activación una sola vez.
- Crear una solicitud personal de recuperación controlada y comprobar su plazo on-chain.
- Agotar la cuota normal del usuario de prueba: cancelar con el dispositivo vigente mediante el ejecutor de emergencia. Confirmar recibo exitoso y solicitud cancelada.
- Repetir con ejecutor normal bloqueado: el ejecutor independiente debe continuar.
- Probar sin presupuesto de emergencia: usar otra billetera compatible con ETH de prueba. Cargar antes contexto, firmar con dispositivo titular y enviar. Comprobar cancelación en cadena, no solo hash mostrado.
- Probar red equivocada, rechazo de firma y repetición: no debe cambiar propietario ni saldos ni compromisos. Documentar resultado y referencia de transacción sin frases/claves.

Quedan fuera de la declaración de preparado: migración heredada, recuperación sin sesión, avisos externos y disponibilidad del sitio ante caída total. Mientras los avisos estén pendientes, supervisar manualmente cada solicitud de prueba; no habilitar recuperación para usuarios reales como servicio completo.
