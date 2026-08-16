// ============================================================================
// WintonCoin Android — RepositoryModule (Módulo Hilt de Repositorios)
// ============================================================================
// Vincula las interfaces de dominio con sus implementaciones concretas.
// Hilt usa esto para saber qué clase inyectar cuando alguien pide AuthRepository.
// ============================================================================

package com.wintoncoin.app.di

import com.wintoncoin.app.data.repository.AuthRepositoryImpl
import com.wintoncoin.app.domain.repository.AuthRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * RepositoryModule — Vincula interfaces de dominio con implementaciones.
 *
 * Cuando un ViewModel pide `AuthRepository`, Hilt inyecta `AuthRepositoryImpl`.
 * Esto permite cambiar la implementación (ej: para testing con mocks)
 * sin modificar el código que la consume.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    /**
     * Vincula AuthRepository (interfaz) → AuthRepositoryImpl (implementación).
     */
    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository
}
