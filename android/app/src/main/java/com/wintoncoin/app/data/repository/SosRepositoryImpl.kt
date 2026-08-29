// ============================================================================
// WintonCoin Android — SosRepositoryImpl
// ============================================================================
// [DATA LAYER / REPOSITORY IMPL] Implementación concreta de SosRepository.
// Conecta los endpoints Retrofit de SOS Venezuela con la capa de dominio.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.data.remote.api.SosApiService
import com.wintoncoin.app.data.remote.dto.RegisterVictimRequestDto
import com.wintoncoin.app.data.remote.dto.RegisterVolunteerRequestDto
import com.wintoncoin.app.data.remote.dto.ResendSosOtpRequestDto
import com.wintoncoin.app.data.remote.dto.VerifySosOtpRequestDto
import com.wintoncoin.app.domain.model.SosAuthSession
import com.wintoncoin.app.domain.model.SosCampaignInfo
import com.wintoncoin.app.domain.model.SosOtpVerificationInput
import com.wintoncoin.app.domain.model.SosRegistrationResult
import com.wintoncoin.app.domain.model.VictimRegistrationInput
import com.wintoncoin.app.domain.model.VolunteerRegistrationInput
import com.wintoncoin.app.domain.repository.SosRepository
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SosRepositoryImpl @Inject constructor(
    private val apiService: SosApiService,
    private val tokenManager: TokenManager,
    private val auditLogger: AuditLogger
) : SosRepository {

    override suspend fun registerVictim(input: VictimRegistrationInput): Result<SosRegistrationResult> {
        return try {
            val requestDto = RegisterVictimRequestDto(
                fullName = input.fullName.trim(),
                idDocument = input.idDocument.trim().uppercase(),
                birthdate = input.birthdate.trim(),
                email = input.email.trim(),
                phone = input.phone.trim(),
                country = input.country.trim(),
                state = input.state.trim(),
                municipality = input.municipality.trim(),
                sector = input.sector.trim(),
                address = input.address.trim(),
                affectationLevel = input.affectationLevel.apiValue,
                minorsCount = input.minorsCount,
                elderlyCount = input.elderlyCount,
                disabledCount = input.disabledCount,
                age = input.age,
                gender = input.gender,
                description = input.description.trim(),
                googlePhotosUrl = input.googlePhotosUrl?.trim()?.takeIf { it.isNotBlank() },
                dataConsent = input.dataConsent,
                swornDeclaration = input.swornDeclaration
            )

            val response = apiService.registerVictim(requestDto)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.success) {
                    auditLogger.log(
                        AuditLogger.Category.USER_ACTION,
                        "SOS_VICTIM_REGISTERED",
                        "Dossier: ${body.dossierNumber}, Email: ${body.email}"
                    )
                    Result.success(
                        SosRegistrationResult(
                            dossierNumber = body.dossierNumber ?: "",
                            email = body.email ?: input.email,
                            message = body.message.ifBlank { "Registro de emergencia recibido exitosamente." }
                        )
                    )
                } else {
                    Result.failure(Exception(body.message.ifBlank { "Error al registrar damnificado." }))
                }
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string())
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun verifyVictimOtp(input: SosOtpVerificationInput): Result<SosAuthSession> {
        return try {
            val requestDto = VerifySosOtpRequestDto(
                email = input.email.trim(),
                otpCode = input.otpCode.trim(),
                password = input.password,
                confirmPassword = input.confirmPassword
            )

            val response = apiService.verifyVictimOtp(requestDto)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.success && !body.token.isNullOrBlank() && !body.username.isNullOrBlank()) {
                    tokenManager.saveAccessToken(body.token)
                    tokenManager.saveUsername(body.username)
                    auditLogger.logAuthSuccess("SOS_VICTIM_OTP_VERIFIED", body.username)
                    Result.success(
                        SosAuthSession(
                            token = body.token,
                            username = body.username,
                            dossierNumber = body.dossierNumber ?: ""
                        )
                    )
                } else {
                    Result.failure(Exception(body.message.ifBlank { "Error al verificar código de activación." }))
                }
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string())
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun resendVictimOtp(email: String): Result<String> {
        return try {
            val response = apiService.resendVictimOtp(ResendSosOtpRequestDto(email.trim()))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.success) {
                    Result.success(body.message.ifBlank { "Nuevo código OTP enviado a tu correo electrónico." })
                } else {
                    Result.failure(Exception(body.message.ifBlank { "Error al reenviar código OTP." }))
                }
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string())
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun registerVolunteer(input: VolunteerRegistrationInput): Result<SosRegistrationResult> {
        return try {
            val requestDto = RegisterVolunteerRequestDto(
                fullName = input.fullName.trim(),
                idDocument = input.idDocument.trim().uppercase(),
                birthdate = input.birthdate.trim(),
                email = input.email.trim(),
                phone = input.phone.trim(),
                country = input.country.trim(),
                state = input.state.trim(),
                municipality = input.municipality.trim(),
                sector = input.sector.trim(),
                specialty = input.specialty.apiValue,
                availability = input.availability.apiValue,
                modality = input.modality.apiValue,
                experienceDescription = input.experienceDescription?.trim()?.takeIf { it.isNotBlank() },
                dataConsent = input.dataConsent,
                legalDisclaimer = input.legalDisclaimer
            )

            val response = apiService.registerVolunteer(requestDto)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.success) {
                    auditLogger.log(
                        AuditLogger.Category.USER_ACTION,
                        "SOS_VOLUNTEER_REGISTERED",
                        "Dossier: ${body.dossierNumber}, Email: ${body.email}"
                    )
                    Result.success(
                        SosRegistrationResult(
                            dossierNumber = body.dossierNumber ?: "",
                            email = body.email ?: input.email,
                            message = body.message.ifBlank { "Postulación de voluntario recibida exitosamente." }
                        )
                    )
                } else {
                    Result.failure(Exception(body.message.ifBlank { "Error al registrar voluntario." }))
                }
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string())
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun verifyVolunteerOtp(input: SosOtpVerificationInput): Result<SosAuthSession> {
        return try {
            val requestDto = VerifySosOtpRequestDto(
                email = input.email.trim(),
                otpCode = input.otpCode.trim(),
                password = input.password,
                confirmPassword = input.confirmPassword
            )

            val response = apiService.verifyVolunteerOtp(requestDto)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.success && !body.token.isNullOrBlank() && !body.username.isNullOrBlank()) {
                    tokenManager.saveAccessToken(body.token)
                    tokenManager.saveUsername(body.username)
                    auditLogger.logAuthSuccess("SOS_VOLUNTEER_OTP_VERIFIED", body.username)
                    Result.success(
                        SosAuthSession(
                            token = body.token,
                            username = body.username,
                            dossierNumber = body.dossierNumber ?: ""
                        )
                    )
                } else {
                    Result.failure(Exception(body.message.ifBlank { "Error al verificar código de activación de voluntario." }))
                }
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string())
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun resendVolunteerOtp(email: String): Result<String> {
        return try {
            val response = apiService.resendVolunteerOtp(ResendSosOtpRequestDto(email.trim()))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.success) {
                    Result.success(body.message.ifBlank { "Nuevo código OTP enviado a tu correo electrónico." })
                } else {
                    Result.failure(Exception(body.message.ifBlank { "Error al reenviar código de voluntario." }))
                }
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string())
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCampaignSettings(): Result<SosCampaignInfo> {
        return try {
            val response = apiService.getCampaignSettings()
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                Result.success(
                    SosCampaignInfo(
                        shareCode = body.referralCustomShareCode ?: "SOSVENEZUELA",
                        bonusBlue = body.referralBonusBlue ?: 200.0,
                        isCampaignActive = body.campaignActive
                    )
                )
            } else {
                // Fallback con datos por defecto si falla la red
                Result.success(
                    SosCampaignInfo(
                        shareCode = "SOSVENEZUELA",
                        bonusBlue = 200.0,
                        isCampaignActive = true
                    )
                )
            }
        } catch (e: Exception) {
            // Resiliencia: Si falla el endpoint, devolver la configuración por defecto
            Result.success(
                SosCampaignInfo(
                    shareCode = "SOSVENEZUELA",
                    bonusBlue = 200.0,
                    isCampaignActive = true
                )
            )
        }
    }

    private fun parseErrorMessage(errorBody: String?): String {
        if (errorBody.isNullOrBlank()) return "Error en la comunicación con el servidor."
        return try {
            val json = JSONObject(errorBody)
            when {
                json.has("message") -> json.getString("message")
                json.has("error") -> json.getString("error")
                else -> "Error en la solicitud (${errorBody.take(100)})"
            }
        } catch (e: Exception) {
            "Error en la comunicación con el servidor."
        }
    }
}
