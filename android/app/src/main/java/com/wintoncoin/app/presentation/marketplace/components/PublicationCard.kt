// ============================================================================
// WintonCoin Android — PublicationCard (Tarjeta de Publicación en Marketplace)
// ============================================================================
// [PRESENTATION LAYER] Tarjeta premium estilo Gleam / Dark Glassmorphism con
// soporte para badges de estado, calificaciones con estrellas, desglose de BLUEs
// y previsualización de imágenes segura.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Task
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.PublicationItem
import com.wintoncoin.app.domain.model.TaskAcceptanceStatus
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGold
import com.wintoncoin.app.presentation.theme.WintonGreen
import com.wintoncoin.app.presentation.theme.WintonPurple
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

@Composable
fun PublicationCard(
    publication: PublicationItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val numberFormat = DecimalFormat("#,##0.0000", DecimalFormatSymbols(Locale("es", "ES")))
    val standardFormat = DecimalFormat("#,##0.00", DecimalFormatSymbols(Locale("es", "ES")))

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1E293B).copy(alpha = 0.92f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Fila superior: Badge de tipo y Estado de usuario
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Badge de Tipo / Categoría
                when {
                    publication.isHumanitarianCause -> {
                        CategoryBadge(
                            text = "Winton Solidario",
                            icon = Icons.Default.Favorite,
                            containerColor = WintonGreen.copy(alpha = 0.2f),
                            contentColor = WintonGreen
                        )
                    }
                    publication.category == MarketplaceCategory.SELL -> {
                        CategoryBadge(
                            text = if (publication.isQuickSale) "Venta Rápida" else "Venta P2P",
                            icon = Icons.Default.ShoppingBag,
                            containerColor = WintonPurple.copy(alpha = 0.2f),
                            contentColor = Color(0xFFC084FC)
                        )
                    }
                    publication.isBoosterTask -> {
                        CategoryBadge(
                            text = "Tarea Booster (${publication.multiplier}x)",
                            icon = Icons.Default.Bolt,
                            containerColor = WintonGold.copy(alpha = 0.2f),
                            contentColor = WintonGold
                        )
                    }
                    else -> {
                        CategoryBadge(
                            text = "Tarea Comercial",
                            icon = Icons.Default.Task,
                            containerColor = WintonBlue.copy(alpha = 0.2f),
                            contentColor = Color(0xFF60A5FA)
                        )
                    }
                }

                // Badge de Estado del Usuario
                when (publication.userAcceptanceStatus) {
                    TaskAcceptanceStatus.PENDING_APPROVAL -> {
                        StatusBadge("Esperando Aprobación", Color(0xFFF59E0B))
                    }
                    TaskAcceptanceStatus.APPROVED -> {
                        StatusBadge("Aprobado • Por Realizar", Color(0xFF10B981))
                    }
                    TaskAcceptanceStatus.COMPLETED -> {
                        StatusBadge("En Revisión", Color(0xFF3B82F6))
                    }
                    TaskAcceptanceStatus.CONFIRMED_PAID -> {
                        StatusBadge("Pagado", Color(0xFF10B981))
                    }
                    TaskAcceptanceStatus.REJECTED -> {
                        StatusBadge("Rechazado", Color(0xFFEF4444))
                    }
                    else -> Unit
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Imagen (si existe)
            if (publication.imageUrls.isNotEmpty()) {
                AsyncImage(
                    model = publication.imageUrls.first(),
                    contentDescription = publication.title,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Título
            Text(
                text = publication.title,
                color = Color.White,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Descripción breve
            Text(
                text = publication.description,
                color = Color(0xFF94A3B8),
                fontSize = 13.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 18.sp
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Información de Autor y Calificación
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(WintonBlue, WintonPurple))),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = publication.authorUsername.take(1).uppercase(),
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = publication.authorUsername,
                    color = Color(0xFFCBD5E1),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )

                if (publication.authorRatingsCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = "Rating",
                            tint = WintonGold,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "${publication.authorRating} (${publication.authorRatingsCount})",
                            color = WintonGold,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Fila inferior: Recompensa / Meta y Cupos
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0F172A).copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (publication.isHumanitarianCause || publication.goalAmount > 0) {
                    Column {
                        Text(
                            text = "Recaudado",
                            color = Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                        Text(
                            text = "${standardFormat.format(publication.currentAmount)} / ${standardFormat.format(publication.goalAmount)} BLUE",
                            color = WintonGreen,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else {
                    Column {
                        Text(
                            text = if (publication.category == MarketplaceCategory.SELL) "Precio" else "Recompensa",
                            color = Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                        Text(
                            text = "${numberFormat.format(publication.blueCost)} BLUE",
                            color = WintonGold,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (publication.availableSlots > 0 && !publication.isHumanitarianCause) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Schedule,
                            contentDescription = "Cupos",
                            tint = Color(0xFF64748B),
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "${publication.availableSlots} cupo(s)",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryBadge(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    containerColor: Color,
    contentColor: Color
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = containerColor
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(13.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = text,
                color = contentColor,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun StatusBadge(
    text: String,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.15f),
        modifier = Modifier.border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
    ) {
        Text(
            text = text,
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}
