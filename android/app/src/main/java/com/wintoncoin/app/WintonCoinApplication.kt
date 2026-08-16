// ============================================================================
// WintonCoin Android — WintonCoinApplication (Clase Application con Hilt)
// ============================================================================
// Punto de entrada principal del proceso de la aplicación Android.
// Anotado con @HiltAndroidApp para inicializar el contenedor de inyección de dependencias.
// ============================================================================

package com.wintoncoin.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * WintonCoinApplication — Punto de entrada global de la app.
 * Inicializa Hilt para la inyección de dependencias en toda la jerarquía.
 */
@HiltAndroidApp
class WintonCoinApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Inicialización global (Crash reporting, logging, etc.)
    }
}
