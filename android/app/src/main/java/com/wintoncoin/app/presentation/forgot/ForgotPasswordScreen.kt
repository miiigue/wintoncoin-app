// ============================================================================
// WintonCoin Android — ForgotPasswordScreen (Pantalla de Recuperación)
// ============================================================================
// UI declarativa para solicitar la recuperación de contraseña por email.
// ============================================================================

package com.wintoncoin.app.presentation.forgot

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.components.WintonButton
import com.wintoncoin.app.presentation.components.WintonTextField
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold

@Composable
fun ForgotPasswordScreen(
    viewModel: ForgotPasswordViewModel,
    onNavigateBackToLogin: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        WintonBlue,
                        Color(0xFF0F172A),
                        Color(0xFF020617)
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onNavigateBackToLogin) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Regresar al Login",
                        tint = Color.White
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Recuperar Contraseña",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(30.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                color = Color(0xFF1E293B).copy(alpha = 0.95f),
                tonalElevation = 8.dp
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "¿Olvidaste tu contraseña?",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = "Ingresa tu correo electrónico registrado y te enviaremos las instrucciones para restablecerla.",
                        color = Color.LightGray,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
                    )

                    WintonTextField(
                        value = state.email,
                        onValueChange = { viewModel.onEvent(ForgotPasswordEvent.EmailChanged(it)) },
                        label = "Correo Electrónico",
                        placeholder = "ej: usuario@wintoncoin.com",
                        leadingIcon = Icons.Default.Email,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        errorMessage = state.emailError,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    WintonButton(
                        text = "Enviar Instrucciones",
                        onClick = { viewModel.onEvent(ForgotPasswordEvent.Submit) },
                        isLoading = state.isLoading,
                        enabled = !state.isLoading && state.email.isNotBlank()
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "¿Recordaste tu clave? ",
                            color = Color.Gray,
                            fontSize = 14.sp
                        )
                        Text(
                            text = "Inicia Sesión",
                            color = WintonGold,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { onNavigateBackToLogin() }
                        )
                    }
                }
            }
        }

        if (state.isSuccess && state.successMessage != null) {
            WintonAlertDialog(
                title = "Correo Enviado",
                message = state.successMessage!!,
                confirmButtonText = "Ir al Login",
                onDismiss = {
                    viewModel.onEvent(ForgotPasswordEvent.DismissSuccess)
                    onNavigateBackToLogin()
                }
            )
        }

        if (state.errorMessage != null) {
            WintonAlertDialog(
                title = "Error de Recuperación",
                message = state.errorMessage!!,
                onDismiss = { viewModel.onEvent(ForgotPasswordEvent.DismissError) }
            )
        }
    }
}
