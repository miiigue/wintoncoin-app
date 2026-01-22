// ============================================================================
// WintonCoin - Página de Perfil de Usuario
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

function initializeProfilePage() {
    const API_URL = getApiUrl();
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username') || urlParams.get('user');

    const elements = {
        profileHeader: document.getElementById('profile-header'),
        ratingsList: document.getElementById('ratings-list')
    };

    if (!username) {
        displayError("No se ha especificado un perfil de usuario.", true);
        return;
    }

    fetchProfileData();

    async function fetchProfileData() {
        try {
            const response = await fetch(`${API_URL}/users/${username}/profile`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error ${response.status}`);
            }

            const profileData = await response.json();
            renderProfile(profileData);
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
            displayError(error.message, true);
        }
    }

    function renderProfile(data) {
        renderHeader(data.user);
        renderRatings(data.ratings);
    }

    function renderHeader(user) {
        const ratingHTML = generateStarRating(user.average_rating, user.ratings_count);
        elements.profileHeader.innerHTML = `
            <h1 class="profile-username">${user.username}</h1>
            <div class="profile-rating">${ratingHTML}</div>
        `;
    }

    function renderRatings(ratings) {
        if (ratings.length === 0) {
            elements.ratingsList.innerHTML = '<p class="empty-message">Este usuario aún no ha recibido ninguna calificación.</p>';
            return;
        }
        elements.ratingsList.innerHTML = ratings.map(rating => getRatingHTML(rating)).join('');
    }

    function getRatingHTML(rating) {
        const stars = '★'.repeat(rating.rating) + '☆'.repeat(5 - rating.rating);
        const formattedDate = new Date(rating.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
            <div class="rating-item">
                <div class="rating-item-header">
                    <span class="rating-item-rater">De: <strong>${rating.rater_username}</strong></span>
                    <span class="rating-item-stars">${stars}</span>
                </div>
                ${rating.comment ? `<p class="rating-item-comment">"${rating.comment}"</p>` : ''}
                <div class="rating-item-footer"><span>${formattedDate}</span></div>
            </div>
        `;
    }

    function displayError(message, redirect = false) {
        elements.profileHeader.innerHTML = '';
        elements.ratingsList.innerHTML = '';
        showCustomAlert(message, () => {
            if (redirect) {
                window.location.href = 'contract_interaction.html';
            }
        });
    }

    function generateStarRating(rating, count) {
        if (count === 0) {
            return '<span class="no-rating">Sin calificaciones</span>';
        }
        const avgRating = parseFloat(rating).toFixed(1);
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        return `
            <span class="stars" title="${avgRating} de 5 estrellas">${stars}</span> 
            <span class="rating-summary"><strong>${avgRating}</strong> de 5 (${count} calificaciones)</span>
        `;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfilePage);
} else {
    initializeProfilePage();
}

export { initializeProfilePage };
