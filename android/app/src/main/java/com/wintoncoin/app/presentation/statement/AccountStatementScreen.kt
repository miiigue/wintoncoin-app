// ============================================================================
// WintonCoin Android — AccountStatementScreen (Estado de Cuenta Web3)
// ============================================================================
// [PRESENTATION LAYER] Pantalla declarativa construida con Jetpack Compose.
// Refleja exactamente la funcionalidad, diseño y auditoría de estado-cuenta.html.
// ============================================================================

package com.wintoncoin.app.presentation.statement

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Token
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.AccountStatementSummary
import com.wintoncoin.app.domain.model.BlockchainActivityStats
import com.wintoncoin.app.domain.model.SmartContractInfo
import com.wintoncoin.app.domain.model.StatementTransaction
import com.wintoncoin.app.domain.model.VaultCollateralToken
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonCardBackground
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonOrange
import com.wintoncoin.app.presentation.theme.WintonPink
import com.wintoncoin.app.presentation.theme.WintonRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountStatementScreen(
    viewModel: AccountStatementViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.copyFeedback) {
        state.copyFeedback?.let { feedback ->
            snackbarHostState.showSnackbar(feedback)
            viewModel.onEvent(AccountStatementEvent.DismissCopyFeedback)
        }
    }

    if (state.errorMessage != null) {
        WintonAlertDialog(
            title = "Aviso del Sistema",
            message = state.errorMessage ?: "Ha ocurrido un error.",
            onDismiss = { viewModel.onEvent(AccountStatementEvent.DismissError) }
        )
    }

    // Modal de Smart Contract
    if (state.showSmartContractDialog) {
        SmartContractInfoModal(
            contract = state.selectedSmartContract,
            isLoading = state.isLoadingSmartContract,
            onDismiss = { viewModel.onEvent(AccountStatementEvent.DismissSmartContractDialog) },
            onOpenExplorer = { url ->
                safeOpenBrowserUrl(context, url) { msg ->
                    viewModel.onEvent(AccountStatementEvent.CopyText(url, msg))
                }
            }
        )
    }

    // Modal de Información de Métrica Blockchain
    if (state.activityInfoDialogMessage != null) {
        ActivityInfoModal(
            message = state.activityInfoDialogMessage!!,
            onDismiss = { viewModel.onEvent(AccountStatementEvent.DismissActivityInfoDialog) }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Estado de Cuenta Web3",
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Surface(
                            color = WintonPink.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, WintonPink.copy(alpha = 0.4f)),
                            modifier = Modifier.padding(end = 12.dp)
                        ) {
                            Text(
                                text = "DEMO MODE",
                                color = WintonPink,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver a Billetera",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.onEvent(AccountStatementEvent.Refresh) }) {
                        Icon(
                            imageVector = Icons.Filled.Refresh,
                            contentDescription = "Actualizar",
                            tint = WintonGreen
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        if (state.isLoading && state.summary == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = WintonGreen)
            }
        } else {
            val summary = state.summary ?: AccountStatementSummary()

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item { Spacer(modifier = Modifier.height(4.dp)) }

                // 1. Tarjeta BLUE (Liquidez)
                item {
                    BlueLiquidityCard(
                        summary = summary,
                        onOpenSmartContract = { viewModel.onEvent(AccountStatementEvent.OpenSmartContractDialog("BLUE")) }
                    )
                }

                // 2. Tarjeta RED (Obligaciones) & Bóveda
                item {
                    RedObligationsCard(
                        summary = summary,
                        showVaultPanel = state.showVaultPanel,
                        selectedToken = state.vaultSelectedToken,
                        depositAmount = state.vaultDepositAmount,
                        simulatedLimit = state.vaultSimulatedLimit,
                        onToggleVaultPanel = { viewModel.onEvent(AccountStatementEvent.ToggleVaultPanel) },
                        onSelectToken = { viewModel.onEvent(AccountStatementEvent.SelectVaultToken(it)) },
                        onAmountChanged = { viewModel.onEvent(AccountStatementEvent.VaultAmountChanged(it)) },
                        onOpenSmartContract = { viewModel.onEvent(AccountStatementEvent.OpenSmartContractDialog("RED")) }
                    )
                }

                // 3. Tarjeta Identidad Web3 & KYC
                item {
                    Web3IdentityCard(
                        summary = summary,
                        onCopyAddress = { address ->
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("Dirección Web3", address)
                            clipboard.setPrimaryClip(clip)
                            viewModel.onEvent(AccountStatementEvent.CopyText(address, "Dirección pública"))
                        }
                    )
                }

                // 4. Métricas de Actividad Blockchain (Grid 2x2)
                item {
                    BlockchainMetricsCard(
                        stats = state.stats,
                        onInfoClick = { message ->
                            viewModel.onEvent(AccountStatementEvent.ShowActivityInfoDialog(message))
                        }
                    )
                }

                // 5. Historial de Últimas Transacciones
                item {
                    StatementTransactionsCard(
                        transactions = state.transactions,
                        onOpenExplorerTx = { url ->
                            safeOpenBrowserUrl(context, url) { msg ->
                                viewModel.onEvent(AccountStatementEvent.CopyText(url, msg))
                            }
                        }
                    )
                }

                // 6. Botón de Auditoría Pública en Bloques
                item {
                    AuditInExplorerButton(
                        web3Address = summary.web3WalletAddress,
                        hasValidAddress = summary.hasValidWeb3Address,
                        onClick = {
                            if (summary.hasValidWeb3Address) {
                                val url = "https://sepolia-optimism.etherscan.io/address/${summary.web3WalletAddress}"
                                safeOpenBrowserUrl(context, url) { msg ->
                                    viewModel.onEvent(AccountStatementEvent.CopyText(url, msg))
                                }
                            }
                        }
                    )
                }

                item { Spacer(modifier = Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
private fun BlueLiquidityCard(
    summary: AccountStatementSummary,
    onOpenSmartContract: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = Color.White.copy(alpha = 0.08f),
                shape = RoundedCornerShape(16.dp)
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = WintonCardBackground)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            // Acento vertical azul a la izquierda
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(60.dp)
                    .background(
                        WintonBlue,
                        shape = RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp)
                    )
            )

            Column(modifier = Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.AttachMoney,
                        contentDescription = null,
                        tint = WintonBlue,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Tokens BLUE (Liquidez)",
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                DataRowItem(
                    label = "Total Disponible",
                    value = summary.formattedBlueAvailable,
                    valueColor = WintonBlue,
                    isBold = true
                )

                DataRowItem(
                    label = "En Escrow (Bloqueado)",
                    value = summary.formattedBlueEscrow,
                    valueColor = Color.White
                )

                val unlockText = if (summary.blueEscrow > 0 && summary.blueNextUnlockAt != null) {
                    "Próximo desbloqueo: ${summary.blueNextUnlockAt}"
                } else if (summary.blueEscrow > 0) {
                    "Pendiente de fecha"
                } else {
                    "Sin saldo bloqueado actualmente"
                }

                DataRowItem(
                    label = "Próxima liberación de Escrow",
                    value = unlockText,
                    valueColor = if (summary.blueEscrow > 0) WintonOrange else Color(0xFF94A3B8),
                    fontSize = 12.sp
                )

                Spacer(modifier = Modifier.height(12.dp))

                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = WintonBlue.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "USD Estimado",
                            color = Color(0xFFE2E8F0),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = summary.formattedFiatEstimatedUsd,
                            color = WintonGreen,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                }

                Text(
                    text = "Valor referencial (1 BLUE = 1 USD). Sujeto al lanzamiento oficial.",
                    color = Color(0xFF64748B),
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                )

                Spacer(modifier = Modifier.height(14.dp))

                Button(
                    onClick = onOpenSmartContract,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Black.copy(alpha = 0.4f)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                ) {
                    Icon(
                        imageVector = Icons.Filled.Token,
                        contentDescription = null,
                        tint = Color(0xFF94A3B8),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Ver Smart Contract BLUE",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun RedObligationsCard(
    summary: AccountStatementSummary,
    showVaultPanel: Boolean,
    selectedToken: VaultCollateralToken,
    depositAmount: String,
    simulatedLimit: Double?,
    onToggleVaultPanel: () -> Unit,
    onSelectToken: (VaultCollateralToken) -> Unit,
    onAmountChanged: (String) -> Unit,
    onOpenSmartContract: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = Color.White.copy(alpha = 0.08f),
                shape = RoundedCornerShape(16.dp)
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = WintonCardBackground)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            // Acento vertical rojo a la izquierda
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(60.dp)
                    .background(
                        WintonRed,
                        shape = RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp)
                    )
            )

            Column(modifier = Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.PowerSettingsNew,
                        contentDescription = null,
                        tint = WintonRed,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Tokens RED (Obligaciones)",
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                DataRowItem(
                    label = "Límite RED aprobado",
                    value = summary.formattedRedCreditLimit,
                    valueColor = Color.White
                )

                DataRowItem(
                    label = "Límite RED disponible",
                    value = summary.formattedRedCreditAvailable,
                    valueColor = WintonGreen,
                    isBold = true
                )

                DataRowItem(
                    label = "Cupo RED utilizado",
                    value = summary.formattedRedDebtTotal,
                    valueColor = if (summary.redDebtTotal > 0) WintonRed else Color.White
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Desglose de Límite RED
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color.Black.copy(alpha = 0.25f),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "DESGLOSE DE TU LÍMITE",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "🟢 Score Orgánico (Referidos/KYC)",
                                color = Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                            Text(
                                text = summary.formattedOrganicScore,
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "🔒 Garantía en Bóveda",
                                color = Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                            Text(
                                text = summary.formattedCollateralBalance,
                                color = if (summary.collateralBalance > 0) WintonGreen else Color(0xFF64748B),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Botón CTA Principal Aumentar Límite
                Button(
                    onClick = onToggleVaultPanel,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.horizontalGradient(listOf(Color(0xFFF59E0B), Color(0xFFEF4444))),
                                shape = RoundedCornerShape(10.dp)
                            )
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (showVaultPanel) "✕ Cerrar Panel" else "⚡ Aumentar Límite RED",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Panel Expandible de la Bóveda
                AnimatedVisibility(
                    visible = showVaultPanel,
                    enter = fadeIn(),
                    exit = fadeOut()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 14.dp)
                            .background(Color.Black.copy(alpha = 0.35f), shape = RoundedCornerShape(12.dp))
                            .border(1.dp, WintonRed.copy(alpha = 0.3f), shape = RoundedCornerShape(12.dp))
                            .padding(14.dp)
                    ) {
                        Text(
                            text = "🏦 Bóveda de Garantías",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = "Token de Garantía",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))

                        // Selector de Stablecoins
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            VaultCollateralToken.entries.forEach { token ->
                                val isSelected = token == selectedToken
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { onSelectToken(token) },
                                    color = if (isSelected) WintonGreen.copy(alpha = 0.2f) else Color.Black.copy(alpha = 0.4f),
                                    shape = RoundedCornerShape(8.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (isSelected) WintonGreen else Color.White.copy(alpha = 0.1f)
                                    )
                                ) {
                                    Text(
                                        text = token.symbol,
                                        color = if (isSelected) WintonGreen else Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(vertical = 8.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = "Monto a depositar",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))

                        OutlinedTextField(
                            value = depositAmount,
                            onValueChange = onAmountChanged,
                            placeholder = { Text("Ej: 50", color = Color(0xFF64748B)) },
                            trailingIcon = {
                                Text(
                                    text = selectedToken.symbol,
                                    color = Color(0xFF94A3B8),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(end = 12.dp)
                                )
                            },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = WintonGreen,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                                focusedContainerColor = Color.Black.copy(alpha = 0.4f),
                                unfocusedContainerColor = Color.Black.copy(alpha = 0.4f)
                            ),
                            shape = RoundedCornerShape(8.dp)
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Calculadora en vivo
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = WintonGreen.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            val newLimitText = simulatedLimit?.let {
                                String.format(java.util.Locale("es", "ES"), "%.4f RED", it)
                            } ?: "--"

                            Row(
                                modifier = Modifier.padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Tu nuevo Límite RED será: ",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp
                                )
                                Text(
                                    text = newLimitText,
                                    color = WintonGreen,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Al depositar, tus tokens quedan custodiados en WintonCollateralVault. Solo podrás retirarlos si tu deuda RED utilizada es 0,0000 RED.",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            lineHeight = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Button(
                    onClick = onOpenSmartContract,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Black.copy(alpha = 0.4f)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                ) {
                    Icon(
                        imageVector = Icons.Filled.Token,
                        contentDescription = null,
                        tint = Color(0xFF94A3B8),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Ver Smart Contract RED",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun Web3IdentityCard(
    summary: AccountStatementSummary,
    onCopyAddress: (String) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = WintonCardBackground)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.Security,
                    contentDescription = null,
                    tint = WintonGreen,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Identidad Web3",
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            DataRowItem(
                label = "Estado de Red",
                value = "${summary.networkStatus} ●",
                valueColor = WintonGreen,
                isBold = true
            )

            val (kycText, kycColor) = if (summary.kycVerified) {
                "✅ Verificado On-Chain" to WintonGreen
            } else {
                "⏳ Pendiente de Aprobación" to WintonOrange
            }

            DataRowItem(
                label = "Estado KYC On-Chain",
                value = kycText,
                valueColor = kycColor,
                isBold = true
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Llave Pública (Public Key)",
                color = Color(0xFF94A3B8),
                fontSize = 12.sp
            )
            Spacer(modifier = Modifier.height(6.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.Black.copy(alpha = 0.4f),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (summary.web3WalletAddress.isNotBlank()) summary.web3WalletAddress else "0xPendienteDeAsignacion...",
                        color = Color(0xFF94A3B8),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )

                    if (summary.hasValidWeb3Address) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = { onCopyAddress(summary.web3WalletAddress) },
                            colors = ButtonDefaults.buttonColors(containerColor = WintonGreen.copy(alpha = 0.2f)),
                            shape = RoundedCornerShape(6.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, WintonGreen.copy(alpha = 0.4f)),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "Copiar",
                                color = WintonGreen,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BlockchainMetricsCard(
    stats: BlockchainActivityStats,
    onInfoClick: (String) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = WintonCardBackground)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ShowChart,
                    contentDescription = null,
                    tint = WintonGreen,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Métricas de Actividad Blockchain",
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Cuadrícula 2x2
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatMetricBox(
                    modifier = Modifier.weight(1f),
                    number = stats.totalInteractions.toString(),
                    label = "Interacciones Web3",
                    onInfo = {
                        onInfoClick("Suma total de veces que tu billetera ha interactuado con los contratos inteligentes de WintonCoin (BLUE/RED) en la blockchain.")
                    }
                )
                StatMetricBox(
                    modifier = Modifier.weight(1f),
                    number = stats.paymentsReceived.toString(),
                    label = "Pagos Recibidos",
                    onInfo = {
                        onInfoClick("Cantidad de transferencias entrantes exitosas en la blockchain. Representa las veces que has recibido tokens BLUE.")
                    }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatMetricBox(
                    modifier = Modifier.weight(1f),
                    number = stats.paymentsSent.toString(),
                    label = "Pagos Enviados",
                    onInfo = {
                        onInfoClick("Cantidad de transferencias salientes exitosas en la blockchain. Incluye pagos directos y liberación de fondos en Escrow.")
                    }
                )
                StatMetricBox(
                    modifier = Modifier.weight(1f),
                    number = stats.commitmentsAmortized.toString(),
                    label = "Compromiso Amortizado",
                    onInfo = {
                        onInfoClick("Eventos de auto-amortización on-chain. Cantidad de veces que tus ingresos en BLUE liquidaron automáticamente el compromiso RED pendiente.")
                    }
                )
            }
        }
    }
}

@Composable
private fun StatMetricBox(
    modifier: Modifier = Modifier,
    number: String,
    label: String,
    onInfo: () -> Unit
) {
    Surface(
        modifier = modifier,
        color = Color.Black.copy(alpha = 0.3f),
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = number,
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = label,
                    color = Color(0xFF94A3B8),
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f, fill = false)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.Filled.Info,
                    contentDescription = "Info",
                    tint = Color(0xFF64748B),
                    modifier = Modifier
                        .size(14.dp)
                        .clickable { onInfo() }
                )
            }
        }
    }
}

@Composable
private fun StatementTransactionsCard(
    transactions: List<StatementTransaction>,
    onOpenExplorerTx: (String) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = WintonCardBackground)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.Description,
                    contentDescription = null,
                    tint = WintonGreen,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Últimas Transacciones",
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            if (transactions.isEmpty()) {
                Text(
                    text = "Aún no tienes actividades registradas.",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp)
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    transactions.take(15).forEach { tx ->
                        StatementTxRow(tx = tx, onOpenExplorer = onOpenExplorerTx)
                    }
                }
            }
        }
    }
}

@Composable
private fun StatementTxRow(
    tx: StatementTransaction,
    onOpenExplorer: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                Color.White.copy(alpha = 0.04f),
                RoundedCornerShape(8.dp)
            )
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tx.description,
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = tx.createdAt.take(10),
                    color = Color(0xFF64748B),
                    fontSize = 11.sp
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                tx.formattedBlueChange?.let { blueText ->
                    Text(
                        text = blueText,
                        color = if (tx.blueChange > 0) WintonGreen else Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
                tx.formattedRedChange?.let { redText ->
                    Text(
                        text = redText,
                        color = if (tx.redChange > 0) WintonRed else WintonGreen,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }
        }

        tx.explorerUrl?.let { url ->
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.clickable { onOpenExplorer(url) },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Ver en Explorer ↗",
                    color = WintonBlue,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun AuditInExplorerButton(
    web3Address: String,
    hasValidAddress: Boolean,
    onClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Button(
            onClick = onClick,
            enabled = hasValidAddress,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White.copy(alpha = 0.06f),
                disabledContainerColor = Color.White.copy(alpha = 0.02f)
            ),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = null,
                tint = if (hasValidAddress) Color.White else Color(0xFF64748B),
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (hasValidAddress) "Auditar en Explorador de Bloques" else "Auditar en Explorador (No disponible)",
                color = if (hasValidAddress) Color.White else Color(0xFF64748B),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Todas las transacciones son inmutables y trazables en la red pública, cumpliendo con estándares de auditoría financiera Web3.",
            color = Color(0xFF64748B),
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            lineHeight = 15.sp,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun DataRowItem(
    label: String,
    value: String,
    valueColor: Color = Color.White,
    isBold: Boolean = false,
    fontSize: androidx.compose.ui.unit.TextUnit = 14.sp
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 7.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = Color(0xFF94A3B8),
            fontSize = 13.sp
        )
        Text(
            text = value,
            color = valueColor,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = fontSize
        )
    }
}

@Composable
private fun SmartContractInfoModal(
    contract: SmartContractInfo?,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onOpenExplorer: (String) -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF0F172A),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = contract?.title ?: "Smart Contract",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(16.dp))

                if (isLoading) {
                    CircularProgressIndicator(color = WintonGreen, modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = "Consultando Blockchain...", color = Color(0xFF94A3B8), fontSize = 12.sp)
                } else if (contract != null) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color.Black,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = contract.address,
                            color = WintonGreen,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(10.dp),
                            textAlign = TextAlign.Center
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color.White.copy(alpha = 0.05f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "Suministro Actual Minteado:",
                                color = Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                            Text(
                                text = contract.minted,
                                color = Color.White,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (contract.explorerUrl.isNotBlank()) {
                        Button(
                            onClick = { onOpenExplorer(contract.explorerUrl) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = WintonGreen),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text(text = "Auditar en Blockchain ↗", color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(onClick = onDismiss) {
                    Text(text = "Cerrar", color = Color(0xFF94A3B8))
                }
            }
        }
    }
}

@Composable
private fun ActivityInfoModal(
    message: String,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF0F172A),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Filled.Info,
                    contentDescription = null,
                    tint = WintonGreen,
                    modifier = Modifier.size(36.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Métrica Blockchain",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = message,
                    color = Color(0xFFCBD5E1),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = WintonGreen),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(text = "Entendido", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun safeOpenBrowserUrl(
    context: Context,
    url: String,
    onFeedback: (String) -> Unit
) {
    if (url.isBlank()) {
        onFeedback("La dirección web no está disponible actualmente.")
        return
    }
    if (!url.startsWith("https://", ignoreCase = true)) {
        onFeedback("Por seguridad bancaria (Zero-Trust), solo se permiten enlaces cifrados HTTPS.")
        return
    }
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        onFeedback("No se encontró una aplicación de navegación para abrir el enlace.")
    }
}

