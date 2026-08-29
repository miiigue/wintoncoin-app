// ============================================================================
// WintonCoin Android — BoosterRepository (Contrato de Repositorio de Dominio)
// ============================================================================
// [DOMAIN LAYER / REPOSITORY CONTRACT] Define los métodos para la gestión de
// perfiles de impulsor, ladder de niveles y árbol de referidos.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.BoosterProfile
import com.wintoncoin.app.domain.model.ReferralNetworkData

interface BoosterRepository {

    /**
     * Obtiene el perfil enriquecido de impulsor del usuario autenticado actual.
     */
    suspend fun getMyBoosterProfile(): Result<BoosterProfile>

    /**
     * Obtiene el perfil público de impulsor de un usuario por su nombre de usuario.
     */
    suspend fun getUserBoosterProfile(username: String): Result<BoosterProfile>

    /**
     * Obtiene los datos de la red de referidos (código, enlace y miembros invitados).
     */
    suspend fun getReferralInfo(username: String): Result<ReferralNetworkData>
}
