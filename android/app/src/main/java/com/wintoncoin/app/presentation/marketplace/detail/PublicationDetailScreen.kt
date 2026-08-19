// ============================================================================
// WintonCoin Android — PublicationDetailScreen (Detalle y Acciones de Tarea)
// ============================================================================
// [PRESENTATION LAYER] Pantalla completa para visualizar requisitos, postularse,
// enviar evidencias de trabajo o confirmar pagos a trabajadores.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.detail

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
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.ParticipantItem
import com.wintoncoin.app.domain.model.TaskAcceptanceStatus
import com.wintoncoin.app.presentation.components.WintonButton
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonPurple
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicationDetailScreen(
    viewModel: PublicationDetailViewModel,
    publicationId: String,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(publicationId) {
        viewModel.onEvent(PublicationDetailEvent.LoadDetails(publicationId))
    }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onEvent(PublicationDetailEvent.ClearMessages)
        }
    }

    LaunchedEffect(state.successMessage) {
        state.successMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onEvent(PublicationDetailEvent.ClearMessages)
        }
    }

    val numberFormat = DecimalFormat("#,##0.0000", DecimalFormatSymbols(Locale("es", "ES")))
    val standardFormat = DecimalFormat("#,##0.00", DecimalFormatSymbols(Locale("es", "ES")))
    val pub = state.publication
    val isAuthor = pub?.authorUsername == state.currentUsername

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (pub?.isHumanitarianCause == true) "Causa Solidaria" else "Detalle de Tarea",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0F172A))
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF0F172A),
                            Color(0xFF020617)
                        )
                    )
                )
        ) {
            if (state.isLoading && pub == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = WintonGold)
                }
            } else if (pub != null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    Spacer(modifier = Modifier.height(16.dp))

                    // Fotos / Evidencias si existen
                    if (pub.imageUrls.isNotEmpty()) {
                        AsyncImage(
                            model = pub.imageUrls.first(),
                            contentDescription = pub.title,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp)
                                .clip(RoundedCornerShape(16.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // Título
                    Text(
                        text = pub.title,
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Tarjeta de Recompensa / Presupuesto
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = if (pub.isHumanitarianCause || pub.goalAmount > 0) "Meta de Recaudación" else "Recompensa por Completar",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp
                                )
                                Text(
                                    text = if (pub.isHumanitarianCause || pub.goalAmount > 0) {
                                        "${standardFormat.format(pub.goalAmount)} BLUE"
                                    } else {
                                        "${numberFormat.format(pub.blueCost)} BLUE"
                                    },
                                    color = WintonGold,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold
                                )

                                if (pub.isBoosterTx) {
                                    Text(
                                        text = "Base: ${numberFormat.format(pub.baseBlueCost)} × ${pub.multiplier}x (${pub.stageName})",
                                        color = Color(0xFF60A5FA),
                                        fontSize = 11.sp
                                    )
                                }
                            }

                            if (pub.availableSlots > 0 && !pub.isHumanitarianCause) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = WintonBlue.copy(alpha = 0.2f)
                                ) {
                                    Text(
                                        text = "${pub.availableSlots} cupos",
                                        color = Color(0xFF60A5FA),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Información del Autor / Organización
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(WintonBlue, WintonPurple))),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = pub.authorUsername.take(1).uppercase(),
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column {
                            Text(
                                text = "Publicado por",
                                color = Color(0xFF94A3B8),
                                fontSize = 11.sp
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = pub.authorUsername,
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                if (pub.authorRatingsCount > 0) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = "Rating",
                                        tint = WintonGold,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(2.dp))
                                    Text(
                                        text = "${pub.authorRating} (${pub.authorRatingsCount})",
                                        color = WintonGold,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Descripción / Instrucciones
                    Text(
                        text = "Descripción e Instrucciones",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = pub.description,
                        color = Color(0xFFCBD5E1),
                        fontSize = 14.sp,
                        lineHeight = 22.sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // SECCIÓN DE ACCIONES SEGÚN EL ROL
                    if (isAuthor) {
                        // VISTA DEL AUTOR: Gestión de Participantes
                        Text(
                            text = "Participantes y Postulaciones (${pub.participants.size})",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        if (pub.participants.isEmpty()) {
                            Text(
                                text = "Aún no hay participantes en esta tarea.",
                                color = Color(0xFF94A3B8),
                                fontSize = 13.sp
                            )
                        } else {
                            pub.participants.forEach { participant ->
                                ParticipantManagementCard(
                                    participant = participant,
                                    isLoading = state.isActionLoading,
                                    onConfirmPayment = {
                                        viewModel.onEvent(PublicationDetailEvent.ConfirmPayment(participant.username))
                                    }
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                            }
                        }
                    } else {
                        // VISTA DEL USUARIO: Postularse o Completar Tarea
                        when (pub.userAcceptanceStatus) {
                            TaskAcceptanceStatus.NONE -> {
                                if (pub.isHumanitarianCause) {
                                    OutlinedTextField(
                                        value = state.donationAmountInput,
                                        onValueChange = { viewModel.onEvent(PublicationDetailEvent.UpdateDonationAmount(it)) },
                                        label = { Text("Monto a Donar (BLUE)") },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = WintonGreen,
                                            unfocusedBorderColor = Color(0xFF334155)
                                        )
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    WintonButton(
                                        text = "Donar a la Causa",
                                        onClick = { viewModel.onEvent(PublicationDetailEvent.Apply) },
                                        isLoading = state.isActionLoading,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                } else {
                                    WintonButton(
                                        text = if (pub.category == MarketplaceCategory.SELL) "Comprar Producto" else "Postularme a esta Tarea",
                                        onClick = { viewModel.onEvent(PublicationDetailEvent.Apply) },
                                        isLoading = state.isActionLoading,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }

                            TaskAcceptanceStatus.PENDING_APPROVAL -> {
                                ActionStatusCard(
                                    title = "Postulación Enviada",
                                    message = "Tu solicitud está en espera de aprobación por parte del autor.",
                                    color = Color(0xFFF59E0B)
                                )
                            }

                            TaskAcceptanceStatus.APPROVED -> {
                                Column {
                                    ActionStatusCard(
                                        title = "¡Postulación Aprobada!",
                                        message = "Realiza el trabajo solicitado y envía tus evidencias fotográficas o enlace para recibir tu pago.",
                                        color = Color(0xFF10B981)
                                    )

                                    Spacer(modifier = Modifier.height(14.dp))

                                    OutlinedTextField(
                                        value = state.evidenceInput,
                                        onValueChange = { viewModel.onEvent(PublicationDetailEvent.UpdateEvidenceInput(it)) },
                                        label = { Text("Enlace o URL de Evidencia (Imgur, Cloudflare, etc.)") },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = WintonBlue,
                                            unfocusedBorderColor = Color(0xFF334155)
                                        )
                                    )

                                    Spacer(modifier = Modifier.height(12.dp))

                                    WintonButton(
                                        text = "Enviar Evidencia y Culminar",
                                        onClick = { viewModel.onEvent(PublicationDetailEvent.CompleteTask) },
                                        isLoading = state.isActionLoading,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }

                            TaskAcceptanceStatus.COMPLETED -> {
                                ActionStatusCard(
                                    title = "Tarea Enviada con Éxito",
                                    message = "Has completado la tarea. El autor revisará tus evidencias y liberará el pago a tu billetera.",
                                    color = Color(0xFF3B82F6)
                                )
                            }

                            TaskAcceptanceStatus.CONFIRMED_PAID -> {
                                ActionStatusCard(
                                    title = "¡Pago Confirmado!",
                                    message = "Esta tarea ha sido finalizada y los BLUEs han sido transferidos a tu saldo disponible.",
                                    color = Color(0xFF10B981)
                                )
                            }

                            else -> Unit
                        }
                    }

                    Spacer(modifier = Modifier.height(40.dp))
                }
            }
        }
    }
}

@Composable
private fun ActionStatusCard(
    title: String,
    message: String,
    color: Color
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, color.copy(alpha = 0.5f), RoundedCornerShape(14.dp)),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.12f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                color = color,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = message,
                color = Color(0xFFCBD5E1),
                fontSize = 13.sp,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
private fun ParticipantManagementCard(
    participant: ParticipantItem,
    isLoading: Boolean,
    onConfirmPayment: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF334155)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = participant.username.take(1).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = participant.username,
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (participant.ratingsCount > 0) {
                            Text(
                                text = "⭐ ${participant.averageRating} (${participant.ratingsCount})",
                                color = WintonGold,
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = when (participant.status) {
                        TaskAcceptanceStatus.COMPLETED -> Color(0xFF3B82F6).copy(alpha = 0.2f)
                        TaskAcceptanceStatus.APPROVED -> Color(0xFF10B981).copy(alpha = 0.2f)
                        TaskAcceptanceStatus.CONFIRMED_PAID -> Color(0xFF10B981).copy(alpha = 0.2f)
                        else -> Color(0xFFF59E0B).copy(alpha = 0.2f)
                    }
                ) {
                    Text(
                        text = when (participant.status) {
                            TaskAcceptanceStatus.COMPLETED -> "Por Pagar"
                            TaskAcceptanceStatus.APPROVED -> "En Progreso"
                            TaskAcceptanceStatus.CONFIRMED_PAID -> "Pagado"
                            else -> "Pendiente"
                        },
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            if (participant.status == TaskAcceptanceStatus.COMPLETED) {
                Spacer(modifier = Modifier.height(12.dp))
                WintonButton(
                    text = "Confirmar Pago y Liberar BLUEs",
                    onClick = onConfirmPayment,
                    isLoading = isLoading,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
