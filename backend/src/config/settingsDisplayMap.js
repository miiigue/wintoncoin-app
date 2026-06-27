/**
 * Mapa centralizado: clave técnica de app_settings → etiqueta legible en español.
 * Se usa en correos de gobernanza, panel admin y catálogo de configuraciones.
 */
const SETTINGS_DISPLAY_MAP = {
    'allow_new_registrations': 'Permitir Nuevos Registros',
    'allow_new_publications': 'Permitir Nuevas Publicaciones',
    'public_profiles_enabled': 'Perfiles Públicos',
    'debt_system_enabled': 'Sistema de Deuda (Tokens RED)',
    'debt_cycle_days': 'Duración del Ciclo de Deuda RED — Días',
    'debt_cycle_hours': 'Duración del Ciclo de Deuda RED — Horas',
    'debt_cycle_minutes': 'Duración del Ciclo de Deuda RED — Minutos',
    'blue_escrow_days': 'Duración del Depósito BLUE (Escrow) — Días',
    'blue_escrow_hours': 'Duración del Depósito BLUE (Escrow) — Horas',
    'blue_escrow_minutes': 'Duración del Depósito BLUE (Escrow) — Minutos',
    'platform_commission_percentage': 'Comisión de Plataforma (%)',
    // --- SISTEMA DE IMPULSORES (BOOSTERS) ---
    // Controla si se activa la lógica de los impulsores y sus pagos.
    'booster_system_enabled': 'Sistema de Impulsores',
    // Determina si se habilitan los pagos periódicos con tiempos personalizados.
    'booster_custom_frequency_enabled': 'Impulsores — Activar Intervalo de Pago Personalizado (Switch)',
    // Cantidad de días del intervalo personalizado de pagos de impulsores.
    'booster_payment_frequency_days': 'Impulsores — Intervalo de Pago Personalizado (Días)',
    // Cantidad de horas del intervalo personalizado de pagos de impulsores.
    'booster_payment_frequency_hours': 'Impulsores — Intervalo de Pago Personalizado (Horas)',
    // Cantidad de minutos del intervalo personalizado de pagos de impulsores.
    'booster_payment_frequency_minutes': 'Impulsores — Intervalo de Pago Personalizado (Minutos)',
    // --- SISTEMA DE REFERIDOS (REFERRALS) ---
    // Indica si el sistema de referidos en general está activo.
    'referral_system_enabled': 'Sistema de Referidos',
    // Monto estándar pagado en tokens BLUE al referente/referido.
    'referral_reward_amount': 'Recompensa por Referido (BLUE)',
    // Monto alterno pagado después del vencimiento de la promoción de referidos.
    'referral_reward_after_expiry': 'Recompensa después de la Promo (BLUE)',
    // Fecha en la que vence la promoción especial de recompensas por referidos.
    'referral_codes_expiry_date': 'Vigencia de Códigos de Referido',
    // Parámetros heredados (Legacy) para soporte de retrocompatibilidad y auditoría.
    'referral_bonus_amount': 'Recompensa por Referido Legacy (Monto BLUE)',
    'referral_bonus_enabled': 'Recompensa por Referido Legacy (Switch Habilitado)',
    // --- BONO DE BIENVENIDA (WELCOME BONUS) ---
    // Indica si se paga un bono de bienvenida a cuentas nuevas.
    'welcome_bonus_enabled': 'Bono de Bienvenida',
    // Monto inicial del bono de bienvenida para nuevos registros.
    'welcome_bonus_amount': 'Monto del Bono de Bienvenida (BLUE)',
    // --- MODAL INTERSTICIAL & MODO PRE-LANZAMIENTO ---
    // Habilita el modal diario de motivación e información en el Dashboard.
    'global_app_interstitial_enabled': 'General — Activar Modal Diario Intersticial',
    // Título dinámico para el modal de noticias diarias del Dashboard.
    'daily_modal_title': 'Modal Diario — Título Informativo',
    // Textos informativos de lunes a domingo para avisos operacionales.
    'daily_modal_mon': 'Modal Diario — Mensaje de Lunes',
    'daily_modal_tue': 'Modal Diario — Mensaje de Martes',
    'daily_modal_wed': 'Modal Diario — Mensaje de Miércoles',
    'daily_modal_thu': 'Modal Diario — Mensaje de Jueves',
    'daily_modal_fri': 'Modal Diario — Mensaje de Viernes',
    'daily_modal_sat': 'Modal Diario — Mensaje de Sábado',
    'daily_modal_sun': 'Modal Diario — Mensaje de Domingo',
    // Indica si el sistema está operando en pre-lanzamiento.
    'pre_launch_mode_enabled': 'Modo Pre-Lanzamiento',
    'allow_request_publications': 'Permitir Publicaciones de "Solicitud"',
    'allow_sell_publications': 'Permitir Publicaciones de "Venta"',
    'allow_donation_publications': 'Permitir Publicaciones de "Donación"',
    'allow_quick_sale_publications': 'Permitir Publicaciones de "Venta Rápida"',
    'p2p_enabled': 'P2P — Habilitado',
    'p2p_price_min': 'P2P — Precio Mínimo (USD)',
    'p2p_price_max': 'P2P — Precio Máximo (USD)',
    'p2p_fee_percentage': 'P2P — Comisión (%)',
    'p2p_payment_window_minutes': 'P2P — Ventana de Pago (min)',
    'p2p_extension_minutes': 'P2P — Extensión (min)',
    'p2p_extension_limit': 'P2P — Límite de Extensiones',
    'p2p_cash_min_rating': 'P2P — Reputación Mínima para Efectivo',
    // Gobernanza (Winton-Consensus)
    'gov_quorum_percentage': 'Gobernanza — Quórum Requerido (%)',
    'gov_timelock_hours': 'Gobernanza — Time-Lock (horas)',
    'gov_request_expiry_hours': 'Gobernanza — Expiración de Solicitud (horas)',
    'gov_reminder_threshold_hours': 'Gobernanza — Umbral de Recordatorio (horas)',
    'gov_reminder_cooldown_hours': 'Gobernanza — Enfriamiento entre Recordatorios (horas)',
    'gov_vote_reward_blue': 'Gobernanza — Recompensa por Voto (BLUE IOU)',
    // Credit Scoring (Winton Trust Score)
    'red_credit_base_limit': 'Scoring — Límite Base RED (Nuevos Usuarios)',
    'red_credit_culture_quiz': 'Scoring — Bono por Cuestionario de Cultura (RED)',
    'red_credit_referral': 'Scoring — Bono por Referido Activo (RED)',
    'red_credit_monthly_activity': 'Scoring — Bono por Alta Actividad Mensual (>20) (RED)',
    'red_credit_early_payment': 'Scoring — Bono por Pago Anticipado de Deuda (<5 días) (RED)',
    // Web3 Smart Contracts (Optimism Sepolia — EIP-7702)
    'web3_protocol_paused': 'Web3 — Protocolo Pausado (Emergencia)',
    'web3_max_transaction_amount': 'Web3 — Límite Máximo por Transacción (BLUE)',
    'web3_founders_wallet': 'Web3 — Billetera de Fundadores (Treasury)',
    'web3_treasury_withdrawal': 'Web3 — Retiro de Excedentes del Treasury (BLUE)',
};

function settingLabel(key) {
    return SETTINGS_DISPLAY_MAP[key] || key;
}

module.exports = { SETTINGS_DISPLAY_MAP, settingLabel };
