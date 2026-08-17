// ============================================================================
// WintonCoin Android — MarketplaceViewModel (ViewModel del Feed de Tareas)
// ============================================================================
// [PRESENTATION LAYER / STATE MANAGEMENT] Gestiona el estado reactivo,
// filtrado por chips y búsqueda del Marketplace.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.usecase.GetMarketplaceFeedUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MarketplaceViewModel @Inject constructor(
    private val getMarketplaceFeedUseCase: GetMarketplaceFeedUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(MarketplaceState())
    val state: StateFlow<MarketplaceState> = _state.asStateFlow()

    init {
        loadFeed()
    }

    fun onEvent(event: MarketplaceEvent) {
        when (event) {
            is MarketplaceEvent.LoadFeed -> loadFeed(isRefreshing = false)
            is MarketplaceEvent.Refresh -> loadFeed(isRefreshing = true)
            is MarketplaceEvent.SelectCategory -> selectCategory(event.category)
            is MarketplaceEvent.UpdateSearchQuery -> updateSearch(event.query)
            is MarketplaceEvent.ClearMessages -> _state.update { it.copy(errorMessage = null, successMessage = null) }
        }
    }

    private fun loadFeed(isRefreshing: Boolean = false) {
        viewModelScope.launch {
            if (isRefreshing) {
                _state.update { it.copy(isRefreshing = true, errorMessage = null) }
            } else {
                _state.update { it.copy(isLoading = true, errorMessage = null) }
            }

            val result = getMarketplaceFeedUseCase(
                search = _state.value.searchQuery.ifBlank { null },
                category = _state.value.selectedCategory
            )

            result.fold(
                onSuccess = { items ->
                    _state.update {
                        it.copy(
                            publications = items,
                            isLoading = false,
                            isRefreshing = false,
                            errorMessage = null
                        )
                    }
                },
                onFailure = { error ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            errorMessage = error.localizedMessage ?: "Error al cargar publicaciones."
                        )
                    }
                }
            )
        }
    }

    private fun selectCategory(category: MarketplaceCategory) {
        _state.update { it.copy(selectedCategory = category) }
        loadFeed()
    }

    private fun updateSearch(query: String) {
        _state.update { it.copy(searchQuery = query) }
        loadFeed()
    }
}
