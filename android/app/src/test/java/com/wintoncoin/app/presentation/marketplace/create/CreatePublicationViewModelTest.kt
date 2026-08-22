// ============================================================================
// WintonCoin Android — CreatePublicationViewModelTest (Pruebas Unitarias)
// ============================================================================
// [TEST / PRESENTATION] Valida la lógica reactiva del ViewModel de creación,
// cálculo dinámico de precios y gestión de pasos de instrucción.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.create

import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.core.util.ImageCompressor
import com.wintoncoin.app.domain.model.BoosterMultiplierInfo
import com.wintoncoin.app.domain.model.PlatformEconomicSettings
import com.wintoncoin.app.domain.usecase.CreatePublicationUseCase
import com.wintoncoin.app.domain.usecase.CreateQuickSaleUseCase
import com.wintoncoin.app.domain.usecase.GetBoosterMultiplierUseCase
import com.wintoncoin.app.domain.usecase.GetPlatformEconomicSettingsUseCase
import com.wintoncoin.app.domain.usecase.UploadMediaUseCase
import io.mockk.coEvery
import io.mockk.coVerify
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
class CreatePublicationViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var createPublicationUseCase: CreatePublicationUseCase
    private lateinit var createQuickSaleUseCase: CreateQuickSaleUseCase
    private lateinit var uploadMediaUseCase: UploadMediaUseCase
    private lateinit var getBoosterMultiplierUseCase: GetBoosterMultiplierUseCase
    private lateinit var getPlatformSettingsUseCase: GetPlatformEconomicSettingsUseCase
    private lateinit var imageCompressor: ImageCompressor
    private lateinit var tokenManager: TokenManager

    private lateinit var viewModel: CreatePublicationViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)

        createPublicationUseCase = mockk(relaxed = true)
        createQuickSaleUseCase = mockk(relaxed = true)
        uploadMediaUseCase = mockk(relaxed = true)
        getBoosterMultiplierUseCase = mockk()
        getPlatformSettingsUseCase = mockk()
        imageCompressor = mockk(relaxed = true)
        tokenManager = mockk()

        every { tokenManager.getUsername() } returns "migue"
        coEvery { getBoosterMultiplierUseCase() } returns Result.success(
            BoosterMultiplierInfo(multiplier = 9.0, stageName = "Etapa 1")
        )
        coEvery { getPlatformSettingsUseCase() } returns Result.success(
            PlatformEconomicSettings(
                preLaunchModeEnabled = true,
                allowRequestPublications = true,
                allowSellPublications = true,
                allowDonationPublications = true,
                allowQuickSalePublications = true,
                maxImagesRequest = 2,
                maxImagesSell = 2,
                maxImagesDonation = 3,
                platformUsername = "wintoncoin"
            )
        )

        viewModel = CreatePublicationViewModel(
            createPublicationUseCase,
            createQuickSaleUseCase,
            uploadMediaUseCase,
            getBoosterMultiplierUseCase,
            getPlatformSettingsUseCase,
            imageCompressor,
            tokenManager
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load fetches multiplier and platform settings`() = runTest {
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isSettingsLoading)
        assertEquals(9.0, state.multiplier, 0.001)
        assertEquals("Etapa 1", state.stageName)
        assertTrue(state.isPreLaunch)
        assertEquals(2, state.maxImagesAllowed)
    }

    @Test
    fun `AmountChanged calculates Truth-in-Pricing preview text in pre-launch mode`() = runTest {
        advanceUntilIdle()

        viewModel.onEvent(CreatePublicationEvent.AmountChanged("10.0"))
        val state = viewModel.state.value

        assertEquals("10.0", state.amountInput)
        assertTrue(state.costPreviewText.contains("Valor Base: 10,0000 BLUE"))
        assertTrue(state.costPreviewText.contains("9.0x (Etapa 1)"))
        assertTrue(state.costPreviewText.contains("90,0000 BLUE IOU"))
    }

    @Test
    fun `TypeChanged updates publicationType and resets amount`() = runTest {
        advanceUntilIdle()

        viewModel.onEvent(CreatePublicationEvent.AmountChanged("10.0"))
        viewModel.onEvent(CreatePublicationEvent.TypeChanged("donation"))
        advanceUntilIdle()

        val state = viewModel.state.value
        assertEquals("donation", state.publicationType)
        assertEquals("", state.amountInput)
        assertEquals(3, state.maxImagesAllowed)
    }

    @Test
    fun `AddStep, UpdateStep and RemoveStep modify instructions correctly`() = runTest {
        viewModel.onEvent(CreatePublicationEvent.AddStep)
        viewModel.onEvent(CreatePublicationEvent.AddStep)
        viewModel.onEvent(CreatePublicationEvent.UpdateStep(0, "Primer paso"))
        viewModel.onEvent(CreatePublicationEvent.UpdateStep(1, "Segundo paso"))

        var state = viewModel.state.value
        assertEquals(2, state.steps.size)
        assertEquals("Primer paso", state.steps[0])
        assertEquals("Segundo paso", state.steps[1])

        viewModel.onEvent(CreatePublicationEvent.RemoveStep(0))
        state = viewModel.state.value
        assertEquals(1, state.steps.size)
        assertEquals("Segundo paso", state.steps[0])
    }

    @Test
    fun `Submit with valid data calls CreatePublicationUseCase and updates isSuccess`() = runTest {
        advanceUntilIdle()

        coEvery { createPublicationUseCase(any()) } returns Result.success("Publicación creada con éxito.")

        viewModel.onEvent(CreatePublicationEvent.TitleChanged("Diseño de Banner"))
        viewModel.onEvent(CreatePublicationEvent.DescriptionChanged("Diseño de banner para Twitter"))
        viewModel.onEvent(CreatePublicationEvent.AmountChanged("15.0"))
        viewModel.onEvent(CreatePublicationEvent.Submit)

        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertTrue(state.isSuccess)
        assertEquals("Publicación creada con éxito.", state.successMessage)
        coVerify(exactly = 1) { createPublicationUseCase(any()) }
    }
}
