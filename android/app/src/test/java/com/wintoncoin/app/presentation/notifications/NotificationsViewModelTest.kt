// ============================================================================
// WintonCoin Android — NotificationsViewModelTest
// ============================================================================
// Pruebas unitarias para NotificationsViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.notifications

import com.wintoncoin.app.domain.model.NotificationCategory
import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.model.NotificationNavigationTarget
import com.wintoncoin.app.domain.repository.NotificationRepository
import com.wintoncoin.app.domain.usecase.DismissNotificationUseCase
import com.wintoncoin.app.domain.usecase.GetNotificationHistoryUseCase
import com.wintoncoin.app.domain.usecase.GetUnreadNotificationsUseCase
import com.wintoncoin.app.domain.usecase.MarkAllNotificationsAsReadUseCase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private val fakeUnreadItem = NotificationItem(
        id = 1,
        message = "¡Has acumulado 15264.0000 BLUE IOU en tu Perfil de Impulsor!",
        isRead = false,
        createdAt = "2026-08-24T12:00:00Z",
        category = NotificationCategory.REWARD_TASK,
        navigationTarget = NotificationNavigationTarget.BOOSTER_PROFILE,
        iconEmoji = "💰",
        formattedDate = "Hace 5 min"
    )

    private val fakeHistoryItem = NotificationItem(
        id = 2,
        message = "¡Has sido aprobado automáticamente para la tarea!",
        isRead = true,
        createdAt = "2026-08-23T10:00:00Z",
        category = NotificationCategory.APPROVAL,
        navigationTarget = NotificationNavigationTarget.BOOSTER_PROFILE,
        iconEmoji = "🎉",
        formattedDate = "Ayer"
    )

    private class FakeRepo(
        private var unreadList: List<NotificationItem>,
        private var historyList: List<NotificationItem>,
        private val shouldFail: Boolean = false
    ) : NotificationRepository {
        override suspend fun getUnreadNotifications(): Result<List<NotificationItem>> {
            return if (shouldFail) Result.failure(Exception("Error al cargar no leídas.")) else Result.success(unreadList)
        }

        override suspend fun getNotificationsHistory(): Result<List<NotificationItem>> {
            return if (shouldFail) Result.failure(Exception("Error al cargar historial.")) else Result.success(historyList)
        }

        override suspend fun markAllAsRead(): Result<Int> {
            val count = unreadList.size
            unreadList = emptyList()
            historyList = historyList.map { it.copy(isRead = true) }
            return Result.success(count)
        }

        override suspend fun dismissNotification(id: Int): Result<Unit> {
            unreadList = unreadList.filter { it.id != id }
            return Result.success(Unit)
        }
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load populates unread and history notification lists`() = runTest {
        val repo = FakeRepo(listOf(fakeUnreadItem), listOf(fakeUnreadItem, fakeHistoryItem))
        val viewModel = NotificationsViewModel(
            GetUnreadNotificationsUseCase(repo),
            GetNotificationHistoryUseCase(repo),
            MarkAllNotificationsAsReadUseCase(repo),
            DismissNotificationUseCase(repo)
        )
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals(1, state.unreadCount)
        assertEquals(1, state.unreadNotifications.size)
        assertEquals(2, state.historyNotifications.size)
        assertNull(state.errorMessage)
    }

    @Test
    fun `SelectTab switches between UNREAD and HISTORY tabs`() = runTest {
        val repo = FakeRepo(listOf(fakeUnreadItem), listOf(fakeHistoryItem))
        val viewModel = NotificationsViewModel(
            GetUnreadNotificationsUseCase(repo),
            GetNotificationHistoryUseCase(repo),
            MarkAllNotificationsAsReadUseCase(repo),
            DismissNotificationUseCase(repo)
        )
        advanceUntilIdle()

        assertEquals(NotificationTab.UNREAD, viewModel.state.value.selectedTab)
        assertEquals(1, viewModel.state.value.displayedNotifications.size)

        viewModel.onEvent(NotificationsEvent.SelectTab(NotificationTab.HISTORY))
        assertEquals(NotificationTab.HISTORY, viewModel.state.value.selectedTab)
        assertEquals(1, viewModel.state.value.displayedNotifications.size)
    }

    @Test
    fun `SelectCategoryFilter filters displayed notifications by category`() = runTest {
        val repo = FakeRepo(listOf(fakeUnreadItem), listOf(fakeUnreadItem, fakeHistoryItem))
        val viewModel = NotificationsViewModel(
            GetUnreadNotificationsUseCase(repo),
            GetNotificationHistoryUseCase(repo),
            MarkAllNotificationsAsReadUseCase(repo),
            DismissNotificationUseCase(repo)
        )
        advanceUntilIdle()

        viewModel.onEvent(NotificationsEvent.SelectTab(NotificationTab.HISTORY))
        assertEquals(2, viewModel.state.value.displayedNotifications.size)

        viewModel.onEvent(NotificationsEvent.SelectCategoryFilter(NotificationCategory.APPROVAL))
        assertEquals(1, viewModel.state.value.displayedNotifications.size)
        assertEquals(NotificationCategory.APPROVAL, viewModel.state.value.displayedNotifications[0].category)

        viewModel.onEvent(NotificationsEvent.SelectCategoryFilter(null))
        assertEquals(2, viewModel.state.value.displayedNotifications.size)
    }

    @Test
    fun `DismissNotification removes item from unread list`() = runTest {
        val repo = FakeRepo(listOf(fakeUnreadItem), listOf(fakeUnreadItem))
        val viewModel = NotificationsViewModel(
            GetUnreadNotificationsUseCase(repo),
            GetNotificationHistoryUseCase(repo),
            MarkAllNotificationsAsReadUseCase(repo),
            DismissNotificationUseCase(repo)
        )
        advanceUntilIdle()

        viewModel.onEvent(NotificationsEvent.DismissNotification(fakeUnreadItem.id))
        advanceUntilIdle()

        val state = viewModel.state.value
        assertEquals(0, state.unreadCount)
        assertTrue(state.unreadNotifications.isEmpty())
        assertEquals("Notificación descartada.", state.feedbackMessage)
    }

    @Test
    fun `MarkAllAsRead clears all unread notifications`() = runTest {
        val repo = FakeRepo(listOf(fakeUnreadItem), listOf(fakeUnreadItem))
        val viewModel = NotificationsViewModel(
            GetUnreadNotificationsUseCase(repo),
            GetNotificationHistoryUseCase(repo),
            MarkAllNotificationsAsReadUseCase(repo),
            DismissNotificationUseCase(repo)
        )
        advanceUntilIdle()

        viewModel.onEvent(NotificationsEvent.MarkAllAsRead)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isClearingAll)
        assertEquals(0, state.unreadCount)
        assertTrue(state.unreadNotifications.isEmpty())
    }

    @Test
    fun `DismissError and DismissFeedback reset messages in state`() = runTest {
        val repo = FakeRepo(emptyList(), emptyList())
        val viewModel = NotificationsViewModel(
            GetUnreadNotificationsUseCase(repo),
            GetNotificationHistoryUseCase(repo),
            MarkAllNotificationsAsReadUseCase(repo),
            DismissNotificationUseCase(repo)
        )
        advanceUntilIdle()

        viewModel.onEvent(NotificationsEvent.DismissError)
        assertNull(viewModel.state.value.errorMessage)

        viewModel.onEvent(NotificationsEvent.DismissFeedback)
        assertNull(viewModel.state.value.feedbackMessage)
    }
}
