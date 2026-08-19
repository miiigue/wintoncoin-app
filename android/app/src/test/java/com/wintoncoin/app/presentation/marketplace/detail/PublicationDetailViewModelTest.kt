// ============================================================================
// WintonCoin Android — Tests Unitarios de PublicationDetailViewModel
// ============================================================================
// [UNIT TEST] Pruebas sobre la carga de detalles, postulaciones, envío de
// evidencias de culminación y confirmación de pagos en tareas.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.detail

import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.PublicationItem
import com.wintoncoin.app.domain.model.TaskAcceptanceStatus
import com.wintoncoin.app.domain.usecase.ApplyToPublicationUseCase
import com.wintoncoin.app.domain.usecase.CompleteTaskUseCase
import com.wintoncoin.app.domain.usecase.ConfirmTaskPaymentUseCase
import com.wintoncoin.app.domain.usecase.GetPublicationDetailsUseCase
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PublicationDetailViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val getDetailsUseCase: GetPublicationDetailsUseCase = mockk()
    private val applyUseCase: ApplyToPublicationUseCase = mockk()
    private val completeUseCase: CompleteTaskUseCase = mockk()
    private val confirmPaymentUseCase: ConfirmTaskPaymentUseCase = mockk()
    private val tokenManager: TokenManager = mockk()

    private lateinit var viewModel: PublicationDetailViewModel

    private val samplePub = PublicationItem(
        id = "42",
        title = "Diseño de Logotipo",
        description = "Requerimos logo vectorial",
        blueCost = 150.0,
        baseBlueCost = 150.0,
        multiplier = 1.0,
        stageName = "Etapa Regular",
        isBoosterTx = false,
        isBoosterTask = false,
        isSellPost = false,
        isQuickSale = false,
        isHumanitarianCause = false,
        availableSlots = 1,
        category = MarketplaceCategory.TASK,
        createdAt = "2026-08-16T12:00:00Z",
        expiresAt = null,
        goalAmount = 0.0,
        currentAmount = 0.0,
        amountOnHold = 0.0,
        imageUrls = emptyList(),
        requiresEvidence = true,
        authorUsername = "bob",
        authorRating = 4.8,
        authorRatingsCount = 5,
        userAcceptanceStatus = TaskAcceptanceStatus.NONE,
        participants = emptyList(),
        beneficiaryUsername = null,
        foundationName = null
    )

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        every { tokenManager.getUsername() } returns "alice"
        coEvery { getDetailsUseCase("42") } returns Result.success(samplePub)
        viewModel = PublicationDetailViewModel(
            getDetailsUseCase,
            applyUseCase,
            completeUseCase,
            confirmPaymentUseCase,
            tokenManager
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `LoadDetails fetches publication data and updates state`() = runTest {
        viewModel.onEvent(PublicationDetailEvent.LoadDetails("42"))
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals("Diseño de Logotipo", state.publication?.title)
    }

    @Test
    fun `Apply calls applyUseCase and updates success message`() = runTest {
        viewModel.onEvent(PublicationDetailEvent.LoadDetails("42"))
        advanceUntilIdle()

        coEvery { applyUseCase("42", null) } returns Result.success("Postulado con éxito")

        viewModel.onEvent(PublicationDetailEvent.Apply)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isActionLoading)
        assertTrue(state.actionCompleted)
        assertEquals("Postulado con éxito", state.successMessage)
    }

    @Test
    fun `CompleteTask sends evidence input and updates success message`() = runTest {
        viewModel.onEvent(PublicationDetailEvent.LoadDetails("42"))
        advanceUntilIdle()

        viewModel.onEvent(PublicationDetailEvent.UpdateEvidenceInput("https://r2.cloudflare.com/uploads/proof.jpg"))
        coEvery { completeUseCase("42", listOf("https://r2.cloudflare.com/uploads/proof.jpg")) } returns Result.success("Tarea completada")

        viewModel.onEvent(PublicationDetailEvent.CompleteTask)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isActionLoading)
        assertEquals("Tarea completada", state.successMessage)
    }

    @Test
    fun `ConfirmPayment calls confirmPaymentUseCase and refreshes details`() = runTest {
        viewModel.onEvent(PublicationDetailEvent.LoadDetails("42"))
        advanceUntilIdle()

        coEvery { confirmPaymentUseCase("42", "worker1") } returns Result.success("Pago liberado")

        viewModel.onEvent(PublicationDetailEvent.ConfirmPayment("worker1"))
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isActionLoading)
        assertEquals("Pago liberado", state.successMessage)
    }
}
