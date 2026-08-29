// ============================================================================
// WintonCoin Android — CreatePublicationScreen (Pantalla de Creación)
// ============================================================================
// [PRESENTATION LAYER / COMPOSE] Interfaz reactiva para crear Tareas, Ventas P2P,
// Ventas Rápidas y Causas Solidarias, con selector fotográfico R2 y calculadora.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.create

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonBlueLighter
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen

private val DarkBackground = Color(0xFF0F172A)
private val DarkSurface = Color(0xFF1E293B)
private val DarkCard = Color(0xFF0B1120)
private val ElectricBlue = Color(0xFF38BDF8)
private val PrimaryBlue = WintonBlue
private val PrimaryBlueLight = WintonBlueLighter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreatePublicationScreen(
    onNavigateBack: () -> Unit,
    viewModel: CreatePublicationViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    // Selector fotográfico nativo (Android Photo Picker - API 33+ / Play Services)
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickMultipleVisualMedia(
            maxItems = (state.maxImagesAllowed - state.localImageUris.size).coerceAtLeast(2)
        )
    ) { uris ->
        if (uris.isNotEmpty()) {
            viewModel.onEvent(CreatePublicationEvent.ImagesSelected(uris, context))
        }
    }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onEvent(CreatePublicationEvent.DismissError)
        }
    }

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) {
            onNavigateBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Crear Publicación",
                        fontWeight = FontWeight.Bold,
                        color = Color.White
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = DarkBackground
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            // 1. Selector de Tipo de Publicación (Tabs)
            val tabs = listOf(
                "request" to "💼 Tarea",
                "sell" to "🛍️ Venta",
                "quick_sale" to "⚡ Rápida",
                "donation" to "❤️ Causa"
            )
            val selectedTabIndex = tabs.indexOfFirst { it.first == state.publicationType }.coerceAtLeast(0)

            TabRow(
                selectedTabIndex = selectedTabIndex,
                containerColor = DarkSurface,
                contentColor = ElectricBlue,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                        color = ElectricBlue
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
            ) {
                tabs.forEachIndexed { index, (key, label) ->
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { viewModel.onEvent(CreatePublicationEvent.TypeChanged(key)) },
                        text = {
                            Text(
                                text = label,
                                fontSize = 13.sp,
                                fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal,
                                color = if (selectedTabIndex == index) ElectricBlue else Color.Gray
                            )
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 2. Sección de Carga de Fotos (Cloudflare R2)
            Text(
                text = "Fotos / Multimedia (${state.uploadedImageUrls.size}/${state.maxImagesAllowed})",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.LightGray
            )
            Spacer(modifier = Modifier.height(8.dp))

            Surface(
                color = DarkSurface,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Column {
                    if (state.localImageUris.isNotEmpty()) {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            itemsIndexed(state.localImageUris) { index, uri ->
                                Box(
                                    modifier = Modifier
                                        .size(80.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(DarkCard)
                                ) {
                                    AsyncImage(
                                        model = uri,
                                        contentDescription = "Preview",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                    IconButton(
                                        onClick = { viewModel.onEvent(CreatePublicationEvent.RemoveImage(index)) },
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .size(24.dp)
                                            .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "Eliminar",
                                            tint = Color.White,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    if (state.isUploadingImages) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(vertical = 4.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = ElectricBlue
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Comprimiendo y subiendo a Cloudflare R2...",
                                fontSize = 12.sp,
                                color = ElectricBlue
                            )
                        }
                    } else if (state.localImageUris.size < state.maxImagesAllowed) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    photoPickerLauncher.launch(
                                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                    )
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AddPhotoAlternate,
                                contentDescription = "Subir foto",
                                tint = ElectricBlue,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Seleccionar de la galería",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = ElectricBlue
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 3. Título
            OutlinedTextField(
                value = state.title,
                onValueChange = { viewModel.onEvent(CreatePublicationEvent.TitleChanged(it)) },
                label = { Text(if (state.publicationType == "quick_sale") "Título (opcional)" else "Título de la publicación") },
                placeholder = { Text("Ej: Desarrollar landing page o Venta de laptop") },
                singleLine = true,
                colors = outlinedTextFieldColors(),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 4. Descripción
            if (state.publicationType != "quick_sale") {
                OutlinedTextField(
                    value = state.description,
                    onValueChange = { viewModel.onEvent(CreatePublicationEvent.DescriptionChanged(it)) },
                    label = { Text("Descripción detallada") },
                    placeholder = { Text("Explica detalladamente en qué consiste...") },
                    minLines = 3,
                    maxLines = 6,
                    colors = outlinedTextFieldColors(),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(12.dp))
            }

            // 5. Lista Dinámica de Pasos (Instrucciones para Tareas)
            if (state.publicationType == "request") {
                Text(
                    text = "Instrucciones Paso a Paso (Opcional)",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.LightGray
                )
                Spacer(modifier = Modifier.height(6.dp))

                state.steps.forEachIndexed { index, stepText ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Text(
                            text = "${index + 1}.",
                            fontWeight = FontWeight.Bold,
                            color = ElectricBlue,
                            modifier = Modifier.width(24.dp)
                        )
                        OutlinedTextField(
                            value = stepText,
                            onValueChange = { viewModel.onEvent(CreatePublicationEvent.UpdateStep(index, it)) },
                            placeholder = { Text("Instrucción del paso ${index + 1}") },
                            singleLine = true,
                            colors = outlinedTextFieldColors(),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = { viewModel.onEvent(CreatePublicationEvent.RemoveStep(index)) }) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Eliminar paso",
                                tint = Color(0xFFEF4444)
                            )
                        }
                    }
                }

                TextButton(
                    onClick = { viewModel.onEvent(CreatePublicationEvent.AddStep) },
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Agregar",
                        tint = ElectricBlue,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Agregar paso", color = ElectricBlue, fontSize = 13.sp)
                }

                Spacer(modifier = Modifier.height(12.dp))
            }

            // 6. Monto / Recompensa en BLUE
            val amountLabel = when (state.publicationType) {
                "request" -> "Recompensa al trabajador (BLUE)"
                "sell" -> "Precio de venta (BLUE)"
                "donation" -> "Meta de recaudación (BLUE)"
                else -> "Monto de la Venta Rápida (BLUE)"
            }

            OutlinedTextField(
                value = state.amountInput,
                onValueChange = { viewModel.onEvent(CreatePublicationEvent.AmountChanged(it)) },
                label = { Text(amountLabel) },
                placeholder = { Text("0.0000") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                colors = outlinedTextFieldColors(),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            // 7. Calculador Dinámico Truth-in-Pricing (SOC 2)
            if (state.costPreviewText.isNotBlank()) {
                Surface(
                    color = Color(0xFF0F172A),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, ElectricBlue.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                        .padding(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = "Información económica",
                            tint = ElectricBlue,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = state.costPreviewText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFFE2E8F0)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 8. Campos específicos por tipo
            if (state.publicationType == "quick_sale") {
                OutlinedTextField(
                    value = state.targetUsername,
                    onValueChange = { viewModel.onEvent(CreatePublicationEvent.TargetUsernameChanged(it)) },
                    label = { Text("Comprador específico (@usuario - opcional)") },
                    placeholder = { Text("Dejar en blanco para venta abierta") },
                    singleLine = true,
                    colors = outlinedTextFieldColors(),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
            } else if (state.publicationType == "donation") {
                OutlinedTextField(
                    value = state.beneficiaryReferralCode,
                    onValueChange = { viewModel.onEvent(CreatePublicationEvent.BeneficiaryCodeChanged(it)) },
                    label = { Text("Código de referido del beneficiario *") },
                    placeholder = { Text("Ej: MIGUEL123") },
                    singleLine = true,
                    colors = outlinedTextFieldColors(),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
            } else {
                OutlinedTextField(
                    value = state.availableSlots,
                    onValueChange = { viewModel.onEvent(CreatePublicationEvent.AvailableSlotsChanged(it)) },
                    label = { Text("Cupos de participantes") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    colors = outlinedTextFieldColors(),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            // 9. Switches de Configuración Avanzada (Evidencia, Aprobación, Expiración)
            if (state.publicationType == "request" || state.publicationType == "sell") {
                HorizontalDivider(color = Color(0xFF334155), thickness = 1.dp)
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Exigir evidencias fotográficas", fontSize = 14.sp, color = Color.White)
                        Text(text = "El postulante debe subir fotos para culminar", fontSize = 12.sp, color = Color.Gray)
                    }
                    Switch(
                        checked = state.requiresEvidence,
                        onCheckedChange = { viewModel.onEvent(CreatePublicationEvent.ToggleRequiresEvidence(it)) },
                        colors = switchColors()
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Aprobación automática", fontSize = 14.sp, color = Color.White)
                        Text(text = "Aceptar postulaciones sin revisión previa", fontSize = 12.sp, color = Color.Gray)
                    }
                    Switch(
                        checked = state.autoApprove,
                        onCheckedChange = { viewModel.onEvent(CreatePublicationEvent.ToggleAutoApprove(it)) },
                        colors = switchColors()
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Límite de tiempo / Expiración", fontSize = 14.sp, color = Color.White)
                        Text(text = "La publicación se cerrará automáticamente", fontSize = 12.sp, color = Color.Gray)
                    }
                    Switch(
                        checked = state.setExpiration,
                        onCheckedChange = { viewModel.onEvent(CreatePublicationEvent.ToggleSetExpiration(it)) },
                        colors = switchColors()
                    )
                }

                if (state.setExpiration) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = state.durationDays,
                            onValueChange = { viewModel.onEvent(CreatePublicationEvent.DurationDaysChanged(it)) },
                            label = { Text("Días") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = outlinedTextFieldColors(),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = state.durationHours,
                            onValueChange = { viewModel.onEvent(CreatePublicationEvent.DurationHoursChanged(it)) },
                            label = { Text("Horas") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = outlinedTextFieldColors(),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = state.durationMinutes,
                            onValueChange = { viewModel.onEvent(CreatePublicationEvent.DurationMinutesChanged(it)) },
                            label = { Text("Minutos") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = outlinedTextFieldColors(),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // 10. Botón de Publicación
            Button(
                onClick = { viewModel.onEvent(CreatePublicationEvent.Submit) },
                enabled = !state.isLoading && !state.isUploadingImages,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = if (state.publicationType == "donation") "Publicar Causa Solidaria" else "Publicar en Marketplace",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // Modal de Advertencia y Confirmación para Causas Solidarias
    if (state.showDonationConfirmDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.onEvent(CreatePublicationEvent.DismissDonationDialog) },
            title = {
                Text(
                    text = "Aviso de Causa Solidaria",
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            },
            text = {
                Text(
                    text = "Las recaudaciones solidarias se transfieren directamente al usuario beneficiario indicado en el código de referido (${state.beneficiaryReferralCode}). Asegúrate de que los datos sean correctos.",
                    fontSize = 14.sp,
                    color = Color.LightGray
                )
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.onEvent(CreatePublicationEvent.ConfirmDonation) },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    Text("Confirmar y Publicar")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.onEvent(CreatePublicationEvent.DismissDonationDialog) }) {
                    Text("Cancelar", color = Color.Gray)
                }
            },
            containerColor = DarkSurface
        )
    }
}

@Composable
private fun outlinedTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = DarkSurface,
    unfocusedContainerColor = DarkSurface,
    focusedBorderColor = ElectricBlue,
    unfocusedBorderColor = Color(0xFF334155),
    focusedLabelColor = ElectricBlue,
    unfocusedLabelColor = Color.Gray,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ElectricBlue
)

@Composable
private fun switchColors() = SwitchDefaults.colors(
    checkedThumbColor = Color.White,
    checkedTrackColor = PrimaryBlue,
    uncheckedThumbColor = Color.Gray,
    uncheckedTrackColor = DarkSurface
)
