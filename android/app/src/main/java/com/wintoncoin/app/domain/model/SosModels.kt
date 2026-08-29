// ============================================================================
// WintonCoin Android — SosModels
// ============================================================================
// [DOMAIN LAYER / MODELS] Modelos inmutables del dominio para el portal
// SOS Venezuela, contingencias de damnificados y brigadas de voluntarios.
// ============================================================================

package com.wintoncoin.app.domain.model

/**
 * Niveles de afectación de emergencia para damnificados.
 */
enum class AffectationLevel(val apiValue: String, val displayName: String, val severityDigit: Int) {
    TOTAL_LOSS("total_loss", "Pérdida total de vivienda / enseres", 4),
    MEDICAL_EMERGENCY("medical_emergency", "Emergencia médica / lesionados", 3),
    PARTIAL_DAMAGE("partial_damage", "Daño parcial en vivienda", 2),
    FOOD_MEDICINE("food_medicine", "Necesidad urgente de alimentos / medicinas", 1);

    companion object {
        fun fromApi(value: String?): AffectationLevel {
            return values().find { it.apiValue.equals(value, ignoreCase = true) } ?: FOOD_MEDICINE
        }
    }
}

/**
 * Especialidades del personal de voluntariado SOS.
 */
enum class VolunteerSpecialty(val apiValue: String, val displayName: String) {
    MEDICO_ENFERMERO("medico_enfermero", "Médico / Enfermero"),
    PRIMEROS_AUXILIOS("primeros_auxilios", "Primeros Auxilios"),
    RESCATE_EVACUACION("rescate_evacuacion", "Rescate y Evacuación"),
    LOGISTICA_TRANSPORTE("logistica_transporte", "Logística y Transporte"),
    APOYO_PSICOLOGICO("apoyo_psicologico", "Apoyo Psicológico"),
    COCINA_COMEDOR("cocina_comedor", "Cocina / Comedor Comunitario"),
    GENERAL("general", "Voluntariado General");

    companion object {
        fun fromApi(value: String?): VolunteerSpecialty {
            return values().find { it.apiValue.equals(value, ignoreCase = true) } ?: GENERAL
        }
    }
}

/**
 * Disponibilidad horaria del voluntario.
 */
enum class VolunteerAvailability(val apiValue: String, val displayName: String) {
    FULL_TIME("tiempo_completo", "Tiempo Completo (24/7 o guardia)"),
    PART_TIME("medio_tiempo", "Medio Tiempo (Mañanas/Tardes)"),
    WEEKENDS("fines_de_semana", "Fines de Semana"),
    EMERGENCIES("emergencias_puntuales", "Guardia para Emergencias Puntuales");

    companion object {
        fun fromApi(value: String?): VolunteerAvailability {
            return values().find { it.apiValue.equals(value, ignoreCase = true) } ?: EMERGENCIES
        }
    }
}

/**
 * Modalidad de despliegue del voluntario.
 */
enum class VolunteerModality(val apiValue: String, val displayName: String) {
    PRESENCIAL("presencial", "Presencial en Terreno"),
    REMOTO("remoto", "Remoto / Coordinación Digital"),
    HIBRIDO("hibrido", "Híbrido (Presencial y Remoto)");

    companion object {
        fun fromApi(value: String?): VolunteerModality {
            return values().find { it.apiValue.equals(value, ignoreCase = true) } ?: PRESENCIAL
        }
    }
}

/**
 * Datos de entrada para el censo y registro de damnificado.
 */
data class VictimRegistrationInput(
    val fullName: String,
    val idDocument: String,
    val birthdate: String,
    val email: String,
    val phone: String,
    val country: String = "Venezuela",
    val state: String,
    val municipality: String,
    val sector: String,
    val address: String,
    val affectationLevel: AffectationLevel,
    val minorsCount: Int = 0,
    val elderlyCount: Int = 0,
    val disabledCount: Int = 0,
    val age: Int = 18,
    val gender: String = "male",
    val description: String,
    val googlePhotosUrl: String? = null,
    val dataConsent: Boolean = true,
    val swornDeclaration: Boolean = true
)

/**
 * Datos de entrada para el registro de voluntario SOS.
 */
data class VolunteerRegistrationInput(
    val fullName: String,
    val idDocument: String,
    val birthdate: String,
    val email: String,
    val phone: String,
    val country: String = "Venezuela",
    val state: String,
    val municipality: String,
    val sector: String,
    val specialty: VolunteerSpecialty,
    val availability: VolunteerAvailability,
    val modality: VolunteerModality,
    val experienceDescription: String? = null,
    val dataConsent: Boolean = true,
    val legalDisclaimer: Boolean = true
)

/**
 * Resultado del registro inicial de damnificado o voluntario.
 */
data class SosRegistrationResult(
    val dossierNumber: String,
    val email: String,
    val message: String
)

/**
 * Entrada para verificación OTP y definición de contraseña.
 */
data class SosOtpVerificationInput(
    val email: String,
    val otpCode: String,
    val password: String,
    val confirmPassword: String
)

/**
 * Sesión autenticada generada tras la activación exitosa.
 */
data class SosAuthSession(
    val token: String,
    val username: String,
    val dossierNumber: String
)

/**
 * Información pública de la campaña humanitaria y código de referidos.
 */
data class SosCampaignInfo(
    val shareCode: String,
    val bonusBlue: Double,
    val isCampaignActive: Boolean
)
