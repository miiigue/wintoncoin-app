// ============================================================================
// WintonCoin Android — ValidateCredentialsUseCaseTest (Prueba Unitaria)
// ============================================================================
// [UNIT TEST] Evalúa exhaustivamente las reglas de validación de campos
// de entrada (username y password) previa transmisión al backend.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ValidateCredentialsUseCaseTest {

    private lateinit var useCase: ValidateCredentialsUseCase

    @Before
    fun setUp() {
        useCase = ValidateCredentialsUseCase()
    }

    @Test
    fun `valid credentials returns isValid true and no errors`() {
        val result = useCase("miguel_123", "password123")

        assertTrue(result.isValid)
        assertNull(result.usernameError)
        assertNull(result.passwordError)
    }

    @Test
    fun `empty username returns error`() {
        val result = useCase("", "password123")

        assertFalse(result.isValid)
        assertEquals("Ingresa tu nombre de usuario", result.usernameError)
        assertNull(result.passwordError)
    }

    @Test
    fun `short username less than 3 chars returns error`() {
        val result = useCase("ab", "password123")

        assertFalse(result.isValid)
        assertEquals("El usuario debe tener al menos 3 caracteres", result.usernameError)
    }

    @Test
    fun `long username greater than 30 chars returns error`() {
        val longUsername = "a".repeat(31)
        val result = useCase(longUsername, "password123")

        assertFalse(result.isValid)
        assertEquals("El usuario no puede exceder 30 caracteres", result.usernameError)
    }

    @Test
    fun `username with invalid special chars returns error`() {
        val result = useCase("user@name", "password123")

        assertFalse(result.isValid)
        assertEquals("Solo se permiten letras, números y guiones bajos (_)", result.usernameError)
    }

    @Test
    fun `empty password returns error`() {
        val result = useCase("miguel_123", "")

        assertFalse(result.isValid)
        assertNull(result.usernameError)
        assertEquals("Ingresa tu contraseña", result.passwordError)
    }

    @Test
    fun `short password less than 6 chars returns error`() {
        val result = useCase("miguel_123", "12345")

        assertFalse(result.isValid)
        assertEquals("La contraseña debe tener al menos 6 caracteres", result.passwordError)
    }
}
