// ============================================================================
// WintonCoin Android — AuditLogger (Sistema de Auditoría Local)
// ============================================================================
// [COMPLIANCE SOC 2] Registra eventos auditables de la aplicación.
// Todas las operaciones financieras, de autenticación y de seguridad
// se registran para trazabilidad y reproducibilidad.
//
// Analogía: Como la caja negra de un avión — registra todo lo que pasa
// para poder reconstruir la secuencia de eventos si algo sale mal.
// ============================================================================

package com.wintoncoin.app.core.audit

import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton

/**
 * AuditLogger — Sistema de logging auditable.
 *
 * Registra eventos con categoría, acción y metadata para cumplir
 * con estándares de auditoría bancaria/FinTech.
 *
 * En esta fase inicial, los logs se escriben en Logcat.
 * En fases futuras se enviarán al backend para persistencia permanente.
 */
@Singleton
class AuditLogger @Inject constructor() {

    companion object {
        private const val TAG = "WintonAudit"
    }

    /**
     * Categorías de eventos auditables.
     * Cada categoría agrupa eventos relacionados para facilitar filtrado.
     */
    enum class Category {
        AUTH,          // Eventos de autenticación (login, logout, refresh)
        TRANSACTION,   // Eventos financieros (transferencias, pagos)
        SECURITY,      // Eventos de seguridad (token expirado, root detectado)
        NAVIGATION,    // Navegación del usuario (pantallas visitadas)
        NETWORK,       // Eventos de red (errores, timeouts)
        USER_ACTION    // Acciones del usuario (publicar, votar, etc.)
    }

    /**
     * Registra un evento auditable.
     *
     * @param category Categoría del evento (AUTH, TRANSACTION, etc.)
     * @param action Acción específica (ej: "LOGIN_SUCCESS", "TOKEN_REFRESH")
     * @param details Detalles adicionales del evento (ej: "username=miguel123")
     * @param isError Si el evento es un error (se loguea como WARNING)
     */
    fun log(
        category: Category,
        action: String,
        details: String = "",
        isError: Boolean = false
    ) {
        // Formato auditable: [CATEGORÍA] ACCIÓN | detalles | timestamp
        val timestamp = System.currentTimeMillis()
        val message = "[${category.name}] $action | $details | ts=$timestamp"

        if (isError) {
            Log.w(TAG, message)
        } else {
            Log.i(TAG, message)
        }
    }

    /**
     * Registra un evento de autenticación exitoso.
     */
    fun logAuthSuccess(action: String, username: String) {
        log(Category.AUTH, action, "user=$username")
    }

    /**
     * Registra un fallo de autenticación.
     */
    fun logAuthFailure(action: String, reason: String) {
        log(Category.AUTH, action, "reason=$reason", isError = true)
    }

    /**
     * Registra un evento de seguridad.
     */
    fun logSecurityEvent(action: String, details: String = "") {
        log(Category.SECURITY, action, details)
    }
}
