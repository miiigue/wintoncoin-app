// ============================================================================
// WintonCoin Android — BiometricStatus
// ============================================================================
// [CORE / SECURITY] Representa el estado del hardware biométrico y/o credenciales
// del dispositivo (PIN / Patrón / Contraseña del sistema operativo).
// ============================================================================

package com.wintoncoin.app.core.biometrics

enum class BiometricStatus(
    val displayName: String,
    val isBiometricAvailable: Boolean,
    val isDeviceCredentialAvailable: Boolean
) {
    BIOMETRIC_AND_CREDENTIAL("Huella/Rostro y PIN del teléfono configurados", true, true),
    BIOMETRIC_ONLY("Biometría disponible y configurada", true, false),
    DEVICE_CREDENTIAL_ONLY("Sin sensor de huella. Desbloqueo mediante PIN/Patrón del teléfono", false, true),
    NONE_CONFIGURED("Ni biometría ni PIN/Patrón configurados en el dispositivo", false, false),
    NO_HARDWARE("Este dispositivo no cuenta con sensor biométrico ni bloqueo de pantalla", false, false),
    HARDWARE_UNAVAILABLE("Sensor biométrico temporalmente no disponible", false, false),
    SECURITY_UPDATE_REQUIRED("Se requiere una actualización de seguridad del sistema", false, false),
    UNKNOWN("Estado de seguridad del dispositivo desconocido", false, false);

    val isAnyUnlockAvailable: Boolean
        get() = isBiometricAvailable || isDeviceCredentialAvailable
}
