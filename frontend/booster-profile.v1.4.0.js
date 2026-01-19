document.addEventListener('DOMContentLoaded', () => {

    // --- Configuración y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    // Lógica mejorada para obtener el nombre de usuario
    const urlParams = new URLSearchParams(window.location.search);
    const usernameFromUrl = urlParams.get('username');
    const usernameFromStorage = localStorage.getItem('username');

    const profileUsername = usernameFromUrl || usernameFromStorage; // Prioriza la URL

    const elements = {
        content: document.getElementById('booster-profile-content')
    };

    // --- Inicialización ---
    if (!profileUsername) {
        // Ahora el mensaje es más genérico, puede que no haya iniciado sesión o falte el username en la URL
        elements.content.innerHTML = `<p class="error-message">No se pudo determinar el perfil a mostrar. Asegúrate de haber iniciado sesión o de que la URL sea correcta.</p>`;
        showCustomAlert('No se pudo determinar qué perfil mostrar.', () => { window.location.href = 'index.html'; });
        return;
    }

    fetchBoosterProfile(profileUsername);

    // --- Lógica de Datos ---
    async function fetchBoosterProfile(username) {
        try {
            const token = localStorage.getItem('token');
            const loggedUsername = localStorage.getItem('username');

            // Profesional: si estoy viendo MI perfil, uso /api/me (id del JWT) y mando Authorization.
            // Si estoy viendo otro perfil vía URL, usamos el endpoint público por username (compatibilidad).
            const isMe = loggedUsername && username === loggedUsername && token;
            const url = isMe
                ? `${API_URL}/api/me/booster-profile`
                : `${API_URL}/api/users/${username}/booster-profile`;

            const response = await fetch(url, {
                headers: isMe ? { 'Authorization': `Bearer ${token}` } : {}
            });
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

    // --- Lógica de Renderizado ---
    function renderProfile(data) {
        if (!data.is_booster) {
            elements.content.innerHTML = `
                <div class="booster-header">
                    <h1>Programa de Impulsores</h1>
                </div>
                <p class="empty-message" style="text-align: center; font-size: 1.1rem; margin: 2rem;">${data.message}<br>¡Completa tareas de la plataforma para unirte!</p>
            `;
            return;
        }

        const {
            current_level_info,
            next_level_info,
            total_booster_blue,
            booster_tasks_completed_count,
            transactions // Historial (bonos + tareas + pagos)
        } = data;

        const headerHTML = getHeaderHTML(current_level_info);
        const statsHTML = getStatsHTML(total_booster_blue, booster_tasks_completed_count || 0);
        const progressHTML = getProgressHTML(total_booster_blue, current_level_info, next_level_info);
        const historyHTML = getHistoryHTML(transactions);

        elements.content.innerHTML = `
            ${headerHTML}
            ${statsHTML}
            ${progressHTML}
            ${historyHTML}
        `;
    }

    function getHeaderHTML(levelInfo) {
        return `
            <div class="booster-header">
                <h1>${levelInfo ? levelInfo.name : 'Impulsor'}</h1>
                <span class="level-badge">Nivel ${levelInfo ? levelInfo.level : '?'}</span>
            </div>
        `;
    }

    function getStatsHTML(totalBlue, totalTasks) {
        return `
            <div class="booster-stats">
                <div class="stat-box">
                    <h4>Total BLUE de Impulsor</h4>
                    <p class="stat-value saldo-blue-text">${formatBalance(totalBlue)}</p>
                </div>
                <div class="stat-box">
                    <h4>Tareas de Impulsor Completadas</h4>
                    <p class="stat-value">${totalTasks}</p>
                </div>
            </div>
        `;
    }

    function getProgressHTML(totalBlue, currentLevel, nextLevel) {
        if (!nextLevel) {
            return `
                <div class="progress-section">
                    <h3>¡Felicidades! Has alcanzado el nivel máximo.</h3>
                </div>
            `;
        }
    
        const blueForNextLevel = parseFloat(nextLevel.min_blue_required);
        const blueInCurrentLevel = totalBlue - parseFloat(currentLevel.min_blue_required);
        const neededForNextLevel = blueForNextLevel - parseFloat(currentLevel.min_blue_required);
        
        const progressPercentage = Math.min((blueInCurrentLevel / neededForNextLevel) * 100, 100);
    
        return `
            <div class="progress-section">
                <h3>Progreso a ${nextLevel.name}</h3>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progressPercentage}%;"></div>
                </div>
                <div class="progress-labels">
                    <span>${formatBalance(totalBlue)} BLUE</span>
                    <span>${formatBalance(blueForNextLevel)} BLUE</span>
                </div>
            </div>
        `;
    }
    
    function getHistoryHTML(transactions) { // <-- CORRECCIÓN: El parámetro ahora es 'transactions'
        if (!transactions || transactions.length === 0) {
            return `
                <div class="history-section">
                    <h2>Historial de Actividades</h2>
                    <p class="empty-message">Aún no hay actividades registradas.</p>
                </div>
            `;
        }

        const historyRows = transactions.map(entry => {
            const amount = Number(entry.amount) || 0;
            const sign = amount >= 0 ? '+' : '−';
            const absAmount = Math.abs(amount);
            // Profesional: nunca mostrar jerga interna tipo "Backfill" al usuario final.
            // Si existen registros antiguos en la DB con ese texto, los normalizamos aquí.
            const rawDescription = (entry.description || '').toString();
            const description = rawDescription.startsWith('Backfill:')
                ? 'Ajuste de saldo histórico (sin detalle disponible)'
                : (rawDescription || '(Sin descripción)');
            return `
            <tr>
                <td>${new Date(entry.created_at).toLocaleDateString('es-ES')}</td>
                <td>${description}</td>
                <td class="saldo-blue-text">${sign}${formatBalance(absAmount)}</td>
            </tr>
        `;
        }).join('');

        return `
            <div class="history-section">
                <h2>Historial de Ganancias</h2>
                <div class="table-container">
                    <table id="booster-history-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Descripción</th>
                                <th>BLUE Ganado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${historyRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // --- Helpers ---
    function formatBalance(value) {
        const num = Number(value) || 0;
        const formattedString = num.toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
        const parts = formattedString.split(',');
        if (parts.length === 2) {
            return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        }
        return formattedString;
    }
});
document.addEventListener('DOMContentLoaded', () => {

    // --- Configuración y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    // Lógica mejorada para obtener el nombre de usuario
    const urlParams = new URLSearchParams(window.location.search);
    const usernameFromUrl = urlParams.get('username');
    const usernameFromStorage = localStorage.getItem('username');

    const profileUsername = usernameFromUrl || usernameFromStorage; // Prioriza la URL

    const elements = {
        content: document.getElementById('booster-profile-content')
    };

    // --- Inicialización ---
    if (!profileUsername) {
        // Ahora el mensaje es más genérico, puede que no haya iniciado sesión o falte el username en la URL
        elements.content.innerHTML = `<p class="error-message">No se pudo determinar el perfil a mostrar. Asegúrate de haber iniciado sesión o de que la URL sea correcta.</p>`;
        showCustomAlert('No se pudo determinar qué perfil mostrar.', () => { window.location.href = 'index.html'; });
        return;
    }

    fetchBoosterProfile(profileUsername);

    // --- Lógica de Datos ---
    async function fetchBoosterProfile(username) {
        try {
            const token = localStorage.getItem('token');
            const loggedUsername = localStorage.getItem('username');

            // Profesional: si estoy viendo MI perfil, uso /api/me (id del JWT) y mando Authorization.
            // Si estoy viendo otro perfil vía URL, usamos el endpoint público por username (compatibilidad).
            const isMe = loggedUsername && username === loggedUsername && token;
            const url = isMe
                ? `${API_URL}/api/me/booster-profile`
                : `${API_URL}/api/users/${username}/booster-profile`;

            const response = await fetch(url, {
                headers: isMe ? { 'Authorization': `Bearer ${token}` } : {}
            });
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

    // --- Lógica de Renderizado ---
    function renderProfile(data) {
        if (!data.is_booster) {
            elements.content.innerHTML = `
                <div class="booster-header">
                    <h1>Programa de Impulsores</h1>
                </div>
                <p class="empty-message" style="text-align: center; font-size: 1.1rem; margin: 2rem;">${data.message}<br>¡Completa tareas de la plataforma para unirte!</p>
            `;
            return;
        }

        const {
            current_level_info,
            next_level_info,
            total_booster_blue,
            booster_tasks_completed_count,
            transactions // Historial (bonos + tareas + pagos)
        } = data;

        const headerHTML = getHeaderHTML(current_level_info);
        const statsHTML = getStatsHTML(total_booster_blue, booster_tasks_completed_count || 0);
        const progressHTML = getProgressHTML(total_booster_blue, current_level_info, next_level_info);
        const historyHTML = getHistoryHTML(transactions);

        elements.content.innerHTML = `
            ${headerHTML}
            ${statsHTML}
            ${progressHTML}
            ${historyHTML}
        `;
    }

    function getHeaderHTML(levelInfo) {
        return `
            <div class="booster-header">
                <h1>${levelInfo ? levelInfo.name : 'Impulsor'}</h1>
                <span class="level-badge">Nivel ${levelInfo ? levelInfo.level : '?'}</span>
            </div>
        `;
    }

    function getStatsHTML(totalBlue, totalTasks) {
        return `
            <div class="booster-stats">
                <div class="stat-box">
                    <h4>Total BLUE de Impulsor</h4>
                    <p class="stat-value saldo-blue-text">${formatBalance(totalBlue)}</p>
                </div>
                <div class="stat-box">
                    <h4>Tareas de Impulsor Completadas</h4>
                    <p class="stat-value">${totalTasks}</p>
                </div>
            </div>
        `;
    }

    function getProgressHTML(totalBlue, currentLevel, nextLevel) {
        if (!nextLevel) {
            return `
                <div class="progress-section">
                    <h3>¡Felicidades! Has alcanzado el nivel máximo.</h3>
                </div>
            `;
        }
    
        const blueForNextLevel = parseFloat(nextLevel.min_blue_required);
        const blueInCurrentLevel = totalBlue - parseFloat(currentLevel.min_blue_required);
        const neededForNextLevel = blueForNextLevel - parseFloat(currentLevel.min_blue_required);
        
        const progressPercentage = Math.min((blueInCurrentLevel / neededForNextLevel) * 100, 100);
    
        return `
            <div class="progress-section">
                <h3>Progreso a ${nextLevel.name}</h3>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progressPercentage}%;"></div>
                </div>
                <div class="progress-labels">
                    <span>${formatBalance(totalBlue)} BLUE</span>
                    <span>${formatBalance(blueForNextLevel)} BLUE</span>
                </div>
            </div>
        `;
    }
    
    function getHistoryHTML(transactions) { // <-- CORRECCIÓN: El parámetro ahora es 'transactions'
        if (!transactions || transactions.length === 0) {
            return `
                <div class="history-section">
                    <h2>Historial de Actividades</h2>
                    <p class="empty-message">Aún no hay actividades registradas.</p>
                </div>
            `;
        }

        const historyRows = transactions.map(entry => {
            const amount = Number(entry.amount) || 0;
            const sign = amount >= 0 ? '+' : '−';
            const absAmount = Math.abs(amount);
            // Profesional: nunca mostrar jerga interna tipo "Backfill" al usuario final.
            // Si existen registros antiguos en la DB con ese texto, los normalizamos aquí.
            const rawDescription = (entry.description || '').toString();
            const description = rawDescription.startsWith('Backfill:')
                ? 'Ajuste de saldo histórico (sin detalle disponible)'
                : (rawDescription || '(Sin descripción)');
            return `
            <tr>
                <td>${new Date(entry.created_at).toLocaleDateString('es-ES')}</td>
                <td>${description}</td>
                <td class="saldo-blue-text">${sign}${formatBalance(absAmount)}</td>
            </tr>
        `;
        }).join('');

        return `
            <div class="history-section">
                <h2>Historial de Ganancias</h2>
                <div class="table-container">
                    <table id="booster-history-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Descripción</th>
                                <th>BLUE Ganado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${historyRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // --- Helpers ---
    function formatBalance(value) {
        const num = Number(value) || 0;
        const formattedString = num.toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
        const parts = formattedString.split(',');
        if (parts.length === 2) {
            return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        }
        return formattedString;
    }
});
