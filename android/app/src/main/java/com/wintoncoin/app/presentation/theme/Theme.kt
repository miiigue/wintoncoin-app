// ============================================================================
// WintonCoin Android — Design System (Tema Material 3)
// ============================================================================
// Define la configuración global del tema visual de WintonCoin.
// Soporta esquemas de color claro y oscuro con contraste accesible y Edge-to-Edge.
// ============================================================================

package com.wintoncoin.app.presentation.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = WintonBlueLighter,
    onPrimary = WintonTextOnPrimary,
    primaryContainer = WintonBlueDark,
    onPrimaryContainer = WintonTextOnPrimary,
    secondary = WintonPurple,
    onSecondary = WintonTextOnPrimary,
    background = WintonSurfaceDark,
    onBackground = WintonTextOnPrimary,
    surface = WintonCardDark,
    onSurface = WintonTextOnPrimary,
    error = WintonError,
    onError = WintonTextOnPrimary
)

private val LightColorScheme = lightColorScheme(
    primary = WintonBlue,
    onPrimary = WintonTextOnPrimary,
    primaryContainer = WintonBlueLighter,
    onPrimaryContainer = WintonBlueDark,
    secondary = WintonPurple,
    onSecondary = WintonTextOnPrimary,
    background = WintonSurfaceLight,
    onBackground = WintonTextPrimary,
    surface = WintonCardLight,
    onSurface = WintonTextPrimary,
    error = WintonError,
    onError = WintonTextOnPrimary
)

/**
 * Tema principal de la aplicación WintonCoin.
 */
@Composable
fun WintonCoinTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val activity = view.context as? Activity
            activity?.window?.let { window ->
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
