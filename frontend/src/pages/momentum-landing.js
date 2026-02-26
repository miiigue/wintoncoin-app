// ============================================================================
// WintonCoin - Momentum Landing Page Logic
// ============================================================================
// Controla: Simulador interactivo, Barra de FOMO, Social Proof,
//           Formulario de postulación y estado de autenticación.
//
// Dependencias:
//   - config.js (getApiUrl)
//   - auth.js (checkAuthStatus, userSession)
// ============================================================================

import { getApiUrl } from '../modules/config.js';
import { checkAuthStatus } from '../modules/auth.js';

// ============================================================================
// CONSTANTES Y ESTADO
// ============================================================================

const API_URL = getApiUrl();

// Tarifas base de ejemplo por tier (se sobreescriben si hay campañas reales)
const DEFAULT_BASE_PAYS = {
    BRONCE: 333,
    PLATA: 666,
    ORO: 1000,
    PLATINO: 2000
};

// Estado local del simulador
let selectedTier = 'BRONCE';
let currentMultiplier = 15;
let landingData = null;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[MOMENTUM LANDING] Inicializando...');

    // 1. Cargar datos públicos (no requiere auth)
    await loadLandingData();
    await loadRecentPayments();

    // 2. Configurar simulador interactivo
    setupSimulator();

    // 3. Verificar estado de autenticación para el formulario
    await checkAndSetupForm();
});

// ============================================================================
// DATOS PÚBLICOS (Sin autenticación)
// ============================================================================

/**
 * Carga la configuración pública (multiplicador, cupos, fase).
 * Alimenta la barra de FOMO y el simulador.
 */
async function loadLandingData() {
    try {
        const response = await fetch(`${API_URL}/api/momentum/landing-data`);
        if (!response.ok) throw new Error('Error al cargar datos');

        landingData = await response.json();

        // Actualizar multiplicador del simulador
        currentMultiplier = landingData.multiplier || 15;
        updateSimulatorDisplay();

        // Actualizar barra de FOMO
        updateFomoBar(landingData);

        // Iniciar countdown si hay fecha de fin
        if (landingData.phase_end_date) {
            startCountdown(new Date(landingData.phase_end_date));
        }
    } catch (error) {
        console.error('[MOMENTUM LANDING] Error cargando datos:', error);
        // Usar valores por defecto si falla
        updateSimulatorDisplay();
    }
}

/**
 * Actualiza la barra de FOMO (cupos + porcentaje).
 */
function updateFomoBar(data) {
    const fillEl = document.getElementById('mm-fomo-fill');
    const occupiedEl = document.getElementById('mm-fomo-occupied');
    const totalEl = document.getElementById('mm-fomo-total');

    if (fillEl && occupiedEl && totalEl) {
        occupiedEl.textContent = data.occupied_slots || 0;
        totalEl.textContent = data.total_slots || 100;

        // Animar la barra de progreso
        const percentage = data.slots_percentage || 0;
        setTimeout(() => {
            fillEl.style.width = `${percentage}%`;
        }, 500);
    }
}

/**
 * Inicia el countdown hacia la fecha de fin de fase.
 */
function startCountdown(endDate) {
    const daysEl = document.getElementById('mm-timer-days');
    const hoursEl = document.getElementById('mm-timer-hours');
    const minsEl = document.getElementById('mm-timer-mins');

    if (!daysEl || !hoursEl || !minsEl) return;

    function tick() {
        const now = new Date();
        const diff = endDate - now;

        if (diff <= 0) {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minsEl.textContent = '00';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minsEl.textContent = String(mins).padStart(2, '0');
    }

    tick(); // Ejecutar inmediatamente
    setInterval(tick, 60000); // Actualizar cada minuto
}

/**
 * Carga las últimas misiones pagadas (Social Proof).
 */
async function loadRecentPayments() {
    const listEl = document.getElementById('mm-proof-list');
    if (!listEl) return;

    try {
        const response = await fetch(`${API_URL}/api/momentum/recent-payments?limit=5`);
        if (!response.ok) throw new Error('Error al cargar pagos');

        const payments = await response.json();

        if (payments.length === 0) {
            listEl.innerHTML = `
                <div class="mm-proof-empty">
                    🎯 Aún no hay misiones completadas. ¡Sé el primero!
                </div>
            `;
            return;
        }

        // Renderizar las últimas misiones pagadas
        listEl.innerHTML = payments.map(payment => {
            const tierClass = `--${payment.tier.toLowerCase()}`;
            // Iniciales del nickname para el avatar
            const initials = (payment.nickname || 'U').substring(0, 2).toUpperCase();
            const amount = parseFloat(payment.paid_amount).toLocaleString('es-ES', { maximumFractionDigits: 2 });

            return `
                <div class="mm-proof-item">
                    <div class="mm-proof-item__user">
                        <div class="mm-proof-item__avatar ${tierClass}">${initials}</div>
                        <div>
                            <div class="mm-proof-item__name">${escapeHtml(payment.nickname)}</div>
                            <div class="mm-proof-item__campaign">${escapeHtml(payment.campaign_title)}</div>
                        </div>
                    </div>
                    <div class="mm-proof-item__amount">+${amount} BLUE IOU</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('[MOMENTUM LANDING] Error cargando social proof:', error);
        listEl.innerHTML = `
            <div class="mm-proof-empty">
                🎯 Aún no hay misiones completadas. ¡Sé el primero!
            </div>
        `;
    }
}

// ============================================================================
// SIMULADOR INTERACTIVO
// ============================================================================

/**
 * Configura los botones de selección de tier en el simulador.
 */
function setupSimulator() {
    const tierBtns = document.querySelectorAll('.mm-simulator__tier-btn');
    const baseEl = document.getElementById('mm-sim-base');

    tierBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover clase activa de todos
            tierBtns.forEach(b => b.classList.remove('--active'));
            // Activar el seleccionado
            btn.classList.add('--active');
            // Actualizar tier seleccionado
            selectedTier = btn.dataset.tier;

            // Actualizar el valor del input con el preset del nivel
            if (baseEl) {
                baseEl.value = DEFAULT_BASE_PAYS[selectedTier] || 333;
            }

            // Recalcular
            updateSimulatorDisplay();
        });
    });

    // Escuchar la escritura manual del creador
    if (baseEl) {
        baseEl.addEventListener('input', updateSimulatorDisplay);
    }
}

/**
 * Actualiza los valores del simulador según el tier seleccionado.
 */
function updateSimulatorDisplay() {
    const baseEl = document.getElementById('mm-sim-base');
    const multEl = document.getElementById('mm-sim-mult');
    const resultEl = document.getElementById('mm-sim-result');

    if (!baseEl || !multEl || !resultEl) return;

    // Leer el valor escrito por el usuario en lugar de un preset estático
    const basePay = parseFloat(baseEl.value) || 0;
    const result = basePay * currentMultiplier;

    // Actualizar pantalla (el input no se sobrescribe para evitar interferir)
    multEl.textContent = currentMultiplier;
    resultEl.textContent = result.toLocaleString('es-ES', { maximumFractionDigits: 2 });

    // Efecto visual de "flash" al cambiar
    resultEl.style.transform = 'scale(1.1)';
    setTimeout(() => { resultEl.style.transform = 'scale(1)'; }, 200);
}

// ============================================================================
// FORMULARIO DE POSTULACIÓN
// ============================================================================

/**
 * Verifica autenticación y muestra el estado apropiado:
 * - No autenticado: mostrar formulario normalmente (se valida al enviar)
 * - Autenticado sin perfil: mostrar formulario
 * - Autenticado con perfil: mostrar estado de perfil
 *
 * DISEÑO: El formulario siempre se muestra visible para que el creador
 * pueda verlo y llenarlo. La autenticación se verifica al hacer submit,
 * evitando el problema de "login → app → no vuelvo a momentum".
 */
async function checkAndSetupForm() {
    const formEl = document.getElementById('mm-apply-form');
    const appliedEl = document.getElementById('mm-applied-state');
    const loginPromptEl = document.getElementById('mm-login-prompt');

    // Ocultar prompt de login por defecto (ya no lo necesitamos bloqueando)
    if (loginPromptEl) loginPromptEl.style.display = 'none';

    try {
        // Verificar autenticación silenciosamente
        const authResult = await checkAuthStatus();

        if (!authResult || !authResult.isAuthenticated) {
            // No autenticado: mostrar formulario de todas formas
            // La validación de auth se hará al momento de enviar (submit)
            if (formEl) formEl.style.display = 'block';
            if (appliedEl) appliedEl.style.display = 'none';

            // Configurar formulario SIN token (pedirá login al enviar)
            setupFormSubmission(null);
            return;
        }

        // Autenticado: verificar si ya tiene perfil de Momentum
        const token = localStorage.getItem('token');
        const profileResponse = await fetch(`${API_URL}/api/momentum/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (profileResponse.ok) {
            // Ya tiene perfil: mostrar estado
            const profile = await profileResponse.json();
            if (formEl) formEl.style.display = 'none';

            // OCULTAR invitación a postularse (el h3 y p de arriba)
            const applyTitle = document.getElementById('mm-apply-title');
            const applyDesc = document.getElementById('mm-apply-desc');
            if (applyTitle) applyTitle.style.display = 'none';
            if (applyDesc) applyDesc.style.display = 'none';

            if (appliedEl) {
                appliedEl.style.display = 'block';

                // Cambiar mensajes si YA ESTÁ APROBADO (tier no es PENDIENTE)
                const appliedTitle = appliedEl.querySelector('.mm-applied-state__title');
                const appliedDesc = appliedEl.querySelector('.mm-applied-state__desc');

                if (profile.tier !== 'PENDIENTE') {
                    if (appliedTitle) appliedTitle.textContent = '¡Eres parte de Momentum!';
                    if (appliedDesc) appliedDesc.textContent = 'Tu perfil ha sido aprobado. Ya puedes acceder a las misiones y empezar a ganar.';
                } else {
                    if (appliedTitle) appliedTitle.textContent = '¡Ya estás postulado!';
                    if (appliedDesc) appliedDesc.textContent = 'Tu perfil está siendo revisado. Cuando te asignen un nivel, podrás acceder a las misiones.';
                }

                // Mostrar tier actual
                const tierEl = document.getElementById('mm-applied-tier');
                if (tierEl) {
                    const tierClass = `--${profile.tier.toLowerCase()}`;
                    tierEl.innerHTML = `<span class="mm-tier-badge ${tierClass}">${getTierEmoji(profile.tier)} ${profile.tier}</span>`;
                }

                // Mostrar botón de dashboard si el tier no es PENDIENTE
                const dashBtn = document.getElementById('mm-go-dashboard');
                if (dashBtn && profile.tier !== 'PENDIENTE') {
                    dashBtn.hidden = false;
                }
            }
        } else if (profileResponse.status === 404) {
            // No tiene perfil: mostrar formulario con token
            if (formEl) formEl.style.display = 'block';
            if (appliedEl) appliedEl.style.display = 'none';
            setupFormSubmission(token);
        } else {
            // Error desconocido: mostrar formulario de todas formas
            console.error('[MOMENTUM] Error verificando perfil:', profileResponse.status);
            if (formEl) formEl.style.display = 'block';
            setupFormSubmission(token);
        }
    } catch (error) {
        console.error('[MOMENTUM LANDING] Error en verificación de auth:', error);
        // En caso de error de red/API, mostrar formulario normalmente
        if (formEl) formEl.style.display = 'block';
        if (appliedEl) appliedEl.style.display = 'none';
        setupFormSubmission(null);
    }
}

/**
 * Configura el evento de envío del formulario de postulación.
 */
function setupFormSubmission(token) {
    const form = document.getElementById('mm-apply-form');
    const submitBtn = document.getElementById('mm-submit-btn');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Recoger datos del formulario
        const nickname = document.getElementById('mm-nickname').value.trim();
        const social_platform = document.getElementById('mm-platform').value;
        const social_link = document.getElementById('mm-social-link').value.trim();
        const followers_count = parseInt(document.getElementById('mm-followers').value) || 0;
        const niche = document.getElementById('mm-niche').value.trim();

        // Validaciones del frontend
        if (!nickname || nickname.length < 2) {
            showToast('El nombre artístico debe tener al menos 2 caracteres.', 'error');
            return;
        }
        if (!social_platform) {
            showToast('Selecciona tu plataforma principal.', 'error');
            return;
        }
        if (!social_link) {
            showToast('El link de tu perfil es obligatorio.', 'error');
            return;
        }

        // =========================================================
        // Verificación de autenticación al momento de enviar
        // Si no hay token, el usuario necesita loguearse primero
        // =========================================================
        if (!token) {
            showToast('Para postularte necesitas iniciar sesión. Inicia sesión en WintonCoin y vuelve a esta página.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Enviar Postulación';

            // Mostrar el prompt de login debajo del formulario como ayuda
            const loginPromptEl = document.getElementById('mm-login-prompt');
            if (loginPromptEl) loginPromptEl.style.display = 'block';
            return;
        }

        // Deshabilitar botón durante envío
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Enviando postulación...';

        try {
            const response = await fetch(`${API_URL}/api/momentum/apply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    nickname,
                    social_platform,
                    social_link,
                    followers_count,
                    niche
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast('🎉 ¡Postulación enviada exitosamente!', 'success');
                // Recargar para mostrar el estado actualizado
                setTimeout(() => location.reload(), 1500);
            } else {
                showToast(data.message || 'Error al enviar postulación.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Enviar Postulación';
            }
        } catch (error) {
            console.error('[MOMENTUM] Error en postulación:', error);
            showToast('Error de conexión. Intenta nuevamente.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Enviar Postulación';
        }
    });
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Muestra un toast de notificación temporal.
 * @param {string} message - Texto del toast
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('mm-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `mm-toast --${type} --visible`;

    // Auto-ocultar después de 4 segundos
    setTimeout(() => {
        toast.classList.remove('--visible');
    }, 4000);
}

/**
 * Escapa HTML para prevenir XSS en contenido dinámico.
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Retorna el emoji correspondiente al tier.
 */
function getTierEmoji(tier) {
    const emojis = {
        PENDIENTE: '⏳',
        BRONCE: '🥉',
        PLATA: '🥈',
        ORO: '🥇',
        PLATINO: '💎'
    };
    return emojis[tier] || '❓';
}
