// ============================================================================
// WintonCoin Android — SubmitCauseScreen
// ============================================================================
// [PRESENTATION / SCREEN] Formulario de postulación de causa solidaria en Android.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.submit

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubmitCauseScreen(
    viewModel: SubmitCauseViewModel,
    currentUsername: String?,
    onNavigateBack: () -> Unit,
    onSubmitSuccess: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    if (state.errorMessage != null) {
        WintonAlertDialog(
            title = "Aviso de Postulación",
            message = state.errorMessage ?: "Ha ocurrido un error inesperado.",
            onDismiss = { viewModel.onEvent(SubmitCauseEvent.DismissError) }
        )
    }

    if (state.isSubmittedSuccess) {
        WintonAlertDialog(
            title = "¡Postulación Enviada con Éxito!",
            message = "Tu causa solidaria ha sido registrada y enviada al equipo de auditoría de WintonCoin. Recibirás una notificación cuando sea verificada y publicada.",
            confirmButtonText = "Aceptar",
            onDismiss = onSubmitSuccess
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Postular Causa Solidaria",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F172A)
                )
            )
        },
        containerColor = Color(0xFF0A0E1A)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 20.dp)
        ) {
            // Header con corazón y título
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(WintonRed.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Favorite,
                        contentDescription = null,
                        tint = WintonRed,
                        modifier = Modifier.size(34.dp)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "WintonCoin Solidario",
                    color = Color(0xFFFB7185),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Postula tu causa y recibe donaciones en BLUE IOU de tus referidos",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Tarjeta de Aviso Informativo
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                border = BorderStroke(1.dp, WintonBlue.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = Color(0xFF38BDF8),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Recuerda: Solo las personas que invites a través de tu enlace o código de referido podrán donarte sus BLUE IOU. Asegúrate de que tu historia sea honesta y digna de confianza. Cada caso es revisado manualmente por nuestro equipo de confianza.",
                        color = Color(0xFFCBD5E1),
                        fontSize = 12.sp,
                        lineHeight = 17.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Campo: Usuario Registrado
            Text(
                text = "Nombre de Usuario (Registrado)",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = currentUsername ?: "Usuario",
                onValueChange = {},
                readOnly = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF334155),
                    unfocusedBorderColor = Color(0xFF334155),
                    focusedContainerColor = Color(0xFF1E293B),
                    unfocusedContainerColor = Color(0xFF1E293B),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                )
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = WintonGreen,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Usuario verificado en la base de datos.",
                    color = WintonGreen,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Nombre de Fundación o Beneficiario
            FormTextField(
                label = "Nombre de la Fundación o Beneficiario (Opcional)",
                placeholder = "Ej: Fundación Ayuda Venezuela",
                caption = "El nombre oficial o público de la entidad que se beneficiará de las donaciones.",
                value = state.foundationName,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.FoundationNameChanged(it)) }
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Código de Referido del Beneficiario
            FormTextField(
                label = "Código de Referido del Beneficiario (Organización)",
                placeholder = "Ej: ORG123",
                caption = "El código de referido de la cuenta registrada que recibirá los fondos de WintonCoin Solidario.",
                value = state.beneficiaryReferralCode,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.BeneficiaryReferralCodeChanged(it)) }
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Enlaces a Redes Sociales del Beneficiario
            FormTextField(
                label = "Enlaces a Redes Sociales del Beneficiario (Si los hay)",
                placeholder = "Ej: https://instagram.com/fundacion",
                caption = "Si se incluyen, solo se permiten enlaces de redes sociales autorizadas: Instagram, Facebook, TikTok, Twitter o X.",
                value = state.beneficiarySocialUrls,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.BeneficiarySocialUrlsChanged(it)) }
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Título de la Causa
            FormTextField(
                label = "Título de la Causa *",
                placeholder = "Ej: Apoyo para tratamiento médico y medicinas",
                caption = "Nombre claro y representativo de tu causa humanitaria.",
                value = state.title,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.TitleChanged(it)) }
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Tu Historia
            Text(
                text = "Tu Historia (Dignidad y Claridad) *",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = state.story,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.StoryChanged(it)) },
                placeholder = { Text("Cuéntanos tu situación y cómo te ayudará el sistema de WintonCoin...", color = Color(0xFF64748B), fontSize = 13.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(130.dp),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = WintonRed,
                    unfocusedBorderColor = Color(0xFF334155),
                    focusedContainerColor = Color(0xFF1E293B),
                    unfocusedContainerColor = Color(0xFF0F172A),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                )
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Meta Necesaria (BLUE IOU)
            FormTextField(
                label = "Meta Necesaria (BLUE IOU) *",
                placeholder = "Monto total que necesitas recaudar (Ej: 1000)",
                caption = "Cantidad total de tokens BLUE IOU requeridos para cumplir el objetivo.",
                value = state.goalAmountText,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.GoalAmountChanged(it)) },
                keyboardType = KeyboardType.Decimal
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Enlaces de Evidencias (Nubes Autorizadas)
            FormTextField(
                label = "Enlaces de Evidencias (Nubes Autorizadas)",
                placeholder = "Ej: https://drive.google.com/... o https://dropbox.com/...",
                caption = "Solo se permiten nubes oficiales de almacenamiento seguro: Google Drive, Google Photos, Dropbox, Samsung Cloud, OneDrive, iCloud, Box o Mega.",
                value = state.evidenceUrls,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.EvidenceUrlsChanged(it)) }
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Campo: Enlaces a tus Redes Sociales
            FormTextField(
                label = "Enlaces a tus Redes Sociales (Para Verificación)",
                placeholder = "Ej: https://instagram.com/usuario",
                caption = "Solo se permiten redes autorizadas: Instagram, Facebook, TikTok, Twitter o X.",
                value = state.userSocialUrls,
                onValueChange = { viewModel.onEvent(SubmitCauseEvent.UserSocialUrlsChanged(it)) }
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Box de Fotos de la Causa
            Text(
                text = "Imágenes de tu Causa (Opcional, máx. 3 fotos)",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                border = BorderStroke(1.dp, Color(0xFFFB7185).copy(alpha = 0.4f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.CameraAlt,
                        contentDescription = null,
                        tint = Color(0xFFFB7185),
                        modifier = Modifier.size(38.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Selecciona tus fotos de evidencia",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "JPG, PNG o WebP · Máximo 3 imágenes · 5 MB por archivo",
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "Las imágenes ayudarán al equipo de auditoría a verificar tu caso más rápido y darán más confianza a los donantes.",
                color = Color(0xFF94A3B8),
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Checkbox de Términos
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = state.acceptedTerms,
                    onCheckedChange = { viewModel.onEvent(SubmitCauseEvent.AcceptedTermsChanged(it)) },
                    colors = CheckboxDefaults.colors(
                        checkedColor = WintonRed,
                        uncheckedColor = Color(0xFF64748B),
                        checkmarkColor = Color.White
                    )
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Al enviar tu postulación, aceptas los Términos y Condiciones y la revisión de tus datos para verificar tu caso.",
                    color = Color(0xFFCBD5E1),
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Botón CTA Enviar para Auditoría
            Button(
                onClick = { viewModel.onEvent(SubmitCauseEvent.Submit) },
                enabled = !state.isLoading && state.acceptedTerms,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = WintonRed,
                    disabledContainerColor = Color(0xFF334155)
                )
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Enviando postulación...", color = Color.White, fontWeight = FontWeight.Bold)
                } else {
                    Text(
                        text = "Enviar para Auditoría",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(30.dp))
        }
    }
}

@Composable
private fun FormTextField(
    label: String,
    placeholder: String,
    caption: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            color = Color.White,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, color = Color(0xFF64748B), fontSize = 13.sp) },
            singleLine = keyboardType != KeyboardType.Text,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = WintonRed,
                unfocusedBorderColor = Color(0xFF334155),
                focusedContainerColor = Color(0xFF1E293B),
                unfocusedContainerColor = Color(0xFF0F172A),
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            )
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = caption,
            color = Color(0xFF64748B),
            fontSize = 11.sp,
            lineHeight = 15.sp
        )
    }
}
