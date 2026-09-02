// ============================================================================
// WintonCoin Android — WintonWebChromeClient (Cliente WebChrome & Permisos)
// ============================================================================
// [PRESENTATION / BRIDGE LAYER] Administra diálogos UI JavaScript, permisos de
// cámara/archivos para KYC/avatar y logs de consola.
// ============================================================================

package com.wintoncoin.app.core.bridge

import android.net.Uri
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView

/**
 * WintonWebChromeClient — Manejador de características avanzadas de UI web y consola.
 */
class WintonWebChromeClient(
    private val onProgressChangedCallback: (Int) -> Unit = {}
) : WebChromeClient() {

    companion object {
        private const val TAG = "WintonWebChromeClient"
    }

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        onProgressChangedCallback(newProgress)
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        if (consoleMessage == null) return false

        val level = consoleMessage.messageLevel()
        val message = consoleMessage.message()
        val sourceId = consoleMessage.sourceId()
        val lineNumber = consoleMessage.lineNumber()

        when (level) {
            ConsoleMessage.MessageLevel.ERROR -> Log.e(TAG, "[PWA_JS_ERROR] $message ($sourceId:$lineNumber)")
            ConsoleMessage.MessageLevel.WARNING -> Log.w(TAG, "[PWA_JS_WARN] $message ($sourceId:$lineNumber)")
            else -> Log.d(TAG, "[PWA_JS_LOG] $message")
        }

        return true
    }

    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ): Boolean {
        Log.d(TAG, "[FILE_CHOOSER] PWA solicitó selector de archivos/cámara")
        // Dejar que el sistema procese si se implementan intents de cámara
        return super.onShowFileChooser(webView, filePathCallback, fileChooserParams)
    }
}
