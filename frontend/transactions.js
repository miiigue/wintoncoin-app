document.addEventListener('DOMContentLoaded', () => {

    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    // --- Estado y Elementos del DOM ---
    const storedUsername = sessionStorage.getItem('username');
    const elements = {
        transactionsUsername: document.getElementById('transactionsUsername'),
        tableBody: document.getElementById('transactions-table-body'),
        noTransactionsMessage: document.getElementById('no-transactions-message'),
        tableContainer: document.querySelector('.table-container')
    };

    // --- Inicialización ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver tus transacciones.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    elements.transactionsUsername.textContent = `Transacciones para ${storedUsername}`;
    fetchTransactions();

    // --- Lógica de Datos ---
    async function fetchTransactions() {
        try {
            const response = await fetch(`${API_URL}/users/${storedUsername}/transactions`);
            if (!response.ok) {
                throw new Error('No se pudo cargar el historial de transacciones.');
            }
            const transactions = await response.json();
            
            renderTransactions(transactions);

        } catch (error) {
            console.error('Error al cargar transacciones:', error);
            elements.tableContainer.innerHTML = '<p class="error-message">Error al cargar las transacciones.</p>';
        }
    }

    // --- Lógica de Renderizado ---
    function renderTransactions(transactions) {
        if (transactions.length === 0) {
            elements.tableContainer.style.display = 'none';
            elements.noTransactionsMessage.style.display = 'block';
            return;
        }

        elements.tableBody.innerHTML = ''; // Limpiar el cuerpo de la tabla

        transactions.forEach(tx => {
            const row = document.createElement('tr');
            
            const formattedDate = new Date(tx.created_at).toLocaleString('es-ES', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            // Dar formato y color a los cambios de tokens
            const blueChange = formatChange(tx.blue_change);
            const redChange = formatChange(tx.red_change);

            // El texto para la columna RED siempre es rojo si el valor no es cero.
            const redClassName = tx.red_change !== 0 ? 'red-text-always' : 'no-change';

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${tx.description}</td>
                <td class="${blueChange.className}">${blueChange.text}</td>
                <td class="${redClassName}">${redChange.text}</td>
            `;
            elements.tableBody.appendChild(row);
        });
    }

    /**
     * Formatea un número para que sea positivo o negativo, añadiendo el signo,
     * y ahora también aplicando el estilo a los decimales.
     * @param {number|string} change El valor a formatear.
     * @returns {string} El HTML formateado.
     */
    function formatChange(change) {
        const num = parseFloat(change);
        if (isNaN(num) || num === 0) {
            return `<span class="no-change">0,0000</span>`;
        }

        const formattedString = Math.abs(num).toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
        
        let styledString = formattedString;
        const parts = formattedString.split(',');
        if (parts.length === 2) {
            styledString = `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        }
        
        if (num > 0) {
            return `<span class="positive-change">+${styledString}</span>`;
        } else {
            return `<span class="negative-change">-${styledString}</span>`;
        }
    }
}); 