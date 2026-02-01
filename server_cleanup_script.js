const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'backend', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Agregar el import de authRoutes al inicio
const importMarker = "const { logAuditEvent, startAuditCleanupJob } = require('./src/services/auditService');";
const newImport = "const authRoutes = require('./src/routes/authRoutes');";

if (!content.includes(newImport)) {
    content = content.replace(importMarker, `${importMarker}\n${newImport}`);
}

// 2. Eliminar toda la lógica antigua de Auth (Desde check-email hasta login)
// Usamos marcadores de texto conocidos para recortar el bloque gigante
const startMarker = "// Endpoint to check if email exists (UX Improvement)";
const endMarker = "// NUEVO: Endpoint para reenviar el código de verificación\n        app.post('/api/auth/resend-code'";

// Buscamos manualmente el final del bloque de resend-code para cortar hasta el final de esa función
const resendCodeEnd = "finally {\n                client.release();\n            }\n        });";

// Estrategia: Cortar desde 'startMarker' hasta antes del siguiente bloque de rutas (ej. User Management)
// O mejor: Reemplazar cada bloque por separado para ser mas precisos.

// Bloque 1: Check Email & Phone & Pending
const block1Start = "// Endpoint to check if email exists (UX Improvement)";
const block1End = "app.post('/api/auth/pending-status', async (req, res) => {";
// Buscar el final de pending-status function
// Esto es peligroso hacerlo con regex en un archivo tan grande.

// Plan B: Reemplazo por bloques conocidos exactos (String Replacement)
// Vamos a usar 'replace' con el contenido exacto que sabemos que existe.

// Para mayor seguridad en esta operación delicada, usaré start/end lines aproximados basados en la lectura anterior,
// pero dinámicamente buscando el string.

function removeBlock(source, startStr, endStr) {
    const startIndex = source.indexOf(startStr);
    if (startIndex === -1) {
        console.log(`Marker not found: ${startStr}`);
        return source;
    }
    const endIndex = source.indexOf(endStr, startIndex);
    if (endIndex === -1) {
        console.log(`End marker not found: ${endStr}`);
        return source;
    }
    // Buscamos el cierre de la función después del endMarker
    // En este caso, asumimos que endStr ES el final del bloque a borrar.
    return source.substring(0, startIndex) + source.substring(endIndex + endStr.length);
}

// Reemplazar todo el bloque de rutas de Auth con el uso del router
const authRoutesStart = "// Endpoint to check if email exists (UX Improvement)";
// El final es el último endpoint de auth antes de que empiecen otras rutas.
// Mirando el archivo, 'resend-code' era el último de la sección Auth.
const authRoutesEnd = "app.post('/api/auth/resend-code', resendOtpLimiter, async (req, res) => {";

// Encontrar el final real de la función resend-code
const resendCodeSignature = "app.post('/api/auth/resend-code', resendOtpLimiter, async (req, res) => {";
const idxStart = content.indexOf(authRoutesStart);
const idxResend = content.indexOf(resendCodeSignature);

if (idxStart !== -1 && idxResend !== -1) {
    // Buscar el cierre de resend-code
    // Buscamos el próximo "});" seguido de nueva línea y comentarios o espacio
    // Esto es arriesgado.

    // MEJOR ESTRATEGIA:
    // Voy a reemplazar el bloque ENTERO detectado en 'view_file' paso a paso usando las herramientas de Antigravity (multi_replace),
    // en lugar de este script ciego. Es más seguro porque Antigravity verifica el contexto.
    console.log("Abortando script automático. Pasando a edición manual segura.");
} else {
    console.log("No se encontraron los marcadores de inicio/fin.");
}
