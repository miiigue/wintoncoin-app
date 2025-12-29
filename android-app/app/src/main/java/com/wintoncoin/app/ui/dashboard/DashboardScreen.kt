package com.wintoncoin.app.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import com.wintoncoin.app.ui.components.WintonButton
import com.wintoncoin.app.ui.components.WintonCard
import com.wintoncoin.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToCreatePublication: () -> Unit,
    viewModel: UserViewModel = hiltViewModel()
) {
    val uiState = viewModel.uiState
    val scrollState = rememberScrollState()
    
    // Estado para los tooltips (diálogos)
    var activeTooltip by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("WintonCoin", color = WintonTextPrimary) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WintonBackground),
                actions = {
                    IconButton(onClick = { viewModel.loadData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Recargar", tint = WintonTextPrimary)
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToCreatePublication,
                containerColor = WintonViolet,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Crear Publicación")
            }
        },
        containerColor = WintonBackground
    ) { paddingValues ->
        
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = WintonViolet)
            }
        } else {
            Column(
                modifier = Modifier
                    .padding(paddingValues)
                    .fillMaxSize()
                    .padding(16.dp)
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Pre-launch Ribbon Warning
                WintonCard(
                    backgroundColor = WintonSurface.copy(alpha = 0.8f),
                    borderColor = WintonViolet
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "🚀 Pre-lanzamiento: Prototipo Alfa",
                            style = MaterialTheme.typography.titleMedium,
                            color = WintonViolet,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Balance Section BLUE
                BalanceCard(
                    title = "SALDO BLUE",
                    borderColor = TokenBlue.copy(alpha = 0.3f),
                    onInfoClick = { activeTooltip = "BLUE: Tu activo principal. 1 BLUE = 1 USD (Meta)." }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        BalanceItem(
                            label = "Disponibles",
                            amount = uiState.balance?.liquidBlueBalance ?: "--",
                            color = TokenBlue,
                            onInfoClick = { activeTooltip = "Disponibles: Puedes usarlos ya." }
                        )
                        BalanceItem(
                            label = "Pendientes",
                            amount = uiState.balance?.escrowBlueBalance ?: "--",
                            color = TokenEscrow,
                            onInfoClick = { activeTooltip = "Pendientes: En espera (Escrow)." }
                        )
                    }
                }

                // Balance Section RED
                BalanceCard(
                    title = "SALDO RED",
                    borderColor = TokenRed.copy(alpha = 0.3f),
                    onInfoClick = { activeTooltip = "RED: Tu deuda. Debes quemarla con BLUE." }
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        BalanceItem(
                            label = "Deuda Total",
                            amount = uiState.balance?.redBalance ?: "--",
                            color = TokenRed,
                            onInfoClick = { activeTooltip = "Deuda Total: Lo que debes al sistema." }
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        WintonButton(
                            text = "🔥 Quemar 🔥",
                            onClick = { /* TODO: Implementar Quemar */ },
                            containerColor = WintonError,
                            modifier = Modifier.width(200.dp)
                        )
                    }
                }
                
                // Espacio para la lista de publicaciones (se implementará después)
                Text(
                    "Publicaciones Recientes",
                    style = MaterialTheme.typography.titleLarge,
                    color = WintonTextPrimary,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }
    }

    // Tooltip Dialog
    if (activeTooltip != null) {
        AlertDialog(
            onDismissRequest = { activeTooltip = null },
            confirmButton = {
                TextButton(onClick = { activeTooltip = null }) {
                    Text("Entendido", color = WintonViolet)
                }
            },
            title = { Text("Información", color = WintonViolet) },
            text = { Text(activeTooltip!!, color = WintonTextPrimary) },
            containerColor = WintonSurface
        )
    }
}

@Composable
fun BalanceCard(
    title: String,
    borderColor: Color,
    onInfoClick: () -> Unit,
    content: @Composable () -> Unit
) {
    WintonCard(
        borderColor = borderColor,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth().clickable { onInfoClick() }
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    color = WintonTextPrimary,
                    fontWeight = FontWeight.Bold
                )
                Icon(
                    Icons.Default.Info,
                    contentDescription = "Info",
                    tint = WintonTextSecondary,
                    modifier = Modifier.size(16.dp).padding(start = 4.dp)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            content()
        }
    }
}

@Composable
fun BalanceItem(
    label: String,
    amount: String,
    color: Color,
    onInfoClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onInfoClick() }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.bodySmall, color = WintonTextSecondary)
            Icon(
                Icons.Default.Info,
                contentDescription = null,
                tint = WintonTextSecondary,
                modifier = Modifier.size(12.dp).padding(start = 2.dp)
            )
        }
        Text(
            amount,
            style = MaterialTheme.typography.headlineMedium,
            color = color,
            fontWeight = FontWeight.Bold
        )
    }
}

