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
    'booster_system_enabled': 'Sistema de Impulsores',
    'referral_system_enabled': 'Sistema de Referidos',
    'referral_reward_amount': 'Recompensa por Referido (BLUE)',
    'referral_reward_after_expiry': 'Recompensa después de la Promo (BLUE)',
    'referral_codes_expiry_date': 'Vigencia de Códigos de Referido',
    'welcome_bonus_enabled': 'Bono de Bienvenida',
    'welcome_bonus_amount': 'Monto del Bono de Bienvenida (BLUE)',
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
};

function settingLabel(key) {
    return SETTINGS_DISPLAY_MAP[key] || key;
}

module.exports = { SETTINGS_DISPLAY_MAP, settingLabel };
