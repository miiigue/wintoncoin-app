// ============================================================================
// WintonCoin Android — WintonWebViewContainer (Contenedor Seguro Nativo)
// ============================================================================
// [PRESENTATION LAYER] Componente declarativo en Jetpack Compose que renderiza
// el WebView hiper-optimizado de WintonCoin.
//
// Integra:
// - Aceleración por hardware GPU (60-120 fps).
// - Ajuste seguro de Insets de la Barra de Estado (statusBarsPadding).
// - Seguridad de grado bancario OWASP MASVS (Acceso a archivos deshabilitado).
// - Puente JavaScript nativo (WintonNativeBridge en window.AndroidNative).
// - Control del botón de retroceso nativo de Android.
// - Indicador visual de progreso de carga y pantalla de reintento offline.
// ============================================================================

package com.wintoncoin.app.presentation.container

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.fragment.app.FragmentActivity
import com.wintoncoin.app.BuildConfig
import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.bridge.WintonNativeBridge
import com.wintoncoin.app.core.bridge.WintonWebChromeClient
import com.wintoncoin.app.core.bridge.WintonWebViewClient
import com.wintoncoin.app.core.security.RootDetector
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.presentation.theme.WintonBackgroundDark
import com.wintoncoin.app.presentation.theme.WintonBorderSoft
import com.wintoncoin.app.presentation.theme.WintonPrimary
import com.wintoncoin.app.presentation.theme.WintonSurfaceDark
import com.wintoncoin.app.presentation.theme.WintonTextMuted
import com.wintoncoin.app.presentation.theme.WintonTextWhite
import java.lang.ref.WeakReference

/**
 * WintonWebViewContainer — Contenedor nativo ejecutable de la PWA oficial.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WintonWebViewContainer(
    biometricAuthManager: BiometricAuthManager,
    tokenManager: TokenManager,
    rootDetector: RootDetector,
    auditLogger: AuditLogger,
    targetUrl: String = if (BuildConfig.API_BASE_URL.contains("demo")) "https://demo.wintoncoin.com" else "https://wintoncoin.com",
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity

    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var loadProgress by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var hasError by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    // Interceptar el botón Atrás nativo de Android para navegar atrás en el historial del WebView
    BackHandler(enabled = webViewInstance?.canGoBack() == true && !hasError) {
        webViewInstance?.goBack()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(WintonBackgroundDark) // #1A1A2E (Azul Noche)
            .statusBarsPadding() // <- [UX MEJORA] Protege la UI de solaparse con la barra de notificaciones/hora del teléfono
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Barra de progreso de carga en la parte superior
            AnimatedVisibility(
                visible = isLoading && loadProgress < 100 && !hasError,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                LinearProgressIndicator(
                    progress = { loadProgress / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp),
                    color = WintonPrimary,
                    trackColor = Color.Transparent
                )
            }

            // Vista WebView encapsulada con SwipeRefreshLayout
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    val swipeLayout = androidx.swiperefreshlayout.widget.SwipeRefreshLayout(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        setColorSchemeColors(android.graphics.Color.parseColor("#4da6ff"))
                        setProgressBackgroundColorSchemeColor(android.graphics.Color.parseColor("#1A1A2E"))
                    }

                    val webView = WebView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )

                        // 1. Apariencia y Fondo
                        setBackgroundColor(AndroidColor.parseColor("#1A1A2E"))

                        // 2. Aceleración por Hardware GPU para 60-120 fps
                        setLayerType(View.LAYER_TYPE_HARDWARE, null)

                        // 3. Configuración Estricta de WebSettings (Seguridad Bancaria OWASP MASVS)
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            databaseEnabled = true
                            useWideViewPort = true
                            loadWithOverviewMode = true
                            setSupportZoom(false)
                            builtInZoomControls = false
                            displayZoomControls = false

                            // SEGURIDAD: Deshabilitar acceso a archivos locales peligrosos
                            allowFileAccess = false
                            allowContentAccess = false
                            allowFileAccessFromFileURLs = false
                            allowUniversalAccessFromFileURLs = false
                            setSupportMultipleWindows(false)

                            // User-Agent identificador oficial
                            userAgentString = "$userAgentString WintonCoinNativeApp/${BuildConfig.VERSION_NAME}"
                        }

                        // 3.5. Configuración de Cookies de Sesión y Soporte Multi-Dominio (Cross-Site Cookies)
                        // Imprescindible para preservar la sesión entre demo.wintoncoin.com y el backend en onrender.com
                        val cookieManager = android.webkit.CookieManager.getInstance()
                        cookieManager.setAcceptCookie(true)
                        cookieManager.setAcceptThirdPartyCookies(this, true)

                        // 4. Inyección del Puente Nativo JavaScript (window.AndroidNative)
                        if (activity != null) {
                            val bridge = WintonNativeBridge(
                                activityRef = WeakReference(activity),
                                webViewRef = WeakReference(this),
                                biometricAuthManager = biometricAuthManager,
                                tokenManager = tokenManager,
                                rootDetector = rootDetector,
                                auditLogger = auditLogger
                            )
                            addJavascriptInterface(bridge, WintonNativeBridge.JS_INTERFACE_NAME)
                        }

                        // 5. Configurar Clientes WebView & WebChrome
                        webViewClient = WintonWebViewClient(
                            onPageStartedCallback = {
                                isLoading = true
                                hasError = false
                            },
                            onPageFinishedCallback = {
                                isLoading = false
                                swipeLayout.isRefreshing = false
                                // Persistir inmediatamente las cookies de sesión en el almacenamiento flash
                                try {
                                    android.webkit.CookieManager.getInstance().flush()
                                } catch (e: Exception) {
                                    android.util.Log.w("WintonWebView", "Error al guardar cookies: ${e.message}")
                                }
                            },
                            onErrorCallback = { err ->
                                isLoading = false
                                hasError = true
                                errorMessage = err
                                swipeLayout.isRefreshing = false
                            }
                        )

                        webChromeClient = WintonWebChromeClient(
                            onProgressChangedCallback = { progress ->
                                loadProgress = progress
                                if (progress >= 100) {
                                    isLoading = false
                                    swipeLayout.isRefreshing = false
                                }
                            }
                        )

                        // 6. Cargar URL oficial
                        loadUrl(targetUrl)
                    }

                    swipeLayout.addView(webView)
                    swipeLayout.setOnRefreshListener {
                        webView.reload()
                    }

                    webViewInstance = webView
                    swipeLayout
                },
                update = {
                    // El SwipeRefreshLayout se actualiza, la instancia del webview se mantiene
                }
            )
        }

        // Vista de Error Offline / Sin Conexión
        if (hasError) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(WintonBackgroundDark)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, WintonBorderSoft, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = WintonSurfaceDark)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.WifiOff,
                            contentDescription = "Sin Conexión",
                            tint = WintonPrimary,
                            modifier = Modifier.size(56.dp)
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "Sin Conexión a la Red",
                            color = WintonTextWhite,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = if (errorMessage.isNotBlank()) errorMessage else "No se pudo conectar al servidor de WintonCoin. Verifica tu conexión a Internet e intentalo nuevamente.",
                            color = WintonTextMuted,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = {
                                hasError = false
                                isLoading = true
                                webViewInstance?.reload()
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = WintonPrimary)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Reintentar",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.size(8.dp))
                            Text(
                                text = "Reintentar Conexión",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }

    // Limpieza de recursos al destruir el composable
    DisposableEffect(Unit) {
        onDispose {
            try {
                android.webkit.CookieManager.getInstance().flush()
            } catch (e: Exception) {
                // Ignorar
            }
            webViewInstance?.run {
                stopLoading()
                removeJavascriptInterface(WintonNativeBridge.JS_INTERFACE_NAME)
                destroy()
            }
            webViewInstance = null
        }
    }
}
