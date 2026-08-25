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

import com.wintoncoin.app.presentation.booster.BoosterProfileEvent
import com.wintoncoin.app.presentation.booster.BoosterProfileScreen
import com.wintoncoin.app.presentation.booster.BoosterProfileViewModel
import com.wintoncoin.app.presentation.referrals.ReferralsScreen
import com.wintoncoin.app.presentation.referrals.ReferralsViewModel
import com.wintoncoin.app.presentation.marketplace.MarketplaceScreen
import com.wintoncoin.app.presentation.marketplace.MarketplaceViewModel
import com.wintoncoin.app.presentation.marketplace.create.CreatePublicationScreen
import com.wintoncoin.app.presentation.marketplace.create.CreatePublicationViewModel
import com.wintoncoin.app.presentation.marketplace.detail.PublicationDetailScreen
import com.wintoncoin.app.presentation.marketplace.detail.PublicationDetailViewModel

import com.wintoncoin.app.presentation.statement.AccountStatementScreen
import com.wintoncoin.app.presentation.statement.AccountStatementViewModel
import com.wintoncoin.app.presentation.notifications.NotificationsScreen
import com.wintoncoin.app.presentation.notifications.NotificationsViewModel

/**
 * Rutas de las pantallas de la aplicación.
 */
sealed class Screen(val route: String) {
    object Login : Screen("login_screen")
    object Register : Screen("register_screen")
    object ForgotPassword : Screen("forgot_password_screen")
    object Dashboard : Screen("dashboard_screen")
    object Wallet : Screen("wallet_screen")
    object AccountStatement : Screen("account_statement_screen")
    object Notifications : Screen("notifications_screen")
    object Marketplace : Screen("marketplace_screen")
    object CreatePublication : Screen("create_publication_screen")
    object BoosterProfile : Screen("booster_profile_screen")
    object Referrals : Screen("referrals_screen")
    data class VerifyOtp(val email: String) : Screen("verify_otp_screen/$email")
    data class Profile(val username: String) : Screen("profile_screen/$username")
    data class UserBoosterProfile(val username: String) : Screen("booster_profile_screen/$username")
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
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) },
                onNavigateToAccountStatement = { onNavigateTo(Screen.AccountStatement.route) }
            )
        }
        currentScreen == Screen.AccountStatement.route -> {
            val statementViewModel: AccountStatementViewModel = hiltViewModel()
            AccountStatementScreen(
                viewModel = statementViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) }
            )
        }
        currentScreen == Screen.Notifications.route -> {
            val notificationsViewModel: NotificationsViewModel = hiltViewModel()
            NotificationsScreen(
                viewModel = notificationsViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) },
                onNavigateToBoosterProfile = { onNavigateTo(Screen.BoosterProfile.route) },
                onNavigateToWallet = { onNavigateTo(Screen.Wallet.route) },
                onNavigateToAccountStatement = { onNavigateTo(Screen.AccountStatement.route) },
                onNavigateToPublications = { onNavigateTo(Screen.Marketplace.route) }
            )
        }
        currentScreen == Screen.Marketplace.route -> {
            val marketplaceViewModel: MarketplaceViewModel = hiltViewModel()
            MarketplaceScreen(
                viewModel = marketplaceViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) },
                onNavigateToDetail = { id -> onNavigateTo("publication_detail_screen/$id") },
                onNavigateToCreatePublication = { onNavigateTo(Screen.CreatePublication.route) }
            )
        }
        currentScreen == Screen.CreatePublication.route -> {
            val createViewModel: CreatePublicationViewModel = hiltViewModel()
            CreatePublicationScreen(
                viewModel = createViewModel,
                onNavigateBack = { onNavigateTo(Screen.Marketplace.route) }
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
        currentScreen == Screen.BoosterProfile.route -> {
            val boosterViewModel: BoosterProfileViewModel = hiltViewModel()
            BoosterProfileScreen(
                viewModel = boosterViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) },
                onNavigateToReferrals = { onNavigateTo(Screen.Referrals.route) },
                onNavigateToMarketplace = { onNavigateTo(Screen.Marketplace.route) }
            )
        }
        currentScreen.startsWith("booster_profile_screen/") -> {
            val targetUser = currentScreen.removePrefix("booster_profile_screen/")
            val boosterViewModel: BoosterProfileViewModel = hiltViewModel()
            boosterViewModel.onEvent(BoosterProfileEvent.LoadProfile(targetUser))
            BoosterProfileScreen(
                viewModel = boosterViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) },
                onNavigateToReferrals = { onNavigateTo(Screen.Referrals.route) },
                onNavigateToMarketplace = { onNavigateTo(Screen.Marketplace.route) }
            )
        }
        currentScreen == Screen.Referrals.route -> {
            val referralsViewModel: ReferralsViewModel = hiltViewModel()
            ReferralsScreen(
                viewModel = referralsViewModel,
                onNavigateBack = { onNavigateTo(Screen.Dashboard.route) }
            )
        }
        currentScreen == Screen.Dashboard.route -> {
            val walletViewModel: WalletViewModel = hiltViewModel()
            DashboardScreen(
                username = tokenManager.getUsername(),
                walletViewModel = walletViewModel,
                onNavigateToWallet = { onNavigateTo(Screen.Wallet.route) },
                onNavigateToAccountStatement = { onNavigateTo(Screen.AccountStatement.route) },
                onNavigateToNotifications = { onNavigateTo(Screen.Notifications.route) },
                onNavigateToMarketplace = { onNavigateTo(Screen.Marketplace.route) },
                onNavigateToProfile = { username -> onNavigateTo("profile_screen/$username") },
                onNavigateToBooster = { onNavigateTo(Screen.BoosterProfile.route) },
                onNavigateToReferrals = { onNavigateTo(Screen.Referrals.route) },
                onLogout = {
                    tokenManager.clearSession()
                    onNavigateToLogin()
                }
            )
        }
    }
}
