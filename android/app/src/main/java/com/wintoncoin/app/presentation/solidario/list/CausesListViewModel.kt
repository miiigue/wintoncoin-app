// ============================================================================
// WintonCoin Android — CausesListViewModel
// ============================================================================
// [PRESENTATION / VIEWMODEL] Gestiona el listado y búsqueda de causas solidarias.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.list

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.usecase.GetApprovedCausesUseCase
import com.wintoncoin.app.domain.usecase.GetMyCausesUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CausesListViewModel @Inject constructor(
    private val getApprovedCausesUseCase: GetApprovedCausesUseCase,
    private val getMyCausesUseCase: GetMyCausesUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(CausesListState())
    val state: StateFlow<CausesListState> = _state.asStateFlow()

    init {
        loadData()
    }

    fun onEvent(event: CausesListEvent) {
        when (event) {
            is CausesListEvent.Load -> loadData()
            is CausesListEvent.Refresh -> refreshData()
            is CausesListEvent.SelectTab -> _state.update { it.copy(selectedTab = event.tab) }
            is CausesListEvent.SearchQueryChanged -> _state.update { it.copy(searchQuery = event.query) }
            is CausesListEvent.DismissError -> _state.update { it.copy(errorMessage = null) }
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }

            val approvedDeferred = async { getApprovedCausesUseCase() }
            val myDeferred = async { getMyCausesUseCase() }

            val approvedResult = approvedDeferred.await()
            val myResult = myDeferred.await()

            if (approvedResult.isSuccess || myResult.isSuccess) {
                _state.update {
                    it.copy(
                        isLoading = false,
                        approvedCauses = approvedResult.getOrDefault(emptyList()),
                        myCauses = myResult.getOrDefault(emptyList()),
                        errorMessage = null
                    )
                }
            } else {
                val error = approvedResult.exceptionOrNull() ?: myResult.exceptionOrNull()
                _state.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error?.message ?: "Error al cargar las causas solidarias."
                    )
                }
            }
        }
    }

    private fun refreshData() {
        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, errorMessage = null) }

            val approvedDeferred = async { getApprovedCausesUseCase() }
            val myDeferred = async { getMyCausesUseCase() }

            val approvedResult = approvedDeferred.await()
            val myResult = myDeferred.await()

            _state.update {
                it.copy(
                    isRefreshing = false,
                    approvedCauses = approvedResult.getOrDefault(it.approvedCauses),
                    myCauses = myResult.getOrDefault(it.myCauses)
                )
            }
        }
    }
}
