// ============================================================================
// WintonCoin Android — DashboardScreen (Pantalla Principal Idéntica a PWA)
// ============================================================================
// [PRESENTATION LAYER] Replica exactamente la estructura, colores sapphire #14245a,
// tabs (Impulsor / Billetera), banners y menús de contract_interaction.html.
// ============================================================================

package com.wintoncoin.app.presentation.dashboard

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.presentation.theme.WintonBackgroundDark
import com.wintoncoin.app.presentation.theme.WintonBorderSoft
import com.wintoncoin.app.presentation.theme.WintonCardBlueBottom
import com.wintoncoin.app.presentation.theme.WintonCardBlueTop
import com.wintoncoin.app.presentation.theme.WintonCyan
import com.wintoncoin.app.presentation.theme.WintonEmergencyRedBottom
import com.wintoncoin.app.presentation.theme.WintonEmergencyRedTop
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonPink
import com.wintoncoin.app.presentation.theme.WintonPrimary
import com.wintoncoin.app.presentation.theme.WintonSurfaceDark
import com.wintoncoin.app.presentation.theme.WintonTextMuted
import com.wintoncoin.app.presentation.theme.WintonTextWhite
import com.wintoncoin.app.presentation.wallet.BlueBalanceCard
import com.wintoncoin.app.presentation.wallet.RedBalanceCard
import com.wintoncoin.app.presentation.wallet.WalletEvent
import com.wintoncoin.app.presentation.wallet.WalletViewModel

@Composable
fun DashboardScreen(
    username: String?,
    walletViewModel: WalletViewModel,
    onNavigateToWallet: () -> Unit,
    onNavigateToAccountStatement: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToSolidario: () -> Unit = {},
    onNavigateToSos: () -> Unit = {},
    onNavigateToSecurity: () -> Unit = {},
    onNavigateToMarketplace: () -> Unit,
    onNavigateToProfile: (String) -> Unit,
    onNavigateToBooster: () -> Unit,
    onNavigateToReferrals: () -> Unit,
    onLogout: () -> Unit
) {
    val walletState by walletViewModel.state.collectAsStateWithLifecycle()
    val balance = walletState.balance

    var selectedTab by remember { mutableStateOf("impulsor") } // "impulsor" or "billetera"
    var showProfileMenu by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WintonBackgroundDark) // #1A1A2E
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // =============================================================
            // 1. HEADER MENU (Perfil con Dropdown + Campana de Notificaciones)
            // =============================================================
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Menú de Perfil (Disparador con nombre y hamburguesa)
                Box {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { showProfileMenu = true }
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = username ?: "Usuario",
                            color = WintonTextWhite,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Menú de Perfil",
                            tint = WintonTextWhite,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    // Dropdown Content de la PWA
                    DropdownMenu(
                        expanded = showProfileMenu,
                        onDismissRequest = { showProfileMenu = false },
                        modifier = Modifier
                            .background(WintonSurfaceDark)
                            .border(1.dp, WintonBorderSoft, RoundedCornerShape(12.dp))
                    ) {
                        DropdownMenuItem(
                            text = { Text("👤 Mi Perfil", color = WintonTextWhite, fontWeight = FontWeight.Bold) },
                            onClick = { showProfileMenu = false; onNavigateToProfile(username ?: "") }
                        )
                        DropdownMenuItem(
                            text = { Text("🛒 Vende o Compra BLUE", color = WintonTextWhite) },
                            onClick = { showProfileMenu = false; onNavigateToMarketplace() }
                        )
                        DropdownMenuItem(
                            text = { Text("📊 Billetera Web3", color = WintonGreen, fontWeight = FontWeight.Bold) },
                            onClick = { showProfileMenu = false; onNavigateToAccountStatement() }
                        )
                        DropdownMenuItem(
                            text = { Text("⚡ Perfil de Impulsor", color = WintonGold) },
                            onClick = { showProfileMenu = false; onNavigateToBooster() }
                        )
                        DropdownMenuItem(
                            text = { Text("👥 Referidos", color = WintonCyan) },
                            onClick = { showProfileMenu = false; onNavigateToReferrals() }
                        )
                        DropdownMenuItem(
                            text = { Text("🚨 SOS Emergencia Venezuela", color = Color(0xFFEF4444)) },
                            onClick = { showProfileMenu = false; onNavigateToSos() }
                        )
                        DropdownMenuItem(
                            text = { Text("❤️ Donaciones Solidarias", color = WintonPink) },
                            onClick = { showProfileMenu = false; onNavigateToSolidario() }
                        )
                        DropdownMenuItem(
                            text = { Text("🛡️ Seguridad & Biometría", color = WintonTextMuted) },
                            onClick = { showProfileMenu = false; onNavigateToSecurity() }
                        )
                        DropdownMenuItem(
                            text = { Text("🚪 Cerrar Sesión", color = Color(0xFFFDA4AF), fontWeight = FontWeight.Bold) },
                            onClick = { showProfileMenu = false; onLogout() }
                        )
                    }
                }

                // Campana de Notificaciones con Badge
                Box {
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Notificaciones",
                            tint = WintonTextWhite,
                            modifier = Modifier.size(26.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // =============================================================
            // 2. CONTENEDOR PRINCIPAL (.container .interaction-container)
            // =============================================================
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, WintonBorderSoft, RoundedCornerShape(16.dp))
                    .shadow(16.dp, RoundedCornerShape(16.dp), spotColor = Color.Black),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = WintonSurfaceDark) // #14245A
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Banda / Badge de Pre-lanzamiento
                    Surface(
                        color = WintonGold.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, WintonGold.copy(alpha = 0.4f)),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Text(
                            text = "PRE-LANZAMIENTO • VERSIÓN BETA",
                            color = WintonGold,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Título Principal "WintonCoin"
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Winton",
                            color = WintonPrimary, // #6A5ACD
                            fontSize = 28.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "Coin",
                            color = WintonGold, // #F59E0B
                            fontSize = 28.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // =============================================================
                    // 3. BANNER DE EMERGENCIA TERREMOTO VENEZUELA
                    // =============================================================
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigateToSos() },
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    Brush.linearGradient(
                                        listOf(WintonEmergencyRedTop, WintonEmergencyRedBottom)
                                    )
                                )
                                .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                                .padding(14.dp)
                        ) {
                            Column {
                                Surface(
                                    color = Color.White,
                                    shape = RoundedCornerShape(50.dp)
                                ) {
                                    Text(
                                        text = "🚨 EMERGENCIA VENEZUELA",
                                        color = WintonEmergencyRedBottom,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Dos Terremotos en Venezuela. Dona tus BLUE IOU acumulados gratis para apoyar.",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = onNavigateToSos,
                                    shape = RoundedCornerShape(50.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color.White,
                                        contentColor = WintonEmergencyRedBottom
                                    ),
                                    modifier = Modifier.height(34.dp)
                                ) {
                                    Text(
                                        text = "Ver Causas",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // =============================================================
                    // 4. SISTEMA DE PESTAÑAS (TABS): IMPULSOR / BILLETERA
                    // =============================================================
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(WintonBackgroundDark)
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        // Tab Impulsor
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (selectedTab == "impulsor") WintonPrimary else Color.Transparent
                                )
                                .clickable { selectedTab = "impulsor" }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Impulsor",
                                color = if (selectedTab == "impulsor") Color.White else WintonTextMuted,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }

                        // Tab Billetera
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (selectedTab == "billetera") WintonPrimary else Color.Transparent
                                )
                                .clickable { selectedTab = "billetera" }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Billetera",
                                color = if (selectedTab == "billetera") Color.White else WintonTextMuted,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // =============================================================
                    // 5. CONTENIDO SEGÚN LA PESTAÑA SELECCIONADA
                    // =============================================================
                    if (selectedTab == "impulsor") {
                        // Panel IMPULSOR: Tarjeta Sapphire Degradada (.booster-banner)
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onNavigateToBooster() }
                                .border(1.dp, WintonBorderSoft, RoundedCornerShape(16.dp)),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.Transparent)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        Brush.verticalGradient(
                                            listOf(WintonCardBlueTop, WintonCardBlueBottom) // #1447B4 a #081D4E
                                        )
                                    )
                                    .padding(20.dp)
                            ) {
                                Column {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "Perfil de Impulsor",
                                            color = Color.White,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Icon(
                                            imageVector = Icons.Default.Star,
                                            contentDescription = "Impulsor",
                                            tint = WintonGold,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(14.dp))

                                    Text(
                                        text = "SALDO ACUMULADO",
                                        color = Color.White.copy(alpha = 0.7f),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        letterSpacing = 1.sp
                                    )

                                    Spacer(modifier = Modifier.height(4.dp))

                                    val totalBlue = (balance?.blueAvailable ?: 0.0) + (balance?.blueEscrow ?: 0.0)
                                    val boosterTotal = String.format(java.util.Locale.US, "%.2f", totalBlue)
                                    Text(
                                        text = "$boosterTotal BLUE iou",
                                        color = Color.White,
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }
                        }
                    } else {
                        // Panel BILLETERA: Tarjetas BLUE y RED
                        Column(modifier = Modifier.fillMaxWidth()) {
                            BlueBalanceCard(
                                availableBalance = balance?.blueAvailable ?: 0.0,
                                escrowBalance = balance?.blueEscrow ?: 0.0
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            RedBalanceCard(
                                debtBalance = balance?.redDebt ?: 0.0,
                                creditLimit = balance?.redLimit ?: 0.0,
                                availableCredit = balance?.redAvailable ?: 0.0
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // =============================================================
            // 6. ACCESOS DIRECTOS / MÓDULOS DE LA PLATAFORMA
            // =============================================================
            Text(
                text = "Módulos de la Plataforma",
                color = WintonTextWhite,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // Fila 1: Marketplace y Billetera Web3
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                DashboardModuleCard(
                    title = "Marketplace P2P",
                    subtitle = "Vende o Compra",
                    icon = Icons.Default.ShoppingBag,
                    iconTint = WintonCyan,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToMarketplace
                )

                DashboardModuleCard(
                    title = "Billetera Web3",
                    subtitle = "Estado de Cuenta",
                    icon = Icons.Default.AccountBalanceWallet,
                    iconTint = WintonGreen,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToAccountStatement
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Fila 2: Referidos y SOS Venezuela
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                DashboardModuleCard(
                    title = "Referidos",
                    subtitle = "Invita y Gana",
                    icon = Icons.Default.People,
                    iconTint = WintonGold,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToReferrals
                )

                DashboardModuleCard(
                    title = "SOS Venezuela",
                    subtitle = "Ayuda Humanitaria",
                    icon = Icons.Default.Warning,
                    iconTint = Color(0xFFEF4444),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToSos
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Fila 3: Donaciones Solidarias y Seguridad
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                DashboardModuleCard(
                    title = "Donaciones",
                    subtitle = "Causas y Fondos",
                    icon = Icons.Default.Favorite,
                    iconTint = WintonPink,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToSolidario
                )

                DashboardModuleCard(
                    title = "Seguridad",
                    subtitle = "Biometría y PIN",
                    icon = Icons.Default.Security,
                    iconTint = WintonPrimary,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToSecurity
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun DashboardModuleCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    iconTint: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .border(1.dp, WintonBorderSoft, RoundedCornerShape(14.dp))
            .clickable { onClick() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = WintonSurfaceDark) // #14245A
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(iconTint.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = iconTint,
                    modifier = Modifier.size(22.dp)
                )
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = title,
                    color = WintonTextWhite,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = subtitle,
                    color = WintonTextMuted,
                    fontSize = 11.sp
                )
            }
        }
    }
}
