// ============================================================================
// WintonCoin Android — VerifyOtpScreen (Pantalla de Verificación OTP)
// ============================================================================
// UI declarativa para ingresar el código PIN OTP de 6 dígitos enviado por SMS/Email.
// ============================================================================

package com.wintoncoin.app.presentation.otp

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.components.WintonButton
import com.wintoncoin.app.presentation.components.WintonTextField
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonPurple

@Composable
fun VerifyOtpScreen(
    viewModel: OtpViewModel,
    email: String,
    onNavigateBack: () -> Unit,
    onNavigateToDashboard: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) {
            onNavigateToDashboard()
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Regresar",
                        tint = Color.White
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Verificación de Seguridad",
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
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(
                                color = WintonPurple.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(36.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.MarkEmailRead,
                            contentDescription = "OTP Email",
                            tint = WintonGold,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Verifica tu Correo",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = "Hemos enviado un código OTP de 6 dígitos a:\n$email",
                        color = Color.LightGray,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
                    )

                    WintonTextField(
                        value = state.otpCode,
                        onValueChange = { viewModel.onEvent(OtpEvent.OtpCodeChanged(it)) },
                        label = "Código de Verificación (6 dígitos)",
                        placeholder = "123456",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        errorMessage = state.otpError,
                        enabled = !state.isLoading
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    WintonButton(
                        text = "Verificar Código",
                        onClick = { viewModel.onEvent(OtpEvent.Submit) },
                        isLoading = state.isLoading,
                        enabled = !state.isLoading && state.otpCode.length == 6
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    if (state.canResend) {
                        Text(
                            text = "¿No recibiste el código? Reenviar",
                            color = WintonGold,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { viewModel.onEvent(OtpEvent.ResendCode) }
                        )
                    } else {
                        Text(
                            text = "Reenviar código en ${state.resendCountdown}s",
                            color = Color.Gray,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }

        if (state.errorMessage != null) {
            WintonAlertDialog(
                title = "Error de Verificación",
                message = state.errorMessage!!,
                onDismiss = { viewModel.onEvent(OtpEvent.DismissError) }
            )
        }
    }
}
