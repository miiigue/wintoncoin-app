// ============================================================================
// WintonCoin Android — NotificationsViewModel
// ============================================================================
// [PRESENTATION / VIEWMODEL] Gestiona el estado reactivo, la carga concurrente,
// el descarte individual y la limpieza masiva de alertas con StateFlow.
// ============================================================================

package com.wintoncoin.app.presentation.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.usecase.DismissNotificationUseCase
import com.wintoncoin.app.domain.usecase.GetNotificationHistoryUseCase
import com.wintoncoin.app.domain.usecase.GetUnreadNotificationsUseCase
import com.wintoncoin.app.domain.usecase.MarkAllNotificationsAsReadUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val getUnreadNotificationsUseCase: GetUnreadNotificationsUseCase,
    private val getNotificationHistoryUseCase: GetNotificationHistoryUseCase,
    private val markAllNotificationsAsReadUseCase: MarkAllNotificationsAsReadUseCase,
    private val dismissNotificationUseCase: DismissNotificationUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsState())
    val state: StateFlow<NotificationsState> = _state.asStateFlow()

    init {
        loadData()
    }

    fun onEvent(event: NotificationsEvent) {
        when (event) {
            is NotificationsEvent.Load -> loadData()
            is NotificationsEvent.Refresh -> refreshData()
            is NotificationsEvent.SelectTab -> {
                _state.update { it.copy(selectedTab = event.tab) }
            }
            is NotificationsEvent.SelectCategoryFilter -> {
                _state.update { it.copy(selectedCategoryFilter = event.category) }
            }
            is NotificationsEvent.DismissNotification -> dismissNotification(event.id)
            is NotificationsEvent.MarkAllAsRead -> markAllAsRead()
            is NotificationsEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
            is NotificationsEvent.DismissFeedback -> {
                _state.update { it.copy(feedbackMessage = null) }
            }
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }

            val unreadDeferred = async { getUnreadNotificationsUseCase() }
            val historyDeferred = async { getNotificationHistoryUseCase() }

            val unreadResult = unreadDeferred.await()
            val historyResult = historyDeferred.await()

            if (unreadResult.isSuccess && historyResult.isSuccess) {
                _state.update {
                    it.copy(
                        isLoading = false,
                        unreadNotifications = unreadResult.getOrDefault(emptyList()),
                        historyNotifications = historyResult.getOrDefault(emptyList())
                    )
                }
            } else {
                val error = unreadResult.exceptionOrNull() ?: historyResult.exceptionOrNull()
                _state.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error?.message ?: "Error al cargar notificaciones."
                    )
                }
            }
        }
    }

    private fun refreshData() {
        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, errorMessage = null) }

            val unreadDeferred = async { getUnreadNotificationsUseCase() }
            val historyDeferred = async { getNotificationHistoryUseCase() }

            val unreadResult = unreadDeferred.await()
            val historyResult = historyDeferred.await()

            _state.update {
                it.copy(
                    isRefreshing = false,
                    unreadNotifications = unreadResult.getOrDefault(it.unreadNotifications),
                    historyNotifications = historyResult.getOrDefault(it.historyNotifications),
                    errorMessage = if (unreadResult.isFailure && historyResult.isFailure) "Error al actualizar notificaciones." else null
                )
            }
        }
    }

    private fun dismissNotification(id: Int) {
        viewModelScope.launch {
            _state.update { it.copy(dismissingIds = it.dismissingIds + id) }
            dismissNotificationUseCase(id)
                .onSuccess {
                    _state.update { current ->
                        current.copy(
                            dismissingIds = current.dismissingIds - id,
                            unreadNotifications = current.unreadNotifications.filter { it.id != id },
                            historyNotifications = current.historyNotifications.map {
                                if (it.id == id) it.copy(isRead = true) else it
                            },
                            feedbackMessage = "Notificación descartada."
                        )
                    }
                }
                .onFailure { error ->
                    _state.update { current ->
                        current.copy(
                            dismissingIds = current.dismissingIds - id,
                            errorMessage = error.message ?: "No se pudo descartar la notificación."
                        )
                    }
                }
        }
    }

    private fun markAllAsRead() {
        viewModelScope.launch {
            _state.update { it.copy(isClearingAll = true, errorMessage = null) }
            markAllNotificationsAsReadUseCase()
                .onSuccess { count ->
                    _state.update { current ->
                        current.copy(
                            isClearingAll = false,
                            unreadNotifications = emptyList(),
                            historyNotifications = current.historyNotifications.map { it.copy(isRead = true) },
                            feedbackMessage = if (count > 0) "Se marcaron $count notificaciones como leídas." else "No había notificaciones pendientes."
                        )
                    }
                }
                .onFailure { error ->
                    _state.update { current ->
                        current.copy(
                            isClearingAll = false,
                            errorMessage = error.message ?: "Error al marcar notificaciones como leídas."
                        )
                    }
                }
        }
    }
}
