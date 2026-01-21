document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.getApiUrl();
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');

    const elements = {
        historyList: document.getElementById('p2pOrdersHistoryList')
    };

    if (!token || !storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver tu historial.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    loadHistory();

    async function loadHistory() {
        elements.historyList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const response = await fetch(`${API_URL}/api/p2p/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('No se pudieron cargar órdenes.');
            const orders = await response.json();
            renderHistory(orders);
        } catch (error) {
            console.error(error);
            elements.historyList.innerHTML = '<p class="empty-message">No se pudo cargar el historial.</p>';
        }
    }

    function renderHistory(orders) {
        const allOrders = Array.isArray(orders) ? orders : [];
        const historyStatuses = new Set(['released', 'cancelled', 'expired']);
        const historyOrders = allOrders
            .filter(order => historyStatuses.has(order.status))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (historyOrders.length === 0) {
            elements.historyList.innerHTML = '<p class="empty-message">Aún no tienes historial.</p>';
            return;
        }

        elements.historyList.innerHTML = historyOrders.map(order => {
            const isBuyer = order.buyer_username === storedUsername;
            const counterparty = isBuyer ? order.seller_username : order.buyer_username;
            const statusLabel = getOrderStatusLabel(order.status);
            const statusClass = `p2p-status ${order.status}`;
            const dateLabel = formatOrderDate(order.created_at);
            return `
                <div class="p2p-order-card">
                    <div>
                        <strong>${isBuyer ? 'Comprando' : 'Vendiendo'}</strong> con ${counterparty}
                    </div>
                    <div class="p2p-order-meta">
                        <span>${order.fiat_amount} ${order.currency}</span>
                        <span>${Number(order.blue_amount).toFixed(4)} BLUE</span>
                        <span class="${statusClass}">${statusLabel}</span>
                        <span class="p2p-order-date">${dateLabel}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getOrderStatusLabel(status) {
        const map = {
            released: 'liberada',
            cancelled: 'cancelada',
            expired: 'expirada'
        };
        return map[status] || status;
    }

    function formatOrderDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.getApiUrl();
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');

    const elements = {
        historyList: document.getElementById('p2pOrdersHistoryList')
    };

    if (!token || !storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver tu historial.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    loadHistory();

    async function loadHistory() {
        elements.historyList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const response = await fetch(`${API_URL}/api/p2p/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('No se pudieron cargar órdenes.');
            const orders = await response.json();
            renderHistory(orders);
        } catch (error) {
            console.error(error);
            elements.historyList.innerHTML = '<p class="empty-message">No se pudo cargar el historial.</p>';
        }
    }

    function renderHistory(orders) {
        const allOrders = Array.isArray(orders) ? orders : [];
        const historyStatuses = new Set(['released', 'cancelled', 'expired']);
        const historyOrders = allOrders
            .filter(order => historyStatuses.has(order.status))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (historyOrders.length === 0) {
            elements.historyList.innerHTML = '<p class="empty-message">Aún no tienes historial.</p>';
            return;
        }

        elements.historyList.innerHTML = historyOrders.map(order => {
            const isBuyer = order.buyer_username === storedUsername;
            const counterparty = isBuyer ? order.seller_username : order.buyer_username;
            const statusLabel = getOrderStatusLabel(order.status);
            const statusClass = `p2p-status ${order.status}`;
            const dateLabel = formatOrderDate(order.created_at);
            return `
                <div class="p2p-order-card">
                    <div>
                        <strong>${isBuyer ? 'Comprando' : 'Vendiendo'}</strong> con ${counterparty}
                    </div>
                    <div class="p2p-order-meta">
                        <span>${order.fiat_amount} ${order.currency}</span>
                        <span>${Number(order.blue_amount).toFixed(4)} BLUE</span>
                        <span class="${statusClass}">${statusLabel}</span>
                        <span class="p2p-order-date">${dateLabel}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getOrderStatusLabel(status) {
        const map = {
            released: 'liberada',
            cancelled: 'cancelada',
            expired: 'expirada'
        };
        return map[status] || status;
    }

    function formatOrderDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
});
