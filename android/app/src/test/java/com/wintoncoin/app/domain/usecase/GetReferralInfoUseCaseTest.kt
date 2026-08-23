// ============================================================================
// WintonCoin Android — GetReferralInfoUseCaseTest (Pruebas Unitarias)
// ============================================================================
// [TEST / DOMAIN] Valida la obtención de código y miembros de la red de referidos.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.ReferralNetworkData
import com.wintoncoin.app.domain.model.ReferredMember
import com.wintoncoin.app.domain.repository.BoosterRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetReferralInfoUseCaseTest {

    private lateinit var repository: BoosterRepository
    private lateinit var useCase: GetReferralInfoUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = GetReferralInfoUseCase(repository)
    }

    @Test
    fun `blank username returns error without calling repository`() = runTest {
        val result = useCase("")
        assertTrue(result.isFailure)
        assertEquals("El nombre de usuario no puede estar vacío.", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { repository.getReferralInfo(any()) }
    }

    @Test
    fun `valid username calls repository and returns ReferralNetworkData`() = runTest {
        val mockData = ReferralNetworkData(
            referralCode = "MIGUE777",
            referralLink = "https://demo.wintoncoin.com/register.html?ref=MIGUE777",
            referredUsers = listOf(
                ReferredMember(username = "carlos", kycVerified = true, registrationDate = "2026-08-20", totalBoosterBlue = 5000.0),
                ReferredMember(username = "ana", kycVerified = false, registrationDate = "2026-08-21", totalBoosterBlue = 2500.0)
            ),
            totalReferredCount = 2,
            kycVerifiedCount = 1,
            totalBoosterBlueGenerated = 7500.0
        )

        coEvery { repository.getReferralInfo("migue") } returns Result.success(mockData)

        val result = useCase("migue")
        assertTrue(result.isSuccess)
        val data = result.getOrNull()!!
        assertEquals("MIGUE777", data.referralCode)
        assertEquals(2, data.totalReferredCount)
        assertEquals(1, data.kycVerifiedCount)
        assertEquals(7500.0, data.totalBoosterBlueGenerated, 0.001)
        coVerify(exactly = 1) { repository.getReferralInfo("migue") }
    }

    @Test
    fun `repository failure propagates error`() = runTest {
        coEvery { repository.getReferralInfo("migue") } returns Result.failure(Exception("Usuario no encontrado"))

        val result = useCase("migue")
        assertTrue(result.isFailure)
        assertEquals("Usuario no encontrado", result.exceptionOrNull()?.message)
    }
}
