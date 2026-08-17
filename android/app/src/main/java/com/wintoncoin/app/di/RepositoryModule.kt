// ============================================================================
// WintonCoin Android — RepositoryModule (Módulo Hilt de Repositorios)
// ============================================================================
// Vincula las interfaces de dominio con sus implementaciones concretas.
// ============================================================================

package com.wintoncoin.app.di

import com.wintoncoin.app.data.repository.AuthRepositoryImpl
import com.wintoncoin.app.data.repository.ProfileRepositoryImpl
import com.wintoncoin.app.data.repository.WalletRepositoryImpl
import com.wintoncoin.app.domain.repository.AuthRepository
import com.wintoncoin.app.domain.repository.ProfileRepository
import com.wintoncoin.app.domain.repository.WalletRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindProfileRepository(impl: ProfileRepositoryImpl): ProfileRepository

    @Binds
    @Singleton
    abstract fun bindWalletRepository(impl: WalletRepositoryImpl): WalletRepository
}
