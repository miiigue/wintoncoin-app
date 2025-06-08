document.addEventListener('DOMContentLoaded', () => {

    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    // --- Estado y Elementos del DOM ---
    const storedUsername = sessionStorage.getItem('username');
    const elements = {
        historyUsername: document.getElementById('historyUsername'),
        authoredList: document.getElementById('authored-publications-list'),
        completedList: document.getElementById('completed-publications-list'),
    };

    // --- Inicialización ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver tu historial.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    elements.historyUsername.textContent = `Historial para ${storedUsername}`;
    fetchHistory();

    // --- Lógica de Datos ---
    async function fetchHistory() {
        try {
            const response = await fetch(`${API_URL}/users/${storedUsername}/history`);
            if (!response.ok) {
                throw new Error('No se pudo cargar el historial.');
            }
            const history = await response.json();
            
            renderPublications(elements.authoredList, history.authored, 'No has creado ninguna publicación todavía.');
            renderPublications(elements.completedList, history.completed, 'No has completado ninguna tarea todavía.');

        } catch (error) {
            console.error('Error al cargar el historial:', error);
            elements.authoredList.innerHTML = '<p class="error-message">Error al cargar tus publicaciones.</p>';
            elements.completedList.innerHTML = '<p class="error-message">Error al cargar tus tareas completadas.</p>';
        }
    }

    // --- Lógica de Renderizado ---
    function renderPublications(container, publications, emptyMessage) {
        container.innerHTML = '';
        if (publications.length === 0) {
            container.innerHTML = `<p>${emptyMessage}</p>`;
            return;
        }

        publications.forEach(pub => {
            const item = document.createElement('div');
            item.className = 'publication-item';
            // Esta función es una copia simplificada de la de interaction.js,
            // ya que en el historial no se necesitan botones de acción.
            item.innerHTML = getHistoryPublicationHTML(pub);
            container.appendChild(item);
        });
    }

    function getHistoryPublicationHTML(pub) {
        let statusText = getStatusText(pub.status);
        let acceptedByHTML = pub.accepted_by_username 
            ? `<li>Aceptado por: <strong>${pub.accepted_by_username}</strong></li>`
            : '';

        return `
            <h3>${pub.title}</h3>
            <p class="pub-description">${pub.description}</p>
            <ul class="pub-meta-list">
                <li>Autor: <strong>${pub.author_username}</strong></li>
                <li>Costo: <strong>${pub.blue_cost} BLUE</strong></li>
                ${acceptedByHTML}
                <li>Estado: <span class="status-badge ${pub.status}">${statusText}</span></li>
            </ul>
        `;
    }

    function getStatusText(status) {
        const statusMap = {
            'open': 'Abierta',
            'pending_approval': 'Pendiente de Aprobación',
            'approved': 'Aprobada',
            'completed': 'Culminada',
            'confirmed_paid': 'Finalizada y Pagada'
        };
        return statusMap[status] || status;
    }
}); 