// ============================================================================
// WintonCoin Android — CausesListScreen
// ============================================================================
// [PRESENTATION / SCREEN] Pantalla exploradora de causas de WintonCoin Solidario.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.list

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonOrange
import com.wintoncoin.app.presentation.theme.WintonPurple
import com.wintoncoin.app.presentation.theme.WintonRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CausesListScreen(
    viewModel: CausesListViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToCauseDetail: (Int) -> Unit,
    onNavigateToSubmitCause: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    if (state.errorMessage != null) {
        WintonAlertDialog(
            title = "Aviso de Winton Solidario",
            message = state.errorMessage ?: "Ha ocurrido un error inesperado.",
            onDismiss = { viewModel.onEvent(CausesListEvent.DismissError) }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Winton Solidario",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "❤️", fontSize = 16.sp)
                    }
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
                        onClick = { viewModel.onEvent(CausesListEvent.Refresh) },
                        enabled = !state.isRefreshing && !state.isLoading
                    ) {
                        if (state.isRefreshing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = WintonRed,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Actualizar",
                                tint = Color.White
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F172A)
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNavigateToSubmitCause,
                containerColor = WintonRed,
                contentColor = Color.White,
                shape = RoundedCornerShape(14.dp),
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Postular Causa", fontWeight = FontWeight.Bold) }
            )
        },
        containerColor = Color(0xFF0A0E1A)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Pestañas (Aprobadas / Mis Causas)
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
                    selected = state.selectedTab == CausesTab.APPROVED,
                    onClick = { viewModel.onEvent(CausesListEvent.SelectTab(CausesTab.APPROVED)) },
                    text = {
                        Text(
                            text = "Causas en Recaudación",
                            fontWeight = if (state.selectedTab == CausesTab.APPROVED) FontWeight.Bold else FontWeight.Normal,
                            color = if (state.selectedTab == CausesTab.APPROVED) WintonRed else Color(0xFF94A3B8)
                        )
                    }
                )
                Tab(
                    selected = state.selectedTab == CausesTab.MY_CAUSES,
                    onClick = { viewModel.onEvent(CausesListEvent.SelectTab(CausesTab.MY_CAUSES)) },
                    text = {
                        Text(
                            text = "Mis Postulaciones (${state.myCauses.size})",
                            fontWeight = if (state.selectedTab == CausesTab.MY_CAUSES) FontWeight.Bold else FontWeight.Normal,
                            color = if (state.selectedTab == CausesTab.MY_CAUSES) WintonRed else Color(0xFF94A3B8)
                        )
                    }
                )
            }

            // Buscador
            OutlinedTextField(
                value = state.searchQuery,
                onValueChange = { viewModel.onEvent(CausesListEvent.SearchQueryChanged(it)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                placeholder = { Text("Buscar por causa, creador o fundación...", color = Color(0xFF64748B), fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF94A3B8)) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = WintonRed,
                    unfocusedBorderColor = Color(0xFF334155),
                    focusedContainerColor = Color(0xFF1E293B),
                    unfocusedContainerColor = Color(0xFF0F172A),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                )
            )

            // Contenido de Causas
            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = WintonRed)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Cargando causas solidarias...",
                            color = Color(0xFF94A3B8),
                            fontSize = 14.sp
                        )
                    }
                }
            } else if (state.displayedCauses.isEmpty()) {
                EmptyCausesView(
                    selectedTab = state.selectedTab,
                    onPostularClick = onNavigateToSubmitCause
                )
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    item { Spacer(modifier = Modifier.height(2.dp)) }

                    items(
                        items = state.displayedCauses,
                        key = { it.id }
                    ) { cause ->
                        CauseCardItem(
                            cause = cause,
                            onClick = { onNavigateToCauseDetail(cause.id) }
                        )
                    }

                    item { Spacer(modifier = Modifier.height(80.dp)) }
                }
            }
        }
    }
}

@Composable
private fun CauseCardItem(
    cause: HumanitarianCause,
    onClick: () -> Unit
) {
    val statusColor = when (cause.status) {
        CauseStatus.APPROVED -> WintonGreen
        CauseStatus.PENDING -> WintonOrange
        CauseStatus.COMPLETED -> WintonPurple
        CauseStatus.REJECTED -> WintonRed
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        border = BorderStroke(1.dp, Color(0xFF334155))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header: Creador/Fundación y Badge de Estado
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
                            .background(WintonRed.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "❤️", fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = cause.foundationName ?: "@${cause.creatorUsername ?: "Solidario"}",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = cause.formattedCreatedAt,
                            color = Color(0xFF64748B),
                            fontSize = 10.sp
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = statusColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = cause.status.label,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Título de la causa
            Text(
                text = cause.title,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Extracto de historia
            Text(
                text = cause.story,
                color = Color(0xFFCBD5E1),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Barra de Progreso
            LinearProgressIndicator(
                progress = { cause.progressPercentage },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = if (cause.isCompleted) WintonPurple else WintonGreen,
                trackColor = Color(0xFF0F172A)
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Métricas de recaudación
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Recaudado: ${String.format(java.util.Locale.US, "%.2f", cause.totalEffectiveRaised)} BLUE",
                        color = WintonGreen,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Meta: ${String.format(java.util.Locale.US, "%.2f", cause.goalAmount)} BLUE",
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp
                    )
                }

                Text(
                    text = cause.percentageString,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
        }
    }
}

@Composable
private fun EmptyCausesView(
    selectedTab: CausesTab,
    onPostularClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF1E293B)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Favorite,
                    contentDescription = null,
                    tint = WintonRed,
                    modifier = Modifier.size(36.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = if (selectedTab == CausesTab.APPROVED) "No hay causas activas por ahora" else "No has postulado ninguna causa",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = if (selectedTab == CausesTab.APPROVED)
                    "Sé el primero en postular una causa solidaria y recibir donaciones de tus referidos."
                else
                    "Postula tu causa humanitaria para que sea auditada y publicada en la plataforma.",
                color = Color(0xFF94A3B8),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )

            Spacer(modifier = Modifier.height(20.dp))

            androidx.compose.material3.Button(
                onClick = onPostularClick,
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = WintonRed
                ),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(
                    text = "+ Postular Causa Solidaria",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
            }
        }
    }
}
