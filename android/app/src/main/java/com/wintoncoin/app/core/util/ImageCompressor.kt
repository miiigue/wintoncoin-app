// ============================================================================
// WintonCoin Android — ImageCompressor (Optimizador y Compresor WebP)
// ============================================================================
// [CORE / UTILITY / PERFORMANCE] Procesa y comprime imágenes locales antes de
// transmitirlas a Cloudflare R2 vía Retrofit Multipart.
// Evita el consumo excesivo de datos móviles y previene Out-Of-Memory (OOM).
// ============================================================================

package com.wintoncoin.app.core.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ImageCompressor @Inject constructor() {

    /**
     * Comprime una imagen desde una Uri local y genera el MultipartBody.Part
     * listo para el endpoint `POST /api/media/upload`.
     */
    suspend fun compressAndCreateMultipart(
        context: Context,
        uri: Uri,
        maxDimension: Int = 1080,
        quality: Int = 80
    ): MultipartBody.Part = withContext(Dispatchers.IO) {
        // 1. Obtener dimensiones sin cargar todo el mapa de bits en RAM
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { inputStream ->
            BitmapFactory.decodeStream(inputStream, null, options)
        }

        // 2. Calcular factor de reducción inSampleSize
        var inSampleSize = 1
        val (origWidth, origHeight) = options.outWidth to options.outHeight
        if (origWidth > maxDimension || origHeight > maxDimension) {
            val halfWidth = origWidth / 2
            val halfHeight = origHeight / 2
            while ((halfWidth / inSampleSize) >= maxDimension && (halfHeight / inSampleSize) >= maxDimension) {
                inSampleSize *= 2
            }
        }

        // 3. Decodificar el Bitmap con el sampleSize óptimo
        val decodeOptions = BitmapFactory.Options().apply {
            this.inSampleSize = inSampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val rawBitmap: Bitmap? = context.contentResolver.openInputStream(uri)?.use { inputStream ->
            BitmapFactory.decodeStream(inputStream, null, decodeOptions)
        }

        val bitmap = rawBitmap ?: throw IllegalArgumentException("No se pudo procesar la imagen seleccionada.")

        // 4. Redimensionar de forma proporcional si aún excede el límite máximo
        val finalBitmap = if (bitmap.width > maxDimension || bitmap.height > maxDimension) {
            val ratio = bitmap.width.toFloat() / bitmap.height.toFloat()
            val (targetWidth, targetHeight) = if (ratio > 1) {
                maxDimension to (maxDimension / ratio).toInt()
            } else {
                (maxDimension * ratio).toInt() to maxDimension
            }
            Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
        } else {
            bitmap
        }

        // 5. Comprimir a formato WebP optimizado
        val outputStream = ByteArrayOutputStream()
        val compressFormat = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Bitmap.CompressFormat.WEBP_LOSSY
        } else {
            @Suppress("DEPRECATION")
            Bitmap.CompressFormat.WEBP
        }
        finalBitmap.compress(compressFormat, quality, outputStream)
        val byteArray = outputStream.toByteArray()

        val requestBody = byteArray.toRequestBody("image/webp".toMediaTypeOrNull())
        val fileName = "upload_${System.currentTimeMillis()}.webp"

        MultipartBody.Part.createFormData("images", fileName, requestBody)
    }
}
