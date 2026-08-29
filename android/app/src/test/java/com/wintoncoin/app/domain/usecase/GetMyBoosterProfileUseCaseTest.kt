// ============================================================================
// WintonCoin Android — GetMyBoosterProfileUseCaseTest (Pruebas Unitarias)
// ============================================================================
// [TEST / DOMAIN] Valida la obtención y cálculo de progreso del perfil de impulsor.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.BoosterLevelInfo
import com.wintoncoin.app.domain.model.BoosterProfile
import com.wintoncoin.app.domain.repository.BoosterRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetMyBoosterProfileUseCaseTest {

    private lateinit var repository: BoosterRepository
    private lateinit var useCase: GetMyBoosterProfileUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = GetMyBoosterProfileUseCase(repository)
    }

    @Test
    fun `getMyBoosterProfile success returns BoosterProfile with calculated level progression`() = runTest {
        val mockProfile = BoosterProfile(
            isBooster = true,
            username = "migue",
            boosterLevel = 2,
            totalBoosterBlue = 25000.0,
            eligibleBoosterBlue = 20000.0,
            pendingBoosterBlue = 5000.0,
            currentLevelInfo = BoosterLevelInfo(level = 2, name = "BRONCE", minBlueRequired = 10000.0, description = "Nivel 2"),
            nextLevelInfo = BoosterLevelInfo(level = 3, name = "PLATA", minBlueRequired = 50000.0, description = "Nivel 3")
        )

        coEvery { repository.getMyBoosterProfile() } returns Result.success(mockProfile)

        val result = useCase()
        assertTrue(result.isSuccess)
        val profile = result.getOrNull()!!
        assertTrue(profile.isBooster)
        assertEquals("migue", profile.username)
        assertEquals(25000.0, profile.neededBlueForNextLevel, 0.001) // 50000 - 25000 = 25000
        assertEquals(0.375f, profile.levelProgressPercentage, 0.001f) // (25000 - 10000) / (50000 - 10000) = 15000 / 40000 = 0.375
        coVerify(exactly = 1) { repository.getMyBoosterProfile() }
    }

    @Test
    fun `getMyBoosterProfile non-booster returns isBooster false`() = runTest {
        val nonBoosterProfile = BoosterProfile(
            isBooster = false,
            message = "Aún no formas parte del programa de impulsores."
        )

        coEvery { repository.getMyBoosterProfile() } returns Result.success(nonBoosterProfile)

        val result = useCase()
        assertTrue(result.isSuccess)
        assertFalse(result.getOrNull()!!.isBooster)
    }

    @Test
    fun `getMyBoosterProfile repository failure returns Result error`() = runTest {
        coEvery { repository.getMyBoosterProfile() } returns Result.failure(Exception("Error de conexión"))

        val result = useCase()
        assertTrue(result.isFailure)
        assertEquals("Error de conexión", result.exceptionOrNull()?.message)
    }
}
