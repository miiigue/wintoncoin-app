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
const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL || '';

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
              <td style="padding:22px 24px; border-bottom:1px solid #EEF2F6;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" style="font-family: Arial, sans-serif;">
                      ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="${safeBrandName}" height="96" style="display:block; height:96px; width:96px; max-height:96px; max-width:96px;">` : `<div style="font-size:16px; font-weight:700; color:#0B1220;">${safeBrandName}</div>`}
                    </td>
                    <td align="right" style="font-family: Arial, sans-serif; font-size:12px; color:#667085;">
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

module.exports = {
    generateOtp6,
    hashOtpForEmail,
    safeEqualHex,
    sendOtpEmail,
    normalizeEmail
};
