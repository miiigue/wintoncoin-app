// ============================================================================
// WintonCoin Android — ProfileViewModel (ViewModel de Perfil)
// ============================================================================
// [PRESENTATION LAYER] Administra la carga reactiva de datos del perfil.
// ============================================================================

package com.wintoncoin.app.presentation.profile

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.GetProfileUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val getProfileUseCase: GetProfileUseCase,
    private val tokenManager: TokenManager,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val initialUsername: String = savedStateHandle.get<String>("username")
        ?: tokenManager.getUsername() ?: ""

    private val _state = MutableStateFlow(ProfileState(username = initialUsername))
    val state: StateFlow<ProfileState> = _state.asStateFlow()

    init {
        if (initialUsername.isNotBlank()) {
            loadProfile(initialUsername)
        }
    }

    fun onEvent(event: ProfileEvent) {
        when (event) {
            is ProfileEvent.LoadProfile -> loadProfile(event.targetUsername)
            is ProfileEvent.Refresh -> loadProfile(_state.value.username)
            is ProfileEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun loadProfile(targetUser: String) {
        val sessionUser = tokenManager.getUsername()
        val isMyProfile = sessionUser != null && sessionUser.equals(targetUser, ignoreCase = true)

        _state.update { it.copy(isLoading = true, username = targetUser, isMyProfile = isMyProfile, errorMessage = null) }

        viewModelScope.launch {
            val result = getProfileUseCase(targetUser, sessionUser)
            when (result) {
                is Result.Success -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            profile = result.data
                        )
                    }
                }
                is Result.Error -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }
}
