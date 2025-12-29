package com.wintoncoin.app.ui.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.data.model.LoginRequest
import com.wintoncoin.app.data.model.RegisterRequest
import com.wintoncoin.app.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repository: AuthRepository
) : ViewModel() {

    var uiState by mutableStateOf(AuthUiState())
        private set

    fun login(username: String, password: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            val result = repository.login(LoginRequest(username, password))
            uiState = if (result.isSuccess) {
                uiState.copy(isLoading = false, isAuthenticated = true)
            } else {
                uiState.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Error desconocido")
            }
        }
    }

    fun register(request: RegisterRequest) {
         viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            val result = repository.register(request)
            uiState = if (result.isSuccess) {
                // Tras registro exitoso, normalmente pedimos login o mostramos mensaje
                uiState.copy(isLoading = false, isRegistered = true)
            } else {
                uiState.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Error al registrar")
            }
        }
    }
    
    fun clearError() {
        uiState = uiState.copy(error = null)
    }
}

data class AuthUiState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val isRegistered: Boolean = false,
    val error: String? = null
)

