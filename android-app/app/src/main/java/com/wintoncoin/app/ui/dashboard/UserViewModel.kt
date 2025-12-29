package com.wintoncoin.app.ui.dashboard

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.data.model.UserBalanceResponse
import com.wintoncoin.app.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UserViewModel @Inject constructor(
    private val repository: UserRepository
) : ViewModel() {

    var uiState by mutableStateOf(DashboardUiState())
        private set

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            val result = repository.getBalance()
            uiState = if (result.isSuccess) {
                uiState.copy(isLoading = false, balance = result.getOrNull())
            } else {
                uiState.copy(isLoading = false, error = result.exceptionOrNull()?.message)
            }
        }
    }
}

data class DashboardUiState(
    val isLoading: Boolean = false,
    val balance: UserBalanceResponse? = null,
    val error: String? = null
)

