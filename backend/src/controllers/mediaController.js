// ============================================================================
// CONTROLADOR DE MEDIOS (MEDIA CONTROLLER) - Infraestructura R2 + Sharp
// ============================================================================
// Maneja la subida, compresión (WebP) y carga de múltiples imágenes a 
// Cloudflare R2 / S3 usando el SDK de AWS v3.
// ============================================================================

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');

// Variables de configuración de AWS S3 / Cloudflare R2 con soporte de nomenclatura flexible
const s3Endpoint = process.env.S3_ENDPOINT;
const s3AccessKeyId = process.env.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const s3SecretAccessKey = process.env.S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const s3BucketName = process.env.S3_BUCKET_NAME;
const s3PublicUrl = process.env.S3_PUBLIC_URL;

// Inicialización del Cliente S3
const s3Client = new S3Client({
    region: 'auto',
    endpoint: s3Endpoint,
    forcePathStyle: true, // [CRÍTICO PARA CLOUDFLARE R2] Desactiva enrutamiento virtual-host estilo AWS que no es soportado por R2
    credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey
    }
});

exports.uploadImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No se recibieron imágenes.' 
            });
        }

        // Leer límite de imágenes (por defecto 5 si no se especifica)
        const maxImages = parseInt(req.body.max_images || 5);
        if (req.files.length > maxImages) {
            return res.status(400).json({ 
                success: false, 
                message: `Has excedido el límite máximo de ${maxImages} imágenes permitidas para esta acción.` 
            });
        }

        if (!s3BucketName || !s3PublicUrl || !s3Endpoint || !s3AccessKeyId || !s3SecretAccessKey) {
            const missing = [];
            if (!s3BucketName) missing.push('S3_BUCKET_NAME');
            if (!s3PublicUrl) missing.push('S3_PUBLIC_URL');
            if (!s3Endpoint) missing.push('S3_ENDPOINT');
            if (!s3AccessKeyId) missing.push('S3_ACCESS_KEY (o S3_ACCESS_KEY_ID)');
            if (!s3SecretAccessKey) missing.push('S3_SECRET_KEY (o S3_SECRET_ACCESS_KEY)');

            const availableKeys = Object.keys(process.env).filter(key => key.includes('S3') || key.includes('R2') || key.includes('BUCKET') || key.includes('CLOUDFLARE') || key.includes('ACCESS') || key.includes('SECRET'));
            console.error('[MEDIA CONTROLLER] Configuración de S3/R2 incompleta. Faltan:', missing);
            return res.status(500).json({ 
                success: false, 
                message: 'La infraestructura de almacenamiento no está completamente configurada.',
                details: `Faltan variables críticas: [${missing.join(', ')}]. Claves relacionadas cargadas en Render: [${availableKeys.join(', ')}]`
            });
        }

        const bucketName = s3BucketName;
        const publicUrlBase = s3PublicUrl;

        const uploadedUrls = [];

        // Procesar y subir cada imagen en paralelo
        const uploadPromises = req.files.map(async (file) => {
            // 1. Comprimir agresivamente y convertir a WebP con Sharp
            const optimizedBuffer = await sharp(file.buffer)
                .resize({ width: 1080, withoutEnlargement: true }) // Máximo 1080px de ancho
                .webp({ quality: 80 }) // 80% de calidad es el punto dulce entre peso y claridad
                .toBuffer();

            // 2. Generar nombre de archivo inmutable y seguro
            const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
            const fileName = `uploads/${uniqueSuffix}.webp`;

            // 3. Comando de subida a S3/R2
            const uploadParams = {
                Bucket: bucketName,
                Key: fileName,
                Body: optimizedBuffer,
                ContentType: 'image/webp',
            };

            await s3Client.send(new PutObjectCommand(uploadParams));

            // 4. Retornar URL pública final
            // Formatear correctamente asegurando que no haya dobles slashes
            const cleanBase = publicUrlBase.endsWith('/') ? publicUrlBase.slice(0, -1) : publicUrlBase;
            return `${cleanBase}/${fileName}`;
        });

        // Esperar a que todas las imágenes se suban exitosamente
        const results = await Promise.all(uploadPromises);
        uploadedUrls.push(...results);

        return res.status(200).json({
            success: true,
            message: 'Imágenes subidas y optimizadas exitosamente.',
            urls: uploadedUrls
        });

    } catch (error) {
        console.error('[MEDIA CONTROLLER] Error interno al subir imágenes:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error interno del servidor al procesar las imágenes.',
            details: error.stack,
            code: error.code || error.name || 'UNKNOWN_ERROR'
        });
    }
};
