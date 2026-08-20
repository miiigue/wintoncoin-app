/**
 * ============================================================================
 * WintonCoin - Módulo de Ordenamiento de Tablas Estilo Binance (tableSort.js)
 * ============================================================================
 * Este módulo proporciona una solución modular, reactiva y reutilizable (DRY)
 * para ordenar cualquier tabla de datos del panel administrativo y la plataforma.
 * 
 * Cumple con los estándares de ingeniería:
 * 1. Zero-Trust & Ciberseguridad: Ordenamiento en memoria en el cliente sin
 *    consultas SQL dinámicas vulnerables a inyecciones.
 * 2. Rendimiento Extremo: 0ms de latencia, respuesta instantánea sin spinners.
 * 3. Diseño Binance Pro: Flechas dobles ▲▼ con estados activo / inactivo / hover.
 * 4. Tipado Inteligente: Manejo exacto de números con decimales, fechas,
 *    textos con tildes y valores booleanos.
 * ============================================================================
 */

/**
 * Normaliza y extrae el valor comparable para ordenamiento según su tipo.
 * 
 * @param {*} value - Valor original a comparar (número, string, fecha, boolean, etc.)
 * @param {string} type - Tipo de dato esperado ('number', 'text', 'date', 'boolean', 'custom')
 * @returns {number|string} Valor normalizado para comparación
 */
export function parseSortValue(value, type = 'text') {
    // Si el valor es nulo o indefinido, retornar valor neutro
    if (value === null || value === undefined) {
        return type === 'number' || type === 'date' || type === 'boolean' ? -Infinity : '';
    }

    switch (type) {
        case 'number': {
            // Si ya es número nativo, verificar que no sea NaN
            if (typeof value === 'number') {
                return Number.isFinite(value) ? value : -Infinity;
            }

            // Convertir a string para sanitizar y parsear
            const strVal = String(value).trim();

            // Si viene en formato "X / Y" (ejemplo participantes: "13 / 100"), ordenar por el primer número (X)
            if (strVal.includes('/')) {
                const parts = strVal.split('/');
                const numerator = parseFloat(parts[0].replace(/\./g, '').replace(',', '.').trim());
                return Number.isFinite(numerator) ? numerator : -Infinity;
            }

            // Manejo de formato español con puntos de miles y comas decimales (ej: "681.710,0000" -> 681710.0)
            const cleanStr = strVal
                .replace(/[^\d.,-]/g, '') // Eliminar símbolos de moneda o texto
                .replace(/\./g, '')       // Eliminar separadores de miles
                .replace(',', '.');       // Convertir coma decimal en punto

            const parsed = parseFloat(cleanStr);
            return Number.isFinite(parsed) ? parsed : -Infinity;
        }

        case 'date': {
            // Si ya es un objeto Date
            if (value instanceof Date) {
                return value.getTime();
            }
            // Si es un timestamp numérico o string ISO
            const time = new Date(value).getTime();
            return Number.isFinite(time) ? time : -Infinity;
        }

        case 'boolean': {
            return value ? 1 : 0;
        }

        case 'text':
        case 'string':
        default: {
            // Normalizar texto eliminando espacios sobrantes y convirtiendo a minúsculas
            return String(value).trim().toLowerCase();
        }
    }
}

/**
 * Ordena un arreglo de objetos in-memory de forma inmutable (retorna un nuevo arreglo).
 * 
 * @param {Array<Object>} dataset - Arreglo original de registros a ordenar
 * @param {string} sortKey - Clave o propiedad del objeto por la cual ordenar
 * @param {'asc'|'desc'} direction - Dirección del ordenamiento ('asc' o 'desc')
 * @param {Object} typeMap - Mapa opcional de tipos por columna { [key]: 'number'|'text'|'date'|'boolean' }
 * @returns {Array<Object>} Nuevo arreglo ordenado
 */
export function sortDataset(dataset, sortKey, direction = 'desc', typeMap = {}) {
    // Validación de seguridad para evitar errores de ejecución
    if (!Array.isArray(dataset) || dataset.length === 0 || !sortKey) {
        return Array.isArray(dataset) ? [...dataset] : [];
    }

    const type = typeMap[sortKey] || 'text';
    const isAsc = direction === 'asc';

    // Clonar el arreglo para no mutar el estado original directamente
    return [...dataset].sort((a, b) => {
        const valA = parseSortValue(a ? a[sortKey] : null, type);
        const valB = parseSortValue(b ? b[sortKey] : null, type);

        // Si es tipo texto, utilizar localeCompare con soporte de lenguaje español y números naturales
        if (type === 'text' || type === 'string') {
            const strA = String(valA);
            const strB = String(valB);
            const comparison = strA.localeCompare(strB, 'es', {
                numeric: true,
                sensitivity: 'base'
            });
            return isAsc ? comparison : -comparison;
        }

        // Para números, fechas y booleanos
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });
}

/**
 * Genera el marcado HTML de un encabezado <th> interactivo con flechas estilo Binance Pro.
 * 
 * @param {Object} options - Parámetros de configuración del encabezado
 * @param {string} options.key - Identificador de la columna (sortKey)
 * @param {string} options.label - Texto visible en el encabezado
 * @param {string} [options.currentSortKey] - Columna actualmente activa
 * @param {'asc'|'desc'} [options.currentDirection] - Dirección actual ('asc' o 'desc')
 * @param {'left'|'center'|'right'} [options.align='left'] - Alineación visual del contenido
 * @param {string} [options.type='text'] - Tipo de dato ('number', 'text', 'date', 'boolean')
 * @param {string} [options.width=''] - Ancho CSS opcional (ej: '120px')
 * @param {string} [options.title=''] - Tooltip descriptivo para accesibilidad
 * @returns {string} Código HTML del elemento <th>
 */
export function renderSortableTh({
    key,
    label,
    currentSortKey = '',
    currentDirection = 'desc',
    align = 'left',
    type = 'text',
    width = '',
    title = ''
}) {
    const isActive = currentSortKey === key;
    const isAsc = isActive && currentDirection === 'asc';
    const isDesc = isActive && currentDirection === 'desc';

    // Clases para alineación flexbox
    let justifyClass = 'justify-start';
    if (align === 'center') justifyClass = 'justify-center';
    if (align === 'right') justifyClass = 'justify-end';

    // Estilos en línea de apoyo
    const styleAttr = [
        align !== 'left' ? `text-align: ${align};` : '',
        width ? `width: ${width};` : ''
    ].filter(Boolean).join(' ');

    const ariaSort = isActive
        ? (isAsc ? 'ascending' : 'descending')
        : 'none';

    const tooltip = title || `Ordenar por ${label} (${isActive && isDesc ? 'cambiar a menor a mayor' : 'cambiar a mayor a menor'})`;

    return `
        <th class="sortable-th ${isActive ? 'active-sort' : ''}" 
            data-sort-key="${escapeHtmlAttr(key)}" 
            data-sort-type="${escapeHtmlAttr(type)}"
            role="columnheader"
            aria-sort="${ariaSort}"
            tabindex="0"
            title="${escapeHtmlAttr(tooltip)}"
            ${styleAttr ? `style="${styleAttr}"` : ''}>
            <div class="th-sort-wrapper ${justifyClass}">
                <span class="th-label">${label}</span>
                <span class="sort-arrows" aria-hidden="true">
                    <svg class="sort-arrow sort-arrow-up ${isAsc ? 'active' : ''}" viewBox="0 0 24 24" width="8" height="8">
                        <path fill="currentColor" d="M12 4l-8 8h16z"/>
                    </svg>
                    <svg class="sort-arrow sort-arrow-down ${isDesc ? 'active' : ''}" viewBox="0 0 24 24" width="8" height="8">
                        <path fill="currentColor" d="M12 20l8-8H4z"/>
                    </svg>
                </span>
            </div>
        </th>
    `;
}

/**
 * Calcula la siguiente dirección de ordenamiento tras hacer clic en un encabezado.
 * 
 * Regla de Ciclo Intuitivo:
 * - Si es la misma columna que ya estaba activa: invierte la dirección ('desc' <-> 'asc').
 * - Si es una columna nueva: números, fechas y balances empiezan en 'desc' (Mayor a Menor); textos empiezan en 'asc' (A-Z).
 * 
 * @param {string} currentKey - Columna actualmente activa
 * @param {string} targetKey - Columna en la que se hizo clic
 * @param {'asc'|'desc'} currentDirection - Dirección actual
 * @param {string} [type='text'] - Tipo de dato de la columna objetivo
 * @returns {'asc'|'desc'} Siguiente dirección a aplicar
 */
export function getNextSortDirection(currentKey, targetKey, currentDirection, type = 'text') {
    if (currentKey === targetKey) {
        return currentDirection === 'desc' ? 'asc' : 'desc';
    }
    // Para números, fechas y balances, es más intuitivo ver los mayores o más recientes primero
    return (type === 'number' || type === 'date') ? 'desc' : 'asc';
}

/**
 * Vincula el evento click y accesibilidad de teclado (Enter / Espacio) en los <th> ordenables de un contenedor.
 * 
 * @param {HTMLElement|string} tableContainer - Elemento DOM o selector del contenedor de la tabla
 * @param {Function} onSortChange - Callback invocado con (sortKey, nextDirection, type)
 */
export function attachTableSortHandler(tableContainer, onSortChange) {
    const container = typeof tableContainer === 'string' 
        ? document.querySelector(tableContainer) 
        : tableContainer;

    if (!container || typeof onSortChange !== 'function') return;

    // Actualizar siempre el callback activo más reciente para este contenedor
    container._tableSortCallback = onSortChange;

    // Si los listeners de delegación ya fueron vinculados a este contenedor, no duplicar
    if (container._hasTableSortListener) return;
    container._hasTableSortListener = true;

    // Delegación de eventos de clic eficiente en el contenedor
    container.addEventListener('click', (event) => {
        const th = event.target.closest('.sortable-th');
        if (!th || !container.contains(th)) return;

        const sortKey = th.getAttribute('data-sort-key');
        const sortType = th.getAttribute('data-sort-type') || 'text';

        if (sortKey && typeof container._tableSortCallback === 'function') {
            container._tableSortCallback(sortKey, sortType);
        }
    });

    // Accesibilidad para lectores de pantalla y navegación por teclado (Enter / Espacio)
    container.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            const th = event.target.closest('.sortable-th');
            if (th && container.contains(th)) {
                event.preventDefault();
                const sortKey = th.getAttribute('data-sort-key');
                const sortType = th.getAttribute('data-sort-type') || 'text';
                if (sortKey && typeof container._tableSortCallback === 'function') {
                    container._tableSortCallback(sortKey, sortType);
                }
            }
        }
    });
}

/**
 * Función interna de sanitización para atributos HTML
 */
function escapeHtmlAttr(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
