// ============================================================================
// WintonCoin Android — MainActivity (Contenedor Principal de la App Híbrida)
// ============================================================================
// [PRESENTATION LAYER] Activity única (Single Activity Architecture).
//
// Extiende FragmentActivity para compatibilidad con BiometricPrompt de AndroidX.
// Hospeda el WintonWebViewContainer hiper-optimizado con paridad 100% PWA.
// ============================================================================

package com.wintoncoin.app

import android.os.Bundle
import android.util.Log
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.security.RootDetector
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.presentation.container.WintonWebViewContainer
import com.wintoncoin.app.presentation.theme.WintonCoinTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * MainActivity — Punto de entrada visual y contenedor nativo de WintonCoin.
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var rootDetector: RootDetector

    @Inject
    lateinit var biometricAuthManager: BiometricAuthManager

    @Inject
    lateinit var auditLogger: AuditLogger

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // enableEdgeToEdge seguro para experiencia inmersiva
        try {
            enableEdgeToEdge()
        } catch (e: Exception) {
            Log.w("MainActivity", "enableEdgeToEdge warning: ${e.message}")
        }

        // Escaneo de integridad del dispositivo al iniciar
        try {
            rootDetector.checkSecurity()
            auditLogger.logSecurityEvent("APP_LAUNCH", "Contenedor híbrido nativo iniciado correctamente")
        } catch (e: Exception) {
            Log.w("MainActivity", "rootDetector check: ${e.message}")
        }

        setContent {
            WintonCoinTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    WintonWebViewContainer(
                        biometricAuthManager = biometricAuthManager,
                        tokenManager = tokenManager,
                        rootDetector = rootDetector,
                        auditLogger = auditLogger
                    )
                }
            }
        }
    }
}
