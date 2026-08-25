// ============================================================================
// WintonCoin Android — NotificationsScreen
// ============================================================================
// [PRESENTATION / SCREEN] Pantalla nativa completa de Centro de Notificaciones &
// Alertas Web3 con categorización inteligente, acciones masivas y deep links.
// ============================================================================

package com.wintoncoin.app.presentation.notifications

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.NotificationCategory
import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.model.NotificationNavigationTarget
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonCardBackground
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonOrange
import com.wintoncoin.app.presentation.theme.WintonPurple
import com.wintoncoin.app.presentation.theme.WintonRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToBoosterProfile: () -> Unit = {},
    onNavigateToWallet: () -> Unit = {},
    onNavigateToAccountStatement: () -> Unit = {},
    onNavigateToPublications: () -> Unit = {}
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.feedbackMessage) {
        state.feedbackMessage?.let { feedback ->
            snackbarHostState.showSnackbar(feedback)
            viewModel.onEvent(NotificationsEvent.DismissFeedback)
        }
    }

    if (state.errorMessage != null) {
        WintonAlertDialog(
            title = "Aviso de Notificaciones",
            message = state.errorMessage ?: "Ha ocurrido un error inesperado.",
            onDismiss = { viewModel.onEvent(NotificationsEvent.DismissError) }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Notificaciones",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        if (state.unreadCount > 0) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(WintonRed)
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "${state.unreadCount}",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
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
                        onClick = { viewModel.onEvent(NotificationsEvent.Refresh) },
                        enabled = !state.isRefreshing && !state.isLoading
                    ) {
                        if (state.isRefreshing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = WintonGreen,
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
        containerColor = Color(0xFF0A0E1A)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Selector de Pestañas (Nuevas / Historial)
            TabRow(
                selectedTabIndex = state.selectedTab.ordinal,
                containerColor = Color(0xFF0F172A),
                contentColor = Color.White,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(tabPositions[state.selectedTab.ordinal]),
                        color = WintonGreen,
                        height = 3.dp
                    )
                }
            ) {
                Tab(
                    selected = state.selectedTab == NotificationTab.UNREAD,
                    onClick = { viewModel.onEvent(NotificationsEvent.SelectTab(NotificationTab.UNREAD)) },
                    text = {
                        Text(
                            text = if (state.unreadCount > 0) "Nuevas (${state.unreadCount})" else "Nuevas",
                            fontWeight = if (state.selectedTab == NotificationTab.UNREAD) FontWeight.Bold else FontWeight.Normal,
                            color = if (state.selectedTab == NotificationTab.UNREAD) WintonGreen else Color(0xFF94A3B8)
                        )
                    }
                )
                Tab(
                    selected = state.selectedTab == NotificationTab.HISTORY,
                    onClick = { viewModel.onEvent(NotificationsEvent.SelectTab(NotificationTab.HISTORY)) },
                    text = {
                        Text(
                            text = "Historial Completo",
                            fontWeight = if (state.selectedTab == NotificationTab.HISTORY) FontWeight.Bold else FontWeight.Normal,
                            color = if (state.selectedTab == NotificationTab.HISTORY) WintonGreen else Color(0xFF94A3B8)
                        )
                    }
                )
            }

            // Barra de Filtros y Acciones
            NotificationActionBar(
                selectedTab = state.selectedTab,
                unreadCount = state.unreadCount,
                isClearingAll = state.isClearingAll,
                selectedCategory = state.selectedCategoryFilter,
                onSelectCategory = { viewModel.onEvent(NotificationsEvent.SelectCategoryFilter(it)) },
                onClearAll = { viewModel.onEvent(NotificationsEvent.MarkAllAsRead) }
            )

            // Contenido Principal
            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = WintonGreen)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Cargando notificaciones...",
                            color = Color(0xFF94A3B8),
                            fontSize = 14.sp
                        )
                    }
                }
            } else if (state.displayedNotifications.isEmpty()) {
                EmptyNotificationsView(
                    selectedTab = state.selectedTab,
                    onSwitchToHistory = {
                        viewModel.onEvent(NotificationsEvent.SelectTab(NotificationTab.HISTORY))
                    }
                )
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    item { Spacer(modifier = Modifier.height(4.dp)) }

                    items(
                        items = state.displayedNotifications,
                        key = { "${it.id}_${it.isRead}" }
                    ) { notification ->
                        val isDismissing = state.dismissingIds.contains(notification.id)
                        AnimatedVisibility(
                            visible = !isDismissing,
                            enter = fadeIn(),
                            exit = fadeOut() + shrinkVertically()
                        ) {
                            NotificationCardItem(
                                notification = notification,
                                onDismiss = { viewModel.onEvent(NotificationsEvent.DismissNotification(notification.id)) },
                                onClick = {
                                    when (notification.navigationTarget) {
                                        NotificationNavigationTarget.BOOSTER_PROFILE -> onNavigateToBoosterProfile()
                                        NotificationNavigationTarget.WALLET -> onNavigateToWallet()
                                        NotificationNavigationTarget.ACCOUNT_STATEMENT -> onNavigateToAccountStatement()
                                        NotificationNavigationTarget.PUBLICATIONS -> onNavigateToPublications()
                                        NotificationNavigationTarget.NONE -> {}
                                    }
                                }
                            )
                        }
                    }

                    item { Spacer(modifier = Modifier.height(24.dp)) }
                }
            }
        }
    }
}

@Composable
private fun NotificationActionBar(
    selectedTab: NotificationTab,
    unreadCount: Int,
    isClearingAll: Boolean,
    selectedCategory: NotificationCategory?,
    onSelectCategory: (NotificationCategory?) -> Unit,
    onClearAll: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0F172A).copy(alpha = 0.5f))
            .padding(vertical = 8.dp, horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (selectedTab == NotificationTab.UNREAD) "Bandeja de Entrada" else "Historial de Actividad",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )

            if (selectedTab == NotificationTab.UNREAD && unreadCount > 0) {
                TextButton(
                    onClick = onClearAll,
                    enabled = !isClearingAll
                ) {
                    if (isClearingAll) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            color = WintonGreen,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                    } else {
                        Icon(
                            imageVector = Icons.Default.DeleteSweep,
                            contentDescription = null,
                            tint = WintonGreen,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Text(
                        text = "Limpiar todo",
                        color = WintonGreen,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Filtros horizontales por categoría
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            FilterChip(
                selected = selectedCategory == null,
                onClick = { onSelectCategory(null) },
                label = { Text(text = "Todas", fontSize = 12.sp) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = WintonGreen.copy(alpha = 0.2f),
                    selectedLabelColor = WintonGreen,
                    containerColor = Color(0xFF1E293B),
                    labelColor = Color(0xFF94A3B8)
                ),
                border = BorderStroke(
                    1.dp,
                    if (selectedCategory == null) WintonGreen else Color(0xFF334155)
                )
            )

            NotificationCategoryChip(
                label = "💰 Recompensas",
                category = NotificationCategory.REWARD_TASK,
                selected = selectedCategory == NotificationCategory.REWARD_TASK,
                onSelect = onSelectCategory
            )

            NotificationCategoryChip(
                label = "🎉 Aprobadas",
                category = NotificationCategory.APPROVAL,
                selected = selectedCategory == NotificationCategory.APPROVAL,
                onSelect = onSelectCategory
            )

            NotificationCategoryChip(
                label = "💸 Pagos",
                category = NotificationCategory.TRANSFER,
                selected = selectedCategory == NotificationCategory.TRANSFER,
                onSelect = onSelectCategory
            )

            NotificationCategoryChip(
                label = "📩 Solicitudes",
                category = NotificationCategory.REQUEST,
                selected = selectedCategory == NotificationCategory.REQUEST,
                onSelect = onSelectCategory
            )

            NotificationCategoryChip(
                label = "⚠️ Alertas",
                category = NotificationCategory.SECURITY_WARNING,
                selected = selectedCategory == NotificationCategory.SECURITY_WARNING,
                onSelect = onSelectCategory
            )
        }
    }
}

@Composable
private fun NotificationCategoryChip(
    label: String,
    category: NotificationCategory,
    selected: Boolean,
    onSelect: (NotificationCategory?) -> Unit
) {
    FilterChip(
        selected = selected,
        onClick = { onSelect(if (selected) null else category) },
        label = { Text(text = label, fontSize = 12.sp) },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = WintonGreen.copy(alpha = 0.2f),
            selectedLabelColor = WintonGreen,
            containerColor = Color(0xFF1E293B),
            labelColor = Color(0xFF94A3B8)
        ),
        border = BorderStroke(
            1.dp,
            if (selected) WintonGreen else Color(0xFF334155)
        )
    )
}

@Composable
private fun NotificationCardItem(
    notification: NotificationItem,
    onDismiss: () -> Unit,
    onClick: () -> Unit
) {
    val accentColor = when (notification.category) {
        NotificationCategory.REWARD_TASK -> WintonOrange
        NotificationCategory.APPROVAL -> WintonGreen
        NotificationCategory.TRANSFER -> WintonBlue
        NotificationCategory.REQUEST -> WintonPurple
        NotificationCategory.SECURITY_WARNING -> WintonRed
        NotificationCategory.GENERAL_INFO -> Color(0xFF38BDF8)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = notification.navigationTarget != NotificationNavigationTarget.NONE) { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (notification.isRead) Color(0xFF0F172A).copy(alpha = 0.7f) else Color(0xFF1E293B)
        ),
        border = BorderStroke(
            1.dp,
            if (notification.isRead) Color(0xFF334155).copy(alpha = 0.5f) else accentColor.copy(alpha = 0.4f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Icono / Emoji con círculo de fondo
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(accentColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = notification.iconEmoji,
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Contenido de texto y fecha
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.message,
                    color = if (notification.isRead) Color(0xFFCBD5E1) else Color.White,
                    fontSize = 13.5.sp,
                    lineHeight = 19.sp,
                    fontWeight = if (notification.isRead) FontWeight.Normal else FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = notification.formattedDate,
                        color = Color(0xFF64748B),
                        fontSize = 11.sp
                    )

                    if (notification.navigationTarget != NotificationNavigationTarget.NONE) {
                        Text(
                            text = "Ver detalle ↗",
                            color = accentColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Botón para descartar notificación individual (✕)
            if (!notification.isRead) {
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Descartar",
                        tint = Color(0xFF94A3B8),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyNotificationsView(
    selectedTab: NotificationTab,
    onSwitchToHistory: () -> Unit
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
                    imageVector = Icons.Default.NotificationsNone,
                    contentDescription = null,
                    tint = WintonGreen,
                    modifier = Modifier.size(36.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = if (selectedTab == NotificationTab.UNREAD) "No tienes notificaciones nuevas" else "Historial de notificaciones vacío",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = if (selectedTab == NotificationTab.UNREAD)
                    "Todas las alertas de pagos, tareas y recompensas están al día."
                else
                    "Aún no hay registros de notificaciones pasadas en este entorno.",
                color = Color(0xFF94A3B8),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )

            if (selectedTab == NotificationTab.UNREAD) {
                Spacer(modifier = Modifier.height(20.dp))
                androidx.compose.material3.Button(
                    onClick = onSwitchToHistory,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1E293B)
                    ),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, WintonGreen.copy(alpha = 0.4f))
                ) {
                    Text(
                        text = "Ver Historial Completo ↗",
                        color = WintonGreen,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}
