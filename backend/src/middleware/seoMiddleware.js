const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/db');

// Función de escape para prevenir inyecciones HTML / XSS dentro de los atributos content
function escapeHtmlAttribute(str) {
    if (typeof str !== 'string') return '';
    // Eliminar saltos de línea para que no dañen la estructura visual de las meta tags
    const cleanStr = str.replace(/[\r\n]+/g, ' ').trim();
    return cleanStr
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Middleware de SEO para Causas Solidarias
async function seoMiddlewareCauses(req, res, next) {
    try {
        const { id } = req.query;

        // Validar ID de la causa (debe ser numérico)
        const causeId = parseInt(id, 10);
        if (isNaN(causeId)) {
            // Degradación elegante: pasar al siguiente middleware (servidor estático normal)
            return next();
        }

        // Consultar la causa en base de datos
        const sql = `
            SELECT hc.title, hc.story, hc.evidence_urls
            FROM humanitarian_causes hc
            WHERE hc.id = $1 AND hc.status IN ('pending', 'approved', 'completed')
        `;
        const result = await pool.query(sql, [causeId]);

        if (result.rowCount === 0) {
            return next();
        }

        const cause = result.rows[0];

        // Determinar imagen principal
        let imageUrl = '';
        let evidence = [];
        try {
            evidence = typeof cause.evidence_urls === 'string' 
                ? JSON.parse(cause.evidence_urls) 
                : cause.evidence_urls;
        } catch (e) {
            console.error('[SEO_MIDDLEWARE] Error al parsear evidence_urls:', e);
        }

        if (Array.isArray(evidence) && evidence.length > 0 && evidence[0]) {
            imageUrl = evidence[0];
        }

        // Construir URLs absolutas requeridas por WhatsApp
        const protocol = req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Si la imagen es relativa, prefijarla con el host absoluto
        if (imageUrl && imageUrl.startsWith('/')) {
            imageUrl = `${baseUrl}${imageUrl}`;
        } else if (!imageUrl) {
            // Fallback al logotipo oficial
            imageUrl = `${baseUrl}/assets/logo-high-res.png`;
        }

        const fullUrl = `${baseUrl}/causa-solidaria.html?id=${causeId}`;

        // Leer la plantilla HTML desde el frontend
        const htmlPath = path.join(__dirname, '../../../frontend/causa-solidaria.html');
        let htmlContent = await fs.readFile(htmlPath, 'utf8');

        // Limpiar descripción de la causa (recortar a 150 caracteres para mejor apariencia)
        let cleanStory = cause.story || '';
        if (cleanStory.length > 150) {
            cleanStory = cleanStory.substring(0, 147) + '...';
        }

        // Escapar datos de forma segura
        const escapedTitle = escapeHtmlAttribute(cause.title);
        const escapedStory = escapeHtmlAttribute(cleanStory);
        const escapedImageUrl = escapeHtmlAttribute(imageUrl);
        const escapedFullUrl = escapeHtmlAttribute(fullUrl);

        // Reemplazar etiqueta title
        htmlContent = htmlContent.replace(
            /<title>.*?<\/title>/i, 
            `<title>${escapedTitle} — Winton Solidario</title>`
        );

        // Reemplazar o inyectar etiquetas Open Graph
        const ogTags = `
    <!-- SEO & Open Graph Meta Tags Inyectados Dinámicamente -->
    <meta name="description" content="${escapedStory}">
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedStory}" />
    <meta property="og:image" content="${escapedImageUrl}" />
    <meta property="og:url" content="${escapedFullUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
        `;

        // Colocar etiquetas OG justo después de <!-- SEO Meta Tags -->
        if (htmlContent.includes('<!-- SEO Meta Tags -->')) {
            htmlContent = htmlContent.replace('<!-- SEO Meta Tags -->', `<!-- SEO Meta Tags -->${ogTags}`);
        } else {
            htmlContent = htmlContent.replace('</head>', `${ogTags}\n</head>`);
        }

        // Responder con el contenido HTML modificado
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlContent);

    } catch (error) {
        console.error('[SEO_MIDDLEWARE] Error al procesar Open Graph en causas:', error);
        // Degradación elegante
        return next();
    }
}

// Middleware de SEO para Registro de Referidos
async function seoMiddlewareReferrals(req, res, next) {
    try {
        // Consultar la configuración del banner de referidos
        const sql = `
            SELECT setting_value 
            FROM app_settings 
            WHERE setting_key = 'referral_campaign_image_url'
        `;
        const result = await pool.query(sql);

        let imageUrl = '';
        if (result.rowCount > 0 && result.rows[0].setting_value) {
            imageUrl = result.rows[0].setting_value;
        }

        const protocol = req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Prefijar si la imagen es relativa
        if (imageUrl && imageUrl.startsWith('/')) {
            imageUrl = `${baseUrl}${imageUrl}`;
        } else if (!imageUrl) {
            // Fallback al logotipo oficial
            imageUrl = `${baseUrl}/assets/logo-high-res.png`;
        }

        const referralCode = req.query.ref ? String(req.query.ref) : '';
        const fullUrl = referralCode 
            ? `${baseUrl}/register.html?ref=${referralCode}`
            : `${baseUrl}/register.html`;

        const title = 'Regístrate en WintonCoin';
        const description = referralCode
            ? `Únete a WintonCoin usando mi código '${referralCode}' y obtén BLUE IOU de bienvenida.`
            : 'Regístrate en WintonCoin - La plataforma premium de intercambio de servicios.';

        // Leer plantilla HTML
        const htmlPath = path.join(__dirname, '../../../frontend/register.html');
        let htmlContent = await fs.readFile(htmlPath, 'utf8');

        // Escapar datos
        const escapedTitle = escapeHtmlAttribute(title);
        const escapedDescription = escapeHtmlAttribute(description);
        const escapedImageUrl = escapeHtmlAttribute(imageUrl);
        const escapedFullUrl = escapeHtmlAttribute(fullUrl);

        // Reemplazar etiqueta title
        htmlContent = htmlContent.replace(
            /<title>.*?<\/title>/i, 
            `<title>${escapedTitle}</title>`
        );

        const ogTags = `
    <!-- SEO & Open Graph Meta Tags Inyectados Dinámicamente -->
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:image" content="${escapedImageUrl}" />
    <meta property="og:url" content="${escapedFullUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
        `;

        // Colocar OG en register.html
        if (htmlContent.includes('<!-- PWA Meta Tags -->')) {
            htmlContent = htmlContent.replace('<!-- PWA Meta Tags -->', `<!-- PWA Meta Tags -->${ogTags}`);
        } else {
            htmlContent = htmlContent.replace('</head>', `${ogTags}\n</head>`);
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlContent);

    } catch (error) {
        console.error('[SEO_MIDDLEWARE] Error al procesar Open Graph en referidos:', error);
        return next();
    }
}

module.exports = {
    seoMiddlewareCauses,
    seoMiddlewareReferrals
};
