const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '../server.js');
let content = fs.readFileSync(serverFile, 'utf8');

function extractBlockRegex(startRegex, endRegex) {
    const startMatch = content.match(startRegex);
    if (!startMatch) throw new Error("No encontré start: " + startRegex);
    const startIndex = startMatch.index;

    const restOfContent = content.substring(startIndex + startMatch[0].length);
    const endMatch = restOfContent.match(endRegex);
    if (!endMatch) throw new Error("No encontré end: " + endRegex);

    // endIndex depends on whether we want to INCLUDE the matched end text or just up to it.
    // We want to INCLUDE the matched end text so we remove it from server.js
    const endIndex = startIndex + startMatch[0].length + endMatch.index + endMatch[0].length;

    const extracted = content.substring(startIndex, endIndex);
    content = content.substring(0, startIndex) + content.substring(endIndex);
    return extracted;
}

// 1. Extraer Funciones de Motor 
const cooldown = extractBlockRegex(
    /function resolveRepeatCooldownHours\(body\) \{/,
    /return totalMinutes \/ 60;\r?\n\s*\}/
);

const booster = extractBlockRegex(
    /\/\/ --- NUEVA FUNCIÓN HELPER PARA ACTUALIZAR EL NIVEL DE UN IMPULSOR ---\r?\nasync function updateUserBoosterLevel\(client, userId\) \{/,
    /console\.log.*?\r?\n\s*\}/
);

const helpers = extractBlockRegex(
    /\/\*\*\r?\n\s*\*\s*Helper para determinar el usuario responsable de la deuda RED/,
    /return \{ success: true, message: resultMessage \};\r?\n\}/
);

// 2. Extraer TODAS las rutas de publicaciones
const endpoints = extractBlockRegex(
    /\/\/ Ruta para crear una nueva Publicación\r?\n\s*app\.post\('\/publish',/,
    /res\.status\(error\.status \|\| 500\)\.json\(\{ message: error\.message \|\| "Error crítico en la transacción\." \}\);\r?\n\s*\} finally \{\r?\n\s*if \(client\) client\.release\(\);\r?\n\s*\}\r?\n\s*\}\);/
);

const singlePub = extractBlockRegex(
    /\/\/ --- NUEVO: Endpoint para obtener los detalles completos de UNA SOLA publicación ---\r?\napp\.get\('\/api\/publications\/:id',/,
    /res\.status\(500\)\.json\(\{ message: "Error interno del servidor al obtener los detalles de la publicación\." \}\);\r?\n\s*\} finally \{\r?\n\s*client\.release\(\);\r?\n\s*\}\r?\n\}\);/
);


// Formatear controladores
const cleanEndpoints = endpoints.replace(/app\.(post|get|put|delete|patch)/g, 'router.$1');
const cleanSinglePub = singlePub.replace(/app\.(post|get|put|delete|patch)/g, 'router.$1');

const controllerContent = `// ============================================================================
// src/controllers/publicationController.js
// ============================================================================

const { 
    resolveRepeatCooldownHours,
    updateUserBoosterLevel,
    processRequestPayment,
    processDirectPaymentCompletion
} = require('../services/publicationService');

module.exports = function(router, pool, requireAcceptedLegalByUsernameField, verifyAdminToken, logAuditEvent) {

${cleanEndpoints}

${cleanSinglePub}

};
`;
fs.writeFileSync(path.join(__dirname, '../src/controllers/publicationController.js'), controllerContent);

// Crear publicationRoutes.js
const routesContent = `// ============================================================================
// src/routes/publicationRoutes.js
// ============================================================================

const express = require('express');
const publicationController = require('../controllers/publicationController');

module.exports = function(pool, requireAcceptedLegalByUsernameField, verifyAdminToken, logAuditEvent) {
    const router = express.Router();
    publicationController(router, pool, requireAcceptedLegalByUsernameField, verifyAdminToken, logAuditEvent);
    return router;
};
`;
fs.writeFileSync(path.join(__dirname, '../src/routes/publicationRoutes.js'), routesContent);


// 4. Modificar content de server.js
content = content.replace(
    /const \{\r?\n\s*requireAcceptedLegalForAuthenticatedUser,\r?\n\s*requireAcceptedLegalByUsernameField\r?\n\} = require\('\.\/src\/middleware\/legalAcceptanceMiddleware'\);/,
    `const {
    requireAcceptedLegalForAuthenticatedUser,
    requireAcceptedLegalByUsernameField
} = require('./src/middleware/legalAcceptanceMiddleware');

// === SERVICIOS Y RUTAS MODULARIZADOS NUEVAS ===
const { 
    resolveRepeatCooldownHours, 
    updateUserBoosterLevel,
    getDebtResponsibleUser,
    getDebtResponsibleUserById,
    processRequestCompletion,
    processRequestPayment,
    processDirectPaymentCompletion
} = require('./src/services/publicationService');
const publicationRoutes = require('./src/routes/publicationRoutes');`
);

content = content.replace(
    /\/\/ --- AHORA DEFINIMOS LAS RUTAS ---\r?\n\s*app\.use\('\/api', authRoutes\);/,
    `// --- AHORA DEFINIMOS LAS RUTAS ---
        app.use('/api', authRoutes); // Registrar rutas de autenticación
        
        // Registrar rutas de Publicaciones
        app.use('/', publicationRoutes(pool, requireAcceptedLegalByUsernameField, verifyAdminToken, logAuditEvent));`
);


// Crear publicationService.js usando los extractos
const serviceContent = `// ============================================================================
// src/services/publicationService.js
// ============================================================================

const pool = require('../config/db');
const { sendTransactionEmail } = require('./emailService');
const logAuditEvent = require('./auditService');

${cooldown}

${booster}

${helpers}

module.exports = {
    resolveRepeatCooldownHours,
    updateUserBoosterLevel,
    getDebtResponsibleUser,
    getDebtResponsibleUserById,
    processRequestCompletion,
    processRequestPayment,
    processDirectPaymentCompletion
};
`;
fs.writeFileSync(path.join(__dirname, '../src/services/publicationService.js'), serviceContent);

fs.writeFileSync(serverFile, content);

console.log("¡Todo extraído e inyectado con precisión final!");
