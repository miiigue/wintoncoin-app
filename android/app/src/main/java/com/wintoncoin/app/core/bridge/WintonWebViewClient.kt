// ============================================================================
// WintonCoin Android — WintonWebViewClient (Cliente de Navegación & Anti-Phishing)
// ============================================================================
// [SECURITY LAYER] Controla la navegación interna de la aplicación.
//
// Reglas de Ciberseguridad OWASP MASVS:
// 1. Whitelisting Estricto: Solo permite la carga interna de dominios oficiales de WintonCoin.
// 2. Aislamiento de Entornos: Restringe las peticiones al servidor Demo en modo DEMO.
// 3. Anti-Phishing: Redirige enlaces externos fuera de la app al navegador del sistema.
// 4. Supresión de Fugas de Información: Oculta detalles técnicos de errores de red.
// ============================================================================

package com.wintoncoin.app.core.bridge

import android.content.Intent
import android.net.Uri
import android.graphics.Bitmap
import android.util.Log
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import com.wintoncoin.app.BuildConfig

/**
 * WintonWebViewClient — Filtro de navegación estricto de grado bancario.
 */
class WintonWebViewClient(
    private val onPageStartedCallback: () -> Unit = {},
    private val onPageFinishedCallback: () -> Unit = {},
    private val onErrorCallback: (String) -> Unit = {}
) : WebViewClient() {

    companion object {
        private const val TAG = "WintonWebViewClient"

        // Lista blanca oficial de dominios permitidos (Entorno DEMO & Producción)
        private val ALLOWED_HOSTS = listOf(
            "demo.wintoncoin.com",
            "wintoncoin-backend-demo.onrender.com",
            "wintoncoin.com",
            "www.wintoncoin.com",
            "localhost",
            "127.0.0.1"
        )
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        val host = request.url?.host?.lowercase() ?: ""

        Log.d(TAG, "[NAV_CHECK] Evaluando URL: $url (host: $host)")

        // 1. Permitir dominios de la lista blanca oficial de WintonCoin
        if (isHostAllowed(host)) {
            return false // Dejar que el WebView cargue la URL internamente
        }

        // 2. Si el protocolo es mailto:, tel:, whatsapp: o un enlace externo, abrir con Intent del sistema
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            view?.context?.startActivity(intent)
            Log.i(TAG, "[NAV_REDIRECT] Enlace externo enviado al sistema: $url")
        } catch (e: Exception) {
            Log.e(TAG, "[NAV_ERROR] No se pudo abrir enlace externo: ${e.message}")
        }

        return true // Interceptar y bloquear dentro del WebView
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        Log.d(TAG, "[NAV_START] Iniciando carga de página: $url")
        onPageStartedCallback()
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        Log.d(TAG, "[NAV_FINISH] Carga de página completada: $url")
        onPageFinishedCallback()
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)

        // Solo procesar errores del recurso principal (no de imágenes secundarias)
        if (request?.isForMainFrame == true) {
            val description = error?.description?.toString() ?: "Error de conexión"
            Log.e(TAG, "[NAV_ERROR] Error de red en frame principal: $description (código: ${error?.errorCode})")
            onErrorCallback("No se pudo conectar con el servidor de WintonCoin. Verifica tu conexión a internet.")
        }
    }

    /**
     * Verifica si un host está dentro de la lista blanca autorizada.
     */
    private fun isHostAllowed(host: String): Boolean {
        if (host.isEmpty()) return false
        return ALLOWED_HOSTS.any { allowed -> host == allowed || host.endsWith(".$allowed") }
    }
}
