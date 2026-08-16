// ============================================================================
// WintonCoin - Módulo Centralizado de Billetera (walletService.js)
// ============================================================================
// Provee utilidades puras y funciones seguras para el formateo numérico,
// parsing de saldos, cálculo de métricas crediticias y sincronización
// de balances bajo el principio de Zero-Trust.
// ============================================================================

/**
 * Formatea un saldo numérico a formato con localización española (es-ES)
 * con 4 decimales obligatorios, separando la parte decimal en un span para
 * estilización visual de alta fidelidad.
 * 
 * @param {number|string} value - El monto o valor numérico a formatear
 * @returns {string} Cadena HTML formateada (ej: "1.250,<span class=\"decimal-part\">0000</span>")
 */
export function formatBalance(value) {
    // Convertir de forma segura a número o asumir 0 en caso de valor nulo/indefinido
    const num = Number(value) || 0;
    
    // Aplicar localización española: punto para miles, coma para decimales
    const formattedString = num.toLocaleString('es-ES', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
    });
    
    // Dividir entre parte entera y parte decimal
    const parts = formattedString.split(',');
    if (parts.length === 2) {
        return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
    }
    
    return formattedString;
}

/**
 * Formatea un saldo retornando solo texto plano (sin etiquetas HTML),
 * ideal para atributos aria-label, títulos o cálculos de logging.
 * 
 * @param {number|string} value - El monto a formatear
 * @returns {string} Cadena en texto plano (ej: "1.250,0000")
 */
export function formatBalancePlain(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('es-ES', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
    });
}

/**
 * Parsea de forma segura cualquier cadena de balance formateada (soportando
 * formatos europeos con coma o americanos con punto) a un número flotante nativo.
 * 
 * @param {string} text - El texto del balance a parsear
 * @returns {number} Valor numérico en float
 */
export function parseFormattedBalance(text) {
    if (!text) return 0;
    
    // Remover cualquier carácter que no sea dígito, punto o coma
    let cleaned = text.replace(/[^\d.,]/g, '');
    
    // Contar ocurrencias de puntos y comas
    const dots = (cleaned.match(/\./g) || []).length;
    const commas = (cleaned.match(/,/g) || []).length;

    if (dots > 1 || (dots === 1 && commas === 1 && cleaned.indexOf('.') < cleaned.indexOf(','))) {
        // Formato europeo: 1.952.340,0000 (puntos como separador de miles, coma como decimal)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (commas > 1 || (commas === 1 && dots === 1 && cleaned.indexOf(',') < cleaned.indexOf('.'))) {
        // Formato americano: 1,952,340.0000 (comas como separador de miles, punto como decimal)
        cleaned = cleaned.replace(/,/g, '');
    } else if (commas === 1 && dots === 0) {
        // Formato decimal con coma simple: 1952340,0000
        cleaned = cleaned.replace(',', '.');
    }
    
    return parseFloat(cleaned) || 0;
}

/**
 * Calcula las métricas crediticias clave de la billetera RED y BLUE
 * a partir del payload devuelto por el backend.
 * 
 * @param {Object} data - Objeto de respuesta del endpoint /api/me/balance
 * @returns {Object} Métricas calculadas { blueAvailable, blueEscrow, redDebt, redLimit, redAvailable }
 */
export function calculateCreditMetrics(data) {
    if (!data) {
        return {
            blueAvailable: 0,
            blueEscrow: 0,
            redDebt: 0,
            redLimit: 0,
            redAvailable: 0
        };
    }
    
    const blueAvailable = parseFloat(data.blue_balance) || 0;
    const blueEscrow = parseFloat(data.escrow_blue_balance) || 0;
    const redDebt = parseFloat(data.red_balance) || 0;
    const redLimit = parseFloat(data.credit_limit) || 0;
    const redAvailable = Math.max(0, redLimit - redDebt);
    
    return {
        blueAvailable,
        blueEscrow,
        redDebt,
        redLimit,
        redAvailable
    };
}
