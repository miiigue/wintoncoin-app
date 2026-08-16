// ============================================================================
// WintonCoin Android — Modelo de Dominio de Resultado
// ============================================================================
// Wrapper genérico para manejar resultados de operaciones (éxito o error).
// Patrón estándar en Clean Architecture para comunicar entre capas.
//
// Analogía: Como un sobre de correo certificado — puede contener el documento
// solicitado (Success) o una notificación de que no se pudo entregar (Error).
// ============================================================================

package com.wintoncoin.app.domain.model

/**
 * Result — Envuelve el resultado de cualquier operación.
 *
 * @param T Tipo del dato en caso de éxito.
 */
sealed class Result<out T> {
    /**
     * La operación fue exitosa.
     * @param data Los datos resultantes de la operación.
     */
    data class Success<out T>(val data: T) : Result<T>()

    /**
     * La operación falló.
     * @param message Mensaje de error legible para el usuario.
     * @param code Código HTTP del error (ej: 401, 500) o null si es error local.
     */
    data class Error(
        val message: String,
        val code: Int? = null
    ) : Result<Nothing>()
}
