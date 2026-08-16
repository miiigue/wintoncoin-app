// ============================================================================
// WintonCoin Android — MainActivity (Activity Principal)
// ============================================================================
// Activity única (Single Activity Architecture) anotada con @AndroidEntryPoint.
// Administra el contenedor principal de la UI en Jetpack Compose e inspecciona
// la seguridad del dispositivo en cada inicio.
// ============================================================================

package com.wintoncoin.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var rootDetector: RootDetector

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Escaneo de seguridad de integridad del dispositivo al arrancar la app
        rootDetector.checkSecurity()

        setContent {
            // Verificar si hay sesión activa previa para decidir la pantalla inicial
            val initialScreen = if (tokenManager.hasSession() && !tokenManager.isTokenExpired()) {
                Screen.Dashboard.route
            } else {
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
                        onNavigateToDashboard = { currentScreen = Screen.Dashboard.route },
                        onNavigateToLogin = { currentScreen = Screen.Login.route }
                    )
                }
            }
        }
    }
}
