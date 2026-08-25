// ============================================================================
// WintonCoin Android — DashboardScreen (Pantalla Principal del Usuario)
// ============================================================================
// [PRESENTATION LAYER] Dashboard principal autenticado con tarjetas de saldo
// BLUE & RED en tiempo real, accesos directos y navegación fluida.
// ============================================================================

package com.wintoncoin.app.presentation.dashboard

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
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
import com.wintoncoin.app.presentation.components.WintonButton
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonPurple
import com.wintoncoin.app.presentation.wallet.BlueBalanceCard
import com.wintoncoin.app.presentation.wallet.RedBalanceCard
import com.wintoncoin.app.presentation.wallet.WalletEvent
import com.wintoncoin.app.presentation.wallet.WalletViewModel

import androidx.compose.foundation.BorderStroke
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Star

@Composable
fun DashboardScreen(
    username: String?,
    walletViewModel: WalletViewModel,
    onNavigateToWallet: () -> Unit,
    onNavigateToAccountStatement: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToSolidario: () -> Unit = {},
    onNavigateToSos: () -> Unit = {},
    onNavigateToMarketplace: () -> Unit,
    onNavigateToProfile: (String) -> Unit,
    onNavigateToBooster: () -> Unit,
    onNavigateToReferrals: () -> Unit,
    onLogout: () -> Unit
) {
    val walletState by walletViewModel.state.collectAsStateWithLifecycle()
    val balance = walletState.balance

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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header con Saludo y Accesos Rápidos
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(WintonBlue, WintonPurple))),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (username ?: "U").take(1).uppercase(),
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Hola,",
                            color = Color.LightGray,
                            fontSize = 13.sp
                        )
                        Text(
                            text = username ?: "Usuario",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Notificaciones",
                            tint = WintonGold
                        )
                    }
                    IconButton(onClick = { walletViewModel.onEvent(WalletEvent.Refresh) }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refrescar",
                            tint = Color.LightGray
                        )
                    }
                    IconButton(onClick = onLogout) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Logout,
                            contentDescription = "Cerrar Sesión",
                            tint = Color(0xFFFDA4AF)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            if (walletState.isLoading && balance == null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = WintonGold)
                }
            } else {
                // Tarjeta BLUE Líquido
                BlueBalanceCard(
                    availableBalance = balance?.blueAvailable ?: 0.0,
                    escrowBalance = balance?.blueEscrow ?: 0.0
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Tarjeta RED Compromiso
                RedBalanceCard(
                    debtBalance = balance?.redDebt ?: 0.0,
                    creditLimit = balance?.redLimit ?: 0.0,
                    availableCredit = balance?.redAvailable ?: 0.0
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Acciones Rápidas del Dashboard
                Text(
                    text = "Acciones Principales",
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                // Tarjeta Destacada de Marketplace
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Brush.linearGradient(
                            listOf(Color(0xFF1E293B), Color(0xFF0F172A))
                        ).let { Color(0xFF1E293B) }
                    ),
                    onClick = onNavigateToMarketplace
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(WintonBlue.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Security,
                                    contentDescription = "Marketplace",
                                    tint = Color(0xFF60A5FA),
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    text = "Marketplace de Tareas",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Gana BLUEs postulándote a tareas P2P",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = WintonGold.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "Explorar",
                                color = WintonGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                        onClick = onNavigateToWallet
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountBalanceWallet,
                                contentDescription = "Billetera",
                                tint = WintonGold,
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Mi Billetera",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                        onClick = { onNavigateToProfile(username ?: "") }
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = "Perfil",
                                tint = Color(0xFF60A5FA),
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Mi Perfil",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                        onClick = onNavigateToBooster
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "Impulsores",
                                tint = WintonGold,
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Impulsores",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                        onClick = onNavigateToReferrals
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.People,
                                contentDescription = "Referidos",
                                tint = Color(0xFF6366F1),
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Mis Referidos",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Tarjeta de Estado de Cuenta Web3
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                    onClick = onNavigateToAccountStatement
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(WintonGreen.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Description,
                                    contentDescription = "Estado de Cuenta",
                                    tint = WintonGreen,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    text = "Estado de Cuenta Web3",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Auditoría de Smart Contracts y Ledger",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = WintonGreen.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "Auditar",
                                color = WintonGreen,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Acceso a Centro de Notificaciones & Alertas
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.3f)),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                    onClick = onNavigateToNotifications
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFF38BDF8).copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Notifications,
                                    contentDescription = "Centro de Notificaciones",
                                    tint = Color(0xFF38BDF8),
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    text = "Centro de Notificaciones",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Alertas de pagos, tareas y sistema",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFF38BDF8).copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "Ver",
                                color = Color(0xFF38BDF8),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Acceso a WintonCoin Solidario ❤️
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFFFB7185).copy(alpha = 0.3f)),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                    onClick = onNavigateToSolidario
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFFFB7185).copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = "WintonCoin Solidario",
                                    tint = Color(0xFFFB7185),
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    text = "WintonCoin Solidario ❤️",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Causas comunitarias y donaciones",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFFB7185).copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "Apoyar",
                                color = Color(0xFFFB7185),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Acceso a SOS Venezuela 🇻🇪
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFFFBBF24).copy(alpha = 0.4f)),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f)),
                    onClick = onNavigateToSos
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFFFBBF24).copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "🇻🇪", fontSize = 22.sp)
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    text = "SOS Venezuela 🇻🇪",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Censo Damnificados y Voluntarios",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFFBBF24).copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "Acceder",
                                color = Color(0xFFFBBF24),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(30.dp))
        }
    }
}
