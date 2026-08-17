// ============================================================================
// WintonCoin Android — MarketplaceScreen (Pantalla del Marketplace de Tareas)
// ============================================================================
// [PRESENTATION LAYER] Feed principal de Tareas, Ventas y Causas Solidarias.
// Implementa búsqueda en tiempo real, chips de filtro y LazyColumn de alto rendimiento.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.presentation.marketplace.components.PublicationCard
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MarketplaceScreen(
    viewModel: MarketplaceViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToDetail: (String) -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onEvent(MarketplaceEvent.ClearMessages)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Marketplace P2P",
                        color = Color.White,
                        fontSize = 19.sp,
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
                actions = {
                    IconButton(onClick = { viewModel.onEvent(MarketplaceEvent.Refresh) }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refrescar",
                            tint = WintonGold
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F172A)
                )
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
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                // Barra de Búsqueda
                OutlinedTextField(
                    value = state.searchQuery,
                    onValueChange = { viewModel.onEvent(MarketplaceEvent.UpdateSearchQuery(it)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    placeholder = { Text("Buscar tareas, ventas, causas...", color = Color(0xFF64748B), fontSize = 14.sp) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Buscar",
                            tint = Color(0xFF94A3B8)
                        )
                    },
                    trailingIcon = {
                        if (state.searchQuery.isNotBlank()) {
                            IconButton(onClick = { viewModel.onEvent(MarketplaceEvent.UpdateSearchQuery("")) }) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Limpiar",
                                    tint = Color(0xFF94A3B8)
                                )
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = Color(0xFF1E293B),
                        unfocusedContainerColor = Color(0xFF1E293B),
                        focusedBorderColor = WintonBlue,
                        unfocusedBorderColor = Color(0xFF334155)
                    )
                )

                // Chips de Filtro Horizontal
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = state.selectedCategory == MarketplaceCategory.ALL,
                        onClick = { viewModel.onEvent(MarketplaceEvent.SelectCategory(MarketplaceCategory.ALL)) },
                        label = { Text("Todos") },
                        colors = filterChipColors()
                    )
                    FilterChip(
                        selected = state.selectedCategory == MarketplaceCategory.PENDING,
                        onClick = { viewModel.onEvent(MarketplaceEvent.SelectCategory(MarketplaceCategory.PENDING)) },
                        label = { Text("⚡ Mis Pendientes") },
                        colors = filterChipColors()
                    )
                    FilterChip(
                        selected = state.selectedCategory == MarketplaceCategory.TASK,
                        onClick = { viewModel.onEvent(MarketplaceEvent.SelectCategory(MarketplaceCategory.TASK)) },
                        label = { Text("💼 Tareas") },
                        colors = filterChipColors()
                    )
                    FilterChip(
                        selected = state.selectedCategory == MarketplaceCategory.SELL,
                        onClick = { viewModel.onEvent(MarketplaceEvent.SelectCategory(MarketplaceCategory.SELL)) },
                        label = { Text("🛍️ Ventas P2P") },
                        colors = filterChipColors()
                    )
                    FilterChip(
                        selected = state.selectedCategory == MarketplaceCategory.DONATION,
                        onClick = { viewModel.onEvent(MarketplaceEvent.SelectCategory(MarketplaceCategory.DONATION)) },
                        label = { Text("❤️ Solidario") },
                        colors = filterChipColors()
                    )
                }

                // Contador de Resultados
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Publicaciones Activas",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "${state.publications.size} disponibles",
                        color = Color(0xFF94A3B8),
                        fontSize = 12.sp
                    )
                }

                // Estado de Carga o Lista de Publicaciones
                if (state.isLoading && state.publications.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = 60.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = WintonGold)
                    }
                } else if (state.publications.isEmpty()) {
                    EmptyMarketplaceState(category = state.selectedCategory)
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(
                            items = state.publications,
                            key = { it.id }
                        ) { pub ->
                            PublicationCard(
                                publication = pub,
                                onClick = { onNavigateToDetail(pub.id) }
                            )
                        }

                        item {
                            Spacer(modifier = Modifier.height(24.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyMarketplaceState(category: MarketplaceCategory) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (category == MarketplaceCategory.PENDING) "📁" else "🚀",
                fontSize = 44.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = if (category == MarketplaceCategory.PENDING) {
                    "No tienes tareas pendientes"
                } else {
                    "¡El mercado está tranquilo!"
                },
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = if (category == MarketplaceCategory.PENDING) {
                    "Las tareas que aceptes o que otros usuarios postulen en tus publicaciones aparecerán aquí."
                } else {
                    "No hay publicaciones disponibles en esta categoría en este momento."
                },
                color = Color(0xFF94A3B8),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
private fun filterChipColors() = FilterChipDefaults.filterChipColors(
    containerColor = Color(0xFF1E293B),
    labelColor = Color(0xFF94A3B8),
    selectedContainerColor = WintonBlue,
    selectedLabelColor = Color.White
)
