// ============================================================================
// WintonCoin Android — AppLockEvent
// ============================================================================
// [PRESENTATION LAYER / MVI EVENT] Eventos de la pantalla de bloqueo.
// ============================================================================

package com.wintoncoin.app.presentation.lock

import androidx.fragment.app.FragmentActivity

sealed interface AppLockEvent {
    data class AuthenticateBiometrics(val activity: FragmentActivity) : AppLockEvent
    data object ClearError : AppLockEvent
    data object Logout : AppLockEvent
}
