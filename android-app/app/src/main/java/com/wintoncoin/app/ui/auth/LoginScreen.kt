package com.wintoncoin.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.wintoncoin.app.ui.components.WintonButton
import com.wintoncoin.app.ui.components.WintonCard
import com.wintoncoin.app.ui.components.WintonTextField
import com.wintoncoin.app.ui.theme.WintonBackground
import com.wintoncoin.app.ui.theme.WintonViolet

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState = viewModel.uiState
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) {
            onLoginSuccess()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WintonBackground),
        contentAlignment = Alignment.Center
    ) {
        WintonCard(
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Bienvenido",
                    style = MaterialTheme.typography.headlineMedium,
                    color = WintonViolet,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = "Por favor, inicia sesión para continuar",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(32.dp))

                WintonTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = "Usuario"
                )

                Spacer(modifier = Modifier.height(16.dp))

                WintonTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Contraseña",
                    visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                            // Usaremos un icono simple por ahora, luego pondremos los vector assets
                            Text(if (isPasswordVisible) "🙈" else "👁️")
                        }
                    }
                )

                Spacer(modifier = Modifier.height(24.dp))

                if (uiState.error != null) {
                    Text(
                        text = uiState.error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )
                }

                WintonButton(
                    text = "Ingresar",
                    onClick = { viewModel.login(username, password) },
                    isLoading = uiState.isLoading
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Botón secundario para registro (estilo link)
                TextButton(
                    onClick = onNavigateToRegister,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Registrarse", 
                        color = WintonViolet,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
    }
}

