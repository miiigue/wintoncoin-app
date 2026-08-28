// ============================================================================
// WintonCoin Android — SecuritySettingsEvent
// ============================================================================
// [PRESENTATION LAYER / MVI EVENT] Eventos de configuración de seguridad.
// ============================================================================

package com.wintoncoin.app.presentation.settings.security

sealed interface SecuritySettingsEvent {
    data class ToggleAppLock(val enabled: Boolean) : SecuritySettingsEvent
    data class ToggleTransactionBiometrics(val required: Boolean) : SecuritySettingsEvent
    data object ClearFeedback : SecuritySettingsEvent
    data object RefreshStatus : SecuritySettingsEvent
}
