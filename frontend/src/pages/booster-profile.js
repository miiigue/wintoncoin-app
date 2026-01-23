// ============================================================================
// WintonCoin - Página de Perfil de Impulsor (Booster)
// ============================================================================

import { getApiUrl, showCustomAlert, handleSessionExpired } from '../modules/index.js';

function initializeBoosterProfilePage() {
    const API_URL = getApiUrl();
    const urlParams = new URLSearchParams(window.location.search);
    const usernameFromUrl = urlParams.get('username');
    const usernameFromStorage = localStorage.getItem('username');
    const profileUsername = usernameFromUrl || usernameFromStorage;

    const elements = {
        content: document.getElementById('booster-profile-content')
    };

    if (!profileUsername) {
        elements.content.innerHTML = `<p class="error-message">No se pudo determinar el perfil a mostrar. Asegúrate de haber iniciado sesión o de que la URL sea correcta.</p>`;
        showCustomAlert('No se pudo determinar qué perfil mostrar.', () => { window.location.href = 'index.html'; });
        return;
    }

    fetchBoosterProfile(profileUsername);

    async function fetchBoosterProfile(username) {
        try {
            const token = localStorage.getItem('token');
            const loggedUsername = localStorage.getItem('username');
            const isMe = loggedUsername && username === loggedUsername && token;
            const url = isMe
                ? `${API_URL}/api/me/booster-profile`
                : `${API_URL}/api/users/${username}/booster-profile`;

            const response = await fetch(url, {
                headers: isMe ? { 'Authorization': `Bearer ${token}` } : {}
            });
            
            // Manejar sesión expirada (401)
            if (handleSessionExpired(response)) return;
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al cargar el perfil de impulsor.');
            }
            const data = await response.json();
            renderProfile(data);
        } catch (error) {
            console.error(error);
            elements.content.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    }

    function renderProfile(data) {
        if (!data.is_booster) {
            elements.content.innerHTML = `
                <div class="booster-header"><h1>Programa de Impulsores</h1></div>
                <p class="empty-message" style="text-align: center; font-size: 1.1rem; margin: 2rem;">${data.message}<br>¡Completa tareas de la plataforma para unirte!</p>
            `;
            return;
        }

        const { current_level_info, next_level_info, total_booster_blue, booster_tasks_completed_count, transactions } = data;
        const headerHTML = getHeaderHTML(current_level_info);
        const cardsHTML = getAllCardsHTML(data, total_booster_blue, booster_tasks_completed_count || 0);
        const progressHTML = getProgressHTML(total_booster_blue, current_level_info, next_level_info);
        const historyHTML = getHistoryHTML(transactions);

        elements.content.innerHTML = `${headerHTML}${cardsHTML}${progressHTML}${historyHTML}`;

        if (data.daily_improved) {
            const dailyCard = elements.content.querySelector('.booster-daily-goal');
            if (dailyCard) {
                dailyCard.classList.add('rank-improved');
                launchFireworks(dailyCard);
                setTimeout(() => dailyCard.classList.remove('rank-improved'), 2200);
            }
        }
    }

    function getHeaderHTML(levelInfo) {
        return `
            <div class="booster-header">
                <h1>${levelInfo ? levelInfo.name : 'Impulsor'}</h1>
                <span class="level-badge">Nivel ${levelInfo ? levelInfo.level : '?'}</span>
            </div>
        `;
    }

    function getAllCardsHTML(data, totalBlue, totalTasks) {
        const cards = [
            getTotalBlueCardHTML(totalBlue),
            getDailyGoalCardHTML(data),
            getRankingCardHTML(data),
            getTasksCardHTML(totalTasks)
        ].filter(Boolean);
        if (cards.length === 0) return '';
        return `<div class="booster-stats booster-stats-blocks booster-summary-cards">${cards.join('')}</div>`;
    }

    function getTotalBlueCardHTML(totalBlue) {
        return `
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">Total BLUE iou de Impulsor</div>
                <div class="ranking-position saldo-blue-text">${formatBalance(totalBlue)}</div>
            </div>
        `;
    }

    function getRankingCardHTML(data) {
        if (!data.rank_position || !data.rank_total) return '';
        const rankText = `#${data.rank_position} de ${formatInteger(data.rank_total)}`;
        const percentileText = data.rank_percentile ? `Top ${data.rank_percentile}%` : '';
        return `
            <div class="booster-stat-block booster-summary-card booster-ranking">
                <div class="ranking-title">Ranking</div>
                <div class="ranking-position">${rankText}</div>
                ${percentileText ? `<div class="ranking-subtitle">${percentileText}</div>` : ''}
            </div>
        `;
    }

    function getDailyGoalCardHTML(data) {
        if (data.daily_today == null || data.daily_yesterday == null) return '';
        const todayValue = Number(data.daily_today) || 0;
        const yesterdayValue = Number(data.daily_yesterday) || 0;
        const progress = yesterdayValue > 0 ? Math.min((todayValue / yesterdayValue) * 100, 100) : (todayValue > 0 ? 100 : 0);
        const delta = todayValue - yesterdayValue;
        return `
            <div class="booster-stat-block booster-summary-card booster-daily-goal">
                <div class="ranking-title">Meta diaria (hoy vs ayer)</div>
                <div class="daily-goal-value">${formatBalance(todayValue)} hoy</div>
                <div class="daily-goal-bar"><div class="daily-goal-fill" style="width: ${progress}%;"></div></div>
                <div class="ranking-subtitle">Ayer: ${formatBalance(yesterdayValue)} | Diferencia: ${formatDelta(delta)}</div>
                ${data.daily_improved ? `<div class="daily-goal-reward">🎉 ¡Mejoraste tu día anterior!</div>` : ''}
            </div>
        `;
    }

    function getTasksCardHTML(totalTasks) {
        return `
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">Tareas de Impulsor Completadas</div>
                <div class="ranking-position">${formatInteger(totalTasks)}</div>
            </div>
        `;
    }

    function getProgressHTML(totalBlue, currentLevel, nextLevel) {
        if (!nextLevel) {
            return `<div class="progress-section"><h3>¡Felicidades! Has alcanzado el nivel máximo.</h3></div>`;
        }
        const blueForNextLevel = parseFloat(nextLevel.min_blue_required);
        const blueInCurrentLevel = totalBlue - parseFloat(currentLevel.min_blue_required);
        const neededForNextLevel = blueForNextLevel - parseFloat(currentLevel.min_blue_required);
        const progressPercentage = Math.min((blueInCurrentLevel / neededForNextLevel) * 100, 100);
        return `
            <div class="progress-section">
                <h3>Progreso a ${nextLevel.name}</h3>
                <div class="progress-bar-container"><div class="progress-bar" style="width: ${progressPercentage}%;"></div></div>
                <div class="progress-labels">
                    <span>${formatBalance(totalBlue)} BLUE</span>
                    <span>${formatBalance(blueForNextLevel)} BLUE</span>
                </div>
            </div>
        `;
    }
    
    function getHistoryHTML(transactions) {
        if (!transactions || transactions.length === 0) {
            return `<div class="history-section"><h2>Historial de Actividades</h2><p class="empty-message">Aún no hay actividades registradas.</p></div>`;
        }
        const historyRows = transactions.map(entry => {
            const amount = Number(entry.amount) || 0;
            const sign = amount >= 0 ? '+' : '−';
            const absAmount = Math.abs(amount);
            const rawDescription = (entry.description || '').toString();
            const description = rawDescription.startsWith('Backfill:') ? 'Ajuste de saldo histórico' : (rawDescription || '(Sin descripción)');
            return `<tr><td>${new Date(entry.created_at).toLocaleDateString('es-ES')}</td><td>${description}</td><td class="saldo-blue-text">${sign}${formatBalance(absAmount)}</td></tr>`;
        }).join('');
        return `
            <div class="history-section">
                <h2>Historial de Ganancias</h2>
                <div class="table-container">
                    <table id="booster-history-table">
                        <thead><tr><th>Fecha</th><th>Descripción</th><th>BLUE Ganado</th></tr></thead>
                        <tbody>${historyRows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function formatBalance(value) {
        const num = Number(value) || 0;
        const formattedString = num.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        const parts = formattedString.split(',');
        if (parts.length === 2) return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        return formattedString;
    }

    function formatInteger(value) {
        return Number(value || 0).toLocaleString('es-ES');
    }

    function formatDelta(value) {
        const numeric = Number(value) || 0;
        const sign = numeric > 0 ? '+' : '';
        return `${sign}${formatBalance(numeric)}`;
    }

    function launchFireworks(container) {
        const colors = ['#f5d76e', '#6a5acd', '#2ecc71', '#ffffff'];
        const particlesPerBurst = 14;
        for (let i = 0; i < particlesPerBurst; i++) {
            const particle = document.createElement('span');
            const size = 6 + Math.random() * 5;
            const angle = Math.random() * Math.PI * 2;
            const distance = 40 + Math.random() * 70;
            particle.className = 'firework-particle';
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.background = colors[i % colors.length];
            particle.style.setProperty('--fx-x', `${Math.cos(angle) * distance}px`);
            particle.style.setProperty('--fx-y', `${Math.sin(angle) * distance}px`);
            particle.style.animationDelay = `${Math.random() * 0.4}s`;
            container.appendChild(particle);
            setTimeout(() => particle.remove(), 4200);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBoosterProfilePage);
} else {
    initializeBoosterProfilePage();
}

export { initializeBoosterProfilePage };
