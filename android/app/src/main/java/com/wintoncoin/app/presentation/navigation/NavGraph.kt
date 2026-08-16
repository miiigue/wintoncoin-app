// ============================================================================
// WintonCoin Android — Navegación (Rutas & NavGraph)
// ============================================================================
// Define la estructura de navegación declarativa de la app Android nativa.
// ============================================================================

package com.wintoncoin.app.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.presentation.dashboard.DashboardPlaceholderScreen
import com.wintoncoin.app.presentation.login.LoginScreen
import com.wintoncoin.app.presentation.login.LoginViewModel

/**
 * Rutas de las pantallas de la aplicación.
 */
sealed class Screen(val route: String) {
    object Login : Screen("login_screen")
    object Dashboard : Screen("dashboard_screen")
}

/**
 * NavGraph — Grafo principal de navegación.
 * Gestiona el paso entre la pantalla de Login y el Dashboard.
 */
@Composable
fun NavGraph(
    tokenManager: TokenManager,
    currentScreen: String,
    onNavigateToDashboard: () -> Unit,
    onNavigateToLogin: () -> Unit
) {
    when (currentScreen) {
        Screen.Login.route -> {
            val loginViewModel: LoginViewModel = hiltViewModel()
            LoginScreen(
                viewModel = loginViewModel,
                onLoginSuccess = onNavigateToDashboard
            )
        }
        Screen.Dashboard.route -> {
            DashboardPlaceholderScreen(
                username = tokenManager.getUsername(),
                onLogout = {
                    tokenManager.clearSession()
                    onNavigateToLogin()
                }
            )
        }
    }
}
