// ============================================================================
// WintonCoin - Página de Perfil de Impulsor (Booster)
// ============================================================================

import { getApiUrl, showCustomAlert, handleSessionExpired, initializeInfoTooltip } from '../modules/index.js';

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

        // Inicializar tooltips después de renderizar
        initializeBoosterTooltips();

        // Inicializar modal de condiciones de desbloqueo
        initializeUnlockModal();

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
        const levelDescription = levelInfo?.description || 'Acumula más BLUE iou para subir de nivel.';
        return `
            <div class="booster-header">
                <h1>${levelInfo ? levelInfo.name : 'Impulsor'}</h1>
                <span class="level-badge info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-booster-level">Nivel ${levelInfo ? levelInfo.level : '?'}</span>
                <div id="tooltip-booster-level" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>${levelDescription}</p>
                </div>
            </div>
        `;
    }

    function getAllCardsHTML(data, totalBlue, totalTasks) {
        const cards = [
            getTotalBlueCardHTML(totalBlue),
            getDailyGoalCardHTML(data),
            getRankingCardHTML(data),
            getFriendsRankingCardHTML(data),
            getTasksCardHTML(totalTasks)
        ].filter(Boolean);
        if (cards.length === 0) return '';
        return `<div class="booster-stats booster-stats-blocks booster-summary-cards">${cards.join('')}</div>`;
    }

    function getTotalBlueCardHTML(totalBlue) {
        return `
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-total-blue">Total BLUE iou de Impulsor</span>
                </div>
                <div id="tooltip-total-blue" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>BLUE iou ganados por completar tareas de plataforma y referidos.</p>
                </div>
                <div class="ranking-position booster-total-highlight">${formatBalance(totalBlue)}</div>
            </div>
        `;
    }

    function getRankingCardHTML(data) {
        if (!data.rank_position || !data.rank_total) return '';
        const rankText = `#${data.rank_position} de ${formatInteger(data.rank_total)}`;
        const percentileText = data.rank_percentile ? `Top ${data.rank_percentile}%` : '';
        return `
            <div class="booster-stat-block booster-summary-card booster-ranking">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-ranking">Ranking Mundial</span>
                </div>
                <div id="tooltip-ranking" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Tu posición entre todos los impulsores activos de la plataforma.</p>
                </div>
                <div class="ranking-position">${rankText}</div>
                ${percentileText ? `<div class="ranking-subtitle">${percentileText}</div>` : ''}
            </div>
        `;
    }

    function getFriendsRankingCardHTML(data) {
        if (!data.friends_rank_position || !data.friends_rank_total) return '';
        const rankText = `#${data.friends_rank_position} de ${formatInteger(data.friends_rank_total)}`;
        const percentileText = data.friends_rank_percentile ? `Top ${data.friends_rank_percentile}%` : '';
        return `
            <div class="booster-stat-block booster-summary-card booster-ranking">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-friends-ranking">Ranking entre amigos</span>
                </div>
                <div id="tooltip-friends-ranking" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Tu posición frente a las personas que invitaste con tu código de referido.</p>
                </div>
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
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-daily-goal">Meta diaria (hoy vs ayer)</span>
                </div>
                <div id="tooltip-daily-goal" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Compara tus ganancias de hoy vs ayer. Supéralas diariamente para mejorar tu ranking.</p>
                </div>
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
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-tasks">Tareas de Impulsor Completadas</span>
                </div>
                <div id="tooltip-tasks" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Cantidad de tareas de plataforma que has completado como impulsor.</p>
                </div>
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
        const remaining = blueForNextLevel - totalBlue;
        const remainingFormatted = formatBalancePlain(remaining);
        return `
            <div class="progress-section">
                <h3 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-progress">Progreso a ${nextLevel.name}</h3>
                <div id="tooltip-progress" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Te faltan <strong>${remainingFormatted} BLUE iou</strong> para ${nextLevel.name}. ¡No te quedes atrás, otros impulsores ya están subiendo!</p>
                </div>
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
            return `<div class="history-section"><h2 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-history">Historial de Actividades</h2><div id="tooltip-history" class="info-tooltip" role="tooltip" aria-hidden="true"><p>Registro detallado de tus ganancias como impulsor.</p></div><p class="empty-message">Aún no hay actividades registradas.</p></div>`;
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
                <h2 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-history">Historial de Ganancias</h2>
                <div id="tooltip-history" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Registro detallado de tus ganancias como impulsor.</p>
                </div>
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
        const fixed = num.toFixed(4);
        const [intPart, decPart] = fixed.split('.');
        // Agregar separador de miles manualmente
        const intWithSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${intWithSeparator},<span class="decimal-part">${decPart}</span>`;
    }

    function formatBalancePlain(value) {
        const num = Number(value) || 0;
        const fixed = num.toFixed(4);
        const [intPart, decPart] = fixed.split('.');
        const intWithSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${intWithSeparator},${decPart}`;
    }

    function formatInteger(value) {
        return Number(value || 0).toLocaleString('es-ES');
    }

    function formatDelta(value) {
        const numeric = Number(value) || 0;
        const sign = numeric > 0 ? '+' : '';
        return `${sign}${formatBalance(numeric)}`;
    }

    function initializeBoosterTooltips() {
        // Inicializar cada tooltip si existe en el DOM
        const tooltips = [
            { trigger: '[data-tooltip-id="tooltip-booster-level"]', tooltip: '#tooltip-booster-level' },
            { trigger: '[data-tooltip-id="tooltip-total-blue"]', tooltip: '#tooltip-total-blue' },
            { trigger: '[data-tooltip-id="tooltip-daily-goal"]', tooltip: '#tooltip-daily-goal' },
            { trigger: '[data-tooltip-id="tooltip-ranking"]', tooltip: '#tooltip-ranking' },
            { trigger: '[data-tooltip-id="tooltip-friends-ranking"]', tooltip: '#tooltip-friends-ranking' },
            { trigger: '[data-tooltip-id="tooltip-tasks"]', tooltip: '#tooltip-tasks' },
            { trigger: '[data-tooltip-id="tooltip-progress"]', tooltip: '#tooltip-progress' },
            { trigger: '[data-tooltip-id="tooltip-history"]', tooltip: '#tooltip-history' }
        ];
        tooltips.forEach(({ trigger, tooltip }) => {
            if (document.querySelector(trigger) && document.querySelector(tooltip)) {
                initializeInfoTooltip(trigger, tooltip);
            }
        });
    }

    function initializeUnlockModal() {
        const modalOverlay = document.getElementById('unlockConditionsModalOverlay');
        const acceptBtn = document.getElementById('unlockModalAccept');

        if (!modalOverlay) return;

        // Mostrar siempre al entrar
        setTimeout(() => {
            modalOverlay.style.display = 'flex'; // Importante para centrar con flexbox
            // Forzar reflow
            void modalOverlay.offsetWidth;
            modalOverlay.classList.add('show');
        }, 500);

        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                modalOverlay.classList.remove('show');
                setTimeout(() => {
                    modalOverlay.style.display = 'none';
                }, 400); // Dar tiempo a la animación de salida
            });
        }

        // Cerrar al hacer clic fuera (en el overlay)
        window.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                modalOverlay.classList.remove('show');
                setTimeout(() => {
                    modalOverlay.style.display = 'none';
                }, 400);
            }
        });
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
