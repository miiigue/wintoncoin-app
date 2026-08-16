// ============================================================================
// WintonCoin Android — RegisterUseCase (Caso de Uso de Registro)
// ============================================================================
// [DOMAIN LAYER] Ejecuta la solicitud de registro en el backend.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.data.remote.dto.RegisterResponse
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.repository.AuthRepository
import javax.inject.Inject

class RegisterUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(
        username: String,
        email: String,
        phone: String,
        password: String
    ): Result<RegisterResponse> {
        return authRepository.register(
            username = username.trim(),
            email = email.trim(),
            phone = phone.trim(),
            password = password
        )
    }
}
