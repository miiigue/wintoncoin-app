// ============================================================================
// WintonCoin Android — ValidateRegisterUseCaseTest (Prueba Unitaria)
// ============================================================================
// [UNIT TEST] Evalúa todas las reglas de validación del registro.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ValidateRegisterUseCaseTest {

    private lateinit var useCase: ValidateRegisterUseCase

    @Before
    fun setUp() {
        useCase = ValidateRegisterUseCase()
    }

    @Test
    fun `valid register fields returns isValid true`() {
        val result = useCase(
            username = "miguel_123",
            email = "miguel@wintoncoin.com",
            phone = "+584121234567",
            password = "password123",
            confirmPassword = "password123",
            termsAccepted = true
        )

        assertTrue(result.isValid)
        assertNull(result.usernameError)
        assertNull(result.emailError)
        assertNull(result.phoneError)
        assertNull(result.passwordError)
        assertNull(result.confirmPasswordError)
        assertNull(result.termsError)
    }

    @Test
    fun `invalid email format returns email error`() {
        val result = useCase(
            username = "miguel_123",
            email = "invalid-email-format",
            phone = "",
            password = "password123",
            confirmPassword = "password123",
            termsAccepted = true
        )

        assertFalse(result.isValid)
        assertEquals("Ingresa un correo electrónico válido", result.emailError)
    }

    @Test
    fun `mismatched confirm password returns confirm password error`() {
        val result = useCase(
            username = "miguel_123",
            email = "miguel@wintoncoin.com",
            phone = "",
            password = "password123",
            confirmPassword = "password321",
            termsAccepted = true
        )

        assertFalse(result.isValid)
        assertEquals("Las contraseñas no coinciden", result.confirmPasswordError)
    }

    @Test
    fun `unaccepted terms returns terms error`() {
        val result = useCase(
            username = "miguel_123",
            email = "miguel@wintoncoin.com",
            phone = "",
            password = "password123",
            confirmPassword = "password123",
            termsAccepted = false
        )

        assertFalse(result.isValid)
        assertEquals("Debes aceptar los Términos y Condiciones para continuar", result.termsError)
    }
}
