// ============================================================================
// WintonCoin Android — LoginScreen (Pantalla de Inicio de Sesión Idéntica a PWA)
// ============================================================================
// [PRESENTATION LAYER] Replica exactamente la estética y estructura de login.html.
// ============================================================================

package com.wintoncoin.app.presentation.login

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.BuildConfig
import com.wintoncoin.app.R
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.components.WintonButton
import com.wintoncoin.app.presentation.components.WintonTextField
import com.wintoncoin.app.presentation.theme.WintonBackgroundDark
import com.wintoncoin.app.presentation.theme.WintonBorderSoft
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonPink
import com.wintoncoin.app.presentation.theme.WintonPrimary
import com.wintoncoin.app.presentation.theme.WintonSurfaceDark
import com.wintoncoin.app.presentation.theme.WintonTextMuted
import com.wintoncoin.app.presentation.theme.WintonTextWhite

/**
 * LoginScreen — Pantalla de login declarativa en Jetpack Compose idéntica a login.html.
 */
@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit = {},
    onNavigateToForgotPassword: () -> Unit = {}
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current

    // Escuchar el evento de éxito para navegar al Dashboard
    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) {
            onLoginSuccess()
        }
    }

    // Modal de diálogo en caso de error de autenticación
    if (state.errorMessage != null) {
        WintonAlertDialog(
            title = "Error de Autenticación",
            message = state.errorMessage ?: "Ha ocurrido un error inesperado",
            onDismiss = { viewModel.onEvent(LoginEvent.DismissError) }
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WintonBackgroundDark),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Contenedor Tarjeta (.container de style.css)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 450.dp)
                    .border(1.dp, WintonBorderSoft, RoundedCornerShape(16.dp))
                    .shadow(16.dp, RoundedCornerShape(16.dp), spotColor = Color.Black),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = WintonSurfaceDark)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Logo Oficial PWA Centrado
                    Image(
                        painter = painterResource(id = R.drawable.winton_logo),
                        contentDescription = "WintonCoin Logo",
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Título Oficial "Bienvenido"
                    Text(
                        text = "Bienvenido",
                        style = MaterialTheme.typography.headlineMedium,
                        color = WintonPrimary, // #6A5ACD de la PWA
                        fontWeight = FontWeight.Bold,
                        fontSize = 26.sp
                    )

                    Text(
                        text = "Plataforma de intercambio de bienes y servicios con tokens BLUE y RED",
                        style = MaterialTheme.typography.bodySmall,
                        color = WintonTextMuted,
                        textAlign = TextAlign.Center,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )

                    // Indicador visual de modo DEMO
                    if (BuildConfig.API_BASE_URL.contains("demo")) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Surface(
                            color = WintonPink.copy(alpha = 0.2f),
                            border = BorderStroke(1.dp, WintonPink.copy(alpha = 0.5f)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Text(
                                text = "ENTORNO DEMO DE PRUEBAS",
                                color = WintonPink,
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Campo 1: Usuario / Email
                    WintonTextField(
                        value = state.username,
                        onValueChange = { viewModel.onEvent(LoginEvent.UsernameChanged(it)) },
                        label = "Inicia sesión con tu Usuario o Email:",
                        placeholder = "Tu nombre de usuario o correo electrónico",
                        leadingIcon = Icons.Default.Person,
                        errorMessage = state.usernameError,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        )
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Campo 2: Contraseña con Ojito
                    WintonTextField(
                        value = state.password,
                        onValueChange = { viewModel.onEvent(LoginEvent.PasswordChanged(it)) },
                        label = "Contraseña:",
                        placeholder = "Tu contraseña",
                        leadingIcon = Icons.Default.Lock,
                        isPassword = true,
                        errorMessage = state.passwordError,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.onEvent(LoginEvent.Submit)
                            }
                        )
                    )

                    // Enlace: ¿Olvidaste tu contraseña? (Alineado a la derecha en dorado)
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                        Text(
                            text = "¿Olvidaste tu contraseña?",
                            color = WintonGold,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable { onNavigateToForgotPassword() }
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Botón Principal "Ingresar"
                    WintonButton(
                        text = "Ingresar",
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.onEvent(LoginEvent.Submit)
                        },
                        isLoading = state.isLoading
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Botón Secundario "Registrarse"
                    OutlinedButton(
                        onClick = onNavigateToRegister,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, WintonBorderSoft),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = WintonTextWhite)
                    ) {
                        Text(
                            text = "Registrarse",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "WintonCoin Native Android v1.5.0",
                color = WintonTextMuted.copy(alpha = 0.5f),
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}
