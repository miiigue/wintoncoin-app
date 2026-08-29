// ============================================================================
// WintonCoin Android — CreatePublicationViewModel
// ============================================================================
// [PRESENTATION LAYER / VIEWMODEL] Gestiona el estado reactivo del formulario
// de publicación, subida asíncrona de fotos a Cloudflare R2, y cálculo de precios.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.create

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.core.util.ImageCompressor
import com.wintoncoin.app.data.remote.dto.CreatePublicationRequest
import com.wintoncoin.app.data.remote.dto.CreateQuickSaleRequest
import com.wintoncoin.app.domain.usecase.CreatePublicationUseCase
import com.wintoncoin.app.domain.usecase.CreateQuickSaleUseCase
import com.wintoncoin.app.domain.usecase.GetBoosterMultiplierUseCase
import com.wintoncoin.app.domain.usecase.GetPlatformEconomicSettingsUseCase
import com.wintoncoin.app.domain.usecase.UploadMediaUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class CreatePublicationViewModel @Inject constructor(
    private val createPublicationUseCase: CreatePublicationUseCase,
    private val createQuickSaleUseCase: CreateQuickSaleUseCase,
    private val uploadMediaUseCase: UploadMediaUseCase,
    private val getBoosterMultiplierUseCase: GetBoosterMultiplierUseCase,
    private val getPlatformSettingsUseCase: GetPlatformEconomicSettingsUseCase,
    private val imageCompressor: ImageCompressor,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(CreatePublicationState())
    val state: StateFlow<CreatePublicationState> = _state.asStateFlow()

    init {
        loadPlatformEconomicContext()
    }

    fun onEvent(event: CreatePublicationEvent) {
        when (event) {
            is CreatePublicationEvent.TypeChanged -> {
                _state.update {
                    it.copy(
                        publicationType = event.type,
                        amountInput = "",
                        errorMessage = null
                    )
                }
                updateCostPreview()
                updateMaxImagesLimit(event.type)
            }
            is CreatePublicationEvent.TitleChanged -> _state.update { it.copy(title = event.title) }
            is CreatePublicationEvent.DescriptionChanged -> _state.update { it.copy(description = event.description) }
            is CreatePublicationEvent.AddStep -> {
                _state.update { it.copy(steps = it.steps + "") }
            }
            is CreatePublicationEvent.UpdateStep -> {
                val updatedSteps = _state.value.steps.toMutableList()
                if (event.index in updatedSteps.indices) {
                    updatedSteps[event.index] = event.text
                    _state.update { it.copy(steps = updatedSteps) }
                }
            }
            is CreatePublicationEvent.RemoveStep -> {
                val updatedSteps = _state.value.steps.toMutableList()
                if (event.index in updatedSteps.indices) {
                    updatedSteps.removeAt(event.index)
                    _state.update { it.copy(steps = updatedSteps) }
                }
            }
            is CreatePublicationEvent.AmountChanged -> {
                _state.update { it.copy(amountInput = event.amount) }
                updateCostPreview()
            }
            is CreatePublicationEvent.TargetUsernameChanged -> _state.update { it.copy(targetUsername = event.target) }
            is CreatePublicationEvent.BeneficiaryCodeChanged -> _state.update { it.copy(beneficiaryReferralCode = event.code) }
            is CreatePublicationEvent.AvailableSlotsChanged -> _state.update { it.copy(availableSlots = event.slots) }
            is CreatePublicationEvent.ToggleRequiresEvidence -> _state.update { it.copy(requiresEvidence = event.enabled) }
            is CreatePublicationEvent.ToggleAutoApprove -> _state.update { it.copy(autoApprove = event.enabled) }
            is CreatePublicationEvent.ToggleSetExpiration -> _state.update { it.copy(setExpiration = event.enabled) }
            is CreatePublicationEvent.DurationDaysChanged -> _state.update { it.copy(durationDays = event.days) }
            is CreatePublicationEvent.DurationHoursChanged -> _state.update { it.copy(durationHours = event.hours) }
            is CreatePublicationEvent.DurationMinutesChanged -> _state.update { it.copy(durationMinutes = event.minutes) }
            is CreatePublicationEvent.ToggleAllowRepeat -> _state.update { it.copy(allowRepeat = event.enabled) }
            is CreatePublicationEvent.MaxRepeatChanged -> _state.update { it.copy(maxRepeatPerUser = event.max) }
            is CreatePublicationEvent.RepeatCooldownDaysChanged -> _state.update { it.copy(repeatCooldownDays = event.days) }
            is CreatePublicationEvent.RepeatCooldownHoursChanged -> _state.update { it.copy(repeatCooldownHours = event.hours) }
            is CreatePublicationEvent.RepeatCooldownMinutesChanged -> _state.update { it.copy(repeatCooldownMinutes = event.minutes) }
            is CreatePublicationEvent.ImagesSelected -> handleImageSelection(event.uris, event.context)
            is CreatePublicationEvent.RemoveImage -> {
                val currentLocal = _state.value.localImageUris.toMutableList()
                val currentUploaded = _state.value.uploadedImageUrls.toMutableList()
                if (event.index in currentLocal.indices) currentLocal.removeAt(event.index)
                if (event.index in currentUploaded.indices) currentUploaded.removeAt(event.index)
                _state.update {
                    it.copy(
                        localImageUris = currentLocal,
                        uploadedImageUrls = currentUploaded
                    )
                }
            }
            is CreatePublicationEvent.Submit -> {
                if (_state.value.publicationType == "donation") {
                    _state.update { it.copy(showDonationConfirmDialog = true) }
                } else {
                    executePublicationSubmit()
                }
            }
            is CreatePublicationEvent.ConfirmDonation -> {
                _state.update { it.copy(showDonationConfirmDialog = false) }
                executePublicationSubmit()
            }
            is CreatePublicationEvent.DismissDonationDialog -> _state.update { it.copy(showDonationConfirmDialog = false) }
            is CreatePublicationEvent.DismissError -> _state.update { it.copy(errorMessage = null) }
            is CreatePublicationEvent.DismissSuccess -> _state.update { it.copy(isSuccess = false, successMessage = null) }
        }
    }

    private fun loadPlatformEconomicContext() {
        viewModelScope.launch {
            _state.update { it.copy(isSettingsLoading = true) }
            val multResult = getBoosterMultiplierUseCase()
            val multInfo = multResult.getOrNull()

            val settingsResult = getPlatformSettingsUseCase()
            val settings = settingsResult.getOrNull()

            _state.update {
                it.copy(
                    multiplier = multInfo?.multiplier ?: 1.0,
                    stageName = multInfo?.stageName ?: "Sin etapa activa",
                    isPreLaunch = settings?.preLaunchModeEnabled ?: true,
                    maxImagesAllowed = settings?.maxImagesRequest ?: 1,
                    isSettingsLoading = false
                )
            }
            updateCostPreview()
        }
    }

    private fun updateMaxImagesLimit(type: String) {
        viewModelScope.launch {
            val settings = getPlatformSettingsUseCase().getOrNull()
            val max = when (type) {
                "request" -> settings?.maxImagesRequest ?: 1
                "sell" -> settings?.maxImagesSell ?: 1
                "donation" -> settings?.maxImagesDonation ?: 3
                else -> 1
            }
            _state.update { it.copy(maxImagesAllowed = max) }
        }
    }

    private fun updateCostPreview() {
        val s = _state.value
        val amount = s.amountInput.replace(',', '.').toDoubleOrNull() ?: 0.0

        val preview = if (!s.isPreLaunch || s.publicationType == "quick_sale") {
            if (amount <= 0.0) {
                "Moneda: BLUE Real (Transacción directa sin multiplicador)"
            } else {
                val formatted = String.format(Locale("es", "ES"), "%.4f", amount)
                "Valor Nominal: $formatted BLUE (Transacción real on-chain)"
            }
        } else {
            if (amount <= 0.0) {
                "Multiplicador vigente: ${s.multiplier}x (${s.stageName})"
            } else {
                val total = amount * s.multiplier
                val baseFmt = String.format(Locale("es", "ES"), "%.4f", amount)
                val totalFmt = String.format(Locale("es", "ES"), "%.4f", total)
                "Valor Base: $baseFmt BLUE × ${s.multiplier}x (${s.stageName}) = Total Final: $totalFmt BLUE IOU"
            }
        }
        _state.update { it.copy(costPreviewText = preview) }
    }

    private fun handleImageSelection(uris: List<Uri>, context: Context) {
        if (uris.isEmpty()) return
        val currentCount = _state.value.localImageUris.size
        val allowedRemaining = _state.value.maxImagesAllowed - currentCount
        if (allowedRemaining <= 0) {
            _state.update { it.copy(errorMessage = "Has alcanzado el límite de ${_state.value.maxImagesAllowed} imágenes.") }
            return
        }

        val toProcess = uris.take(allowedRemaining)
        _state.update {
            it.copy(
                localImageUris = it.localImageUris + toProcess,
                isUploadingImages = true
            )
        }

        viewModelScope.launch {
            try {
                val parts = toProcess.map { uri ->
                    imageCompressor.compressAndCreateMultipart(context, uri)
                }
                val uploadResult = uploadMediaUseCase(parts)
                uploadResult.onSuccess { urls ->
                    _state.update {
                        it.copy(
                            uploadedImageUrls = it.uploadedImageUrls + urls,
                            isUploadingImages = false
                        )
                    }
                }.onFailure { err ->
                    _state.update {
                        it.copy(
                            isUploadingImages = false,
                            errorMessage = "Error al subir imágenes: ${err.message}"
                        )
                    }
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        isUploadingImages = false,
                        errorMessage = "Error al procesar imágenes: ${e.message}"
                    )
                }
            }
        }
    }

    private fun executePublicationSubmit() {
        val s = _state.value
        val username = tokenManager.getUsername() ?: ""

        if (username.isBlank()) {
            _state.update { it.copy(errorMessage = "Sesión no encontrada. Inicia sesión nuevamente.") }
            return
        }

        if (s.publicationType == "quick_sale") {
            val amount = s.amountInput.replace(',', '.').toDoubleOrNull() ?: 0.0
            val quickSaleReq = CreateQuickSaleRequest(
                title = s.title.ifBlank { "Venta Rápida" },
                amount = amount,
                authorUsername = username,
                targetUsername = s.targetUsername.ifBlank { null }
            )
            viewModelScope.launch {
                _state.update { it.copy(isLoading = true, errorMessage = null) }
                createQuickSaleUseCase(quickSaleReq)
                    .onSuccess { msg ->
                        _state.update { it.copy(isLoading = false, isSuccess = true, successMessage = msg) }
                    }
                    .onFailure { err ->
                        _state.update { it.copy(isLoading = false, errorMessage = err.message ?: "Error al crear la Venta Rápida.") }
                    }
            }
            return
        }

        // Formateo de descripción con pasos estructurados
        val finalDescription = if (s.publicationType == "request" && s.steps.any { it.isNotBlank() }) {
            val stepsText = s.steps.filter { it.isNotBlank() }
                .mapIndexed { idx, step -> "${idx + 1}. $step" }
                .joinToString("\n")
            "${s.description.trim()}\n\nInstrucciones paso a paso:\n$stepsText"
        } else {
            s.description.trim()
        }

        val amountVal = s.amountInput.replace(',', '.').toDoubleOrNull()
        val slots = s.availableSlots.toIntOrNull() ?: 1

        val request = CreatePublicationRequest(
            title = s.title.trim(),
            description = finalDescription,
            authorUsername = username,
            publicationType = s.publicationType,
            blueCost = if (s.publicationType == "request") amountVal else null,
            blueSell = if (s.publicationType == "sell") amountVal else null,
            goalAmount = if (s.publicationType == "donation") amountVal else null,
            availableSlots = if (s.publicationType == "donation") 999999 else slots,
            autoApprove = s.autoApprove,
            requiresEvidence = s.requiresEvidence,
            imageUrls = s.uploadedImageUrls,
            durationDays = if (s.setExpiration) s.durationDays.toIntOrNull() ?: 0 else null,
            durationHours = if (s.setExpiration) s.durationHours.toIntOrNull() ?: 0 else null,
            durationMinutes = if (s.setExpiration) s.durationMinutes.toIntOrNull() ?: 0 else null,
            allowRepeatParticipation = s.allowRepeat,
            maxRepeatPerUser = if (s.allowRepeat) s.maxRepeatPerUser.toIntOrNull() ?: 2 else 1,
            repeatCooldownDays = if (s.allowRepeat) s.repeatCooldownDays.toIntOrNull() ?: 0 else null,
            repeatCooldownHours = if (s.allowRepeat) s.repeatCooldownHours.toIntOrNull() ?: 0 else null,
            repeatCooldownMinutes = if (s.allowRepeat) s.repeatCooldownMinutes.toIntOrNull() ?: 12 else null,
            beneficiaryReferralCode = if (s.publicationType == "donation") s.beneficiaryReferralCode.trim().uppercase(Locale.ROOT) else null
        )

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            createPublicationUseCase(request)
                .onSuccess { msg ->
                    _state.update { it.copy(isLoading = false, isSuccess = true, successMessage = msg) }
                }
                .onFailure { err ->
                    _state.update { it.copy(isLoading = false, errorMessage = err.message ?: "Error al publicar.") }
                }
        }
    }
}
