// ============================================================================
// WintonCoin Android — SecuritySettingsScreen
// ============================================================================
// [PRESENTATION LAYER / JETPACK COMPOSE] Pantalla de gestión de seguridad biométrica
// y bloqueo por credenciales del dispositivo (PIN / Patrón).
// ============================================================================

package com.wintoncoin.app.presentation.settings.security

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun SecuritySettingsScreen(
    onNavigateBack: () -> Unit,
    viewModel: SecuritySettingsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val scrollState = rememberScrollState()

    val hasBiometrics = state.biometricStatus.isBiometricAvailable
    val hasPinOnly = !hasBiometrics && state.biometricStatus.isDeviceCredentialAvailable

    Scaffold(
        topBar = {
            Surface(color = Color(0xFF0F172A), shadowElevation = 4.dp) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                            tint = Color.White
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Seguridad & Biometría",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        },
        containerColor = Color(0xFF0B1120)
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(scrollState)
                .padding(16.dp)
        ) {
            // FEEDBACK TEMPORAL
            AnimatedVisibility(visible = state.feedbackMessage != null) {
                state.feedbackMessage?.let { msg ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (state.isSuccessFeedback) Color(0xFF064E3B) else Color(0xFF7F1D1D)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 16.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (state.isSuccessFeedback) Icons.Default.CheckCircle else Icons.Default.Warning,
                                contentDescription = null,
                                tint = if (state.isSuccessFeedback) Color(0xFF34D399) else Color(0xFFF87171),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(text = msg, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }

            // TARJETA 1: ESTADO DEL SENSOR O BLOQUEO DE PANTALLA
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF38BDF8).copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(
                                if (hasBiometrics) Color(0xFF10B981).copy(alpha = 0.2f)
                                else if (hasPinOnly) Color(0xFF38BDF8).copy(alpha = 0.2f)
                                else Color(0xFFF59E0B).copy(alpha = 0.2f)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (hasBiometrics) Icons.Default.Fingerprint else Icons.Default.Lock,
                            contentDescription = "Seguridad",
                            tint = if (hasBiometrics) Color(0xFF10B981) else if (hasPinOnly) Color(0xFF38BDF8) else Color(0xFFF59E0B),
                            modifier = Modifier.size(30.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column {
                        Text(
                            text = if (hasBiometrics) {
                                "Sensor Biométrico Activo"
                            } else if (hasPinOnly) {
                                "Bloqueo por PIN / Patrón Activo"
                            } else {
                                "Seguridad No Configurada"
                            },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = state.biometricStatus.displayName,
                            fontSize = 12.sp,
                            color = Color(0xFF94A3B8),
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // SECCIÓN: CONTROLES DE PROTECCIÓN
            Text(
                text = "CONTROLES DE PROTECCIÓN",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF38BDF8),
                letterSpacing = 0.5.sp,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            // SWITCH 1: BLOQUEO AL INICIAR
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(14.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFF2563EB).copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = Color(0xFF38BDF8),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = if (hasBiometrics) "Bloqueo Biométrico de la App" else "Bloqueo por PIN de la App",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = if (hasBiometrics) "Exigir huella o rostro al abrir la aplicación" else "Exigir PIN o patrón al abrir la aplicación",
                                fontSize = 12.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }

                    Switch(
                        checked = state.isAppLockEnabled,
                        onCheckedChange = { viewModel.onEvent(SecuritySettingsEvent.ToggleAppLock(it)) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFF2563EB),
                            uncheckedThumbColor = Color(0xFF94A3B8),
                            uncheckedTrackColor = Color(0xFF334155)
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // SWITCH 2: CONFIRMACIÓN EN TRANSACCIONES
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(14.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFF10B981).copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = null,
                                tint = Color(0xFF10B981),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Autorizar Transacciones",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = if (hasBiometrics) "Exigir biometría antes de transferir o donar" else "Exigir PIN antes de transferir o donar",
                                fontSize = 12.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }

                    Switch(
                        checked = state.isTransactionBiometricRequired,
                        onCheckedChange = { viewModel.onEvent(SecuritySettingsEvent.ToggleTransactionBiometrics(it)) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFF10B981),
                            uncheckedThumbColor = Color(0xFF94A3B8),
                            uncheckedTrackColor = Color(0xFF334155)
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // SECCIÓN: ARQUITECTURA CRIPTOGRÁFICA
            Text(
                text = "ESTÁNDARES DE CIBERSEGURIDAD BANCARIA",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF38BDF8),
                letterSpacing = 0.5.sp,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(14.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    SecurityBullet(
                        icon = Icons.Default.Key,
                        title = "Android Keystore (AES-256-GCM)",
                        description = "Tus tokens y llaves criptográficas están aislados en el procesador seguro de tu dispositivo."
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    SecurityBullet(
                        icon = Icons.Default.Security,
                        title = "Arquitectura Cero Confianza (Zero-Trust)",
                        description = "Todas las solicitudes de red se verifican criptográficamente con tokens de vida corta."
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    SecurityBullet(
                        icon = Icons.Default.CheckCircle,
                        title = "Auditoría SOC 2 Type II",
                        description = "Cada intento de autenticación y transacción genera un registro indeleble y verificable."
                    )
                }
            }

            Spacer(modifier = Modifier.height(30.dp))
        }
    }
}

@Composable
private fun SecurityBullet(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    description: String
) {
    Row(verticalAlignment = Alignment.Top) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Color(0xFF38BDF8),
            modifier = Modifier.size(18.dp).padding(top = 2.dp)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column {
            Text(text = title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = description, fontSize = 12.sp, color = Color(0xFF94A3B8), lineHeight = 16.sp)
        }
    }
}
