// ============================================================================
// WintonCoin Android — BiometricAuthManager
// ============================================================================
// [CORE / SECURITY] Administrador de autenticación biométrica (Huella / Rostro)
// y Credenciales del Dispositivo (PIN / Patrón / Contraseña del teléfono).
// Integra BiometricPrompt nativo de AndroidX con trazabilidad auditable SOC 2.
// ============================================================================

package com.wintoncoin.app.core.biometrics

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.wintoncoin.app.core.audit.AuditLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BiometricAuthManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val auditLogger: AuditLogger
) {

    /**
     * Comprueba la disponibilidad de sensores biométricos y/o bloqueo de pantalla (PIN/Patrón).
     */
    fun checkBiometricAvailability(): BiometricStatus {
        val biometricManager = BiometricManager.from(context)
        val biometricResult = try {
            biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        } catch (e: Exception) {
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE
        }

        // Verificación 100% segura y universal de credenciales (PIN/Patrón) sin excepciones en Android
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? android.app.KeyguardManager
        val hasCredential = keyguardManager?.isDeviceSecure == true
        val hasBiometrics = biometricResult == BiometricManager.BIOMETRIC_SUCCESS

        return when {
            hasBiometrics && hasCredential -> BiometricStatus.BIOMETRIC_AND_CREDENTIAL
            hasBiometrics -> BiometricStatus.BIOMETRIC_ONLY
            hasCredential -> BiometricStatus.DEVICE_CREDENTIAL_ONLY
            biometricResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                if (hasCredential) BiometricStatus.DEVICE_CREDENTIAL_ONLY else BiometricStatus.NONE_CONFIGURED
            biometricResult == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                if (hasCredential) BiometricStatus.DEVICE_CREDENTIAL_ONLY else BiometricStatus.NO_HARDWARE
            biometricResult == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                if (hasCredential) BiometricStatus.DEVICE_CREDENTIAL_ONLY else BiometricStatus.HARDWARE_UNAVAILABLE
            biometricResult == BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED ->
                BiometricStatus.SECURITY_UPDATE_REQUIRED
            else -> if (hasCredential) BiometricStatus.DEVICE_CREDENTIAL_ONLY else BiometricStatus.UNKNOWN
        }
    }

    /**
     * Lanza el diálogo nativo del sistema operativo BiometricPrompt.
     * Permite autenticar por Huella, Rostro o PIN/Patrón del teléfono.
     */
    fun authenticate(
        activity: FragmentActivity,
        title: String,
        subtitle: String = "",
        description: String = "",
        negativeButtonText: String = "Cancelar",
        allowDeviceCredential: Boolean = true,
        onResult: (BiometricPromptResult) -> Unit
    ) {
        val status = checkBiometricAvailability()
        if (!status.isAnyUnlockAvailable) {
            onResult(BiometricPromptResult.NotAvailable(status.displayName))
            return
        }

        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                auditLogger.log(
                    AuditLogger.Category.AUTH,
                    "BIOMETRIC_AUTH_SUCCESS",
                    "type=${result.authenticationType}"
                )
                onResult(BiometricPromptResult.Success)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                ) {
                    auditLogger.log(
                        AuditLogger.Category.AUTH,
                        "BIOMETRIC_AUTH_CANCELLED",
                        "code=$errorCode"
                    )
                    onResult(BiometricPromptResult.Cancelled)
                } else {
                    auditLogger.log(
                        AuditLogger.Category.AUTH,
                        "BIOMETRIC_AUTH_ERROR",
                        "code=$errorCode, msg=$errString",
                        isError = true
                    )
                    onResult(BiometricPromptResult.Error(errorCode, errString.toString()))
                }
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                auditLogger.log(
                    AuditLogger.Category.AUTH,
                    "BIOMETRIC_AUTH_FAILED",
                    "Intento biométrico o PIN no reconocido",
                    isError = true
                )
                onResult(BiometricPromptResult.Failed)
            }
        }

        val prompt = BiometricPrompt(activity, executor, callback)

        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)

        if (subtitle.isNotBlank()) promptInfoBuilder.setSubtitle(subtitle)
        if (description.isNotBlank()) promptInfoBuilder.setDescription(description)

        if (allowDeviceCredential) {
            // Permite PIN/Patrón/Contraseña del sistema si no hay sensor o como respaldo
            promptInfoBuilder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
        } else {
            promptInfoBuilder.setNegativeButtonText(negativeButtonText)
            promptInfoBuilder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        }

        try {
            prompt.authenticate(promptInfoBuilder.build())
        } catch (e: Exception) {
            auditLogger.log(
                AuditLogger.Category.AUTH,
                "BIOMETRIC_LAUNCH_EXCEPTION",
                "Error: ${e.message}",
                isError = true
            )
            onResult(BiometricPromptResult.Error(-1, e.message ?: "Error al iniciar autenticación"))
        }
    }
}
