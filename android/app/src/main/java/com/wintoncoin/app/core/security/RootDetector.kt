// ============================================================================
// WintonCoin Android — RootDetector (Detección de Dispositivos Vulnerables)
// ============================================================================
// [SEGURIDAD FINTECH / OWASP MASVS] Verifica la integridad del entorno Android
// detectando si el dispositivo ha sido rooteado o si tiene herramientas de
// modificación instaladas (Superuser, Magisk, KingRoot, etc.).
//
// ¿Por qué es crítico?
// En dispositivos rooteados, un malware con permisos de superusuario podría
// inspeccionar la memoria RAM del proceso o el almacenamiento interno.
//
// Detecciones realizadas:
// 1. Presencia de binarios `su` en rutas estándar del sistema.
// 2. Presencia de paquetes o administradores de Root (Magisk, SuperSU).
// 3. Compilaciones de firmware de prueba (`test-keys` en Build.TAGS).
//
// Analogía: Como la alarma sísmica y de intrusos de una bóveda de banco — si
// detecta vibraciones inusuales o manipulación en los cimientos, activa las
// alertas de auditoría inmediatamente.
// ============================================================================

package com.wintoncoin.app.core.security

import android.content.Context
import android.os.Build
import com.wintoncoin.app.core.audit.AuditLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resultado de la inspección de integridad del dispositivo.
 */
data class SecurityCheckResult(
    val isRooted: Boolean,
    val reasons: List<String> = emptyList()
)

/**
 * RootDetector — Módulo de auditoría de integridad de hardware y SO.
 */
@Singleton
class RootDetector @Inject constructor(
    @ApplicationContext private val context: Context,
    private val auditLogger: AuditLogger
) {

    companion object {
        // Rutas habituales donde reside el binario su en dispositivos rooteados
        private val SU_PATHS = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su"
        )

        // Paquetes conocidos de administración de permisos de superusuario
        private val ROOT_PACKAGES = arrayOf(
            "com.noshufou.android.su",
            "com.thirdparty.superuser",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser",
            "com.topjohnwu.magisk"
        )
    }

    /**
     * Realiza un escaneo completo de seguridad en el dispositivo.
     *
     * @return SecurityCheckResult indicando si se detectaron vulnerabilidades de Root.
     */
    fun checkSecurity(): SecurityCheckResult {
        val detectedReasons = mutableListOf<String>()

        // Check 1: Firma Build.TAGS (test-keys)
        if (checkTestKeys()) {
            detectedReasons.add("Firmware con test-keys no oficiales")
        }

        // Check 2: Existencia de binarios su
        if (checkSuBinaries()) {
            detectedReasons.add("Binario 'su' localizado en sistema de archivos")
        }

        // Check 3: Presencia de aplicaciones de administración de Root
        if (checkRootPackages()) {
            detectedReasons.add("Aplicaciones de Root (Magisk/SuperSU) instaladas")
        }

        val isRooted = detectedReasons.isNotEmpty()

        // Registramos en la auditoría bancaria el resultado
        if (isRooted) {
            auditLogger.logSecurityEvent(
                action = "ROOT_DETECTED",
                details = "Vulnerabilidades: ${detectedReasons.joinToString("; ")}"
            )
        } else {
            auditLogger.logSecurityEvent(
                action = "DEVICE_INTEGRITY_OK",
                details = "Entorno verificado y seguro."
            )
        }

        return SecurityCheckResult(isRooted, detectedReasons)
    }

    private fun checkTestKeys(): Boolean {
        val buildTags = Build.TAGS
        return buildTags != null && buildTags.contains("test-keys")
    }

    private fun checkSuBinaries(): Boolean {
        for (path in SU_PATHS) {
            if (File(path).exists()) return true
        }
        return false
    }

    private fun checkRootPackages(): Boolean {
        val pm = context.packageManager
        for (packageName in ROOT_PACKAGES) {
            try {
                pm.getPackageInfo(packageName, 0)
                return true
            } catch (e: Exception) {
                // Paquete no encontrado, continuar escaneo
            }
        }
        return false
    }
}
