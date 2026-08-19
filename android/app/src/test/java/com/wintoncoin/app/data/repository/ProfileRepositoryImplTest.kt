// ============================================================================
// WintonCoin Android — ProfileRepositoryImplTest (Prueba Unitaria)
// ============================================================================
// [UNIT TEST] Evalúa la deserialización y mapeo de datos de ProfileRepositoryImpl.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.ProfileApiService
import com.wintoncoin.app.data.remote.dto.ProfileRatingDto
import com.wintoncoin.app.data.remote.dto.ProfileResponseDto
import com.wintoncoin.app.data.remote.dto.ProfileUserDto
import com.wintoncoin.app.data.remote.dto.RatingBreakdownDto
import com.wintoncoin.app.data.remote.dto.SosCaseDetailDto
import com.wintoncoin.app.data.remote.dto.SosCaseResponseDto
import com.wintoncoin.app.domain.model.Result
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class ProfileRepositoryImplTest {

    private val profileApiService: ProfileApiService = mockk()
    private lateinit var repository: ProfileRepositoryImpl

    @Before
    fun setUp() {
        repository = ProfileRepositoryImpl(profileApiService)
    }

    @Test
    fun `getProfile success maps DTO to domain UserProfile`() = runTest {
        val breakdown = RatingBreakdownDto(stars5 = 10, stars4 = 2, stars3 = 0, stars2 = 0, stars1 = 0)
        val userDto = ProfileUserDto(
            username = "miguel_123",
            isVerified = true,
            kycVerified = true,
            walletAddress = "0x1234567890abcdef1234567890abcdef12345678",
            averageRating = 4.8,
            totalRatings = 12,
            ratingBreakdown = breakdown
        )
        val ratings = listOf(
            ProfileRatingDto(id = 1, raterUsername = "evaluator", rating = 5, comment = "Excelente servicio")
        )
        val responseDto = ProfileResponseDto(user = userDto, ratings = ratings)

        coEvery { profileApiService.getUserProfile("miguel_123") } returns Response.success(responseDto)

        val result = repository.getProfile("miguel_123")

        assertTrue(result is Result.Success)
        val profile = (result as Result.Success).data
        assertEquals("miguel_123", profile.username)
        assertTrue(profile.isVerified)
        assertTrue(profile.kycVerified)
        assertEquals(4.8, profile.averageRating, 0.01)
        assertEquals(12, profile.totalRatings)
        assertEquals(1, profile.ratings.size)
        assertEquals("evaluator", profile.ratings[0].raterUsername)
    }

    @Test
    fun `getMySosCase with active case returns domain SosCase`() = runTest {
        val caseDto = SosCaseDetailDto(
            fullName = "Miguel",
            cedula = "V-12345678",
            phone = "+584121234567",
            status = "approved",
            affectedFamilyCount = 3,
            description = "Afectación por lluvias"
        )
        val responseDto = SosCaseResponseDto(success = true, hasCase = true, case = caseDto)

        coEvery { profileApiService.getMySosCase("miguel_123") } returns Response.success(responseDto)

        val result = repository.getMySosCase("miguel_123")

        assertTrue(result is Result.Success)
        val sosCase = (result as Result.Success).data
        assertNotNull(sosCase)
        assertEquals("Miguel", sosCase?.fullName)
        assertEquals("approved", sosCase?.status)
        assertEquals(3, sosCase?.affectedFamilyCount)
    }

    @Test
    fun `getMySosCase with no case returns null`() = runTest {
        val responseDto = SosCaseResponseDto(success = true, hasCase = false, case = null)

        coEvery { profileApiService.getMySosCase("user_no_sos") } returns Response.success(responseDto)

        val result = repository.getMySosCase("user_no_sos")

        assertTrue(result is Result.Success)
        assertNull((result as Result.Success).data)
    }
}
