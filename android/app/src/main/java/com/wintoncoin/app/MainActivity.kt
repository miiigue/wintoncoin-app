// ============================================================================
// WintonCoin Android — MainActivity (Activity Principal)
// ============================================================================
// Activity única (Single Activity Architecture) anotada con @AndroidEntryPoint.
// Administra el contenedor principal de la UI en Jetpack Compose e inspecciona
// la seguridad del dispositivo en cada inicio.
//
// Usa FragmentActivity (no ComponentActivity) para compatibilidad con
// BiometricPrompt de AndroidX, que requiere un FragmentActivity como host.
// ============================================================================

package com.wintoncoin.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.wintoncoin.app.core.security.RootDetector
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.presentation.navigation.NavGraph
import com.wintoncoin.app.presentation.navigation.Screen
import com.wintoncoin.app.presentation.theme.WintonCoinTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * MainActivity — Punto de entrada visual de la app.
 * Extiende FragmentActivity (requerido por BiometricPrompt de AndroidX).
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var rootDetector: RootDetector

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // enableEdgeToEdge seguro — en algunas ROMs puede fallar
        try {
            enableEdgeToEdge()
        } catch (e: Exception) {
            android.util.Log.w("MainActivity", "enableEdgeToEdge: ${e.message}")
        }

        // Escaneo de seguridad de integridad del dispositivo
        try {
            rootDetector.checkSecurity()
        } catch (e: Exception) {
            android.util.Log.w("MainActivity", "rootDetector: ${e.message}")
        }

        setContent {
            // Determinar pantalla inicial de forma segura
            val initialScreen = try {
                if (tokenManager.hasSession() && !tokenManager.isTokenExpired()) {
                    if (tokenManager.isBiometricsEnabled()) {
                        Screen.AppLock.route
                    } else {
                        Screen.Dashboard.route
                    }
                } else {
                    Screen.Login.route
                }
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Session check: ${e.message}")
                Screen.Login.route
            }

            var currentScreen by remember { mutableStateOf(initialScreen) }

            WintonCoinTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    NavGraph(
                        tokenManager = tokenManager,
                        currentScreen = currentScreen,
                        onNavigateTo = { targetRoute -> currentScreen = targetRoute },
                        onNavigateToDashboard = { currentScreen = Screen.Dashboard.route },
                        onNavigateToLogin = { currentScreen = Screen.Login.route }
                    )
                }
            }
        }
    }
}
