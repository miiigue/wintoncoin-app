// ============================================================================
// WintonCoin Android — RootDetectorTest (Prueba Unitaria de Integridad)
// ============================================================================
// [UNIT TEST] Evalúa la inspección de integridad del dispositivo contra
// modificaciones no autorizadas (OWASP MASVS-RESILIENCE-1).
// ============================================================================

package com.wintoncoin.app.core.security

import android.content.Context
import android.content.pm.PackageManager
import com.wintoncoin.app.core.audit.AuditLogger
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test

class RootDetectorTest {

    private val context: Context = mockk(relaxed = true)
    private val packageManager: PackageManager = mockk(relaxed = true)
    private val auditLogger: AuditLogger = mockk(relaxed = true)
    private lateinit var rootDetector: RootDetector

    @Before
    fun setUp() {
        every { context.packageManager } returns packageManager
        rootDetector = RootDetector(context, auditLogger)
    }

    @Test
    fun `clean standard device returns isRooted false and logs DEVICE_INTEGRITY_OK`() {
        every { packageManager.getPackageInfo(any<String>(), any<Int>()) } throws PackageManager.NameNotFoundException()

        val result = rootDetector.checkSecurity()

        assertNotNull(result)
        // En entorno estándar de test JVM (sin binarios su ni apps de root)
        assertFalse(result.isRooted)
        verify(atLeast = 1) { auditLogger.logSecurityEvent("DEVICE_INTEGRITY_OK", any()) }
    }
}
