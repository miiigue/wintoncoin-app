// ============================================================================
// WintonCoin Android — VolunteerRegistrationScreen
// ============================================================================
// [PRESENTATION LAYER / JETPACK COMPOSE] Formulario de registro de voluntario SOS.
// ============================================================================

package com.wintoncoin.app.presentation.sos.volunteer

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.VolunteerActivism
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.wintoncoin.app.domain.model.VolunteerAvailability
import com.wintoncoin.app.domain.model.VolunteerModality
import com.wintoncoin.app.domain.model.VolunteerSpecialty
import com.wintoncoin.app.presentation.sos.victim.getDarkTextFieldColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VolunteerRegistrationScreen(
    onNavigateBack: () -> Unit,
    onActivationSuccess: () -> Unit,
    viewModel: VolunteerRegistrationViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    var specialtyExpanded by remember { mutableStateOf(false) }
    var availabilityExpanded by remember { mutableStateOf(false) }
    var modalityExpanded by remember { mutableStateOf(false) }

    // ── DIÁLOGO MODAL OTP ───────────────────────────────────────────────────
    if (state.showOtpDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.onEvent(VolunteerRegistrationEvent.DismissOtpDialog) },
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
                        text = "Activa tu Expediente Voluntario",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Hemos enviado un código de 6 dígitos a ${state.email}. Ingresa el código y define tu contraseña para activar tu credencial:",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    OutlinedTextField(
                        value = state.otpCode,
                        onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.OtpCodeChanged(it)) },
                        label = { Text("Código de 6 dígitos") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = getDarkTextFieldColors(),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = state.password,
                        onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.PasswordChanged(it)) },
                        label = { Text("Nueva Contraseña (mín 8 car.)") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        colors = getDarkTextFieldColors(),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = state.confirmPassword,
                        onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.ConfirmPasswordChanged(it)) },
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
                            onClick = { viewModel.onEvent(VolunteerRegistrationEvent.ResendOtp) },
                            enabled = !state.isResendingOtp
                        ) {
                            Text("Reenviar código OTP", color = Color(0xFF38BDF8), fontSize = 12.sp)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.onEvent(VolunteerRegistrationEvent.VerifyOtp) },
                    enabled = !state.isVerifyingOtp && state.otpCode.length == 6 && state.password.length >= 8,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    if (state.isVerifyingOtp) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                    } else {
                        Text("Activar Credencial", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.onEvent(VolunteerRegistrationEvent.DismissOtpDialog) }) {
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
                        text = "¡Voluntario Registrado!",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Tu postulación a las Brigadas de Auxilio SOS ha sido registrada. Nuestro equipo de coordinación te contactará según las necesidades de despliegue.",
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
                            .border(1.dp, Color(0xFF38BDF8), RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "NÚMERO DE EXPEDIENTE VOLUNTARIO",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF64748B)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "#${state.registeredDossierNumber ?: "VOL-VZLA-ACTIVO"}",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = Color(0xFF38BDF8)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("Expediente Voluntario", state.registeredDossierNumber)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, "Expediente copiado", Toast.LENGTH_SHORT).show()
                        onActivationSuccess()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
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
                        text = "Registro de Voluntarios SOS",
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
                    .border(1.dp, Color(0xFF2563EB).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "🤝", fontSize = 22.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Únete a la red de respuesta rápida humanitaria. Tu expediente será priorizado por especialidad.",
                        color = Color(0xFFE2E8F0),
                        fontSize = 12.sp,
                        lineHeight = 16.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // ── SECCIÓN 1: DATOS PERSONALES ──────────────────────────────────
            SectionTitle("1. DATOS DEL VOLUNTARIO")

            OutlinedTextField(
                value = state.fullName,
                onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.FullNameChanged(it)) },
                label = { Text("Nombre Completo *") },
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = state.idDocument,
                    onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.IdDocumentChanged(it)) },
                    label = { Text("Cédula (V-/E-) *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(10.dp))
                OutlinedTextField(
                    value = state.birthdate,
                    onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.BirthdateChanged(it)) },
                    label = { Text("F. Nac. (DD/MM/AAAA) *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.email,
                onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.EmailChanged(it)) },
                label = { Text("Correo Electrónico *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.phone,
                onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.PhoneChanged(it)) },
                label = { Text("Teléfono (+58) *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(20.dp))

            // ── SECCIÓN 2: UBICACIÓN ─────────────────────────────────────────
            SectionTitle("2. UBICACIÓN / RESIDENCIA")

            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = state.state,
                    onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.StateChanged(it)) },
                    label = { Text("Estado *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(10.dp))
                OutlinedTextField(
                    value = state.municipality,
                    onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.MunicipalityChanged(it)) },
                    label = { Text("Municipio *") },
                    singleLine = true,
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = state.sector,
                onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.SectorChanged(it)) },
                label = { Text("Sector / Parroquia *") },
                singleLine = true,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(20.dp))

            // ── SECCIÓN 3: ROL OPERATIVO Y DISPONIBILIDAD ────────────────────
            SectionTitle("3. ESPECIALIDAD Y DISPONIBILIDAD")

            // DROPDOWN ESPECIALIDAD
            ExposedDropdownMenuBox(
                expanded = specialtyExpanded,
                onExpandedChange = { specialtyExpanded = it },
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = state.specialty.displayName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Especialidad / Rol *") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = specialtyExpanded) },
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.fillMaxWidth().menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = specialtyExpanded,
                    onDismissRequest = { specialtyExpanded = false },
                    modifier = Modifier.background(Color(0xFF1E293B))
                ) {
                    VolunteerSpecialty.values().forEach { spec ->
                        DropdownMenuItem(
                            text = { Text(spec.displayName, color = Color.White, fontSize = 13.sp) },
                            onClick = {
                                viewModel.onEvent(VolunteerRegistrationEvent.SpecialtyChanged(spec))
                                specialtyExpanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // DROPDOWN DISPONIBILIDAD
            ExposedDropdownMenuBox(
                expanded = availabilityExpanded,
                onExpandedChange = { availabilityExpanded = it },
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = state.availability.displayName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Disponibilidad de Tiempo *") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = availabilityExpanded) },
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.fillMaxWidth().menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = availabilityExpanded,
                    onDismissRequest = { availabilityExpanded = false },
                    modifier = Modifier.background(Color(0xFF1E293B))
                ) {
                    VolunteerAvailability.values().forEach { avail ->
                        DropdownMenuItem(
                            text = { Text(avail.displayName, color = Color.White, fontSize = 13.sp) },
                            onClick = {
                                viewModel.onEvent(VolunteerRegistrationEvent.AvailabilityChanged(avail))
                                availabilityExpanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // DROPDOWN MODALIDAD
            ExposedDropdownMenuBox(
                expanded = modalityExpanded,
                onExpandedChange = { modalityExpanded = it },
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = state.modality.displayName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Modalidad de Apoyo *") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = modalityExpanded) },
                    colors = getDarkTextFieldColors(),
                    modifier = Modifier.fillMaxWidth().menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = modalityExpanded,
                    onDismissRequest = { modalityExpanded = false },
                    modifier = Modifier.background(Color(0xFF1E293B))
                ) {
                    VolunteerModality.values().forEach { mod ->
                        DropdownMenuItem(
                            text = { Text(mod.displayName, color = Color.White, fontSize = 13.sp) },
                            onClick = {
                                viewModel.onEvent(VolunteerRegistrationEvent.ModalityChanged(mod))
                                modalityExpanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ── SECCIÓN 4: EXPERIENCIA ───────────────────────────────────────
            SectionTitle("4. EXPERIENCIA Y CERTIFICACIONES")

            OutlinedTextField(
                value = state.experienceDescription,
                onValueChange = { viewModel.onEvent(VolunteerRegistrationEvent.ExperienceDescriptionChanged(it)) },
                label = { Text("Describe brevemente tu experiencia previa o certificaciones") },
                minLines = 3,
                colors = getDarkTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ── SECCIÓN 5: CHECKBOXES LEGALES ────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.onEvent(VolunteerRegistrationEvent.DataConsentChanged(!state.dataConsent)) },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = state.dataConsent,
                    onCheckedChange = { viewModel.onEvent(VolunteerRegistrationEvent.DataConsentChanged(it)) },
                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFF38BDF8))
                )
                Text(
                    text = "Autorizo el tratamiento de mis datos para la coordinación de brigadas humanitarias.",
                    color = Color(0xFFCBD5E1),
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.onEvent(VolunteerRegistrationEvent.LegalDisclaimerChanged(!state.legalDisclaimer)) },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = state.legalDisclaimer,
                    onCheckedChange = { viewModel.onEvent(VolunteerRegistrationEvent.LegalDisclaimerChanged(it)) },
                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFF38BDF8))
                )
                Text(
                    text = "Acepto el código de conducta y descargo de responsabilidad del voluntariado SOS.",
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
                onClick = { viewModel.onEvent(VolunteerRegistrationEvent.SubmitRegistration) },
                enabled = !state.isSubmitting && state.isFormComplete,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF2563EB),
                    disabledContainerColor = Color(0xFF2563EB).copy(alpha = 0.4f)
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
                        text = "Postularme como Voluntario SOS 🤝",
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
