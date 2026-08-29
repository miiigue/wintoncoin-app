// ============================================================================
// WintonCoin Android — CauseDetailScreen
// ============================================================================
// [PRESENTATION / SCREEN] Pantalla de detalle de causa, muro de donantes y donación.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.detail

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.DonationRecord
import com.wintoncoin.app.domain.model.DonationStatus
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonOrange
import com.wintoncoin.app.presentation.theme.WintonPurple
import com.wintoncoin.app.presentation.theme.WintonRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CauseDetailScreen(
    viewModel: CauseDetailViewModel,
    causeId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToCreatorProfile: (String) -> Unit = {},
    onNavigateToBoosterProfile: () -> Unit = {}
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(causeId) {
        viewModel.onEvent(CauseDetailEvent.Load(causeId))
    }

    LaunchedEffect(state.feedbackMessage) {
        state.feedbackMessage?.let { feedback ->
            snackbarHostState.showSnackbar(feedback)
            viewModel.onEvent(CauseDetailEvent.DismissFeedback)
        }
    }

    if (state.errorMessage != null) {
        WintonAlertDialog(
            title = "Aviso de Winton Solidario",
            message = state.errorMessage ?: "Ha ocurrido un error inesperado.",
            onDismiss = { viewModel.onEvent(CauseDetailEvent.DismissError) }
        )
    }

    if (state.showDonationConfirmDialog) {
        val amount = state.donationAmountText.toDoubleOrNull() ?: 0.0
        WintonAlertDialog(
            title = "Confirmar Donación Solidaria",
            message = "¿Estás seguro de que deseas donar ${String.format(java.util.Locale.US, "%.4f", amount)} BLUE IOU a esta causa? Los tokens serán transferidos para la iniciativa humanitaria.",
            confirmButtonText = "Donar Ahora ❤️",
            onConfirm = { viewModel.onEvent(CauseDetailEvent.ExecuteDonation) },
            onDismiss = { viewModel.onEvent(CauseDetailEvent.DismissDonationConfirmDialog) }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Causa Solidaria",
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
                actions = {
                    IconButton(
                        onClick = { viewModel.onEvent(CauseDetailEvent.Refresh) },
                        enabled = !state.isLoading
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Actualizar",
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
        if (state.isLoading && state.cause == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = WintonRed)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Cargando detalles de la causa...",
                        color = Color(0xFF94A3B8),
                        fontSize = 14.sp
                    )
                }
            }
        } else {
            val cause = state.cause
            if (cause != null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 16.dp)
                ) {
                    // Header Banner con Icono / Ilustración y Badge DEMO MODE
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(
                                Brush.verticalGradient(
                                    listOf(
                                        Color(0xFF1E293B),
                                        Color(0xFF0F172A)
                                    )
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.radialGradient(
                                            listOf(
                                                Color(0xFFFB7185),
                                                WintonRed
                                            )
                                        )
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(44.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = cause.foundationName ?: "WintonCoin Solidario",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Badge DEMO MODE
                        Surface(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(12.dp),
                            shape = RoundedCornerShape(6.dp),
                            color = WintonPurple
                        ) {
                            Text(
                                text = "DEMO MODE",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Título de la Causa
                    Text(
                        text = cause.title,
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 26.sp
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Fila Creador y Fecha
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = Color(0xFF38BDF8),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Creador: ",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                        Text(
                            text = "@${cause.creatorUsername ?: "Solidario"}",
                            color = Color(0xFF38BDF8),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable {
                                cause.creatorUsername?.let { onNavigateToCreatorProfile(it) }
                            }
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "📅 ${cause.formattedCreatedAt}",
                            color = Color(0xFF64748B),
                            fontSize = 11.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Caja de Historia
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                        border = BorderStroke(1.dp, Color(0xFF334155))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Historia de la Causa",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = cause.story,
                                color = Color(0xFFCBD5E1),
                                fontSize = 13.5.sp,
                                lineHeight = 20.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Tarjeta de Progreso de Recaudación
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                        border = BorderStroke(1.dp, WintonGreen.copy(alpha = 0.4f))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "Progreso de Recaudación",
                                        color = Color.White,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${String.format(java.util.Locale.US, "%.2f", cause.totalEffectiveRaised)} / ${String.format(java.util.Locale.US, "%.2f", cause.goalAmount)} BLUE IOU",
                                        color = WintonGreen,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                                Text(
                                    text = cause.percentageString,
                                    color = Color.White,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            LinearProgressIndicator(
                                progress = { cause.progressPercentage },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(10.dp)
                                    .clip(RoundedCornerShape(5.dp)),
                                color = WintonGreen,
                                trackColor = Color(0xFF0F172A)
                            )

                            if (cause.amountOnHold > 0.0) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "ℹ️ Incluye ${String.format(java.util.Locale.US, "%.2f", cause.amountOnHold)} BLUE IOU en custodia preventiva (verificación KYC pendiente).",
                                    color = Color(0xFFFBBF24),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Caja de Donación (Si la causa está aprobada)
                    if (cause.status == CauseStatus.APPROVED && !cause.isCompleted) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                            border = BorderStroke(1.dp, WintonRed.copy(alpha = 0.5f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Realizar Donación en BLUE IOU",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "NO TIENES QUE DONAR DINERO REAL, SOLO TOKENS BLUE IOU ACUMULADOS",
                                    color = Color(0xFFFB7185),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )

                                Spacer(modifier = Modifier.height(12.dp))

                                // Saldo Disponible Clickable
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { onNavigateToBoosterProfile() }
                                        .background(Color(0xFF0F172A), RoundedCornerShape(8.dp))
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.AccountBalanceWallet,
                                            contentDescription = null,
                                            tint = WintonGreen,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "Tu disponible para donar:",
                                            color = Color(0xFF94A3B8),
                                            fontSize = 12.sp
                                        )
                                    }
                                    Text(
                                        text = "${String.format(java.util.Locale.US, "%.4f", state.userAvailableBalance)} BLUE ↗",
                                        color = WintonGreen,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                OutlinedTextField(
                                    value = state.donationAmountText,
                                    onValueChange = { viewModel.onEvent(CauseDetailEvent.DonationAmountChanged(it)) },
                                    placeholder = { Text("Monto a donar (Ej: 100)", color = Color(0xFF64748B), fontSize = 13.sp) },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = WintonRed,
                                        unfocusedBorderColor = Color(0xFF334155),
                                        focusedContainerColor = Color(0xFF0F172A),
                                        unfocusedContainerColor = Color(0xFF0F172A),
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White
                                    )
                                )

                                Spacer(modifier = Modifier.height(10.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = state.acceptedTerms,
                                        onCheckedChange = { viewModel.onEvent(CauseDetailEvent.AcceptedTermsChanged(it)) },
                                        colors = CheckboxDefaults.colors(
                                            checkedColor = WintonRed,
                                            uncheckedColor = Color(0xFF64748B),
                                            checkmarkColor = Color.White
                                        )
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Acepto los términos y condiciones de la campaña solidaria.",
                                        color = Color(0xFFCBD5E1),
                                        fontSize = 11.5.sp
                                    )
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                Button(
                                    onClick = { viewModel.onEvent(CauseDetailEvent.OpenDonationConfirmDialog) },
                                    enabled = !state.isDonating && state.acceptedTerms,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(48.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = WintonRed,
                                        disabledContainerColor = Color(0xFF334155)
                                    )
                                ) {
                                    if (state.isDonating) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(18.dp),
                                            color = Color.White,
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Procesando...", color = Color.White, fontWeight = FontWeight.Bold)
                                    } else {
                                        Text(
                                            text = "Donar BLUE IOU ❤️",
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        )
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))
                    }

                    // Pestañas Muro de Donaciones y Novedades
                    TabRow(
                        selectedTabIndex = state.selectedTab.ordinal,
                        containerColor = Color(0xFF0F172A),
                        contentColor = Color.White,
                        indicator = { tabPositions ->
                            TabRowDefaults.SecondaryIndicator(
                                modifier = Modifier.tabIndicatorOffset(tabPositions[state.selectedTab.ordinal]),
                                color = WintonRed,
                                height = 3.dp
                            )
                        }
                    ) {
                        Tab(
                            selected = state.selectedTab == CauseDetailTab.DONATIONS,
                            onClick = { viewModel.onEvent(CauseDetailEvent.SelectTab(CauseDetailTab.DONATIONS)) },
                            text = {
                                Text(
                                    text = "Muro de Donantes (${state.donationsSummary?.donationsCount ?: 0})",
                                    fontWeight = if (state.selectedTab == CauseDetailTab.DONATIONS) FontWeight.Bold else FontWeight.Normal,
                                    color = if (state.selectedTab == CauseDetailTab.DONATIONS) WintonRed else Color(0xFF94A3B8)
                                )
                            }
                        )
                        Tab(
                            selected = state.selectedTab == CauseDetailTab.UPDATES,
                            onClick = { viewModel.onEvent(CauseDetailEvent.SelectTab(CauseDetailTab.UPDATES)) },
                            text = {
                                Text(
                                    text = "Novedades (${state.updates.size})",
                                    fontWeight = if (state.selectedTab == CauseDetailTab.UPDATES) FontWeight.Bold else FontWeight.Normal,
                                    color = if (state.selectedTab == CauseDetailTab.UPDATES) WintonRed else Color(0xFF94A3B8)
                                )
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    if (state.selectedTab == CauseDetailTab.DONATIONS) {
                        val donations = state.donationsSummary?.allDonations ?: emptyList()
                        if (donations.isEmpty()) {
                            Text(
                                text = "Aún no se han registrado donaciones en esta causa. ¡Sé el primero!",
                                color = Color(0xFF94A3B8),
                                fontSize = 13.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 20.dp)
                            )
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                donations.forEach { donation ->
                                    DonationRowItem(donation)
                                }
                            }
                        }
                    } else {
                        if (state.updates.isEmpty()) {
                            Text(
                                text = "Aún no hay actualizaciones publicadas para esta causa.",
                                color = Color(0xFF94A3B8),
                                fontSize = 13.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 20.dp)
                            )
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                state.updates.forEach { update ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                                        border = BorderStroke(1.dp, Color(0xFF334155))
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp)) {
                                            Text(
                                                text = update.title,
                                                color = Color.White,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = update.text,
                                                color = Color(0xFFCBD5E1),
                                                fontSize = 12.5.sp,
                                                lineHeight = 17.sp
                                            )
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text(
                                                text = update.formattedDate,
                                                color = Color(0xFF64748B),
                                                fontSize = 10.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(40.dp))
                }
            }
        }
    }
}

@Composable
private fun DonationRowItem(donation: DonationRecord) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        border = BorderStroke(1.dp, Color(0xFF334155))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(WintonRed.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "❤️", fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "@${donation.donorUsername}",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = Color(0xFFFB7185).copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = "DONADO",
                                color = Color(0xFFFB7185),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Text(
                        text = donation.formattedCreatedAt,
                        color = Color(0xFF64748B),
                        fontSize = 10.sp
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${String.format(java.util.Locale.US, "%.4f", donation.amount)} BLUE",
                    color = WintonGreen,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = if (donation.status == DonationStatus.RELEASED) "Liberado" else "En espera",
                    color = if (donation.status == DonationStatus.RELEASED) WintonGreen else WintonOrange,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}
