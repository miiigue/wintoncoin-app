// ============================================================================
// WintonCoin Android — WalletViewModel (ViewModel de Billetera)
// ============================================================================

package com.wintoncoin.app.presentation.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.GetTransactionHistoryUseCase
import com.wintoncoin.app.domain.usecase.GetWalletBalanceUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val getWalletBalanceUseCase: GetWalletBalanceUseCase,
    private val getTransactionHistoryUseCase: GetTransactionHistoryUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(WalletState())
    val state: StateFlow<WalletState> = _state.asStateFlow()

    init {
        loadWalletData()
    }

    fun onEvent(event: WalletEvent) {
        when (event) {
            is WalletEvent.TabSelected -> {
                _state.update { it.copy(selectedTab = event.tab) }
            }
            is WalletEvent.Refresh -> {
                loadWalletData()
            }
            is WalletEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    fun loadWalletData() {
        _state.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            val balanceDeferred = getWalletBalanceUseCase()
            val historyDeferred = getTransactionHistoryUseCase()

            var newBalance = _state.value.balance
            var newHistory = _state.value.transactions
            var errorMsg: String? = null

            if (balanceDeferred is Result.Success) {
                newBalance = balanceDeferred.data
            } else if (balanceDeferred is Result.Error) {
                errorMsg = balanceDeferred.message
            }

            if (historyDeferred is Result.Success) {
                newHistory = historyDeferred.data
            }

            _state.update {
                it.copy(
                    isLoading = false,
                    balance = newBalance,
                    transactions = newHistory,
                    errorMessage = errorMsg
                )
            }
        }
    }
}
