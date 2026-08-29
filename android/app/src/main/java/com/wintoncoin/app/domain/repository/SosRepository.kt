// ============================================================================
// WintonCoin Android — SosRepository
// ============================================================================
// [DOMAIN LAYER / REPOSITORY INTERFACE] Contrato para las operaciones de
// SOS Venezuela, damnificados, voluntarios y activación de cuentas.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.SosAuthSession
import com.wintoncoin.app.domain.model.SosCampaignInfo
import com.wintoncoin.app.domain.model.SosOtpVerificationInput
import com.wintoncoin.app.domain.model.SosRegistrationResult
import com.wintoncoin.app.domain.model.VictimRegistrationInput
import com.wintoncoin.app.domain.model.VolunteerRegistrationInput

/**
 * Contrato de repositorio para el ecosistema SOS Venezuela.
 */
interface SosRepository {

    /**
     * Registra un damnificado en el censo público.
     */
    suspend fun registerVictim(input: VictimRegistrationInput): Result<SosRegistrationResult>

    /**
     * Verifica el código OTP y activa la cuenta de un damnificado.
     */
    suspend fun verifyVictimOtp(input: SosOtpVerificationInput): Result<SosAuthSession>

    /**
     * Reenvía el código OTP de damnificado.
     */
    suspend fun resendVictimOtp(email: String): Result<String>

    /**
     * Registra un voluntario en las brigadas de auxilio SOS.
     */
    suspend fun registerVolunteer(input: VolunteerRegistrationInput): Result<SosRegistrationResult>

    /**
     * Verifica el código OTP y activa la cuenta de un voluntario SOS.
     */
    suspend fun verifyVolunteerOtp(input: SosOtpVerificationInput): Result<SosAuthSession>

    /**
     * Reenvía el código OTP de voluntario SOS.
     */
    suspend fun resendVolunteerOtp(email: String): Result<String>

    /**
     * Obtiene la configuración pública de la campaña y código de referido activo.
     */
    suspend fun getCampaignSettings(): Result<SosCampaignInfo>
}
