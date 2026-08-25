// ============================================================================
// WintonCoin Android — SosHubScreen
// ============================================================================
// [PRESENTATION LAYER / JETPACK COMPOSE] Pantalla principal del Portal SOS Venezuela.
// ============================================================================

package com.wintoncoin.app.presentation.sos.hub

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.VolunteerActivism
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun SosHubScreen(
    onNavigateBack: () -> Unit,
    onNavigateToVictimRegistration: () -> Unit,
    onNavigateToVolunteerRegistration: () -> Unit,
    viewModel: SosHubViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    LaunchedEffect(state.codeCopiedFeedback) {
        if (state.codeCopiedFeedback) {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Código SOS", state.campaignInfo.shareCode)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(context, "Código ${state.campaignInfo.shareCode} copiado al portapapeles", Toast.LENGTH_SHORT).show()
            viewModel.onEvent(SosHubEvent.ClearFeedback)
        }
    }

    Scaffold(
        topBar = {
            Surface(
                color = Color(0xFF0F172A),
                shadowElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 12.dp),
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
                        text = "SOS Venezuela 🇻🇪",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        },
        containerColor = Color(0xFF0B1120)
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(scrollState)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ── CINTA DE EMERGENCIA TRICOLOR ──────────────────────────────────
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        1.dp,
                        Brush.horizontalGradient(
                            listOf(Color(0xFFFBBF24), Color(0xFF2563EB), Color(0xFFDC2626))
                        ),
                        RoundedCornerShape(12.dp)
                    )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "🚨", fontSize = 24.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "EMERGENCIA HUMANITARIA",
                            color = Color(0xFFFBBF24),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = "Canalización de ayuda y brigadas de auxilio",
                            color = Color(0xFFE2E8F0),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ── TÍTULO Y SUBTÍTULO HERO ───────────────────────────────────────
            Text(
                text = "Ayudemos a Venezuela",
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Con el código oficial ${state.campaignInfo.shareCode}, la plataforma asigna ${state.campaignInfo.bonusBlue.toInt()} BLUE IOU a la cuenta receptora comunitaria @CadenaSOSVenezuela para víveres y rescate.",
                fontSize = 13.sp,
                color = Color(0xFF94A3B8),
                textAlign = TextAlign.Center,
                lineHeight = 18.sp,
                modifier = Modifier.padding(horizontal = 8.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ── CAJA DE CÓDIGO DE REFERIDO Y COMPARTIR ─────────────────────────
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "CÓDIGO DE CAMPAÑA OFICIAL",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF38BDF8),
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF0F172A))
                            .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
                            .clickable { viewModel.onEvent(SosHubEvent.CopyShareCode) }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = state.campaignInfo.shareCode,
                            color = Color(0xFFF43F5E),
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp,
                            letterSpacing = 1.sp
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = "Copiar",
                                tint = Color(0xFF38BDF8),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Copiar",
                                color = Color(0xFF38BDF8),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedButton(
                        onClick = {
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "🚨 Apoya a los damnificados en Venezuela con WintonCoin. Regístrate usando el código oficial ${state.campaignInfo.shareCode} y asignaremos 200 BLUE IOU a la cuenta @CadenaSOSVenezuela: https://demo.wintoncoin.com/sos-venezuela.html"
                                )
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Compartir Campaña SOS Venezuela"))
                        },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Compartir",
                            tint = Color(0xFF38BDF8),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Compartir por WhatsApp / Redes",
                            color = Color(0xFF38BDF8),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ── TARJETAS DE ACCIÓN PRINCIPALES ────────────────────────────────
            Text(
                text = "¿CÓMO DESEAS PARTICIPAR?",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF64748B),
                letterSpacing = 1.sp,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // TARJETA 1: DAMNIFICADO (SOY AFECTADO)
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFFE11D48).copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                    .clickable { onNavigateToVictimRegistration() }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFE11D48).copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = "Emergencia",
                            tint = Color(0xFFE11D48),
                            modifier = Modifier.size(28.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Soy Afectado / Censo SOS",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Registra tu situación, daños de vivienda o emergencia médica para canalizar asistencia.",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // TARJETA 2: VOLUNTARIADO (QUIERO SER VOLUNTARIO)
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF2563EB).copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                    .clickable { onNavigateToVolunteerRegistration() }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF2563EB).copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.VolunteerActivism,
                            contentDescription = "Voluntariado",
                            tint = Color(0xFF60A5FA),
                            modifier = Modifier.size(28.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Quiero ser Voluntario SOS",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Postúlate en brigadas médicas, rescate, logística, primeros auxilios o apoyo comunitario.",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ── SECCIÓN DE TRANSPARENCIA & AUDITORÍA FINTECH ───────────────────
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        imageVector = Icons.Default.HealthAndSafety,
                        contentDescription = "Seguridad",
                        tint = Color(0xFF10B981),
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Auditoría & Trazabilidad Inmutable",
                            color = Color(0xFF10B981),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Cada solicitud genera un código de expediente inteligente único (#SOS-VZLA o #VOL-VZLA) auditado en la base de datos con verificación criptográfica OTP.",
                            color = Color(0xFF64748B),
                            fontSize = 11.sp,
                            lineHeight = 15.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(30.dp))
        }
    }
}
