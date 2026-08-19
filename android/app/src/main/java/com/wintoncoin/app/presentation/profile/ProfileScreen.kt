// ============================================================================
// WintonCoin Android — ProfileScreen (Pantalla de Perfil de Usuario)
// ============================================================================
// [PRESENTATION LAYER] Interfaz declarativa en Jetpack Compose que replica
// fielmente profile.html + profile.js de la PWA (Reputación P2P, desglose de
// estrellas, billetera, caso SOS Venezuela y comentarios).
// ============================================================================

package com.wintoncoin.app.presentation.profile

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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.Rating
import com.wintoncoin.app.domain.model.RatingBreakdown
import com.wintoncoin.app.domain.model.SosCase
import com.wintoncoin.app.domain.model.UserProfile
import com.wintoncoin.app.presentation.components.WintonAlertDialog
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonPurple

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val clipboardManager = LocalClipboardManager.current

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
            // Header Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Volver",
                        tint = Color.White
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Perfil de Usuario",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            if (state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = WintonGold)
                }
            } else if (state.profile != null) {
                val profile = state.profile!!

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // 1. Tarjeta Principal de Usuario
                    item {
                        ProfileHeaderCard(profile = profile, onCopyWallet = { address ->
                            clipboardManager.setText(AnnotatedString(address))
                        })
                    }

                    // 2. Sección Caso SOS Venezuela (Si aplica para el usuario logueado)
                    if (profile.sosCase != null) {
                        item {
                            SosCaseCard(sosCase = profile.sosCase!!)
                        }
                    }

                    // 3. Desglose de Reputación y Estrellas
                    item {
                        ReputationBreakdownCard(
                            averageRating = profile.averageRating,
                            totalRatings = profile.totalRatings,
                            breakdown = profile.ratingBreakdown
                        )
                    }

                    // 4. Lista de Calificaciones y Comentarios
                    item {
                        Text(
                            text = "Calificaciones y Comentarios (${profile.ratings.size})",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                        )
                    }

                    if (profile.ratings.isEmpty()) {
                        item {
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0xFF1E293B).copy(alpha = 0.8f)
                            ) {
                                Text(
                                    text = "Este usuario aún no tiene calificaciones recibidas.",
                                    color = Color.Gray,
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(20.dp)
                                )
                            }
                        }
                    } else {
                        items(profile.ratings) { rating ->
                            RatingItemCard(rating = rating)
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(24.dp))
                    }
                }
            }
        }

        if (state.errorMessage != null) {
            WintonAlertDialog(
                title = "Error al Cargar Perfil",
                message = state.errorMessage!!,
                onDismiss = { viewModel.onEvent(ProfileEvent.DismissError) }
            )
        }
    }
}

@Composable
private fun ProfileHeaderCard(
    profile: UserProfile,
    onCopyWallet: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f))
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Avatar con inicial
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .clip(CircleShape)
                    .background(
                        brush = Brush.linearGradient(listOf(WintonBlue, WintonPurple))
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = profile.username.take(1).uppercase(),
                    color = Color.White,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = profile.username,
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Badges de Verificación
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (profile.isVerified) {
                    Surface(
                        color = WintonGreen.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = "Verificado",
                                tint = WintonGreen,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Verificado", color = WintonGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                if (profile.kycVerified) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        color = WintonGold.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Security,
                                contentDescription = "KYC",
                                tint = WintonGold,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "KYC Nivel 1", color = WintonGold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Dirección de Billetera
            if (!profile.walletAddress.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(16.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFF0F172A)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${profile.walletAddress.take(8)}...${profile.walletAddress.takeLast(6)}",
                            color = Color.LightGray,
                            fontSize = 13.sp
                        )
                        IconButton(
                            onClick = { onCopyWallet(profile.walletAddress) },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = "Copiar Billetera",
                                tint = WintonGold,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SosCaseCard(sosCase: SosCase) {
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
                    text = "📋 Mi Expediente SOS Venezuela",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    color = if (sosCase.status == "approved") WintonGreen.copy(alpha = 0.2f) else WintonGold.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = if (sosCase.status == "approved") "Aprobado" else "En Revisión",
                        color = if (sosCase.status == "approved") WintonGreen else WintonGold,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            if (!sosCase.fullName.isNullOrBlank()) {
                Text(text = "Titular: ${sosCase.fullName}", color = Color.LightGray, fontSize = 13.sp)
            }
            if (!sosCase.cedula.isNullOrBlank()) {
                Text(text = "Cédula: ${sosCase.cedula}", color = Color.LightGray, fontSize = 13.sp)
            }
            Text(text = "Familiares a cargo: ${sosCase.affectedFamilyCount}", color = Color.LightGray, fontSize = 13.sp)

            if (!sosCase.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Afectación: ${sosCase.description}",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 13.sp
                )
            }
        }
    }
}

@Composable
private fun ReputationBreakdownCard(
    averageRating: Double,
    totalRatings: Int,
    breakdown: RatingBreakdown?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.95f))
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = "Reputación en la Plataforma",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Score Promedio
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.width(100.dp)
                ) {
                    Text(
                        text = String.format("%.1f", averageRating),
                        color = Color.White,
                        fontSize = 40.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Row {
                        repeat(5) { index ->
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = if (index < averageRating.toInt()) WintonGold else Color.Gray,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                    Text(
                        text = "$totalRatings calificaciones",
                        color = Color.Gray,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                // Barras de progreso de estrellas
                Column(modifier = Modifier.weight(1f)) {
                    val b = breakdown ?: RatingBreakdown()
                    val total = if (totalRatings > 0) totalRatings.toFloat() else 1f

                    StarProgressBar(stars = 5, count = b.stars5, progress = b.stars5 / total)
                    StarProgressBar(stars = 4, count = b.stars4, progress = b.stars4 / total)
                    StarProgressBar(stars = 3, count = b.stars3, progress = b.stars3 / total)
                    StarProgressBar(stars = 2, count = b.stars2, progress = b.stars2 / total)
                    StarProgressBar(stars = 1, count = b.stars1, progress = b.stars1 / total)
                }
            }
        }
    }
}

@Composable
private fun StarProgressBar(stars: Int, count: Int, progress: Float) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = "$stars★", color = Color.LightGray, fontSize = 11.sp, modifier = Modifier.width(22.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .weight(1f)
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = WintonGold,
            trackColor = Color(0xFF334155)
        )
        Text(
            text = "$count",
            color = Color.Gray,
            fontSize = 11.sp,
            modifier = Modifier.width(28.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.End
        )
    }
}

@Composable
private fun RatingItemCard(rating: Rating) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = Color(0xFF1E293B).copy(alpha = 0.9f)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = rating.raterUsername,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Row {
                    repeat(5) { index ->
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = if (index < rating.rating) WintonGold else Color.Gray,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }

            if (!rating.comment.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = rating.comment,
                    color = Color.LightGray,
                    fontSize = 13.sp
                )
            }
        }
    }
}
