// ============================================================================
// WintonCoin Android — RegisterScreen (Pantalla de Registro)
// ============================================================================
// UI declarativa responsiva en Jetpack Compose para crear una cuenta.
// ============================================================================

package com.wintoncoin.app.presentation.register

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
fun RegisterScreen(
    viewModel: RegisterViewModel,
    onNavigateBackToLogin: () -> Unit,
    onNavigateToOtp: (String) -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess && state.registeredEmail != null) {
            onNavigateToOtp(state.registeredEmail!!)
        }
    }

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
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
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
                    text = "Crear Cuenta",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

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
                        text = "Únete a WintonCoin",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = "Completa tus datos para comenzar",
                        color = Color.LightGray,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
                    )

                    WintonTextField(
                        value = state.username,
                        onValueChange = { viewModel.onEvent(RegisterEvent.UsernameChanged(it)) },
                        label = "Nombre de Usuario",
                        placeholder = "ej: miguel_123",
                        leadingIcon = Icons.Default.Person,
                        errorMessage = state.usernameError,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    WintonTextField(
                        value = state.email,
                        onValueChange = { viewModel.onEvent(RegisterEvent.EmailChanged(it)) },
                        label = "Correo Electrónico",
                        placeholder = "ej: usuario@wintoncoin.com",
                        leadingIcon = Icons.Default.Email,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        errorMessage = state.emailError,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    WintonTextField(
                        value = state.phone,
                        onValueChange = { viewModel.onEvent(RegisterEvent.PhoneChanged(it)) },
                        label = "Teléfono (Opcional)",
                        placeholder = "ej: +584121234567",
                        leadingIcon = Icons.Default.Phone,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        errorMessage = state.phoneError,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    WintonTextField(
                        value = state.password,
                        onValueChange = { viewModel.onEvent(RegisterEvent.PasswordChanged(it)) },
                        label = "Contraseña",
                        placeholder = "••••••••",
                        leadingIcon = Icons.Default.Lock,
                        isPassword = true,
                        errorMessage = state.passwordError,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    WintonTextField(
                        value = state.confirmPassword,
                        onValueChange = { viewModel.onEvent(RegisterEvent.ConfirmPasswordChanged(it)) },
                        label = "Confirmar Contraseña",
                        placeholder = "••••••••",
                        leadingIcon = Icons.Default.Lock,
                        isPassword = true,
                        errorMessage = state.confirmPasswordError,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = state.termsAccepted,
                            onCheckedChange = { viewModel.onEvent(RegisterEvent.TermsToggled(it)) },
                            colors = CheckboxDefaults.colors(
                                checkedColor = WintonGold,
                                uncheckedColor = Color.Gray,
                                checkmarkColor = Color.Black
                            ),
                            enabled = !state.isLoading
                        )
                        Text(
                            text = "Acepto los Términos y Condiciones Legales",
                            color = Color.White,
                            fontSize = 12.sp,
                            modifier = Modifier
                                .clickable { viewModel.onEvent(RegisterEvent.TermsToggled(!state.termsAccepted)) }
                        )
                    }

                    if (state.termsError != null) {
                        Text(
                            text = state.termsError!!,
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 12.sp,
                            modifier = Modifier
                                .align(Alignment.Start)
                                .padding(start = 12.dp, top = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    WintonButton(
                        text = "Registrarme",
                        onClick = { viewModel.onEvent(RegisterEvent.Submit) },
                        isLoading = state.isLoading,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "¿Ya tienes cuenta? ",
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

            Spacer(modifier = Modifier.height(24.dp))
        }

        if (state.errorMessage != null) {
            WintonAlertDialog(
                title = "Error de Registro",
                message = state.errorMessage!!,
                onDismiss = { viewModel.onEvent(RegisterEvent.DismissError) }
            )
        }
    }
}
