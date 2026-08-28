// ============================================================================
// WintonCoin Android — Design System (Tema Material 3 Idéntico a PWA)
// ============================================================================
// Configuración global del tema visual de WintonCoin.
// Replica fielmente el fondo noche #1a1a2e y tarjetas sapphire #14245a de style.css.
// ============================================================================

package com.wintoncoin.app.presentation.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val PwaColorScheme = darkColorScheme(
    primary = WintonPrimary,
    onPrimary = WintonTextWhite,
    primaryContainer = WintonCardBlueTop,
    onPrimaryContainer = WintonTextWhite,
    secondary = WintonGold,
    onSecondary = WintonBackgroundDark,
    background = WintonBackgroundDark, // #1A1A2E
    onBackground = WintonTextWhite,
    surface = WintonSurfaceDark, // #14245A
    onSurface = WintonTextWhite,
    error = WintonError,
    onError = WintonTextWhite
)

/**
 * Tema principal de la aplicación WintonCoin (Idéntico a PWA).
 */
@Composable
fun WintonCoinTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val activity = view.context as? Activity
            activity?.window?.let { window ->
                try {
                    WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
                } catch (e: Exception) {
                    // Ignore on unsupported ROMs
                }
            }
        }
    }

    MaterialTheme(
        colorScheme = PwaColorScheme,
        typography = Typography,
        content = content
    )
}
