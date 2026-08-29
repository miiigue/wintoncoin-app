// ============================================================================
// WintonCoin Android — VolunteerRegistrationViewModelTest
// ============================================================================
// Pruebas unitarias para VolunteerRegistrationViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.sos

import com.wintoncoin.app.domain.model.SosAuthSession
import com.wintoncoin.app.domain.model.SosRegistrationResult
import com.wintoncoin.app.domain.model.VolunteerSpecialty
import com.wintoncoin.app.domain.usecase.RegisterVolunteerUseCase
import com.wintoncoin.app.domain.usecase.ResendSosOtpUseCase
import com.wintoncoin.app.domain.usecase.VerifySosOtpUseCase
import com.wintoncoin.app.presentation.sos.volunteer.VolunteerRegistrationEvent
import com.wintoncoin.app.presentation.sos.volunteer.VolunteerRegistrationViewModel
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
class VolunteerRegistrationViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var registerVolunteerUseCase: RegisterVolunteerUseCase
    private lateinit var verifySosOtpUseCase: VerifySosOtpUseCase
    private lateinit var resendSosOtpUseCase: ResendSosOtpUseCase
    private lateinit var viewModel: VolunteerRegistrationViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        registerVolunteerUseCase = mockk()
        verifySosOtpUseCase = mockk()
        resendSosOtpUseCase = mockk()
        viewModel = VolunteerRegistrationViewModel(registerVolunteerUseCase, verifySosOtpUseCase, resendSosOtpUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `filling all required volunteer fields activates isFormComplete`() = runTest {
        assertFalse(viewModel.state.value.isFormComplete)

        viewModel.onEvent(VolunteerRegistrationEvent.FullNameChanged("Dra. Elena Silva"))
        viewModel.onEvent(VolunteerRegistrationEvent.IdDocumentChanged("20123456"))
        viewModel.onEvent(VolunteerRegistrationEvent.BirthdateChanged("22/11/1992"))
        viewModel.onEvent(VolunteerRegistrationEvent.EmailChanged("elena@medicos.org"))
        viewModel.onEvent(VolunteerRegistrationEvent.PhoneChanged("4149876543"))
        viewModel.onEvent(VolunteerRegistrationEvent.StateChanged("Miranda"))
        viewModel.onEvent(VolunteerRegistrationEvent.MunicipalityChanged("Chacao"))
        viewModel.onEvent(VolunteerRegistrationEvent.SectorChanged("Los Palos Grandes"))
        viewModel.onEvent(VolunteerRegistrationEvent.SpecialtyChanged(VolunteerSpecialty.MEDICO_ENFERMERO))
        viewModel.onEvent(VolunteerRegistrationEvent.DataConsentChanged(true))
        viewModel.onEvent(VolunteerRegistrationEvent.LegalDisclaimerChanged(true))

        assertTrue(viewModel.state.value.isFormComplete)
    }

    @Test
    fun `SubmitRegistration opens OTP dialog on volunteer success`() = runTest {
        val regResult = SosRegistrationResult(
            dossierNumber = "VOL-VZLA-3211-00015",
            email = "elena@medicos.org",
            message = "Postulación recibida"
        )
        coEvery { registerVolunteerUseCase(any()) } returns Result.success(regResult)

        viewModel.onEvent(VolunteerRegistrationEvent.FullNameChanged("Dra. Elena Silva"))
        viewModel.onEvent(VolunteerRegistrationEvent.EmailChanged("elena@medicos.org"))
        viewModel.onEvent(VolunteerRegistrationEvent.SubmitRegistration)

        assertTrue(viewModel.state.value.showOtpDialog)
        assertEquals("VOL-VZLA-3211-00015", viewModel.state.value.registeredDossierNumber)
    }

    @Test
    fun `VerifyOtp for volunteer activates session on success`() = runTest {
        val session = SosAuthSession(token = "jwt.volunteer", username = "elena92", dossierNumber = "VOL-VZLA-3211-00015")
        coEvery { verifySosOtpUseCase(any(), isVolunteer = true) } returns Result.success(session)

        viewModel.onEvent(VolunteerRegistrationEvent.OtpCodeChanged("654321"))
        viewModel.onEvent(VolunteerRegistrationEvent.PasswordChanged("Password123!"))
        viewModel.onEvent(VolunteerRegistrationEvent.ConfirmPasswordChanged("Password123!"))
        viewModel.onEvent(VolunteerRegistrationEvent.VerifyOtp)

        assertTrue(viewModel.state.value.isActivationComplete)
        assertEquals("VOL-VZLA-3211-00015", viewModel.state.value.registeredDossierNumber)
    }
}
