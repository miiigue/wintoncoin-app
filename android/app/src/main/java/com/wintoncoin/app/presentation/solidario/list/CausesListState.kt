// ============================================================================
// WintonCoin Android — CausesListState
// ============================================================================
// [PRESENTATION / STATE] Estado UI para el explorador de causas solidarias.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.list

import com.wintoncoin.app.domain.model.HumanitarianCause

enum class CausesTab {
    APPROVED,   // Causas Aprobadas en Recaudación
    MY_CAUSES   // Mis Postulaciones
}

data class CausesListState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val selectedTab: CausesTab = CausesTab.APPROVED,
    val approvedCauses: List<HumanitarianCause> = emptyList(),
    val myCauses: List<HumanitarianCause> = emptyList(),
    val searchQuery: String = "",
    val errorMessage: String? = null
) {
    val displayedCauses: List<HumanitarianCause>
        get() {
            val list = if (selectedTab == CausesTab.APPROVED) approvedCauses else myCauses
            return if (searchQuery.isNotBlank()) {
                list.filter {
                    it.title.contains(searchQuery, ignoreCase = true) ||
                    (it.foundationName?.contains(searchQuery, ignoreCase = true) ?: false) ||
                    (it.creatorUsername?.contains(searchQuery, ignoreCase = true) ?: false)
                }
            } else {
                list
            }
        }
}
