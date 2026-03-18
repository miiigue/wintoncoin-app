const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const crypto = require('crypto');
require('dotenv').config();

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

async function sendOtpEmail({ toEmail, otp, context = {} }) {
  const email = normalizeEmail(toEmail);

  // Dev fallback: si SES no está configurado, no bloqueamos el registro.
  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV OTP] Email: ${email} OTP: ${otp} (SES no configurado)`);
    return;
  }

  const brandName = SES_FROM_NAME || 'WintonCoin';
  const subject = `Tu código de verificación de ${brandName}`;
  const safeSupportEmail = escapeHtml(SUPPORT_EMAIL);
  const safeBrandPrimary = escapeHtml(BRAND_PRIMARY_COLOR);
  const safeBrandName = escapeHtml(brandName);
  const safeOtp = escapeHtml(otp);
  const safeLogoUrl = BRAND_LOGO_URL ? escapeHtml(BRAND_LOGO_URL) : '';

  // Contexto opcional (ayuda anti-phishing y “fintech feel”)
  const requestedIp = context.ip ? escapeHtml(context.ip) : '';
  const requestedAt = context.requestedAt ? escapeHtml(context.requestedAt) : '';

  const textBody =
    `Tu código de verificación para ${brandName} es: ${otp}\n\n` +
    `Este código expira en 10 minutos.\n\n` +
    (requestedAt ? `Solicitud: ${requestedAt}\n` : '') +
    (requestedIp ? `IP aproximada: ${requestedIp}\n\n` : '\n') +
    `Seguridad: ${brandName} nunca te pedirá este código por teléfono, chat o redes sociales.\n\n` +
    `Si no solicitaste este código, ignora este correo o contacta a soporte: ${SUPPORT_EMAIL}`;

  // HTML “fintech grade” (compatibilidad alta con clientes de correo: tablas + estilos inline)
  const preheader = `Tu código de verificación es ${otp}. Expira en 10 minutos.`;
  const htmlBody = `
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
    <!-- Preheader (texto oculto) -->
    <div style="display:none; font-size:1px; color:#F5F7FB; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${escapeHtml(preheader)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F7FB;">
      <tr>
        <td align="center" style="padding:24px 12px;">

          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px; background:#FFFFFF; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(16,24,40,0.08);">
            <tr>
              <td style="padding:24px 32px; background-color:#0A0F1C; border-bottom:none;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" style="font-family: Arial, sans-serif;">
                      <!-- Logo Pure CSS: Anti-Spam, no se deforma, carga en milisegundos -->
                      <div style="font-size:26px; font-weight:800; letter-spacing:-0.5px; margin:0;">
                        <span style="color:#FFFFFF;">Winton</span><span style="color:${safeBrandPrimary};">Coin</span>
                      </div>
                    </td>
                    <td align="right" style="font-family: Arial, sans-serif; font-size:13px; color:#94A3B8; font-weight:500;">
                      Verificación de cuenta
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px; font-family: Arial, sans-serif; color:#0B1220;">
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

                <div style="margin:0; padding:14px 16px; background:#FFF7ED; border:1px solid #FFEDD5; border-radius:12px;">
                  <p style="margin:0; font-size:12px; line-height:18px; color:#9A3412;">
                    <strong>Consejo de seguridad:</strong> ${safeBrandName} nunca te pedirá este código por teléfono, chat o redes sociales.
                    Si no solicitaste este correo, ignóralo o contacta a soporte.
                  </p>
                </div>

                <p style="margin:18px 0 0 0; font-size:12px; line-height:18px; color:#667085;">
                  Soporte: <a href="mailto:${safeSupportEmail}" style="color:${safeBrandPrimary}; text-decoration:none;">${safeSupportEmail}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px; background:#F8FAFC; border-top:1px solid #EEF2F6; font-family: Arial, sans-serif; font-size:11px; line-height:16px; color:#667085;">
                Este correo fue enviado automáticamente. No respondas a este mensaje.
              </td>
            </tr>
          </table>

          <div style="max-width:600px; margin-top:14px; font-family: Arial, sans-serif; font-size:11px; line-height:16px; color:#98A2B3;">
            © ${new Date().getFullYear()} ${safeBrandName}. Todos los derechos reservados.
          </div>

        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();

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

  const brandName = SES_FROM_NAME || 'WintonCoin';
  const safeBrandName = escapeHtml(brandName);
  const safeLogoUrl = BRAND_LOGO_URL ? escapeHtml(BRAND_LOGO_URL) : '';
  const safeSupportEmail = escapeHtml(SUPPORT_EMAIL);
  const mainColor = BRAND_PRIMARY_COLOR || '#0B5FFF';

  // Generar filas de detalles
  const detailsRows = details.map(d => `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #EEF2F6; color: #667085; font-size: 14px;">
                ${escapeHtml(d.label)}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #EEF2F6; color: #101828; font-size: 14px; font-weight: 500; text-align: right;">
                ${escapeHtml(d.value)}
            </td>
        </tr>
    `).join('');

  const htmlBody = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background:#F5F7FB; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F7FB; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05); max-width: 600px; width: 100%;">
          
          <!-- Encabezado Oscuro Premium -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background-color: #0A0F1C; border-bottom: none;">
               <!-- Logo Pure CSS para máxima entregabilidad -->
               <div style="font-size:32px; font-weight:800; letter-spacing:-0.5px; margin-bottom: 24px;">
                 <span style="color:#FFFFFF;">Winton</span><span style="color:${mainColor};">Coin</span>
               </div>
               <h1 style="margin: 0; font-size: 24px; color: #FFFFFF; font-weight: 700;">${escapeHtml(title)}</h1>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 40px;">
              
              <!-- Monto -->
              <div style="text-align: center; margin-bottom: 32px;">
                <p style="margin: 0 0 8px 0; color: #667085; font-size: 16px;">Monto total</p>
                <div style="font-size: 36px; color: ${mainColor}; font-weight: 800; letter-spacing: -0.5px;">${escapeHtml(amount)}</div>
              </div>

              <!-- Mensaje -->
              <p style="margin: 0 0 24px 0; color: #344054; font-size: 16px; line-height: 24px; text-align: center;">
                ${escapeHtml(message)}
              </p>

              <!-- Tabla de Detalles -->
              <div style="background: #F9FAFB; border-radius: 12px; padding: 24px;">
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  ${detailsRows}
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background: #F9FAFB; border-top: 1px solid #F2F4F7; text-align: center;">
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #667085; line-height: 18px;">
                Si tienes alguna pregunta sobre esta transacción, contacta a nuestro equipo de soporte en <a href="mailto:${safeSupportEmail}" style="color:${mainColor}; text-decoration:none;">${safeSupportEmail}</a>.
              </p>
              <p style="margin: 0; font-size: 12px; color: #98A2B3;">
                © ${new Date().getFullYear()} ${safeBrandName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

  // Versión texto plano simplificada
  const textBody = `
${title}
----------------------------------------
Monto: ${amount}

${message}

Detalles:
${details.map(d => `${d.label}: ${d.value}`).join('\n')}

Si necesitas ayuda, contacta a ${SUPPORT_EMAIL}.
    `.trim();

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

  const safeBrandName = SES_FROM_NAME || 'WintonCoin';
  const mainColor = '#0052FF'; // Azul corporativo
  const safeLogoUrl = process.env.BRAND_LOGO_URL || '';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { padding: 40px; text-align: center; background-color: #0A0F1C; }
        .logo { height: 50px; width: auto; max-width: 100%; margin-bottom: 24px; object-fit: contain; }
        .content { padding: 40px; }
        .title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 24px; }
        .title-dark-bg { font-size: 24px; font-weight: 700; color: #FFFFFF; margin-bottom: 24px; }
        .body-text { font-size: 16px; color: #4b5563; margin-bottom: 32px; }
        .button { display: inline-block; padding: 14px 28px; background-color: ${mainColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
        .footer { padding: 32px 40px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center; }
        .footer-text { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
        .security-box { background-color: #f0f7ff; border: 1px dashed #0052FF; padding: 20px; border-radius: 8px; margin-top: 32px; text-align: left; }
        .security-title { font-weight: 700; color: #0052FF; font-size: 14px; margin-bottom: 8px; display: block; }
        .security-text { font-size: 12px; color: #1e40af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <!-- Logo Pure CSS: Anti-Spam y Alta Carga -->
          <div style="font-size:32px; font-weight:800; letter-spacing:-0.5px; margin-bottom: 24px;">
            <span style="color:#FFFFFF;">Winton</span><span style="color:${mainColor};">Coin</span>
          </div>
          <div class="title-dark-bg">${escapeHtml(title)}</div>
        </div>
        <div class="content">
          <div class="body-text">${bodyHtml.replace(/\n/g, '<br>')}</div>
          
          ${buttonText && buttonUrl ? `
            <div style="text-align: center; margin: 40px 0;">
              <a href="${buttonUrl}" class="button">${escapeHtml(buttonText)}</a>
            </div>
          ` : ''}

          <div class="security-box">
             <span class="security-title">🛡️ Recordatorio de Seguridad</span>
             <p class="security-text">
               WintonCoin <strong>NUNCA</strong> te pedirá tu contraseña o claves privadas por correo. 
               Si notas algo sospechoso, repórtalo a support@wintoncoin.com.
             </p>
          </div>
        </div>
        <div class="footer">
          <p class="footer-text">© ${new Date().getFullYear()} ${safeBrandName}. Todos los derechos reservados.</p>
          <p class="footer-text">
            Soporte: <a href="mailto:support@wintoncoin.com" style="color: #6b7280; text-decoration: underline;">support@wintoncoin.com</a>
          </p>
          <p class="footer-text">Este es un comunicado oficial de servicio enviado a ${toEmail}.</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  const textBody = `${title}\n\n${subject}\n\n${bodyHtml.replace(/<[^>]*>?/gm, '')}\n\nSeguridad: Recordad que nunca pedimos contraseñas.`.trim();

  const cmd = new SendEmailCommand({
    Source: `${SES_FROM_NAME} <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [toEmail] },
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
 * Procesa una tanda de correos electrónicos pendientes en la cola de difusiones.
 * Esta función es el "Worker" que asegura que no saturemos AWS SES y sea auditable.
 */
async function processPendingBroadcasts(pool) {
  const BATCH_SIZE = 20; // Enviar de 20 en 20 para mayor velocidad sin saturar SES (sandbox)
  const client = await pool.connect();

  try {
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
    console.error("Error crítico en processPendingBroadcasts:", error);
  } finally {
    client.release();
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
async function sendGovernanceEmail({ toEmail, subject, title, body, actionUrl, actionText = 'Ver en Panel', details = [], severity = 'info', recentChanges = [] }) {
  const email = normalizeEmail(toEmail);

  if (!AWS_REGION || !SES_FROM_EMAIL) {
    console.warn(`[DEV GOV-EMAIL] ${email}: ${subject}`);
    return;
  }

  const brandName = SES_FROM_NAME || 'WintonCoin';
  const safeBrandName = escapeHtml(brandName);
  const safeLogoUrl = BRAND_LOGO_URL ? escapeHtml(BRAND_LOGO_URL) : '';
  const safeSupportEmail = escapeHtml(SUPPORT_EMAIL);
  const safeBrandPrimary = escapeHtml(BRAND_PRIMARY_COLOR);

  const accentColors = {
    info: BRAND_PRIMARY_COLOR,
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
  };
  const accent = accentColors[severity] || BRAND_PRIMARY_COLOR;

  const detailsRows = details.map(d => `
                  <tr>
                    <td style="padding:10px 0; border-bottom:1px solid #EEF2F6; color:#667085; font-size:14px;">${escapeHtml(d.label)}</td>
                    <td style="padding:10px 0; border-bottom:1px solid #EEF2F6; color:#101828; font-size:14px; font-weight:500; text-align:right;">${escapeHtml(d.value)}</td>
                  </tr>
  `).join('');

  const buttonBlock = actionUrl ? `
                <div style="text-align:center; margin:24px 0 0 0;">
                  <a href="${escapeHtml(actionUrl)}" style="display:inline-block; padding:12px 28px; background:${accent}; color:#FFFFFF; text-decoration:none; border-radius:8px; font-weight:700; font-size:14px; font-family:Arial,sans-serif;">${escapeHtml(actionText)}</a>
                </div>
  ` : '';

  const preheader = `${title} — ${subject}`;
  const htmlBody = `
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
    <!-- Preheader (texto oculto) -->
    <div style="display:none; font-size:1px; color:#F5F7FB; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${escapeHtml(preheader)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F7FB;">
      <tr>
        <td align="center" style="padding:24px 12px;">

          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px; background:#FFFFFF; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(16,24,40,0.08);">
            <!-- Barra de severidad -->
            <tr>
              <td style="padding:0; height:4px; background:${accent};"></td>
            </tr>

            <!-- Header: Cabecera Oscura y Logo CSS -->
            <tr>
              <td style="padding:24px 32px; background-color:#0A0F1C; border-bottom:none;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" style="font-family: Arial, sans-serif;">
                      <!-- Logo Pure CSS: Anti-Spam y Alta Carga -->
                      <div style="font-size:26px; font-weight:800; letter-spacing:-0.5px; margin:0;">
                        <span style="color:#FFFFFF;">Winton</span><span style="color:${safeBrandPrimary};">Coin</span>
                      </div>
                    </td>
                    <td align="right" style="font-family: Arial, sans-serif; font-size:13px; color:#94A3B8; font-weight:500;">
                      Sistema de Gobernanza
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Contenido principal -->
            <tr>
              <td style="padding:24px; font-family: Arial, sans-serif; color:#0B1220;">
                <h1 style="margin:0 0 10px 0; font-size:20px; line-height:28px; font-weight:700;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 18px 0; font-size:14px; line-height:22px; color:#344054;">
                  ${escapeHtml(body)}
                </p>

                ${details.length > 0 ? `
                <div style="margin:0 0 16px 0; padding:16px; background:#F8FAFC; border:1px solid #EEF2F6; border-radius:12px;">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0">
                    ${detailsRows}
                  </table>
                </div>
                ` : ''}

                ${buttonBlock}

                ${recentChanges.length > 0 ? `
                <div style="margin:20px 0 0 0; padding:16px; background:#F0F4FF; border:1px solid #D0D9F0; border-radius:12px;">
                  <p style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:#1E3A5F;">
                    Últimos ${recentChanges.length} cambios de configuración:
                  </p>
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:12px; color:#344054;">
                    <tr style="border-bottom:1px solid #D0D9F0;">
                      <td style="padding:6px 4px; font-weight:600; color:#667085;">Clave</td>
                      <td style="padding:6px 4px; font-weight:600; color:#667085;">Valor</td>
                      <td style="padding:6px 4px; font-weight:600; color:#667085;">Actor</td>
                      <td style="padding:6px 4px; font-weight:600; color:#667085;">Fecha</td>
                    </tr>
                    ${recentChanges.map(c => `
                    <tr style="border-bottom:1px solid #EEF2F6;">
                      <td style="padding:6px 4px; font-size:11px;">${escapeHtml(c.key)}</td>
                      <td style="padding:6px 4px; font-size:11px;">${escapeHtml(String(c.value).substring(0, 30))}</td>
                      <td style="padding:6px 4px; font-size:11px;">${escapeHtml(c.actor)}${c.viaGovernance ? ' <span style="color:#059669;">(gov)</span>' : ''}</td>
                      <td style="padding:6px 4px; font-size:11px; white-space:nowrap;">${escapeHtml(c.date)}</td>
                    </tr>
                    `).join('')}
                  </table>
                  <p style="margin:8px 0 0 0; font-size:11px; color:#667085; font-style:italic;">
                    Revisa si detectas patrones inusuales o cambios no autorizados.
                  </p>
                </div>
                ` : ''}

                <!-- Caja de seguridad (mismos colores que OTP) -->
                <div style="margin:18px 0 0 0; padding:14px 16px; background:#FFF7ED; border:1px solid #FFEDD5; border-radius:12px;">
                  <p style="margin:0; font-size:12px; line-height:18px; color:#9A3412;">
                    <strong>Consejo de seguridad:</strong> ${safeBrandName} nunca te pedirá contraseñas ni códigos de recuperación por teléfono, chat o redes sociales.
                    Si no esperabas este correo, ignóralo o contacta a soporte.
                  </p>
                </div>

                <p style="margin:18px 0 0 0; font-size:12px; line-height:18px; color:#667085;">
                  Soporte: <a href="mailto:${safeSupportEmail}" style="color:${safeBrandPrimary}; text-decoration:none;">${safeSupportEmail}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 24px; background:#F8FAFC; border-top:1px solid #EEF2F6; font-family: Arial, sans-serif; font-size:11px; line-height:16px; color:#667085;">
                Este correo fue enviado automáticamente por el sistema Winton-Consensus. No respondas a este mensaje.
              </td>
            </tr>
          </table>

          <!-- Copyright fuera de la card -->
          <div style="max-width:600px; margin-top:14px; font-family: Arial, sans-serif; font-size:11px; line-height:16px; color:#98A2B3;">
            &copy; ${new Date().getFullYear()} ${safeBrandName}. Todos los derechos reservados.
          </div>

        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();

  const recentChangesText = recentChanges.length > 0
    ? [
        '',
        `Últimos ${recentChanges.length} cambios de configuración:`,
        ...recentChanges.map(c => `  • ${c.key} = ${String(c.value).substring(0, 30)} | ${c.actor}${c.viaGovernance ? ' (gov)' : ''} | ${c.date}`),
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
    '',
    `Seguridad: ${brandName} nunca te pedirá contraseñas ni códigos de recuperación por correo.`,
    `Soporte: ${SUPPORT_EMAIL}`,
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

module.exports = {
  generateOtp6,
  hashOtpForEmail,
  safeEqualHex,
  sendOtpEmail,
  sendTransactionEmail,
  sendAnnouncementEmail,
  sendGovernanceEmail,
  processPendingBroadcasts,
  normalizeEmail
};
