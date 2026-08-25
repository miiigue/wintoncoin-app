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
import com.wintoncoin.app.data.repository.MarketplaceRepositoryImpl
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import com.wintoncoin.app.data.repository.BoosterRepositoryImpl
import com.wintoncoin.app.domain.repository.BoosterRepository
import com.wintoncoin.app.data.repository.AccountStatementRepositoryImpl
import com.wintoncoin.app.domain.repository.AccountStatementRepository
import com.wintoncoin.app.data.repository.NotificationRepositoryImpl
import com.wintoncoin.app.domain.repository.NotificationRepository
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

    @Binds
    @Singleton
    abstract fun bindMarketplaceRepository(impl: MarketplaceRepositoryImpl): MarketplaceRepository

    @Binds
    @Singleton
    abstract fun bindBoosterRepository(impl: BoosterRepositoryImpl): BoosterRepository

    @Binds
    @Singleton
    abstract fun bindAccountStatementRepository(impl: AccountStatementRepositoryImpl): AccountStatementRepository

    @Binds
    @Singleton
    abstract fun bindNotificationRepository(impl: NotificationRepositoryImpl): NotificationRepository
}
