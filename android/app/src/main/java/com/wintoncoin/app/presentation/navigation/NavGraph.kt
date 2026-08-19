// ============================================================================
// WintonCoin Android — Navegación (Rutas & NavGraph)
// ============================================================================
// Define la estructura de navegación declarativa de la app Android nativa.
// Contempla Login, Registro, OTP, Recuperación de Clave, Dashboard, Perfil y Billetera.
// ============================================================================

package com.wintoncoin.app.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.presentation.dashboard.DashboardScreen
import com.wintoncoin.app.presentation.forgot.ForgotPasswordScreen
import com.wintoncoin.app.presentation.forgot.ForgotPasswordViewModel
import com.wintoncoin.app.presentation.login.LoginScreen
import com.wintoncoin.app.presentation.login.LoginViewModel
import com.wintoncoin.app.presentation.otp.OtpViewModel
import com.wintoncoin.app.presentation.otp.VerifyOtpScreen
import com.wintoncoin.app.presentation.profile.ProfileEvent
import com.wintoncoin.app.presentation.profile.ProfileScreen
import com.wintoncoin.app.presentation.profile.ProfileViewModel
import com.wintoncoin.app.presentation.register.RegisterScreen
import com.wintoncoin.app.presentation.register.RegisterViewModel
import com.wintoncoin.app.presentation.wallet.WalletScreen
import com.wintoncoin.app.presentation.wallet.WalletViewModel

import com.wintoncoin.app.presentation.marketplace.MarketplaceScreen
import com.wintoncoin.app.presentation.marketplace.MarketplaceViewModel
import com.wintoncoin.app.presentation.marketplace.detail.PublicationDetailScreen
import com.wintoncoin.app.presentation.marketplace.detail.PublicationDetailViewModel

/**
 * Rutas de las pantallas de la aplicación.
 */
sealed class Screen(val route: String) {
    object Login : Screen("login_screen")
    object Register : Screen("register_screen")
    object ForgotPassword : Screen("forgot_password_screen")
    object Dashboard : Screen("dashboard_screen")
    object Wallet : Screen("wallet_screen")
    object Marketplace : Screen("marketplace_screen")
    data class VerifyOtp(val email: String) : Screen("verify_otp_screen/$email")
    data class Profile(val username: String) : Screen("profile_screen/$username")
    data class PublicationDetail(val id: String) : Screen("publication_detail_screen/$id")
}

/**
 * NavGraph — Grafo principal de navegación.
 */
@Composable
fun NavGraph(
    tokenManager: TokenManager,
    currentScreen: String,
    onNavigateTo: (String) -> Unit,
    onNavigateToDashboard: () -> Unit,
    onNavigateToLogin: () -> Unit
) {
    when {
        currentScreen == Screen.Login.route -> {
            val loginViewModel: LoginViewModel = hiltViewModel()
            LoginScreen(
                viewModel = loginViewModel,
                onLoginSuccess = onNavigateToDashboard,
                onNavigateToRegister = { onNavigateTo(Screen.Register.route) },
                onNavigateToForgotPassword = { onNavigateTo(Screen.ForgotPassword.route) }
            )
        }
        currentScreen == Screen.Register.route -> {
            val registerViewModel: RegisterViewModel = hiltViewModel()
            RegisterScreen(
                viewModel = registerViewModel,
                onNavigateBackToLogin = { onNavigateTo(Screen.Login.route) },
                onNavigateToOtp = { email -> onNavigateTo("verify_otp_screen/$email") }
            )
        }
        currentScreen.startsWith("verify_otp_screen/") -> {
            val email = currentScreen.removePrefix("verify_otp_screen/")
            val otpViewModel: OtpViewModel = hiltViewModel()
            VerifyOtpScreen(
                viewModel = otpViewModel,
                email = email,
                onNavigateBack = { onNavigateTo(Screen.Register.route) },
                onNavigateToDashboard = onNavigateToDashboard
            )
        }
        currentScreen == Screen.ForgotPassword.route -> {
            val forgotViewModel: ForgotPasswordViewModel = hiltViewModel()
            ForgotPasswordScreen(
                viewModel = forgotViewModel,
                onNavigateBackToLogin = { onNavigateTo(Screen.Login.route) }
            )
        }
        currentScreen.startsWith("profile_screen/") -> {
            val targetUser = currentScreen.removePrefix("profile_screen/")
            val profileViewModel: ProfileViewModel = hiltViewModel()
            profileViewModel.onEvent(ProfileEvent.LoadProfile(targetUser))
            ProfileScreen(
                viewModel = profileViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) }
            )
        }
        currentScreen == Screen.Wallet.route -> {
            val walletViewModel: WalletViewModel = hiltViewModel()
            WalletScreen(
                viewModel = walletViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) }
            )
        }
        currentScreen == Screen.Marketplace.route -> {
            val marketplaceViewModel: MarketplaceViewModel = hiltViewModel()
            MarketplaceScreen(
                viewModel = marketplaceViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) },
                onNavigateToDetail = { id -> onNavigateTo("publication_detail_screen/$id") }
            )
        }
        currentScreen.startsWith("publication_detail_screen/") -> {
            val pubId = currentScreen.removePrefix("publication_detail_screen/")
            val detailViewModel: PublicationDetailViewModel = hiltViewModel()
            PublicationDetailScreen(
                viewModel = detailViewModel,
                publicationId = pubId,
                onNavigateBack = { onNavigateTo(Screen.Marketplace.route) }
            )
        }
        currentScreen == Screen.Dashboard.route -> {
            val walletViewModel: WalletViewModel = hiltViewModel()
            DashboardScreen(
                username = tokenManager.getUsername(),
                walletViewModel = walletViewModel,
                onNavigateToWallet = { onNavigateTo(Screen.Wallet.route) },
                onNavigateToMarketplace = { onNavigateTo(Screen.Marketplace.route) },
                onNavigateToProfile = { username -> onNavigateTo("profile_screen/$username") },
                onLogout = {
                    tokenManager.clearSession()
                    onNavigateToLogin()
                }
            )
        }
    }
}
