// ============================================================================
// WintonCoin Android — WalletScreen (Pantalla de Billetera Web3 Nativa)
// ============================================================================
// [PRESENTATION LAYER] Módulo de Billetera con paridad total con la PWA:
// Tarjetas de balances BLUE y RED, Bóveda de Garantía e Historial Contable.
// ============================================================================

package com.wintoncoin.app.presentation.wallet

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.TransactionItem
import com.wintoncoin.app.domain.model.TransactionType
import com.wintoncoin.app.domain.usecase.FormatBalanceUseCase
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonPurple

@Composable
fun WalletScreen(
    viewModel: WalletViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToAccountStatement: () -> Unit = {}
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val formatter = FormatBalanceUseCase()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        WintonBlue,
                        Color(0xFF0F172A),
                        Color(0xFF020617)
                    )
                )
            )
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                            tint = Color.White
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Billetera Web3",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                IconButton(onClick = { viewModel.onEvent(WalletEvent.Refresh) }) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refrescar",
                        tint = WintonGold
                    )
                }
            }

            // Tab Row
            TabRow(
                selectedTabIndex = state.selectedTab.ordinal,
                containerColor = Color(0xFF1E293B).copy(alpha = 0.9f),
                contentColor = WintonGold,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(tabPositions[state.selectedTab.ordinal]),
                        color = WintonGold
                    )
                }
            ) {
                Tab(
                    selected = state.selectedTab == WalletTab.BALANCES,
                    onClick = { viewModel.onEvent(WalletEvent.TabSelected(WalletTab.BALANCES)) },
                    text = {
                        Text(
                            text = "Saldos & Límites",
                            fontWeight = if (state.selectedTab == WalletTab.BALANCES) FontWeight.Bold else FontWeight.Normal,
                            color = if (state.selectedTab == WalletTab.BALANCES) Color.White else Color.Gray
                        )
                    }
                )
                Tab(
                    selected = state.selectedTab == WalletTab.HISTORY,
                    onClick = { viewModel.onEvent(WalletEvent.TabSelected(WalletTab.HISTORY)) },
                    text = {
                        Text(
                            text = "Movimientos (${state.transactions.size})",
                            fontWeight = if (state.selectedTab == WalletTab.HISTORY) FontWeight.Bold else FontWeight.Normal,
                            color = if (state.selectedTab == WalletTab.HISTORY) Color.White else Color.Gray
                        )
                    }
                )
            }

            if (state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = WintonGold)
                }
            } else {
                when (state.selectedTab) {
                    WalletTab.BALANCES -> {
                        val balance = state.balance
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            item {
                                BlueBalanceCard(
                                    availableBalance = balance?.blueAvailable ?: 0.0,
                                    escrowBalance = balance?.blueEscrow ?: 0.0
                                )
                            }

                            item {
                                RedBalanceCard(
                                    debtBalance = balance?.redDebt ?: 0.0,
                                    creditLimit = balance?.redLimit ?: 0.0,
                                    availableCredit = balance?.redAvailable ?: 0.0
                                )
                            }

                            // Bóveda de Garantía (Collateral Vault)
                            item {
                                CollateralVaultCard(
                                    collateralBalance = balance?.collateralBalance ?: 0.0,
                                    formatter = formatter
                                )
                            }

                            // Estado KYC y Dirección de Billetera
                            item {
                                SecurityStatusCard(
                                    kycVerified = balance?.kycVerified ?: false,
                                    walletAddress = balance?.web3WalletAddress
                                )
                            }

                            // Acceso directo a Estado de Cuenta Web3
                            item {
                                androidx.compose.material3.Button(
                                    onClick = onNavigateToAccountStatement,
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                        containerColor = Color.White.copy(alpha = 0.08f)
                                    ),
                                    shape = RoundedCornerShape(12.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, WintonGreen.copy(alpha = 0.3f))
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Description,
                                        contentDescription = null,
                                        tint = WintonGreen,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Ver Estado de Cuenta Web3 Completo ↗",
                                        color = Color.White,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            item {
                                Spacer(modifier = Modifier.height(24.dp))
                            }
                        }
                    }
                    WalletTab.HISTORY -> {
                        if (state.transactions.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No tienes movimientos contables registrados aún.",
                                    color = Color.Gray,
                                    fontSize = 15.sp
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(state.transactions) { tx ->
                                    TransactionItemRow(item = tx, formatter = formatter)
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

        if (state.errorMessage != null) {
            WintonAlertDialog(
                title = "Error de Billetera",
                message = state.errorMessage!!,
                onDismiss = { viewModel.onEvent(WalletEvent.DismissError) }
            )
        }
    }
}

@Composable
private fun CollateralVaultCard(
    collateralBalance: Double,
    formatter: FormatBalanceUseCase
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f))
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = "Bóveda",
                        tint = WintonGold,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Bóveda de Garantía (Collateral Vault)",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "${formatter(collateralBalance)} USDT",
                color = WintonGold,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Garantía neta en custodia para ampliación de línea de crédito RED.",
                color = Color.LightGray,
                fontSize = 12.sp
            )
        }
    }
}

@Composable
private fun SecurityStatusCard(
    kycVerified: Boolean,
    walletAddress: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f))
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Estado de Verificación KYC",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )

                Surface(
                    color = if (kycVerified) WintonGreen.copy(alpha = 0.2f) else WintonGold.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = if (kycVerified) "KYC APROBADO" else "PENDIENTE",
                        color = if (kycVerified) WintonGreen else WintonGold,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            if (!walletAddress.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Billetera Vinculada: ${walletAddress.take(8)}...${walletAddress.takeLast(6)}",
                    color = Color.LightGray,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun TransactionItemRow(
    item: TransactionItem,
    formatter: FormatBalanceUseCase
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = Color(0xFF1E293B).copy(alpha = 0.9f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icono según tipo de transacción
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        when (item.type) {
                            TransactionType.EARNED -> WintonGreen.copy(alpha = 0.2f)
                            TransactionType.SPENT -> Color(0xFFF43F5E).copy(alpha = 0.2f)
                            TransactionType.ESCROW -> WintonGold.copy(alpha = 0.2f)
                            TransactionType.DONATION -> WintonPurple.copy(alpha = 0.2f)
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (item.type) {
                        TransactionType.EARNED -> Icons.Default.ArrowUpward
                        TransactionType.SPENT -> Icons.Default.ArrowDownward
                        TransactionType.ESCROW -> Icons.Default.Lock
                        TransactionType.DONATION -> Icons.Default.Favorite
                    },
                    contentDescription = null,
                    tint = when (item.type) {
                        TransactionType.EARNED -> WintonGreen
                        TransactionType.SPENT -> Color(0xFFFB7185)
                        TransactionType.ESCROW -> WintonGold
                        TransactionType.DONATION -> WintonPurple
                    },
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.title,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )
                Text(
                    text = when (item.type) {
                        TransactionType.EARNED -> "Tarea Completada"
                        TransactionType.SPENT -> "Publicación Creada"
                        TransactionType.ESCROW -> "En Custodia"
                        TransactionType.DONATION -> "Donación Humanitaria"
                    },
                    color = Color.Gray,
                    fontSize = 12.sp
                )
            }

            Text(
                text = "${if (item.type == TransactionType.EARNED) "+" else "-"}${formatter(item.amount)} BLUE",
                color = when (item.type) {
                    TransactionType.EARNED -> WintonGreen
                    TransactionType.SPENT -> Color(0xFFFB7185)
                    TransactionType.ESCROW -> WintonGold
                    TransactionType.DONATION -> WintonPurple
                },
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
