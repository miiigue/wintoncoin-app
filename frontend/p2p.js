document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');

    const elements = {
        tabs: document.querySelectorAll('.p2p-tab'),
        offersList: document.getElementById('p2pOffersList'),
        myOffersList: document.getElementById('p2pMyOffersList'),
        ordersList: document.getElementById('p2pOrdersList'),
        currencyFilter: document.getElementById('p2pCurrencyFilter'),
        paymentFilter: document.getElementById('p2pPaymentFilter'),
        amountFilter: document.getElementById('p2pAmountFilter'),
        applyFiltersBtn: document.getElementById('applyP2pFiltersBtn'),
        refreshOffersBtn: document.getElementById('refreshOffersBtn'),
        offerModal: document.getElementById('p2pOfferModal'),
        openOfferModalBtn: document.getElementById('openCreateOfferBtn'),
        closeOfferModalBtn: document.getElementById('closeP2pOfferModal'),
        offerForm: document.getElementById('p2pOfferForm'),
        offerType: document.getElementById('p2pOfferType'),
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

    if (!token || !storedUsername) {
        showCustomAlert('Debes iniciar sesión para usar P2P.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    init();

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

    async function loadPaymentMethods() {
        try {
            const response = await fetch(`${API_URL}/api/p2p/payment-methods`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
        elements.paymentFilter.innerHTML = `
            <option value="">Método de pago</option>
            ${paymentMethods.map(method => `<option value="${method.id}">${method.label}</option>`).join('')}
        `;
    }

    async function loadOffers() {
        elements.offersList.innerHTML = '<div class="loading-spinner"></div>';
        const params = new URLSearchParams();
        const offerType = currentTab === 'buy' ? 'sell' : 'buy';
        params.set('type', offerType);
        if (elements.currencyFilter.value) params.set('currency', elements.currencyFilter.value);
        if (elements.paymentFilter.value) params.set('paymentMethod', elements.paymentFilter.value);
        if (elements.amountFilter.value) params.set('min', elements.amountFilter.value);

        try {
            const response = await fetch(`${API_URL}/api/p2p/offers?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('No se pudieron cargar ofertas.');
            const offers = await response.json();
            renderOffers(offers);
        } catch (error) {
            console.error(error);
            elements.offersList.innerHTML = '<p class="empty-message">No se pudieron cargar ofertas.</p>';
        }
    }

    async function loadMyOffers() {
        if (!elements.myOffersList) return;
        elements.myOffersList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const response = await fetch(`${API_URL}/api/p2p/offers/mine`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
            const response = await fetch(`${API_URL}/api/p2p/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ offerId: selectedOffer.id, fiatAmount: amount })
            });
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
            offerType: elements.offerType.value,
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
            const response = await fetch(`${API_URL}/api/p2p/offers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
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
            const response = await fetch(`${API_URL}/api/p2p/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('No se pudieron cargar órdenes.');
            const orders = await response.json();
            renderOrders(orders);
        } catch (error) {
            console.error(error);
            elements.ordersList.innerHTML = '<p class="empty-message">No se pudieron cargar órdenes.</p>';
        }
    }

    function renderOrders(orders) {
        if (!orders || orders.length === 0) {
            elements.ordersList.innerHTML = '<p class="empty-message">No tienes órdenes P2P aún.</p>';
            return;
        }
        elements.ordersList.innerHTML = orders.map(order => {
            const isBuyer = order.buyer_username === storedUsername;
            const counterparty = isBuyer ? order.seller_username : order.buyer_username;
            return `
                <div class="p2p-order-card">
                    <div>
                        <strong>${isBuyer ? 'Comprando' : 'Vendiendo'}</strong> con ${counterparty}
                    </div>
                    <div class="p2p-order-meta">
                        <span>${order.fiat_amount} ${order.currency}</span>
                        <span>${Number(order.blue_amount).toFixed(4)} BLUE</span>
                        <span class="p2p-status">${order.status}</span>
                    </div>
                </div>
            `;
        }).join('');
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
