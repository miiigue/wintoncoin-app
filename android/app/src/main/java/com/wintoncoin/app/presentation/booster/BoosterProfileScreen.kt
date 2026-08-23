// ============================================================================
// WintonCoin Android — BoosterProfileScreen (Pantalla de Perfil de Impulsor)
// ============================================================================
// [PRESENTATION / COMPOSE UI] Dashboard completo del Programa de Impulsores
// con 8 métricas FinTech, Escalera de Rangos (Staircase), Meta Nivel 3,
// Historial de Ledger y Diálogo de Requisitos Anti-Fraude.
// ============================================================================

package com.wintoncoin.app.presentation.booster

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.BoosterLedgerMovement
import com.wintoncoin.app.domain.model.BoosterLevelInfo
import com.wintoncoin.app.domain.model.BoosterProfile
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonBlueLighter
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen
import java.util.Locale

private val DarkBackground = Color(0xFF0F172A)
private val DarkSurface = Color(0xFF1E293B)
private val DarkCard = Color(0xFF0B1120)
private val ElectricBlue = Color(0xFF38BDF8)
private val AmberWarning = Color(0xFFF59E0B)
private val RoseDonation = Color(0xFFE83E8C)
private val PurpleBooster = Color(0xFF8B5CF6)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoosterProfileScreen(
    onNavigateBack: () -> Unit,
    onNavigateToReferrals: () -> Unit,
    onNavigateToMarketplace: () -> Unit,
    viewModel: BoosterProfileViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onEvent(BoosterProfileEvent.DismissError)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (state.isOwnProfile) "Mi Perfil de Impulsor" else "Perfil de Impulsor",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.onEvent(BoosterProfileEvent.OpenUnlockConditionsDialog) }) {
                        Icon(Icons.Default.Info, contentDescription = "Requisitos", tint = ElectricBlue)
                    }
                    IconButton(onClick = { viewModel.onEvent(BoosterProfileEvent.Refresh) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = DarkBackground
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                state.isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ElectricBlue)
                    }
                }
                state.profile == null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No se pudo cargar el perfil.", color = Color.White.copy(alpha = 0.7f))
                    }
                }
                !state.profile!!.isBooster -> {
                    NonBoosterStateView(
                        message = state.profile!!.message ?: "Aún no formas parte del programa de impulsores.",
                        onExploreTasks = onNavigateToMarketplace
                    )
                }
                else -> {
                    BoosterContent(
                        profile = state.profile!!,
                        onNavigateToReferrals = onNavigateToReferrals,
                        onOpenUnlockDialog = { viewModel.onEvent(BoosterProfileEvent.OpenUnlockConditionsDialog) }
                    )
                }
            }
        }
    }

    // Modal de Requisitos Anti-Fraude
    if (state.showUnlockConditionsDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.onEvent(BoosterProfileEvent.DismissUnlockConditionsDialog) },
            icon = {
                Icon(Icons.Default.Lock, contentDescription = null, tint = WintonGold, modifier = Modifier.size(32.dp))
            },
            title = {
                Text("Requisitos de Canje y Bonos", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Medidas de seguridad anti-fraude para el canje de recompensas y bonos en tokens BLUE:",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 14.sp
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("•", color = WintonGreen, fontWeight = FontWeight.Bold)
                        Text(
                            "Tu usuario debe estar Verificado (KYC), al igual que los referidos que hayan generado tus recompensas.",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 13.sp
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("•", color = WintonGreen, fontWeight = FontWeight.Bold)
                        Text(
                            "Debes haber realizado al menos una transacción en la plataforma en los últimos 30 días.",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 13.sp
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.onEvent(BoosterProfileEvent.DismissUnlockConditionsDialog) },
                    colors = ButtonDefaults.buttonColors(containerColor = WintonBlue)
                ) {
                    Text("Entendido", color = Color.White)
                }
            },
            containerColor = DarkSurface,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

@Composable
private fun NonBoosterStateView(
    message: String,
    onExploreTasks: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(PurpleBooster.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Star, contentDescription = null, tint = WintonGold, modifier = Modifier.size(44.dp))
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "Programa de Impulsores",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = "$message\n¡Completa tareas en el marketplace o invita a tus amigos para unirte y multiplicar tus recompensas!",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )
        Spacer(modifier = Modifier.height(28.dp))
        Button(
            onClick = onExploreTasks,
            colors = ButtonDefaults.buttonColors(containerColor = WintonBlue),
            shape = RoundedCornerShape(12.dp),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 14.dp)
        ) {
            Text("Explorar Tareas", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun BoosterContent(
    profile: BoosterProfile,
    onNavigateToReferrals: () -> Unit,
    onOpenUnlockDialog: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Cabecera Principal de Impulsor
        item {
            BoosterHeaderCard(profile = profile, onOpenUnlockDialog = onOpenUnlockDialog)
        }

        // 2. Acceso a Red de Referidos
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigateToReferrals() },
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, ElectricBlue.copy(alpha = 0.3f))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(ElectricBlue.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.People, contentDescription = null, tint = ElectricBlue)
                        }
                        Column {
                            Text("Mi Red de Referidos", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("Comparte tu código y gana comisiones", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                        }
                    }
                    Text("Ver Red →", color = ElectricBlue, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }

        // 3. Cuadrícula de 8 Métricas FinTech
        item {
            Text(
                text = "Métricas Financieras",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        item {
            BoosterMetricsGrid(profile = profile, onNavigateToReferrals = onNavigateToReferrals)
        }

        // 4. Escalera del Sistema de Rangos (Booster Ranking System)
        item {
            BoosterLadderSection(profile = profile)
        }

        // 5. Historial de Ganancias del Ledger
        item {
            Text(
                text = "Historial de Ganancias (Ledger)",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        if (profile.transactions.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "Aún no hay actividades registradas en tu ledger.",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp)
                    )
                }
            }
        } else {
            items(profile.transactions, key = { it.id }) { item ->
                BoosterLedgerRow(item = item)
            }
        }
    }
}

@Composable
private fun BoosterHeaderCard(
    profile: BoosterProfile,
    onOpenUnlockDialog: () -> Unit
) {
    val capitalizedUsername = if (profile.username.isNotBlank()) {
        profile.username.replaceFirstChar { it.uppercase() }
    } else {
        "Impulsor"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            Brush.horizontalGradient(listOf(WintonGold.copy(alpha = 0.6f), ElectricBlue.copy(alpha = 0.3f)))
        )
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "$capitalizedUsername, eres nivel ${profile.boosterLevel}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp
                )
                Icon(
                    Icons.Default.Info,
                    contentDescription = "Ver requisitos",
                    tint = WintonGold,
                    modifier = Modifier
                        .size(20.dp)
                        .clickable { onOpenUnlockDialog() }
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(WintonGold.copy(alpha = 0.15f))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "1 BLUE IOU = 1 BLUE = 1 USD",
                    color = WintonGold,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    letterSpacing = 0.5.sp
                )
            }

            profile.currentLevelInfo?.description?.let { desc ->
                if (desc.isNotBlank()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = desc,
                        color = Color.White.copy(alpha = 0.75f),
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun BoosterMetricsGrid(
    profile: BoosterProfile,
    onNavigateToReferrals: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Fila 1: Total y Habilitado KYC
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            MetricCard(
                title = "Total BLUE IOU",
                value = format4Decimals(profile.totalBoosterBlue),
                unit = "BLUE IOU",
                highlightColor = ElectricBlue,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Habilitado Canje (KYC)",
                value = format4Decimals(profile.eligibleBoosterBlue),
                unit = "BLUE IOU",
                highlightColor = WintonGreen,
                modifier = Modifier.weight(1f)
            )
        }

        // Fila 2: Retenido Referidos y Disponible Donaciones
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            MetricCard(
                title = "Retenido (Ref. sin KYC)",
                value = format4Decimals(profile.pendingBoosterBlue),
                unit = "BLUE IOU",
                highlightColor = AmberWarning,
                actionLabel = "Ver Referidos →",
                onActionClick = onNavigateToReferrals,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Disponible Donación",
                value = format4Decimals(profile.baseEligibleBoosterBlue),
                unit = "BLUE IOU",
                highlightColor = RoseDonation,
                modifier = Modifier.weight(1f)
            )
        }

        // Fila 3: Meta Diaria (Full Width)
        DailyGoalCard(
            today = profile.dailyToday,
            yesterday = profile.dailyYesterday,
            improved = profile.dailyImproved
        )

        // Fila 4: Rankings
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            val worldRank = if (profile.rankPosition != null && profile.rankTotal != null) {
                "#${profile.rankPosition} de ${profile.rankTotal}"
            } else {
                "Sin clasificar"
            }
            MetricCard(
                title = "Ranking Mundial",
                value = worldRank,
                subtitle = profile.rankPercentile?.let { "Top $it%" },
                highlightColor = WintonGold,
                modifier = Modifier.weight(1f)
            )

            val friendsRank = if (profile.friendsRankPosition != null && profile.friendsRankTotal != null) {
                "#${profile.friendsRankPosition} de ${profile.friendsRankTotal}"
            } else {
                "Sin amigos"
            }
            MetricCard(
                title = "Ranking entre Amigos",
                value = friendsRank,
                subtitle = profile.friendsRankPercentile?.let { "Top $it%" },
                highlightColor = PurpleBooster,
                modifier = Modifier.weight(1f)
            )
        }

        // Fila 5: Tareas completadas
        MetricCard(
            title = "Tareas de Impulsor Completadas",
            value = "${profile.boosterTasksCompletedCount}",
            highlightColor = ElectricBlue,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: String,
    unit: String? = null,
    subtitle: String? = null,
    highlightColor: Color = Color.White,
    actionLabel: String? = null,
    onActionClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, color = Color.White.copy(alpha = 0.65f), fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = value,
                    color = highlightColor,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                if (unit != null) {
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = unit,
                        color = highlightColor.copy(alpha = 0.7f),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(bottom = 2.dp)
                    )
                }
            }
            if (subtitle != null) {
                Text(subtitle, color = WintonGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            if (actionLabel != null && onActionClick != null) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = actionLabel,
                    color = highlightColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable { onActionClick() }
                )
            }
        }
    }
}

@Composable
private fun DailyGoalCard(
    today: Double,
    yesterday: Double,
    improved: Boolean
) {
    val progress = if (yesterday > 0) (today / yesterday).toFloat().coerceIn(0f, 1f) else if (today > 0) 1f else 0f
    val animatedProgress by animateFloatAsState(targetValue = progress, label = "dailyProgress")
    val delta = today - yesterday
    val deltaSign = if (delta > 0) "+" else ""

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Meta Diaria (Hoy vs Ayer)", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                Text("${format4Decimals(today)} BLUE IOU hoy", color = ElectricBlue, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }

            LinearProgressIndicator(
                progress = { animatedProgress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = if (improved) WintonGreen else ElectricBlue,
                trackColor = DarkBackground
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Ayer: ${format4Decimals(yesterday)}", color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp)
                Text("Diferencia: $deltaSign${format4Decimals(delta)}", color = if (delta >= 0) WintonGreen else AmberWarning, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }

            if (improved) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(WintonGreen.copy(alpha = 0.15f))
                        .padding(vertical = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🎉 ¡Mejoraste tu día anterior!", color = WintonGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun BoosterLadderSection(profile: BoosterProfile) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("SISTEMA DE RANGOS DE IMPULSOR", color = WintonGold, fontWeight = FontWeight.Bold, fontSize = 15.sp)

            // Meta de Nivel 3 destacada
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkBackground),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, WintonGold.copy(alpha = 0.4f))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("🎁", fontSize = 28.sp)
                    Column {
                        Text("META DE NIVEL 3", color = WintonGold, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        Text("+50.000,0000 BLUE IOU", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("Activable por tareas o referidos con KYC", color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                    }
                }
            }

            // Escalera de niveles
            val sortedLevels = profile.allLevels.sortedByDescending { it.level }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                sortedLevels.forEach { lvl ->
                    val isCompleted = lvl.level < profile.boosterLevel
                    val isActive = lvl.level == profile.boosterLevel

                    val bgColor = when {
                        isActive -> ElectricBlue.copy(alpha = 0.2f)
                        isCompleted -> WintonGreen.copy(alpha = 0.1f)
                        else -> DarkBackground
                    }

                    val borderColor = when {
                        isActive -> ElectricBlue
                        isCompleted -> WintonGreen.copy(alpha = 0.5f)
                        else -> Color.White.copy(alpha = 0.05f)
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(bgColor)
                            .border(1.dp, borderColor, RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            when {
                                isCompleted -> Icon(Icons.Default.CheckCircle, contentDescription = null, tint = WintonGreen, modifier = Modifier.size(18.dp))
                                isActive -> Icon(Icons.Default.Star, contentDescription = null, tint = WintonGold, modifier = Modifier.size(18.dp))
                                else -> Icon(Icons.Default.Lock, contentDescription = null, tint = Color.White.copy(alpha = 0.3f), modifier = Modifier.size(18.dp))
                            }
                            Text("NIVEL ${lvl.level} - ${lvl.name}", color = if (isActive) ElectricBlue else Color.White, fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium, fontSize = 13.sp)
                        }

                        val reqText = if (lvl.minBlueRequired == 0.0) "INICIO" else "${format4Decimals(lvl.minBlueRequired)} BLUE IOU"
                        Text(reqText, color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                    }
                }
            }

            // Pie de progreso
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("TOTAL ACUMULADO", color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
                    Text("${format4Decimals(profile.totalBoosterBlue)} BLUE IOU", color = ElectricBlue, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }

                Column(horizontalAlignment = Alignment.End) {
                    if (profile.nextLevelInfo != null) {
                        Text("SIGUIENTE NIVEL (${profile.nextLevelInfo.name})", color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
                        Text("FALTAN ${format4Decimals(profile.neededBlueForNextLevel)} BLUE IOU", color = WintonGold, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    } else {
                        Text("RANGO MÁXIMO", color = WintonGold, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun BoosterLedgerRow(item: BoosterLedgerMovement) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = item.description.ifBlank { "Actividad de Impulsor" },
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = formatDateTime(item.createdAt),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 11.sp
                )
            }

            val sign = if (item.amount >= 0) "+" else "−"
            val absAmount = kotlin.math.abs(item.amount)
            val color = if (item.amount >= 0) WintonGreen else AmberWarning

            Text(
                text = "$sign${format4Decimals(absAmount)} BLUE IOU",
                color = color,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

private fun format4Decimals(value: Double): String {
    return String.format(Locale("es", "ES"), "%.4f", value)
}

private fun formatDateTime(isoString: String): String {
    return try {
        isoString.take(10)
    } catch (e: Exception) {
        isoString
    }
}
