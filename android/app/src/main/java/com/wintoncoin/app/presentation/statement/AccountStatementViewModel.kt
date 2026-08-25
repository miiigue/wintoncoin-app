// ============================================================================
// WintonCoin Android — AccountStatementViewModel
// ============================================================================
// [PRESENTATION / VIEWMODEL] Controla el flujo de datos reactivo, el cálculo
// dinámico de simulación de colateral y la apertura de modales de Smart Contracts.
// ============================================================================

package com.wintoncoin.app.presentation.statement

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.usecase.GetAccountStatementUseCase
import com.wintoncoin.app.domain.usecase.GetSmartContractInfoUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AccountStatementViewModel @Inject constructor(
    private val getAccountStatementUseCase: GetAccountStatementUseCase,
    private val getSmartContractInfoUseCase: GetSmartContractInfoUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(AccountStatementState())
    val state: StateFlow<AccountStatementState> = _state.asStateFlow()

    init {
        loadData()
    }

    fun onEvent(event: AccountStatementEvent) {
        when (event) {
            is AccountStatementEvent.Load -> loadData()
            is AccountStatementEvent.Refresh -> refreshData()
            is AccountStatementEvent.OpenSmartContractDialog -> openSmartContractModal(event.tokenType)
            is AccountStatementEvent.DismissSmartContractDialog -> {
                _state.update { it.copy(showSmartContractDialog = false, selectedSmartContract = null) }
            }
            is AccountStatementEvent.ShowActivityInfoDialog -> {
                _state.update { it.copy(activityInfoDialogMessage = event.message) }
            }
            is AccountStatementEvent.DismissActivityInfoDialog -> {
                _state.update { it.copy(activityInfoDialogMessage = null) }
            }
            is AccountStatementEvent.ToggleVaultPanel -> {
                _state.update { it.copy(showVaultPanel = !it.showVaultPanel) }
            }
            is AccountStatementEvent.SelectVaultToken -> {
                _state.update { it.copy(vaultSelectedToken = event.token) }
            }
            is AccountStatementEvent.VaultAmountChanged -> {
                val input = event.amount.trim()
                val parsed = input.toDoubleOrNull() ?: 0.0
                val currentLimit = _state.value.summary?.redCreditLimit ?: 0.0
                val simulated = if (parsed > 0) currentLimit + parsed else null
                _state.update {
                    it.copy(
                        vaultDepositAmount = input,
                        vaultSimulatedLimit = simulated
                    )
                }
            }
            is AccountStatementEvent.CopyText -> {
                _state.update { it.copy(copyFeedback = "¡${event.label} copiado al portapapeles!") }
            }
            is AccountStatementEvent.DismissCopyFeedback -> {
                _state.update { it.copy(copyFeedback = null) }
            }
            is AccountStatementEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            getAccountStatementUseCase()
                .onSuccess { data ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            summary = data.summary,
                            stats = data.stats,
                            transactions = data.transactions
                        )
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Error al cargar estado de cuenta."
                        )
                    }
                }
        }
    }

    private fun refreshData() {
        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, errorMessage = null) }
            getAccountStatementUseCase()
                .onSuccess { data ->
                    _state.update {
                        it.copy(
                            isRefreshing = false,
                            summary = data.summary,
                            stats = data.stats,
                            transactions = data.transactions
                        )
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            isRefreshing = false,
                            errorMessage = error.message ?: "Error al actualizar datos."
                        )
                    }
                }
        }
    }

    private fun openSmartContractModal(tokenType: String) {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoadingSmartContract = true,
                    showSmartContractDialog = true,
                    selectedSmartContract = null
                )
            }
            getSmartContractInfoUseCase(tokenType)
                .onSuccess { contractInfo ->
                    _state.update {
                        it.copy(
                            isLoadingSmartContract = false,
                            selectedSmartContract = contractInfo
                        )
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            isLoadingSmartContract = false,
                            errorMessage = error.message ?: "Error al obtener información del contrato."
                        )
                    }
                }
        }
    }
}
