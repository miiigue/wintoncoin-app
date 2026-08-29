// ============================================================================
// WintonCoin Android — RegisterVolunteerUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Valida los datos y registra la postulación de voluntario SOS.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SosRegistrationResult
import com.wintoncoin.app.domain.model.VolunteerRegistrationInput
import com.wintoncoin.app.domain.repository.SosRepository
import javax.inject.Inject

class RegisterVolunteerUseCase @Inject constructor(
    private val repository: SosRepository
) {
    suspend operator fun invoke(input: VolunteerRegistrationInput): Result<SosRegistrationResult> {
        if (input.fullName.isBlank() || input.fullName.length < 3) {
            return Result.failure(IllegalArgumentException("El nombre completo debe tener al menos 3 caracteres."))
        }
        if (input.idDocument.isBlank() || input.idDocument.length < 5) {
            return Result.failure(IllegalArgumentException("La Cédula de Identidad no es válida."))
        }
        if (input.birthdate.isBlank()) {
            return Result.failure(IllegalArgumentException("La fecha de nacimiento es obligatoria."))
        }
        if (input.email.isBlank() || !input.email.contains("@") || !input.email.contains(".")) {
            return Result.failure(IllegalArgumentException("El correo electrónico no tiene un formato válido."))
        }
        if (input.phone.isBlank() || input.phone.length < 10) {
            return Result.failure(IllegalArgumentException("El número de teléfono debe incluir el código de país (ej: +58)."))
        }
        if (input.state.isBlank()) {
            return Result.failure(IllegalArgumentException("El estado de residencia es obligatorio."))
        }
        if (input.municipality.isBlank()) {
            return Result.failure(IllegalArgumentException("El municipio de residencia es obligatorio."))
        }
        if (input.sector.isBlank()) {
            return Result.failure(IllegalArgumentException("El sector o parroquia es obligatorio."))
        }
        if (!input.dataConsent) {
            return Result.failure(IllegalArgumentException("Debes autorizar el tratamiento de datos para la coordinación de brigadas."))
        }
        if (!input.legalDisclaimer) {
            return Result.failure(IllegalArgumentException("Debes aceptar el descargo de responsabilidad y código de conducta del voluntariado."))
        }

        return repository.registerVolunteer(input)
    }
}
