// ============================================================================
// WintonCoin Android — LoginUseCase (Caso de Uso de Inicio de Sesión)
// ============================================================================
// [DOMAIN LAYER] Encapsula la lógica de negocio del flujo de Login.
// Coordina la validación previa de datos y la invocación al AuthRepository.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession
import com.wintoncoin.app.domain.repository.AuthRepository
import javax.inject.Inject

/**
 * LoginUseCase — Ejecuta el inicio de sesión.
 */
class LoginUseCase @Inject constructor(
    private val authRepository: AuthRepository,
    private val validateCredentialsUseCase: ValidateCredentialsUseCase
) {

    suspend operator fun invoke(username: String, password: String): Result<UserSession> {
        val validation = validateCredentialsUseCase(username, password)
        if (!validation.isValid) {
            val errorMsg = validation.usernameError ?: validation.passwordError ?: "Credenciales inválidas"
            return Result.Error(errorMsg)
        }

        return authRepository.login(username.trim(), password)
    }
}
