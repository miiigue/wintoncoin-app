// ============================================================================
// WintonCoin Android — FormatBalanceUseCaseTest (Prueba Unitaria de Formateo)
// ============================================================================
// [UNIT TEST] Evalúa el formateo a 4 decimales con localización española (es-ES).
// ============================================================================

package com.wintoncoin.app.domain.usecase

import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class FormatBalanceUseCaseTest {

    private lateinit var useCase: FormatBalanceUseCase

    @Before
    fun setUp() {
        useCase = FormatBalanceUseCase()
    }

    @Test
    fun `zero amount formats correctly with 4 decimals`() {
        val result = useCase(0.0)
        assertEquals("0,0000", result)
    }

    @Test
    fun `small integer amount formats with 4 decimals`() {
        val result = useCase(100.0)
        assertEquals("100,0000", result)
    }

    @Test
    fun `thousand amount formats with dot thousand separator and comma decimal`() {
        val result = useCase(1250.5)
        assertEquals("1.250,5000", result)
    }

    @Test
    fun `large million balance formats correctly with thousands dots`() {
        val result = useCase(1952340.1234)
        assertEquals("1.952.340,1234", result)
    }
}
