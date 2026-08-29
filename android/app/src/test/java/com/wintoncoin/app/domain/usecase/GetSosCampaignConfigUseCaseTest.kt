// ============================================================================
// WintonCoin Android — GetSosCampaignConfigUseCaseTest
// ============================================================================
// Pruebas unitarias para GetSosCampaignConfigUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SosCampaignInfo
import com.wintoncoin.app.domain.repository.SosRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetSosCampaignConfigUseCaseTest {

    private lateinit var repository: SosRepository
    private lateinit var useCase: GetSosCampaignConfigUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = GetSosCampaignConfigUseCase(repository)
    }

    @Test
    fun `returns campaign settings successfully`() = runTest {
        val expected = SosCampaignInfo(shareCode = "SOSVENEZUELADEMO", bonusBlue = 200.0, isCampaignActive = true)
        coEvery { repository.getCampaignSettings() } returns Result.success(expected)

        val result = useCase()

        assertTrue(result.isSuccess)
        assertEquals("SOSVENEZUELADEMO", result.getOrNull()?.shareCode)
        assertEquals(200.0, result.getOrNull()?.bonusBlue)
    }
}
