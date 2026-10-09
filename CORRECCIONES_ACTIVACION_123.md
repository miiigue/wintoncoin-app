# Correcciones de activación y sustitución del ejecutor — CODEX-123

Fecha: 2026-10-09. Cambios locales; no publicados ni configurados en servidores.

## Qué se corrigió
- El temporizador solo consulta el estado. Una firma o envío necesita una acción explícita del usuario.
- Bloqueo inmediato contra doble clic y solapamiento de consultas. Se detiene la consulta automática ante sesión vencida, fallo o confirmación pendiente del usuario.
- Aviso de éxito independiente por red y billetera; encabezado accesible; opciones de recuperación sin el desplegable exterior redundante.
- Una recuperación pendiente se muestra aunque las opciones estén cerradas. La consulta periódica solo funciona mientras la página está abierta y visible; no sustituye notificaciones externas.
- El servidor rechaza la dirección pública del ejecutor cuya clave fue expuesta. Esto NO invalida la clave en blockchain ni recupera fondos; requiere reemplazo operativo.

## Orden obligatorio antes de publicar backend
1. Inventariar por dirección pública dónde se usa el ejecutor expuesto: 0xF28a82bBc295c00f036d304D252E45A10B336323. Revisar Demo y producción, roles y redes; la etiqueta Demo no demuestra ausencia de reutilización.
2. Crear una clave nueva en un entorno seguro e introducirla directamente en el gestor de secretos. Nunca publicarla en el puente, código, logs ni chat. Debe ser diferente de administrador, relayer habitual y patrocinador general.
3. Revisar cancelaciones existentes en chain_operations para el ejecutor anterior, especialmente prepared/pending/conflict. Consultar recibos y nonces antes de decidir su continuación. No borrar registros, cambiar remitentes de operaciones ya firmadas ni reutilizar nonces a ciegas. Una transacción antigua pendiente no desaparece al cambiar la configuración.
4. Configurar RECOVERY_RELAYER_PRIVATE_KEY y RECOVERY_RELAYER_ADDRESS coherentes, mantener presupuestos de emergencia separados y financiar la nueva dirección con ETH de prueba en Demo. Verificar readiness y separación de roles sin mostrar secretos.
5. Publicar estas correcciones solo tras el reemplazo. Con la clave anterior, la protección rechaza el servicio y puede impedir nuevas activaciones: es una protección deliberada, no un reemplazo automático.
6. Comprobar con una cuenta de QA una cancelación autorizada real y su recibo. Comprobar también la alternativa de envío con otra billetera; esta requiere autorización legítima, fondos y acceso a RPC.
7. Retirar la credencial expuesta de su mensaje original y demás copias mediante el responsable del canal. La eliminación del texto no sustituye la rotación. Revisar qué privilegios y fondos tuvo; no afirmar que producción está libre de afectación sin inventario.

## Verificación repetible
Desde frontend: npm ci; npx playwright install chromium; npm run test:account-security; npm run test:wallet; npm run build:demo.
En un ejecutor Linux nuevo, instalar también dependencias del navegador mediante playwright install --with-deps chromium.
Las 12 comprobaciones de interacción usan respuestas simuladas y no firman ni envían transacciones reales.
Backend: suite safeAccountManifest, accountActivationReadiness, recoverableAccounts, web3Readiness y recoveryEmergency: 69 pruebas aprobadas.
Frontend: 12 comprobaciones de interacción aprobadas, 53 componentes sin referencias no declaradas, compilación Demo/PWA aprobada; test:wallet aprobado durante esta corrección.

## Pendientes adicionales observados
npm audit informa 25 alertas (19 altas, 5 moderadas, 1 baja) en el árbol frontend. Playwright no figura entre los paquetes afectados. Se requiere revisar alcance y actualizar dependencias con pruebas; las propuestas automáticas incluyen saltos mayores de Vite/PWA y no se aplicaron a ciegas. No confundir una alerta de dependencia con una explotación confirmada.
La compilación conserva avisos de scripts clásicos, una imagen sin resolver y tamaño de paquetes. Estas correcciones no constituyen auditoría completa del producto ni prueba de recuperación real en teléfono.
No se accedió a Render, no se usó la clave expuesta, no hubo commit/push/deploy ni rotación remota.
