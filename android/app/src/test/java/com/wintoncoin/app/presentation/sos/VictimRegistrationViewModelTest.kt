// ============================================================================
// WintonCoin Android — VictimRegistrationViewModelTest
// ============================================================================
// Pruebas unitarias para VictimRegistrationViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.sos

import com.wintoncoin.app.domain.model.SosAuthSession
import com.wintoncoin.app.domain.model.SosRegistrationResult
import com.wintoncoin.app.domain.usecase.RegisterVictimUseCase
import com.wintoncoin.app.domain.usecase.ResendSosOtpUseCase
import com.wintoncoin.app.domain.usecase.VerifySosOtpUseCase
import com.wintoncoin.app.presentation.sos.victim.VictimRegistrationEvent
import com.wintoncoin.app.presentation.sos.victim.VictimRegistrationViewModel
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
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
class VictimRegistrationViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var registerVictimUseCase: RegisterVictimUseCase
    private lateinit var verifySosOtpUseCase: VerifySosOtpUseCase
    private lateinit var resendSosOtpUseCase: ResendSosOtpUseCase
    private lateinit var viewModel: VictimRegistrationViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        registerVictimUseCase = mockk()
        verifySosOtpUseCase = mockk()
        resendSosOtpUseCase = mockk()
        viewModel = VictimRegistrationViewModel(registerVictimUseCase, verifySosOtpUseCase, resendSosOtpUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `filling all fields and checkboxes activates isFormComplete`() = runTest {
        assertFalse(viewModel.state.value.isFormComplete)

        viewModel.onEvent(VictimRegistrationEvent.FullNameChanged("Carlos Pérez"))
        viewModel.onEvent(VictimRegistrationEvent.IdDocumentChanged("12345678"))
        viewModel.onEvent(VictimRegistrationEvent.BirthdateChanged("15/05/1985"))
        viewModel.onEvent(VictimRegistrationEvent.EmailChanged("carlos@example.com"))
        viewModel.onEvent(VictimRegistrationEvent.PhoneChanged("4121234567"))
        viewModel.onEvent(VictimRegistrationEvent.StateChanged("Carabobo"))
        viewModel.onEvent(VictimRegistrationEvent.MunicipalityChanged("Valencia"))
        viewModel.onEvent(VictimRegistrationEvent.SectorChanged("El Trigal"))
        viewModel.onEvent(VictimRegistrationEvent.AddressChanged("Calle 5, Casa 12"))
        viewModel.onEvent(VictimRegistrationEvent.DescriptionChanged("Daños severos en vivienda"))
        viewModel.onEvent(VictimRegistrationEvent.DataConsentChanged(true))
        viewModel.onEvent(VictimRegistrationEvent.SwornDeclarationChanged(true))

        assertTrue(viewModel.state.value.isFormComplete)
    }

    @Test
    fun `SubmitRegistration opens OTP dialog on success`() = runTest {
        val regResult = SosRegistrationResult(
            dossierNumber = "SOS-VZLA-4331-00042",
            email = "carlos@example.com",
            message = "Registro recibido"
        )
        coEvery { registerVictimUseCase(any()) } returns Result.success(regResult)

        viewModel.onEvent(VictimRegistrationEvent.FullNameChanged("Carlos Pérez"))
        viewModel.onEvent(VictimRegistrationEvent.EmailChanged("carlos@example.com"))
        viewModel.onEvent(VictimRegistrationEvent.SubmitRegistration)

        assertTrue(viewModel.state.value.showOtpDialog)
        assertEquals("SOS-VZLA-4331-00042", viewModel.state.value.registeredDossierNumber)
    }

    @Test
    fun `VerifyOtp activates session on success`() = runTest {
        val session = SosAuthSession(token = "jwt.test", username = "carlos123", dossierNumber = "SOS-VZLA-4331-00042")
        coEvery { verifySosOtpUseCase(any(), isVolunteer = false) } returns Result.success(session)

        viewModel.onEvent(VictimRegistrationEvent.OtpCodeChanged("123456"))
        viewModel.onEvent(VictimRegistrationEvent.PasswordChanged("Password123!"))
        viewModel.onEvent(VictimRegistrationEvent.ConfirmPasswordChanged("Password123!"))
        viewModel.onEvent(VictimRegistrationEvent.VerifyOtp)

        assertTrue(viewModel.state.value.isActivationComplete)
        assertFalse(viewModel.state.value.showOtpDialog)
    }
}
