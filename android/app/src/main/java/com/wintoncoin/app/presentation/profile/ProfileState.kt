// ============================================================================
// WintonCoin Android — ProfileState (Estado de UI de Perfil)
// ============================================================================
// Data class inmutable para la pantalla de Perfil de Usuario.
// ============================================================================

package com.wintoncoin.app.presentation.profile

import com.wintoncoin.app.domain.model.UserProfile

data class ProfileState(
    val username: String = "",
    val isLoading: Boolean = true,
    val profile: UserProfile? = null,
    val isMyProfile: Boolean = false,
    val errorMessage: String? = null
)
