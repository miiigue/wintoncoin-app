/**
 * P2P Page Module
 * Handles P2P trading functionality - buy/sell BLUE between users
 */

import { getApiUrl, showCustomAlert, handleSessionExpired } from '../modules/index.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = getApiUrl();
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');

    const elements = {
        tabs: document.querySelectorAll('.p2p-tab'),
        offersList: document.getElementById('p2pOffersList'),
        myOffersList: document.getElementById('p2pMyOffersList'),
        ordersList: document.getElementById('p2pOrdersList'),
        currencyFilter: document.getElementById('p2pCurrencyFilter'),
        paymentFilter: document.getElementById('p2pPaymentFilter'),
        paymentFilterTrigger: document.getElementById('p2pPaymentFilterTrigger'),
        paymentFilterMenu: document.getElementById('p2pPaymentFilterMenu'),
        amountFilter: document.getElementById('p2pAmountFilter'),
        applyFiltersBtn: document.getElementById('applyP2pFiltersBtn'),
        refreshOffersBtn: document.getElementById('refreshOffersBtn'),
        offerModal: document.getElementById('p2pOfferModal'),
        openOfferModalBtn: document.getElementById('openCreateOfferBtn'),
        closeOfferModalBtn: document.getElementById('closeP2pOfferModal'),
        offerForm: document.getElementById('p2pOfferForm'),
        offerTypeDisplay: document.getElementById('p2pOfferTypeDisplay'),
        offerTypeHelp: document.getElementById('p2pOfferTypeHelp'),
        offerCurrency: document.getElementById('p2pOfferCurrency'),
        offerPrice: document.getElementById('p2pOfferPrice'),
        usdRate: document.getElementById('p2pUsdRate'),
        minAmount: document.getElementById('p2pMinAmount'),
        maxAmount: document.getElementById('p2pMaxAmount'),
        availableBlue: document.getElementById('p2pAvailableBlue'),
        offerTerms: document.getElementById('p2pOfferTerms'),
        allowPartial: document.getElementById('p2pAllowPartial'),
        paymentMethodsGrid: document.getElementById('p2pPaymentMethods'),
        orderModal: document.getElementById('p2pOrderModal'),
        closeOrderModalBtn: document.getElementById('closeP2pOrderModal'),
        orderSummary: document.getElementById('p2pOrderSummary'),
        orderAmount: document.getElementById('p2pOrderAmount'),
        confirmOrderBtn: document.getElementById('confirmP2pOrderBtn')
    };

    let currentTab = 'buy';
    let paymentMethods = [];
    let selectedOffer = null;

    // Redirect to login if not authenticated
    if (!token || !storedUsername) {
        showCustomAlert('Debes iniciar sesión para usar P2P.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    init();

    async function p2pFetch(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (handleSessionExpired(response)) return null;

            // Clonar la respuesta para poder leer su body sin consumirlo
            const responseText = await response.clone().text();
            let result = {};
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                if (!response.ok) {
                    throw new Error(responseText || `Error ${response.status}`);
                }
            }

            if (!response.ok) {
                // Interceptar error de aceptación legal (403 LEGAL_ACCEPTANCE_REQUIRED)
                if (response.status === 403 && result.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
                    return new Promise((resolve, reject) => {
                        window.showLegalAcceptanceModal(
                            result.pending_documents,
                            async (acceptResult) => {
                                console.log('[LEGAL] Términos aceptados desde modal (P2P). Reintentando operación original...');
                                try {
                                    const retryResponse = await p2pFetch(url, options);
                                    resolve(retryResponse);
                                } catch (retryErr) {
                                    reject(retryErr);
                                }
                            },
                            () => {
                                reject(new Error('Acción bloqueada: Debes aceptar los términos y condiciones vigentes.'));
                            }
                        );
                    });
                }
            }

            return response;
        } catch (error) {
            console.error('[P2P fetch error]:', error);
            throw error;
        }
    }

    function init() {
        setupEventListeners();
        loadPaymentMethods();
        loadOffers();
        loadMyOffers();
        loadOrders();
    }

    function setupEventListeners() {
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                syncOfferTypeWithTab();
                loadOffers();
            });
        });

        elements.applyFiltersBtn.addEventListener('click', loadOffers);
        elements.refreshOffersBtn.addEventListener('click', () => {
            loadOffers();
            loadMyOffers();
            loadOrders();
        });

        elements.openOfferModalBtn.addEventListener('click', () => {
            syncOfferTypeWithTab();
            elements.offerModal.style.display = 'flex';
        });
        elements.closeOfferModalBtn.addEventListener('click', () => {
            elements.offerModal.style.display = 'none';
        });
        elements.offerForm.addEventListener('submit', handleCreateOffer);

        elements.closeOrderModalBtn.addEventListener('click', () => {
            elements.orderModal.style.display = 'none';
            selectedOffer = null;
        });
        elements.confirmOrderBtn.addEventListener('click', handleCreateOrder);

        window.addEventListener('click', (event) => {
            if (event.target === elements.offerModal) elements.offerModal.style.display = 'none';
            if (event.target === elements.orderModal) elements.orderModal.style.display = 'none';
        });
    }

    function syncOfferTypeWithTab() {
        if (!elements.offerTypeDisplay || !elements.offerTypeHelp) return;
        const isBuy = currentTab === 'buy';
        elements.offerTypeDisplay.textContent = isBuy ? 'COMPRAR' : 'VENDER';
        elements.offerTypeHelp.textContent = isBuy
            ? 'Publicas para comprar BLUE a otros usuarios.'
            : 'Publicas para vender tu BLUE a otros usuarios.';
    }

    async function loadPaymentMethods() {
        try {
            const response = await p2pFetch(`${API_URL}/api/p2p/payment-methods`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response) return;
            if (!response.ok) throw new Error('No se pudieron cargar métodos de pago.');
            paymentMethods = await response.json();
            renderPaymentMethods();
            renderPaymentFilter();
        } catch (error) {
            console.error(error);
            showCustomAlert('Error al cargar métodos de pago.');
        }
    }

    function renderPaymentMethods() {
        elements.paymentMethodsGrid.innerHTML = paymentMethods.map(method => `
            <label class="p2p-method-pill">
                <input type="checkbox" value="${method.id}">
                <span>${method.label}</span>
            </label>
        `).join('');
    }

    function renderPaymentFilter() {
        if (!elements.paymentFilterMenu || !elements.paymentFilterTrigger) return;
        elements.paymentFilterMenu.innerHTML = paymentMethods.map(method => `
            <label class="p2p-multiselect-option">
                <input type="checkbox" value="${method.id}">
                <span>${method.label}</span>
            </label>
        `).join('');
        updatePaymentFilterLabel();
    }

    async function loadOffers() {
        elements.offersList.innerHTML = '<div class="loading-spinner"></div>';
        const params = new URLSearchParams();
        const offerType = currentTab === 'buy' ? 'sell' : 'buy';
        params.set('type', offerType);
        if (elements.currencyFilter.value) params.set('currency', elements.currencyFilter.value);
        const selectedMethods = getSelectedPaymentMethods();
        if (selectedMethods.length === 1) {
            params.set('paymentMethod', selectedMethods[0]);
        } else if (selectedMethods.length > 1) {
            params.set('paymentMethods', selectedMethods.join(','));
        }
        if (elements.amountFilter.value) params.set('min', elements.amountFilter.value);

        try {
            const response = await p2pFetch(`${API_URL}/api/p2p/offers?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response) return;
            if (!response.ok) throw new Error('No se pudieron cargar ofertas.');
            const offers = await response.json();
            const sortedOffers = [...offers].sort((a, b) => Number(a.price_per_blue) - Number(b.price_per_blue));
            renderOffers(sortedOffers);
        } catch (error) {
            console.error(error);
            elements.offersList.innerHTML = '<p class="empty-message">No se pudieron cargar ofertas.</p>';
        }
    }

    async function loadMyOffers() {
        if (!elements.myOffersList) return;
        elements.myOffersList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const response = await p2pFetch(`${API_URL}/api/p2p/offers/mine`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response) return;
            if (!response.ok) throw new Error('No se pudieron cargar tus anuncios.');
            const offers = await response.json();
            renderMyOffers(offers);
        } catch (error) {
            console.error(error);
            elements.myOffersList.innerHTML = '<p class="empty-message">No se pudieron cargar tus anuncios.</p>';
        }
    }

    function renderOffers(offers) {
        if (!offers || offers.length === 0) {
            elements.offersList.innerHTML = '<p class="empty-message">No hay ofertas disponibles.</p>';
            return;
        }

        elements.offersList.innerHTML = offers.map(offer => {
            const actionLabel = currentTab === 'buy' ? 'Comprar' : 'Vender';
            const ratingText = offer.ratings_count > 0
                ? `${offer.average_rating.toFixed(1)} (${offer.ratings_count})`
                : 'Sin calificaciones';
            const methods = Array.isArray(offer.payment_methods) ? offer.payment_methods : [];

            return `
                <div class="p2p-offer-card">
                    <div class="p2p-offer-header">
                        <div>
                            <h3>${offer.creator_username}</h3>
                            <span class="p2p-rating">${ratingText}</span>
                        </div>
                        <div class="p2p-price">
                            ${Number(offer.price_per_blue).toLocaleString('es-ES', { minimumFractionDigits: 4 })} ${offer.currency}
                            <span>por BLUE</span>
                        </div>
                    </div>
                    <div class="p2p-offer-meta">
                        <span><strong>Disponible:</strong> ${Number(offer.available_blue_amount).toFixed(4)} BLUE</span>
                        <span><strong>Rango:</strong> ${offer.min_fiat_amount} - ${offer.max_fiat_amount} ${offer.currency}</span>
                    </div>
                    <div class="p2p-methods">
                        ${methods.map(method => `<span class="p2p-method-chip">${method.label}</span>`).join('')}
                    </div>
                    <button class="action-button p2p-action-btn" data-offer-id="${offer.id}" data-offer='${encodeURIComponent(JSON.stringify(offer))}'>${actionLabel}</button>
                </div>
            `;
        }).join('');

        elements.offersList.querySelectorAll('.p2p-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const offer = JSON.parse(decodeURIComponent(btn.dataset.offer));
                openOrderModal(offer);
            });
        });
    }

    function openOrderModal(offer) {
        selectedOffer = offer;
        elements.orderSummary.textContent = `Oferta de ${offer.creator_username} - Precio ${offer.price_per_blue} ${offer.currency} por BLUE.`;
        elements.orderAmount.value = '';
        elements.orderModal.style.display = 'flex';
    }

    async function handleCreateOrder() {
        if (!selectedOffer) return;
        const amount = parseFloat(elements.orderAmount.value);
        if (!Number.isFinite(amount) || amount <= 0) {
            showCustomAlert('Ingresa un monto válido.');
            return;
        }
        try {
            const response = await p2pFetch(`${API_URL}/api/p2p/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ offerId: selectedOffer.id, fiatAmount: amount })
            });
            if (!response) return;
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'No se pudo crear la orden.');
            showCustomAlert('Orden creada. Tienes 15 minutos para pagar.');
            elements.orderModal.style.display = 'none';
            loadOffers();
            loadOrders();
        } catch (error) {
            console.error(error);
            showCustomAlert(error.message || 'Error al crear la orden.');
        }
    }

    async function handleCreateOffer(event) {
        event.preventDefault();
        const selectedMethods = Array.from(elements.paymentMethodsGrid.querySelectorAll('input[type="checkbox"]:checked'))
            .map(input => parseInt(input.value, 10));

        const payload = {
            offerType: currentTab === 'buy' ? 'buy' : 'sell',
            currency: elements.offerCurrency.value,
            pricePerBlue: parseFloat(elements.offerPrice.value),
            usdReferenceRate: parseFloat(elements.usdRate.value),
            minFiatAmount: parseFloat(elements.minAmount.value),
            maxFiatAmount: parseFloat(elements.maxAmount.value),
            availableBlueAmount: parseFloat(elements.availableBlue.value),
            allowPartial: elements.allowPartial.checked,
            terms: elements.offerTerms.value,
            paymentMethodIds: selectedMethods
        };

        try {
            const response = await p2pFetch(`${API_URL}/api/p2p/offers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!response) return;
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'No se pudo crear la oferta.');
            showCustomAlert('Anuncio publicado correctamente.');
            elements.offerForm.reset();
            elements.offerModal.style.display = 'none';
            loadOffers();
        } catch (error) {
            console.error(error);
            showCustomAlert(error.message || 'Error al crear anuncio.');
        }
    }

    async function loadOrders() {
        elements.ordersList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const response = await p2pFetch(`${API_URL}/api/p2p/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response) return;
            if (!response.ok) throw new Error('No se pudieron cargar órdenes.');
            const orders = await response.json();
            renderOrders(orders);
        } catch (error) {
            console.error(error);
            elements.ordersList.innerHTML = '<p class="empty-message">No se pudieron cargar órdenes.</p>';
        }
    }

    function renderOrders(orders) {
        const allOrders = Array.isArray(orders) ? orders : [];
        const activeStatuses = new Set(['payment_pending', 'paid', 'disputed']);
        const activeOrders = allOrders.filter(order => activeStatuses.has(order.status));

        if (activeOrders.length === 0) {
            elements.ordersList.innerHTML = '<p class="empty-message">No tienes órdenes activas.</p>';
        } else {
            elements.ordersList.innerHTML = activeOrders.map(order => {
                const isBuyer = order.buyer_username === storedUsername;
                const counterparty = isBuyer ? order.seller_username : order.buyer_username;
                const statusLabel = getOrderStatusLabel(order.status);
                const actionsHTML = getOrderActionsHTML(order, isBuyer);
                const dateLabel = formatOrderDate(order.created_at);
                return `
                    <div class="p2p-order-card">
                        <div>
                            <strong>${isBuyer ? 'Comprando' : 'Vendiendo'}</strong> con ${counterparty}
                        </div>
                        <div class="p2p-order-meta">
                            <span>${order.fiat_amount} ${order.currency}</span>
                            <span>${Number(order.blue_amount).toFixed(4)} BLUE</span>
                            <span class="p2p-status">${statusLabel}</span>
                            <span class="p2p-order-date">${dateLabel}</span>
                        </div>
                        ${actionsHTML}
                    </div>
                `;
            }).join('');
        }
    }

    function getOrderActionsHTML(order, isBuyer) {
        const status = order.status;
        const actions = [];

        if (status === 'payment_pending') {
            if (isBuyer) {
                actions.push(`<button class="action-button p2p-order-action" data-action="mark-paid" data-order-id="${order.id}">Marcar como pagado</button>`);
            }
            actions.push(`<button class="action-button p2p-order-action secondary" data-action="cancel" data-order-id="${order.id}">Cancelar</button>`);
        } else if (status === 'paid') {
            if (!isBuyer) {
                actions.push(`<button class="action-button p2p-order-action" data-action="release" data-order-id="${order.id}">Liberar BLUE</button>`);
            } else {
                actions.push(`<span class="p2p-order-info">Esperando liberación del vendedor</span>`);
            }
        } else if (status === 'released') {
            actions.push(`<span class="p2p-order-info">Completada</span>`);
        } else if (status === 'cancelled') {
            actions.push(`<span class="p2p-order-info">Cancelada</span>`);
        } else if (status === 'expired') {
            actions.push(`<span class="p2p-order-info">Expirada</span>`);
        } else if (status === 'disputed') {
            actions.push(`<span class="p2p-order-info">En disputa</span>`);
        }

        if (actions.length === 0) return '';
        return `<div class="p2p-order-actions">${actions.join('')}</div>`;
    }

    function getOrderStatusLabel(status) {
        const map = {
            payment_pending: 'pendiente de pago',
            paid: 'pagado',
            released: 'liberado',
            cancelled: 'cancelado',
            expired: 'expirado',
            disputed: 'en disputa'
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

    elements.ordersList.addEventListener('click', async (event) => {
        const button = event.target.closest('.p2p-order-action');
        if (!button) return;
        const orderId = button.dataset.orderId;
        const action = button.dataset.action;
        if (!orderId || !action) return;

        try {
            if (action === 'mark-paid') {
                await postOrderAction(orderId, 'mark-paid');
                showCustomAlert('Pago marcado. Espera la liberación del vendedor.');
            } else if (action === 'release') {
                await postOrderAction(orderId, 'release');
                showCustomAlert('BLUE liberado correctamente.');
            } else if (action === 'cancel') {
                await postOrderAction(orderId, 'cancel');
                showCustomAlert('Orden cancelada.');
            }
            loadOrders();
            loadOffers();
            loadMyOffers();
        } catch (error) {
            console.error(error);
            showCustomAlert(error.message || 'No se pudo procesar la acción.');
        }
    });

    // --- Multi-select UI (Método de pago) ---
    if (elements.paymentFilterTrigger && elements.paymentFilterMenu) {
        elements.paymentFilterTrigger.addEventListener('click', () => {
            elements.paymentFilterMenu.classList.toggle('is-open');
        });
        elements.paymentFilterMenu.addEventListener('change', () => {
            updatePaymentFilterLabel();
        });
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.p2p-multiselect')) {
                elements.paymentFilterMenu.classList.remove('is-open');
            }
        });
    }

    function getSelectedPaymentMethods() {
        if (!elements.paymentFilterMenu) return [];
        return Array.from(elements.paymentFilterMenu.querySelectorAll('input[type="checkbox"]:checked'))
            .map(input => input.value);
    }

    function updatePaymentFilterLabel() {
        if (!elements.paymentFilterTrigger || !elements.paymentFilterMenu) return;
        const selected = getSelectedPaymentMethods();
        if (selected.length === 0) {
            elements.paymentFilterTrigger.textContent = 'Método de pago';
            return;
        }
        const labels = selected
            .map(id => paymentMethods.find(method => String(method.id) === String(id))?.label)
            .filter(Boolean);
        elements.paymentFilterTrigger.textContent = labels.length > 0
            ? `Métodos (${labels.length})`
            : `Métodos (${selected.length})`;
    }

    async function postOrderAction(orderId, action) {
        const response = await p2pFetch(`${API_URL}/api/p2p/orders/${orderId}/${action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response) throw new Error('Sesión expirada');
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Error en la acción.');
        return result;
    }

    function renderMyOffers(offers) {
        if (!offers || offers.length === 0) {
            elements.myOffersList.innerHTML = '<p class="empty-message">No tienes anuncios P2P aún.</p>';
            return;
        }
        elements.myOffersList.innerHTML = offers.map(offer => {
            const typeLabel = offer.offer_type === 'sell' ? 'Venta' : 'Compra';
            return `
                <div class="p2p-offer-card">
                    <div class="p2p-offer-header">
                        <div>
                            <h3>${typeLabel}</h3>
                            <span class="p2p-rating">Estado: ${offer.status}</span>
                        </div>
                        <div class="p2p-price">
                            ${Number(offer.price_per_blue).toLocaleString('es-ES', { minimumFractionDigits: 4 })} ${offer.currency}
                            <span>por BLUE</span>
                        </div>
                    </div>
                    <div class="p2p-offer-meta">
                        <span><strong>Disponible:</strong> ${Number(offer.available_blue_amount).toFixed(4)} BLUE</span>
                        <span><strong>Rango:</strong> ${offer.min_fiat_amount} - ${offer.max_fiat_amount} ${offer.currency}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
});
