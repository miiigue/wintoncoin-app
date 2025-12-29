package com.wintoncoin.app.ui.publication

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.data.model.PublicationRequest
import com.wintoncoin.app.data.repository.PublicationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PublicationViewModel @Inject constructor(
    private val repository: PublicationRepository
) : ViewModel() {

    var uiState by mutableStateOf(PublicationUiState())
        private set

    fun createPublication(
        type: String,
        title: String,
        description: String,
        amount: String,
        slots: Int,
        autoApprove: Boolean
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            
            // Lógica simple para asignar costo o venta según el tipo
            val blueCost = if (type == "request" || type == "donation") amount else null
            val blueSell = if (type == "sell") amount else null

            val request = PublicationRequest(
                type = type,
                title = title,
                description = description,
                blueCost = blueCost,
                blueSell = blueSell,
                availableSlots = slots,
                autoApprove = autoApprove,
                expirationTime = null // Simplificado por ahora
            )

            val result = repository.createPublication(request)
            uiState = if (result.isSuccess) {
                uiState.copy(isLoading = false, isSuccess = true)
            } else {
                uiState.copy(isLoading = false, error = result.exceptionOrNull()?.message)
            }
        }
    }
}

data class PublicationUiState(
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val error: String? = null
)

