package com.wintoncoin.app.ui

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.wintoncoin.app.ui.auth.LoginScreen
import com.wintoncoin.app.ui.dashboard.DashboardScreen
import com.wintoncoin.app.ui.publication.CreatePublicationScreen
import com.wintoncoin.app.ui.navigation.Screen
import com.wintoncoin.app.ui.theme.WintonCoinTheme
import com.wintoncoin.app.util.BiometricPromptManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject
    lateinit var biometricManager: BiometricPromptManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WintonCoinTheme {
                val navController = rememberNavController()
                
                NavHost(navController = navController, startDestination = Screen.Login.route) {
                    
                    composable(Screen.Login.route) {
                        LoginScreen(
                            onLoginSuccess = {
                                navController.navigate(Screen.Dashboard.route) {
                                    popUpTo(Screen.Login.route) { inclusive = true }
                                }
                            },
                            onNavigateToRegister = {
                                navController.navigate(Screen.Register.route)
                            }
                        )
                    }
                    
                    composable(Screen.Register.route) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Pantalla de Registro (En Construcción)")
                        }
                    }
                    
                    composable(Screen.Dashboard.route) {
                        DashboardScreen(
                            onNavigateToCreatePublication = {
                                navController.navigate(Screen.CreatePublication.route)
                            }
                        )
                    }
                    
                    composable(Screen.CreatePublication.route) {
                        CreatePublicationScreen(
                            onNavigateBack = {
                                navController.popBackStack()
                            }
                        )
                    }
                }
            }
        }
    }
}
