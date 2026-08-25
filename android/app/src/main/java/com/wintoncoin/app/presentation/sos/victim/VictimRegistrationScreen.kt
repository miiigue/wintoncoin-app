// ============================================================================
// WintonCoin Android — VictimRegistrationScreen
// ============================================================================
// [PRESENTATION LAYER / JETPACK COMPOSE] Formulario de censo para damnificados.
// ============================================================================

package com.wintoncoin.app.presentation.sos.victim

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.wintoncoin.app.domain.model.AffectationLevel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VictimRegistrationScreen(
    onNavigateBack: () -> Unit,
    onActivationSuccess: () -> Unit,
    viewModel: VictimRegistrationViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    var affectationExpanded by remember { mutableStateOf(false) }

    // ── DIÁLOGO DE VERIFICACIÓN OTP & DEFINICIÓN DE CONTRASEÑA ───────────────
    if (state.showOtpDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.onEvent(VictimRegistrationEvent.DismissOtpDialog) },
            containerColor = Color(0xFF1E293B),
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Security,
                        contentDescription = "OTP",
                        tint = Color(0xFF38BDF8)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Activa tu Expediente",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Hemos enviado un código de 6 dígitos a ${state.email}. Ingresa el código y define tu contraseña para activar tu cuenta:",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    OutlinedTextField(
                        value = state.otpCode,
                        onValueChange = { viewModel.onEvent(VictimRegistrationEvent.OtpCodeChanged(it)) },
                        label = { Text("Código de 6 dígitos") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = getDarkTextFieldColors(),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = state.password,
                        onValueChange = { viewModel.onEvent(VictimRegistrationEvent.PasswordChanged(it)) },
                        label = { Text("Nueva Contraseña (mín 8 car.)") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        colors = getDarkTextFieldColors(),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = state.confirmPassword,
                        onValueChange = { viewModel.onEvent(VictimRegistrationEvent.ConfirmPasswordChanged(it)) },
                        label = { Text("Confirmar Contraseña") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        colors = getDarkTextFieldColors(),
                        modifier = Modifier.fillMaxWidth()
                    )

                    state.otpFeedbackMessage?.let { msg ->
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = msg,
                            color = if (state.otpFeedbackSuccess) Color(0xFF10B981) else Color(0xFFEF4444),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    if (state.resendCooldownSeconds > 0) {
                        Text(
                            text = "Reenviar código en ${state.resendCooldownSeconds}s",
                            color = Color(0xFF64748B),
                            fontSize = 12.sp
                        )
                    } else {
                        TextButton(
                            onClick = { viewModel.onEvent(VictimRegistrationEvent.ResendOtp) },
                            enabled = !state.isResendingOtp
                        ) {
                            Text("Reenviar código OTP", color = Color(0xFF38BDF8), fontSize = 12.sp)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.onEvent(VictimRegistrationEvent.VerifyOtp) },
                    enabled = !state.isVerifyingOtp && state.otpCode.length == 6 && state.password.length >= 8,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    if (state.isVerifyingOtp) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                    } else {
                        Text("Activar Cuenta", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.onEvent(VictimRegistrationEvent.DismissOtpDialog) }) {
                    Text("Cancelar", color = Color(0xFF94A3B8))
                }
            }
        )
    }

    // ── DIÁLOGO FINAL DE ACTIVACIÓN EXITOSA ──────────────────────────────────
    if (state.isActivationComplete) {
        AlertDialog(
            onDismissRequest = { },
            containerColor = Color(0xFF1E293B),
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Éxito",
                        tint = Color(0xFF10B981)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "¡Expediente Registrado!",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Tu caso ha sido incorporado al sistema de priorización de ayuda comunitaria de WintonCoin SOS.",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF0F172A))
                            .border(1.dp, Color(0xFF10B981), RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "NÚMERO DE EXPEDIENTE",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF64748B)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "#${state.registeredDossierNumber ?: "SOS-VZLA-ACTIVO"}",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = Color(0xFF10B981)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("Expediente SOS", state.registeredDossierNumber)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, "Expediente copiado", Toast.LENGTH_SHORT).show()
                        onActivationSuccess()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Icon(imageVector = Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Copiar e Ir al Panel", fontWeight = FontWeight.Bold)
                }
            }
        )
    }

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
                        Icon(imageVector = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Censo de Damnificados SOS",
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
            // AVISO SUPERIOR
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFFE11D48).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "🆘", fontSize = 22.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Todos los campos con (*) son requeridos para procesar el expediente y canalizar los recursos.",
                        color = Color(0xFFE2E8F0),
                        fontSize = 12.sp,
                        lineHeight = 16.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // ── SECCIÓN 1: DATOS PERSONALES ──────────────────────────────────
            SectionTitle("1. DATOS DEL TITULAR")

            OutlinedTextField(
                value = state.fullName,
                onValueChange = { viewModel.onEvent(VictimRegistrationEvent.FullNameChanged(it)) },
                label = { Text("Nombre Completo *") },
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = state.idDocument,
                    onValueChange = { viewModel.onEvent(VictimRegistrationEvent.IdDocumentChanged(it)) },
                    label = { Text("Cédula (V-/E-) *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(10.dp))
                OutlinedTextField(
                    value = state.birthdate,
                    onValueChange = { viewModel.onEvent(VictimRegistrationEvent.BirthdateChanged(it)) },
                    label = { Text("F. Nac. (DD/MM/AAAA) *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.email,
                onValueChange = { viewModel.onEvent(VictimRegistrationEvent.EmailChanged(it)) },
                label = { Text("Correo Electrónico *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.phone,
                onValueChange = { viewModel.onEvent(VictimRegistrationEvent.PhoneChanged(it)) },
                label = { Text("Teléfono de Contacto (+58) *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(20.dp))

            // ── SECCIÓN 2: UBICACIÓN DE LA EMERGENCIA ─────────────────────────
            SectionTitle("2. UBICACIÓN DE LA EMERGENCIA")

            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = state.state,
                    onValueChange = { viewModel.onEvent(VictimRegistrationEvent.StateChanged(it)) },
                    label = { Text("Estado *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(10.dp))
                OutlinedTextField(
                    value = state.municipality,
                    onValueChange = { viewModel.onEvent(VictimRegistrationEvent.MunicipalityChanged(it)) },
                    label = { Text("Municipio *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.sector,
                onValueChange = { viewModel.onEvent(VictimRegistrationEvent.SectorChanged(it)) },
                label = { Text("Sector / Parroquia *") },
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.address,
                onValueChange = { viewModel.onEvent(VictimRegistrationEvent.AddressChanged(it)) },
                label = { Text("Dirección Exacta o Punto de Referencia *") },
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(20.dp))

            // ── SECCIÓN 3: EVALUACIÓN DE AFECTACIÓN Y DEPENDIENTES ────────────
            SectionTitle("3. EVALUACIÓN DE DAÑOS Y PERSONAS A CARGO")

            ExposedDropdownMenuBox(
                expanded = affectationExpanded,
                onExpandedChange = { affectationExpanded = it },
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = state.affectationLevel.displayName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Nivel de Afectación *") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = affectationExpanded) },
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = affectationExpanded,
                    onDismissRequest = { affectationExpanded = false },
                    modifier = Modifier.background(Color(0xFF1E293B))
                ) {
                    AffectationLevel.values().forEach { level ->
                        DropdownMenuItem(
                            text = { Text(level.displayName, color = Color.White, fontSize = 13.sp) },
                            onClick = {
                                viewModel.onEvent(VictimRegistrationEvent.AffectationLevelChanged(level))
                                affectationExpanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // DEPENDIENTES COUNTERS
            CounterRow("Menores de edad (0-17 años)", state.minorsCount) {
                viewModel.onEvent(VictimRegistrationEvent.MinorsCountChanged(it))
            }
            Spacer(modifier = Modifier.height(8.dp))
            CounterRow("Adultos mayores (60+ años)", state.elderlyCount) {
                viewModel.onEvent(VictimRegistrationEvent.ElderlyCountChanged(it))
            }
            Spacer(modifier = Modifier.height(8.dp))
            CounterRow("Personas con discapacidad", state.disabledCount) {
                viewModel.onEvent(VictimRegistrationEvent.DisabledCountChanged(it))
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ── SECCIÓN 4: DESCRIPCIÓN Y EVIDENCIAS ───────────────────────────
            SectionTitle("4. DESCRIPCIÓN DE DAÑOS Y EVIDENCIAS")

            OutlinedTextField(
                value = state.description,
                onValueChange = { viewModel.onEvent(VictimRegistrationEvent.DescriptionChanged(it)) },
                label = { Text("Detalle de la situación o necesidades urgentes *") },
                minLines = 3,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.googlePhotosUrl,
                onValueChange = { viewModel.onEvent(VictimRegistrationEvent.GooglePhotosUrlChanged(it)) },
                label = { Text("Enlace de Fotos / Evidencias (Google Photos, Drive, etc.)") },
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ── SECCIÓN 5: CHECKBOXES LEGALES ────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.onEvent(VictimRegistrationEvent.DataConsentChanged(!state.dataConsent)) },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = state.dataConsent,
                    onCheckedChange = { viewModel.onEvent(VictimRegistrationEvent.DataConsentChanged(it)) },
                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFF38BDF8))
                )
                Text(
                    text = "Autorizo el tratamiento de datos personales para canalizar la ayuda humanitaria.",
                    color = Color(0xFFCBD5E1),
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.onEvent(VictimRegistrationEvent.SwornDeclarationChanged(!state.swornDeclaration)) },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = state.swornDeclaration,
                    onCheckedChange = { viewModel.onEvent(VictimRegistrationEvent.SwornDeclarationChanged(it)) },
                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFF38BDF8))
                )
                Text(
                    text = "Certifico bajo fe de juramento la veracidad de los datos suministrados.",
                    color = Color(0xFFCBD5E1),
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }

            state.errorMessage?.let { err ->
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "⚠️ $err",
                    color = Color(0xFFEF4444),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ── BOTÓN DE ENVÍO ───────────────────────────────────────────────
            Button(
                onClick = { viewModel.onEvent(VictimRegistrationEvent.SubmitRegistration) },
                enabled = !state.isSubmitting && state.isFormComplete,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFE11D48),
                    disabledContainerColor = Color(0xFFE11D48).copy(alpha = 0.4f)
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                if (state.isSubmitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                } else {
                    Text(
                        text = "Registrar Emergencia Humanitaria 🚨",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(30.dp))
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        text = title,
        fontSize = 12.sp,
        fontWeight = FontWeight.Black,
        color = Color(0xFF38BDF8),
        letterSpacing = 0.5.sp,
        modifier = Modifier.padding(bottom = 8.dp)
    )
}

@Composable
private fun CounterRow(label: String, count: Int, onCountChanged: (Int) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF1E293B))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, color = Color(0xFFE2E8F0), fontSize = 13.sp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { onCountChanged(count - 1) },
                enabled = count > 0,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(imageVector = Icons.Default.Remove, contentDescription = "Menos", tint = Color.White)
            }
            Text(
                text = "$count",
                color = Color(0xFF38BDF8),
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                modifier = Modifier.padding(horizontal = 8.dp)
            )
            IconButton(
                onClick = { onCountChanged(count + 1) },
                modifier = Modifier.size(32.dp)
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = "Más", tint = Color.White)
            }
        }
    }
}

@Composable
fun getDarkTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    focusedBorderColor = Color(0xFF38BDF8),
    unfocusedBorderColor = Color(0xFF334155),
    focusedLabelColor = Color(0xFF38BDF8),
    unfocusedLabelColor = Color(0xFF94A3B8),
    cursorColor = Color(0xFF38BDF8)
)
