// ============================================================================
// WintonCoin Android — ReferralsScreen (Pantalla de Red de Referidos)
// ============================================================================
// [PRESENTATION / COMPOSE UI] Visualización y compartición del código único de
// referido, métricas de red y listado reactivo de usuarios afiliados con KYC.
// ============================================================================

package com.wintoncoin.app.presentation.referrals

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wintoncoin.app.domain.model.ReferralNetworkData
import com.wintoncoin.app.domain.model.ReferredMember
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonGreen
import java.util.Locale

private val DarkBackground = Color(0xFF0F172A)
private val DarkSurface = Color(0xFF1E293B)
private val DarkCard = Color(0xFF0B1120)
private val ElectricBlue = Color(0xFF38BDF8)
private val AmberWarning = Color(0xFFF59E0B)
private val PurpleIndigo = Color(0xFF6366F1)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferralsScreen(
    onNavigateBack: () -> Unit,
    viewModel: ReferralsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(state.copyFeedback) {
        state.copyFeedback?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onEvent(ReferralsEvent.DismissCopyFeedback)
        }
    }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onEvent(ReferralsEvent.DismissError)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Mis Referidos",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.onEvent(ReferralsEvent.Refresh) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = DarkBackground
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                state.isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ElectricBlue)
                    }
                }
                state.referralData == null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No se pudo cargar la información de referidos.", color = Color.White.copy(alpha = 0.7f))
                    }
                }
                else -> {
                    ReferralsContent(
                        data = state.referralData!!,
                        onCopyCode = { code ->
                            copyToClipboard(context, code, "Código de Referido")
                            viewModel.onEvent(ReferralsEvent.CopyText(code, "Código de referido"))
                        },
                        onCopyLink = { link ->
                            copyToClipboard(context, link, "Enlace de Referido")
                            viewModel.onEvent(ReferralsEvent.CopyText(link, "Enlace de referido"))
                        },
                        onShareLink = { link, code ->
                            shareReferralLink(context, link, code)
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ReferralsContent(
    data: ReferralNetworkData,
    onCopyCode: (String) -> Unit,
    onCopyLink: (String) -> Unit,
    onShareLink: (String, String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Tarjeta de Código de Referido y Compartición
        item {
            ReferralCodeCard(
                code = data.referralCode,
                link = data.referralLink,
                onCopyCode = onCopyCode,
                onCopyLink = onCopyLink,
                onShareLink = onShareLink
            )
        }

        // 2. Resumen de Métricas de Red
        item {
            ReferralSummaryCards(data = data)
        }

        // 3. Encabezado de Lista de Referidos
        item {
            Text(
                text = "Usuarios Referidos por Ti (${data.totalReferredCount})",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        // 4. Lista de Referidos
        if (data.referredUsers.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(CircleShape)
                                .background(PurpleIndigo.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.People, contentDescription = null, tint = PurpleIndigo)
                        }
                        Text(
                            text = "Aún no has referido a ningún usuario.",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            text = "¡Comparte tu código o enlace con tus amigos para ganar recompensas y subir de nivel de impulsor!",
                            color = Color.White.copy(alpha = 0.65f),
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(data.referredUsers, key = { it.username + it.registrationDate }) { user ->
                ReferredUserCard(user = user)
            }
        }
    }
}

@Composable
private fun ReferralCodeCard(
    code: String,
    link: String,
    onCopyCode: (String) -> Unit,
    onCopyLink: (String) -> Unit,
    onShareLink: (String, String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, PurpleIndigo.copy(alpha = 0.4f))
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "Tu Código de Referido",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )

            // Código en grande
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(PurpleIndigo.copy(alpha = 0.15f))
                    .padding(horizontal = 24.dp, vertical = 12.dp)
            ) {
                Text(
                    text = code.ifBlank { "SIN CÓDIGO" },
                    color = ElectricBlue,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 24.sp,
                    letterSpacing = 2.sp
                )
            }

            Text(
                text = "Comparte este código o enlace. Cuando tus amigos se registren, ¡ambos recibirán recompensas!",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )

            // Botones de acción
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onCopyCode(code) },
                    colors = ButtonDefaults.buttonColors(containerColor = WintonBlue),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Copiar Código", fontSize = 12.sp)
                }

                Button(
                    onClick = { onShareLink(link, code) },
                    colors = ButtonDefaults.buttonColors(containerColor = PurpleIndigo),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Compartir", fontSize = 12.sp)
                }
            }

            OutlinedButton(
                onClick = { onCopyLink(link) },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Copiar Enlace de Registro", color = ElectricBlue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun ReferralSummaryCards(data: ReferralNetworkData) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Card(
            modifier = Modifier.weight(1f),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Total Invitados", color = Color.White.copy(alpha = 0.65f), fontSize = 11.sp)
                Text("${data.totalReferredCount}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }

        Card(
            modifier = Modifier.weight(1f),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Verificados (KYC)", color = Color.White.copy(alpha = 0.65f), fontSize = 11.sp)
                Text("${data.kycVerifiedCount}", color = WintonGreen, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }

        Card(
            modifier = Modifier.weight(1f),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("BLUE IOU Total", color = Color.White.copy(alpha = 0.65f), fontSize = 11.sp)
                Text(format4Decimals(data.totalBoosterBlueGenerated), color = ElectricBlue, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
    }
}

@Composable
private fun ReferredUserCard(user: ReferredMember) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (user.kycVerified) {
                    Icon(Icons.Default.CheckCircle, contentDescription = "KYC Aprobado", tint = WintonGreen, modifier = Modifier.size(22.dp))
                } else {
                    Icon(Icons.Default.HourglassTop, contentDescription = "KYC Pendiente", tint = AmberWarning, modifier = Modifier.size(22.dp))
                }

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = user.username.ifBlank { "Usuario" },
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "Registrado: ${formatShortDate(user.registrationDate)}",
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 11.sp
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "${format4Decimals(user.totalBoosterBlue)} BLUE IOU",
                    color = if (user.kycVerified) WintonGreen else AmberWarning,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
                Text(
                    text = if (user.kycVerified) "KYC Aprobado" else "KYC Pendiente",
                    color = if (user.kycVerified) WintonGreen.copy(alpha = 0.8f) else AmberWarning.copy(alpha = 0.8f),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

private fun copyToClipboard(context: Context, text: String, label: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText(label, text)
    clipboard.setPrimaryClip(clip)
}

private fun shareReferralLink(context: Context, link: String, code: String) {
    val sendIntent = Intent().apply {
        action = Intent.ACTION_SEND
        putExtra(Intent.EXTRA_TEXT, "¡Únete a WintonCoin y gana recompensas! Usa mi código de referido $code o regístrate en: $link")
        type = "text/plain"
    }
    val shareIntent = Intent.createChooser(sendIntent, "Invitar amigos a WintonCoin")
    context.startActivity(shareIntent)
}

private fun format4Decimals(value: Double): String {
    return String.format(Locale("es", "ES"), "%.4f", value)
}

private fun formatShortDate(isoString: String): String {
    return try {
        isoString.take(10)
    } catch (e: Exception) {
        isoString
    }
}
