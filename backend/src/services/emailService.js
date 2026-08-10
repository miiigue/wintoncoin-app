const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const crypto = require('crypto');

// Configuración AWS SES
const isProduction = process.env.NODE_ENV === 'production';
const AWS_REGION = process.env.AWS_REGION;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
const SES_FROM_NAME = process.env.SES_FROM_NAME || 'WintonCoin';
const OTP_SECRET = process.env.OTP_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || SES_FROM_EMAIL || 'support@wintoncoin.com';
const BRAND_PRIMARY_COLOR = process.env.BRAND_PRIMARY_COLOR || '#0B5FFF';
const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL || 'https://sc.wintoncoin.com/assets/branding/wintoncoin_phrase_blue.png';

// Validación de configuración al cargar el módulo
if (isProduction) {
  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.error(`
            *******************************************************************************
            * ERROR FATAL: AWS SES no está configurado para producción.                  *
            *                                                                             *
            * Define AWS_REGION y SES_FROM_EMAIL (email verificado en SES).               *
            * El servidor no se iniciará hasta que estas variables estén configuradas.   *
            *******************************************************************************
        `);
    // En un servicio, quizás no deberíamos matar el proceso directamente, pero mantendré la lógica original
    // para asegurar que el usuario vea el error crítico.
    process.exit(1);
  }
  if (!OTP_SECRET) {
    console.error(`
            *******************************************************************************
            * ERROR FATAL: OTP_SECRET no está definida.                                   *
            *                                                                             *
            * Para seguridad tipo fintech, el OTP debe firmarse/hashearse con un secreto  *
            * dedicado, separado de JWT_SECRET.                                            *
            *******************************************************************************
        `);
    process.exit(1);
  }
} else {
  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn('[DEV WARNING] AWS_REGION o SES_FROM_EMAIL no están definidos. El OTP se mostrará en consola en vez de enviarse por email.');
  }
  if (!OTP_SECRET) {
    console.warn('[DEV WARNING] OTP_SECRET no está definido. Se usará JWT_SECRET como fallback (NO recomendado en producción).');
  }
}

let _sesClient = null;
function getSesClient() {
  if (_sesClient) return _sesClient;
  _sesClient = new SESClient({ region: AWS_REGION });
  return _sesClient;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateOtp6() {
  // crypto.randomInt es criptográficamente seguro (mejor que Math.random para OTP).
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

function hashOtpForEmail(email, otp) {
  // Atamos el OTP al email para evitar reutilización cruzada.
  const secret = OTP_SECRET || JWT_SECRET; // fallback solo para dev
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex');
}

function safeEqualHex(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a), 'hex');
  const bufB = Buffer.from(String(b), 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// LAYOUT MÁSTER CORPORATIVO (Master Email Wrapper)
// ============================================================================
// Función central que envuelve TODOS los correos del sistema en un diseño
// HTML unificado con:
//   - Logo corporativo WintonCoin (CSS puro, sin imágenes externas).
//   - Subtítulo contextual (ej: "Verificación de cuenta", "Recibo de transacción").
//   - Caja de alerta anti-phishing (consejo de seguridad).
//   - Footer No-Reply inmutable: "No respondas a este correo automático."
//   - Enlace de soporte oficial (support@wintoncoin.com).
//   - Copyright dinámico.
//
// Ningún módulo (OTP, Transacciones, SOS, Gobernanza, Reclutamiento) puede
// enviar correos sin pasar por este Layout Máster, garantizando la uniformidad
// visual y la inmunidad de seguridad No-Reply por estructura.
// ============================================================================
function buildMasterEmailWrapper({ subject, contextLabel, bodyHtml, accentColor }) {
  // Valores seguros y con fallback (Zero Hardcoded Secrets)
  const safeBrandName = escapeHtml(SES_FROM_NAME || 'WintonCoin');
  const safeSupportEmail = escapeHtml(SUPPORT_EMAIL);
  const safeBrandPrimary = escapeHtml(accentColor || BRAND_PRIMARY_COLOR);
  const safeSubject = escapeHtml(subject || '');
  const safeContextLabel = escapeHtml(contextLabel || 'Notificación');
  const year = new Date().getFullYear();

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${safeBrandName}</title>
  </head>
  <body style="margin:0; padding:0; background:#F5F7FB;">
    <!-- Preheader (texto oculto para clientes de correo) -->
    <div style="display:none; font-size:1px; color:#F5F7FB; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${safeSubject}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F7FB;">
      <tr>
        <td align="center" style="padding:24px 12px;">

          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px; background:#FFFFFF; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(16,24,40,0.08);">
            <!-- HEADER: Logo CSS Corporativo + Etiqueta Contextual -->
            <tr>
              <td style="padding:24px 32px; background-color:#0A0F1C; border-bottom:none;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" style="font-family: Arial, sans-serif;">
                      <div style="display: inline-block; padding: 12px 20px; background: radial-gradient(circle at center, #0F172A 0%, #0A0F1C 100%); border-radius: 8px;">
                        <div style="font-family: 'Outfit', Arial, sans-serif; font-size:26px; font-weight:600; letter-spacing:-0.5px; margin:0; line-height: 1;">
                          <span style="color:#FFFFFF; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Winton</span><span style="color:#3B82F6; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Coin</span>
                        </div>
                      </div>
                    </td>
                    <td align="right" style="font-family: Arial, sans-serif; font-size:13px; color:#94A3B8; font-weight:500;">
                      ${safeContextLabel}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BODY: Contenido Específico del Correo -->
            <tr>
              <td style="padding:24px; font-family: Arial, sans-serif; color:#0B1220;">
                ${bodyHtml}

                <!-- Caja de Seguridad Anti-Phishing (Estándar FinTech) -->
                <div style="margin:18px 0 0 0; padding:14px 16px; background:#FFF7ED; border:1px solid #FFEDD5; border-radius:12px;">
                  <p style="margin:0; font-size:12px; line-height:18px; color:#9A3412;">
                    <strong>Consejo de seguridad:</strong> ${safeBrandName} nunca te pedirá contraseñas, códigos de recuperación ni claves privadas por teléfono, chat o redes sociales.
                    Si no esperabas este correo, ignóralo o contacta a soporte.
                  </p>
                </div>

                <p style="margin:18px 0 0 0; font-size:12px; line-height:18px; color:#667085;">
                  Soporte: <a href="mailto:${safeSupportEmail}" style="color:${safeBrandPrimary}; text-decoration:none;">${safeSupportEmail}</a>
                </p>
              </td>
            </tr>

            <!-- FOOTER: No-Reply Estándar de la Industria (Inmutable) -->
            <tr>
              <td style="padding:16px 24px; background:#F8FAFC; border-top:1px solid #EEF2F6; font-family: Arial, sans-serif; font-size:11px; line-height:16px; color:#667085;">
                Este es un correo enviado automáticamente por los sistemas de ${safeBrandName}. Por favor no respondas a este mensaje. Si requieres asistencia o soporte técnico, contáctanos en <a href="mailto:${safeSupportEmail}" style="color:#667085; text-decoration:underline;">${safeSupportEmail}</a>.
              </td>
            </tr>
          </table>

          <!-- Copyright fuera de la card -->
          <div style="max-width:600px; margin-top:14px; font-family: Arial, sans-serif; font-size:11px; line-height:16px; color:#98A2B3;">
            &copy; ${year} ${safeBrandName}. Todos los derechos reservados.
          </div>

        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

// ============================================================================
// FOOTER No-Reply ESTÁNDAR PARA VERSIÓN TEXTO PLANO
// ============================================================================
// Complementa el Layout Máster HTML. Se concatena al final de toda versión
// texto plano para garantizar la coherencia No-Reply en ambos formatos.
// ============================================================================
function buildMasterTextFooter() {
  const brandName = SES_FROM_NAME || 'WintonCoin';
  return [
    '',
    '─'.repeat(50),
    `Seguridad: ${brandName} nunca te pedirá contraseñas ni códigos por teléfono, chat o redes sociales.`,
    `Este es un correo automático. Por favor no respondas a este mensaje.`,
    `Soporte: ${SUPPORT_EMAIL}`,
    `© ${new Date().getFullYear()} ${brandName}. Todos los derechos reservados.`,
  ].join('\n');
}

async function sendOtpEmail({ toEmail, otp, context = {} }) {
  const email = normalizeEmail(toEmail);

  // Dev fallback: si SES no está configurado, no bloqueamos el registro.
  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV OTP] Email: ${email} OTP: ${otp} (SES no configurado)`);
    return;
  }

  const brandName = SES_FROM_NAME || 'WintonCoin';
  const safeBrandName = escapeHtml(brandName);
  const safeBrandPrimary = escapeHtml(BRAND_PRIMARY_COLOR);
  const safeOtp = escapeHtml(otp);
  const subject = `Tu código de verificación de ${brandName}`;

  // Contexto opcional (ayuda anti-phishing y "fintech feel")
  const requestedIp = context.ip ? escapeHtml(context.ip) : '';
  const requestedAt = context.requestedAt ? escapeHtml(context.requestedAt) : '';

  // Texto plano con footer No-Reply estandarizado
  const textBody =
    `Tu código de verificación para ${brandName} es: ${otp}\n\n` +
    `Este código expira en 10 minutos.\n\n` +
    (requestedAt ? `Solicitud: ${requestedAt}\n` : '') +
    (requestedIp ? `IP aproximada: ${requestedIp}\n\n` : '\n') +
    buildMasterTextFooter();

  // Contenido específico del OTP (solo el cuerpo, el wrapper se encarga del resto)
  const otpBodyHtml = `
    <h1 style="margin:0 0 10px 0; font-size:20px; line-height:28px; font-weight:700;">Tu código de verificación</h1>
    <p style="margin:0 0 18px 0; font-size:14px; line-height:22px; color:#344054;">
      Usa este código para completar la verificación de tu cuenta en <strong>${safeBrandName}</strong>.
    </p>

    <div style="margin:0 0 16px 0; padding:16px; background:#F8FAFC; border:1px solid #EEF2F6; border-radius:12px; text-align:center;">
      <div style="font-size:28px; line-height:36px; letter-spacing:6px; font-weight:800; color:${safeBrandPrimary}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
        ${safeOtp}
      </div>
      <div style="margin-top:8px; font-size:12px; line-height:18px; color:#667085;">
        Expira en 10 minutos
      </div>
    </div>

    ${(requestedAt || requestedIp) ? `
    <div style="margin:0 0 16px 0; font-size:12px; line-height:18px; color:#667085;">
      ${requestedAt ? `<div><strong>Solicitud:</strong> ${requestedAt}</div>` : ''}
      ${requestedIp ? `<div><strong>IP aproximada:</strong> ${requestedIp}</div>` : ''}
    </div>
    ` : ''}
  `;

  // Ensamblar HTML final con el Layout Máster Corporativo No-Reply
  const htmlBody = buildMasterEmailWrapper({
    subject,
    contextLabel: 'Verificación de cuenta',
    bodyHtml: otpBodyHtml
  });

  const cmd = new SendEmailCommand({
    Source: `${SES_FROM_NAME} <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: textBody, Charset: 'UTF-8' },
        Html: { Data: htmlBody, Charset: 'UTF-8' }
      }
    }
  });

  await getSesClient().send(cmd);
}


/**
 * Envía un correo transaccional (Recibo, Pago, Recompensa) con diseño profesional.
 * @param {Object} params
 * @param {string} params.toEmail - Email del destinatario
 * @param {string} params.subject - Asunto del correo
 * @param {string} params.title - Título principal dentro del correo (ej: "Pago Exitoso")
 * @param {string} params.message - Mensaje breve descriptivo
 * @param {string} params.amount - Monto formateado (ej: "100.00 BLUE")
 * @param {Array<{label: string, value: string}>} params.details - Lista de detalles a mostrar en tabla (ej: ID Transacción, Fecha, Concepto)
 */
async function sendTransactionEmail({ toEmail, subject, title, message, amount, details = [] }) {
  const email = normalizeEmail(toEmail);

  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV EMAIL] Simulación de envío a ${email}: ${subject}`);
    return;
  }

  const mainColor = BRAND_PRIMARY_COLOR || '#0B5FFF';

  // Generar filas de detalles sanitizadas (prevención XSS)
  const detailsRows = details.map(d => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #EEF2F6; color: #667085; font-size: 14px;">${escapeHtml(d.label)}</td>
      <td style="padding: 12px 0; border-bottom: 1px solid #EEF2F6; color: #101828; font-size: 14px; font-weight: 500; text-align: right;">${escapeHtml(d.value)}</td>
    </tr>
  `).join('');

  // Contenido específico de la transacción (solo cuerpo, el wrapper se encarga del diseño)
  const txBodyHtml = `
    <h1 style="margin:0 0 10px 0; font-size:20px; font-weight:700;">${escapeHtml(title)}</h1>
    <div style="text-align: center; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; color: #667085; font-size: 16px;">Monto total</p>
      <div style="font-size: 36px; color: ${mainColor}; font-weight: 800; letter-spacing: -0.5px;">${escapeHtml(amount)}</div>
    </div>
    <p style="margin: 0 0 24px 0; color: #344054; font-size: 16px; line-height: 24px; text-align: left;">
      ${escapeHtml(message).replace(/\n/g, '<br />')}
    </p>
    <div style="background: #F9FAFB; border-radius: 12px; padding: 24px;">
      <table width="100%" cellspacing="0" cellpadding="0" border="0">${detailsRows}</table>
    </div>
  `;

  // Ensamblar HTML con Layout Máster Corporativo No-Reply
  const htmlBody = buildMasterEmailWrapper({
    subject,
    contextLabel: 'Recibo de transacción',
    bodyHtml: txBodyHtml
  });

  // Texto plano con footer No-Reply estandarizado
  const textBody = [
    title,
    '─'.repeat(40),
    `Monto: ${amount}`,
    '',
    message,
    '',
    'Detalles:',
    ...details.map(d => `${d.label}: ${d.value}`),
    buildMasterTextFooter()
  ].join('\n').trim();

  const cmd = new SendEmailCommand({
    Source: `${SES_FROM_NAME} <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: textBody, Charset: 'UTF-8' },
        Html: { Data: htmlBody, Charset: 'UTF-8' }
      }
    }
  });

  await getSesClient().send(cmd);
}




/**
 * Envía un comunicado oficial o anuncio (Broadcast) con diseño de alta gama.
 * @param {Object} params
 * @param {string} params.toEmail - Email del destinatario
 * @param {string} params.subject - Asunto del correo
 * @param {string} params.title - Título del anuncio
 * @param {string} params.bodyHtml - Contenido principal en HTML (soporta párrafos)
 * @param {string} params.buttonText - Texto del botón de acción (opcional)
 * @param {string} params.buttonUrl - URL del botón de acción (opcional)
 */
async function sendAnnouncementEmail({ toEmail, subject, title, bodyHtml, buttonText, buttonUrl }) {
  const email = normalizeEmail(toEmail);

  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV BROADCAST] Simulación de difusión a ${email}: ${subject}`);
    return;
  }

  const mainColor = '#0052FF'; // Azul corporativo

  // Botón CTA opcional (solo si se proporciona texto y URL)
  const actionButton = (buttonText && buttonUrl) ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(buttonUrl)}" style="display: inline-block; padding: 14px 28px; background-color: ${mainColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${escapeHtml(buttonText)}</a>
    </div>
  ` : '';

  // Contenido específico del comunicado (solo cuerpo, el wrapper se encarga del diseño)
  const announcementBodyHtml = `
    <h1 style="margin:0 0 16px 0; font-size:22px; font-weight:700; color:#111827;">${escapeHtml(title)}</h1>
    <div style="font-size:16px; color:#4b5563; margin-bottom:32px;">${bodyHtml.replace(/\n/g, '<br>')}</div>
    ${actionButton}
  `;

  // Ensamblar HTML con Layout Máster Corporativo No-Reply
  const htmlFinal = buildMasterEmailWrapper({
    subject,
    contextLabel: 'Comunicado Oficial',
    bodyHtml: announcementBodyHtml,
    accentColor: mainColor
  });

  // Texto plano con footer No-Reply estandarizado
  const textBody = [
    title,
    '─'.repeat(40),
    bodyHtml.replace(/<[^>]*>?/gm, ''),
    buildMasterTextFooter()
  ].join('\n').trim();

  const cmd = new SendEmailCommand({
    Source: `${SES_FROM_NAME} <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: textBody, Charset: 'UTF-8' },
        Html: { Data: htmlFinal, Charset: 'UTF-8' }
      }
    }
  });

  await getSesClient().send(cmd);
}

/**
 * Procesa una tanda de correos electrónicos pendientes en la cola de difusiones.

  const BATCH_SIZE = 20; // Enviar de 20 en 20 para mayor velocidad sin saturar SES (sandbox)
  // Declaramos la variable del cliente en el ámbito superior para que sea accesible en try/catch/finally
  let client;

  try {
    // Obtenemos la conexión de base de datos de manera protegida ante fallas de red
    client = await pool.connect();

    // 1. Buscar el primer broadcast que esté en progreso o pendiente
    const broadcastResult = await client.query(
      `SELECT id, subject, title, body, button_text, button_url FROM email_broadcasts 
       WHERE status IN ('pending', 'sending') 
       ORDER BY created_at ASC LIMIT 1`
    );

    if (broadcastResult.rowCount === 0) return;

    const broadcast = broadcastResult.rows[0];

    // Marcar como 'sending' si estaba 'pending'
    await client.query("UPDATE email_broadcasts SET status = 'sending' WHERE id = $1", [broadcast.id]);

    // 2. Obtener un lote de destinatarios pendientes de forma segura (Locking)
    const recipientsResult = await client.query(
      `SELECT ebr.id, u.email, u.id as user_id
       FROM email_broadcast_recipients ebr
       JOIN users u ON ebr.user_id = u.id
       WHERE ebr.broadcast_id = $1 AND ebr.status = 'pending'
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [broadcast.id, BATCH_SIZE]
    );

    if (recipientsResult.rowCount === 0) {
      // Si no quedan más pendientes, marcar broadcast como completado
      await client.query("UPDATE email_broadcasts SET status = 'completed' WHERE id = $1", [broadcast.id]);
      return;
    }

    // 3. Enviar correos de forma secuencial o controlada
    for (const recipient of recipientsResult.rows) {
      try {
        await sendAnnouncementEmail({
          toEmail: recipient.email,
          subject: broadcast.subject,
          title: broadcast.title,
          bodyHtml: broadcast.body,
          buttonText: broadcast.button_text,
          buttonUrl: broadcast.button_url
        });

        // Actualizar estado del destinatario a 'sent'
        await client.query(
          "UPDATE email_broadcast_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1",
          [recipient.id]
        );

        // Incrementar contador exitoso en el broadcast
        await client.query(
          "UPDATE email_broadcasts SET sent_count = sent_count + 1 WHERE id = $1",
          [broadcast.id]
        );

      } catch (err) {
        console.error(`Error enviando broadcast ${broadcast.id} a ${recipient.email}:`, err);

        // Marcar como fallido con error
        await client.query(
          "UPDATE email_broadcast_recipients SET status = 'failed', error_message = $1 WHERE id = $2",
          [err.message, recipient.id]
        );

        // Incrementar contador de fallos
        await client.query(
          "UPDATE email_broadcasts SET failed_count = failed_count + 1 WHERE id = $1",
          [broadcast.id]
        );
      }
    }

  } catch (error) {
    console.error("Error crítico en processPendingBroadcasts:", error.message || error);
  } finally {
    // Liberamos el cliente si se instanció correctamente, previniendo leaks de conexiones
    if (client) {
      client.release();
    }
  }
}

/**
 * Sends a governance-related email with the same branding as OTP/transaction emails.
 * Used for: vote requests, approvals, rejections, executions, reminders.
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.title - Main heading (e.g. "Nueva Solicitud de Gobernanza")
 * @param {string} params.body - Main descriptive paragraph
 * @param {string} [params.actionUrl] - CTA button URL
 * @param {string} [params.actionText] - CTA button label (default "Ver en Panel")
 * @param {Array<{label: string, value: string}>} [params.details] - Key-value detail rows
 * @param {'info'|'success'|'warning'|'danger'} [params.severity] - Visual accent color
 */
async function sendGovernanceEmail({
  toEmail,
  subject,
  title,
  body,
  details = [],
  actionText,
  actionUrl,
  severity = 'info',
  recentChanges = [],
}) {
  const email = normalizeEmail(toEmail);

  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV GOVERNANCE EMAIL] Email: ${email} | Subject: ${subject}`);
    return;
  }

  const accentColors = {
    info: BRAND_PRIMARY_COLOR || '#0B5FFF',
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
  };
  const accent = accentColors[severity] || BRAND_PRIMARY_COLOR || '#0B5FFF';

  const detailsRows = details.length > 0 ? details.map(d => `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #EEF2F6; color:#667085; font-size:14px; vertical-align:top; width:38%;">${escapeHtml(d.label)}</td>
      <td style="padding:10px 0; border-bottom:1px solid #EEF2F6; color:#101828; font-size:14px; font-weight:500; text-align:right; word-break:break-word; overflow-wrap:anywhere;">${escapeHtml(d.value)}</td>
    </tr>
  `).join('') : '';

  const buttonBlock = actionUrl ? `
    <div style="text-align:center; margin:24px 0 0 0;">
      <a href="${escapeHtml(actionUrl)}" style="display:inline-block; padding:12px 28px; background:${accent}; color:#FFFFFF; text-decoration:none; border-radius:8px; font-weight:700; font-size:14px; font-family:Arial,sans-serif;">${escapeHtml(actionText || 'Ver en Plataforma')}</a>
    </div>
  ` : '';

  const recentChangesBlock = recentChanges.length > 0 ? `
    <div style="margin:20px 0 0 0; padding:16px; background:#F0F4FF; border:1px solid #D0D9F0; border-radius:12px;">
      <p style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:#1E3A5F;">
        Últimos ${recentChanges.length} cambios de configuración:
      </p>
      <table width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:12px; color:#344054;">
        <tr style="border-bottom:1px solid #D0D9F0;">
          <td style="padding:6px 4px; font-weight:600; color:#667085;">Configuración</td>
          <td style="padding:6px 4px; font-weight:600; color:#667085;">Valor</td>
          <td style="padding:6px 4px; font-weight:600; color:#667085;">Actor</td>
          <td style="padding:6px 4px; font-weight:600; color:#667085;">Fecha</td>
        </tr>
        ${recentChanges.map(c => `
        <tr style="border-bottom:1px solid #EEF2F6;">
          <td style="padding:6px 4px; font-size:11px;">${escapeHtml(c.key)}</td>
          <td style="padding:6px 4px; font-size:11px;">${escapeHtml(String(c.value).substring(0, 50))}</td>
          <td style="padding:6px 4px; font-size:11px;">${escapeHtml(c.actor)}${c.viaGovernance ? ' <span style="color:#059669;">(gov)</span>' : ''}</td>
          <td style="padding:6px 4px; font-size:11px; white-space:nowrap;">${escapeHtml(c.date)}</td>
        </tr>
        `).join('')}
      </table>
      <p style="margin:8px 0 0 0; font-size:11px; color:#667085; font-style:italic;">
        Revisa si detectas patrones inusuales o cambios no autorizados.
      </p>
    </div>
  ` : '';

  const govBodyHtml = `
    <div style="height:4px; background:${accent}; border-radius: 4px; margin-bottom: 16px;"></div>
    <h1 style="margin:0 0 10px 0; font-size:20px; line-height:28px; font-weight:700;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 18px 0; font-size:14px; line-height:22px; color:#344054;">
      ${escapeHtml(body).replace(/\n/g, '<br />')}
    </p>
    ${detailsRows ? `<div style="margin:0 0 16px 0; padding:16px; background:#F8FAFC; border:1px solid #EEF2F6; border-radius:12px;"><table width="100%" cellspacing="0" cellpadding="0" border="0">${detailsRows}</table></div>` : ''}
    ${buttonBlock}
    ${recentChangesBlock}
  `;

  const htmlBody = buildMasterEmailWrapper({
    subject,
    contextLabel: 'Winton-Consensus',
    bodyHtml: govBodyHtml,
    accentColor: accent
  });

  const recentChangesText = recentChanges.length > 0
    ? [
        '',
        `Últimos ${recentChanges.length} cambios de configuración:`,
        ...recentChanges.map(c => `  • ${c.key} = ${String(c.value).substring(0, 50)} | ${c.actor}${c.viaGovernance ? ' (gov)' : ''} | ${c.date}`),
        'Revisa si detectas patrones inusuales.',
      ]
    : [];

  const textBody = [
    title,
    '─'.repeat(50),
    body,
    '',
    ...details.map(d => `${d.label}: ${d.value}`),
    ...recentChangesText,
    buildMasterTextFooter()
  ].join('\n');

  const cmd = new SendEmailCommand({
    Source: `${SES_FROM_NAME} <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: textBody, Charset: 'UTF-8' },
        Html: { Data: htmlBody, Charset: 'UTF-8' },
      },
    },
  });

  await getSesClient().send(cmd);
}

/**
 * Envía un correo HTML personalizado envolviéndolo en el Layout Máster No-Reply
 */
async function sendCustomEmail(toEmail, subject, htmlBody, contextLabel = 'Notificación') {
  const email = normalizeEmail(toEmail);
  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV MAIL] To: ${email} | Subject: ${subject} (SES no configurado)`);
    return;
  }

  // Si el htmlBody no contiene ya la estructura html completa, se envuelve en el Layout Máster
  const wrappedHtml = htmlBody.includes('<!doctype html>') || htmlBody.includes('<html')
    ? htmlBody
    : buildMasterEmailWrapper({ subject, contextLabel, bodyHtml: htmlBody });

  const cmd = new SendEmailCommand({
    Source: `${SES_FROM_NAME} <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: wrappedHtml, Charset: 'UTF-8' },
      },
    },
  });

  await getSesClient().send(cmd);
}

/**
 * Carga una plantilla desde la base de datos `email_templates`, interpola sus variables {{var}},
 * la envuelve en el Layout Máster Corporativo No-Reply y la envía.
 * 
 * @param {Object} params
 * @param {Object} params.pool - Pool de conexión a PostgreSQL
 * @param {string} params.templateKey - Clave de la plantilla (ej: 'otp_verification', 'sos_victim_registered')
 * @param {string} params.toEmail - Correo del destinatario
 * @param {Object} params.variables - Objeto clave-valor para interpolación dinámicas {{var}}
 * @param {string} [params.contextLabel] - Etiqueta de cabecera en el email
 */
async function sendTemplatedEmail({ pool, templateKey, toEmail, variables = {}, contextLabel }) {
  const email = normalizeEmail(toEmail);

  // 1. Obtener la plantilla desde la base de datos
  let template = null;
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT subject, body_html, category FROM email_templates WHERE template_key = $1 AND is_active = TRUE',
        [templateKey]
      );
      if (res.rowCount > 0) {
        template = res.rows[0];
      }
    } catch (err) {
      console.error(`[EMAIL SERVICE] Error cargando plantilla ${templateKey}:`, err.message);
    }
  }

  // Si no se encuentra en DB, notificamos error pero no tumbamos la app
  if (!template) {
    console.warn(`[EMAIL SERVICE] Plantilla '${templateKey}' no encontrada en DB. Usando envío alternativo o fallback.`);
    return false;
  }

  // 2. Interpolación estricta de variables {{variable}} (Sanitizada contra inyecciones)
  let renderedSubject = template.subject;
  let renderedBody = template.body_html;

  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    const safeVal = escapeHtml(String(val !== undefined && val !== null ? val : ''));
    renderedSubject = renderedSubject.replace(regex, safeVal);
    renderedBody = renderedBody.replace(regex, safeVal);
  }

  // 3. Etiqueta contextual por omisión según la categoría
  const categoryLabels = {
    seguridad: 'Verificación de cuenta',
    finanzas: 'Recibo de transacción',
    comunicados: 'Comunicado Oficial',
    gobernanza: 'Winton-Consensus',
    reclutamiento: 'Talento & Reclutamiento',
    sos_venezuela: 'SOS Venezuela Humanitario'
  };
  const label = contextLabel || categoryLabels[template.category] || 'Notificación Oficial';

  // 4. Ensamblado con Layout Máster Corporativo No-Reply
  const finalHtml = buildMasterEmailWrapper({
    subject: renderedSubject,
    contextLabel: label,
    bodyHtml: renderedBody
  });

  // 5. Envío vía AWS SES
  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV TEMPLATE MAIL] Key: ${templateKey} | To: ${email} | Subject: ${renderedSubject}`);
    return true;
  }

  const cmd = new SendEmailCommand({
    Source: `${SES_FROM_NAME} <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: renderedSubject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: finalHtml, Charset: 'UTF-8' },
        Text: { Data: renderedSubject + '\n\n' + buildMasterTextFooter(), Charset: 'UTF-8' }
      },
    },
  });

  await getSesClient().send(cmd);
  return true;
}

module.exports = {
  generateOtp6,
  hashOtpForEmail,
  safeEqualHex,
  sendOtpEmail,
  sendTransactionEmail,
  sendAnnouncementEmail,
  sendGovernanceEmail,
  sendCustomEmail,
  sendTemplatedEmail,
  buildMasterEmailWrapper,
  processPendingBroadcasts,
  normalizeEmail
};

