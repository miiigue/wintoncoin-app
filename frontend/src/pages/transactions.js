// ============================================================================
// WintonCoin - Página de Transacciones
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

function initializeTransactionsPage() {
    const API_URL = getApiUrl();
    const storedUsername = localStorage.getItem('username');
    
    const elements = {
        transactionsUsername: document.getElementById('transactionsUsername'),
        tableBody: document.getElementById('transactions-table-body'),
        noTransactionsMessage: document.getElementById('no-transactions-message'),
        tableContainer: document.querySelector('.table-container')
    };

    // Determinar la pestaña por defecto basada en el panel principal
    const activeDashboardTab = localStorage.getItem('walletActiveTab') || 'billetera';
    let currentType = activeDashboardTab === 'impulsor' ? 'marketing' : 'web3';

    // Inyectar controles de pestañas (Tabs)
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'transaction-tabs';
    tabsContainer.style.display = 'flex';
    tabsContainer.style.gap = '10px';
    tabsContainer.style.marginBottom = '20px';
    
    tabsContainer.innerHTML = `
        <button id="tab-web3" class="btn ${currentType === 'web3' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; padding: 10px;">Estado de Cuenta (Web3)</button>
        <button id="tab-marketing" class="btn ${currentType === 'marketing' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; padding: 10px;">Recompensas (Impulsor)</button>
    `;
    
    elements.tableContainer.parentNode.insertBefore(tabsContainer, elements.tableContainer);

    const tabWeb3 = document.getElementById('tab-web3');
    const tabMarketing = document.getElementById('tab-marketing');

    function updateTabStyles() {
        tabWeb3.className = `btn ${currentType === 'web3' ? 'btn-primary' : 'btn-secondary'}`;
        tabWeb3.style.opacity = currentType === 'web3' ? '1' : '0.6';
        
        tabMarketing.className = `btn ${currentType === 'marketing' ? 'btn-primary' : 'btn-secondary'}`;
        tabMarketing.style.opacity = currentType === 'marketing' ? '1' : '0.6';
    }
    updateTabStyles(); // Initial style

    tabWeb3.addEventListener('click', () => {
        if (currentType !== 'web3') {
            currentType = 'web3';
            updateTabStyles();
            fetchTransactions();
        }
    });

    tabMarketing.addEventListener('click', () => {
        if (currentType !== 'marketing') {
            currentType = 'marketing';
            updateTabStyles();
            fetchTransactions();
        }
    });

    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver tus transacciones.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    elements.transactionsUsername.textContent = `Transacciones para ${storedUsername}`;
    fetchTransactions();

    async function fetchTransactions() {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            // Limpiar la tabla y mostrar un estado de carga (opcional pero buena UX)
            elements.tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando...</td></tr>';
            elements.tableContainer.style.display = 'block';
            elements.noTransactionsMessage.style.display = 'none';

            const response = await fetch(`${API_URL}/api/me/transactions?type=${currentType}`, { headers });
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

    function renderTransactions(transactions) {
        if (transactions.length === 0) {
            elements.tableContainer.style.display = 'none';
            elements.noTransactionsMessage.style.display = 'block';
            return;
        }

        elements.tableBody.innerHTML = '';

        transactions.forEach(tx => {
            const row = document.createElement('tr');
            
            const formattedDate = new Date(tx.created_at).toLocaleString('es-ES', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const blueChange = formatChange(tx.blue_change);
            const redChange = formatChange(tx.red_change);
            const redClassName = tx.red_change !== 0 ? 'red-text-always' : 'no-change';

            row.innerHTML = `
                <td data-label="Fecha">${formattedDate}</td>
                <td data-label="Descripción">${tx.description}</td>
                <td data-label="BLUE" class="${blueChange.className}">${blueChange.text}</td>
                <td data-label="RED" class="${redClassName}">${redChange.text}</td>
            `;
            elements.tableBody.appendChild(row);
        });
    }

    function formatChange(change) {
        const num = parseFloat(change);

        if (isNaN(num) || num === 0) {
            return { className: 'no-change', text: '' };
        }

        const formattedString = Math.abs(num).toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
        
        let styledText = formattedString;
        const parts = formattedString.split(',');
        if (parts.length === 2) {
            styledText = `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        }
        
        if (num > 0) {
            return { className: 'positive-change', text: `+${styledText}` };
        } else {
            return { className: 'negative-change', text: `-${styledText}` };
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTransactionsPage);
} else {
    initializeTransactionsPage();
}

export { initializeTransactionsPage };
