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

// Configuración de AWS S3 / Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
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
                message: \`Has excedido el límite máximo de \${maxImages} imágenes permitidas para esta acción.\` 
            });
        }

        const bucketName = process.env.S3_BUCKET_NAME;
        const publicUrlBase = process.env.S3_PUBLIC_URL;

        if (!bucketName || !publicUrlBase) {
            console.error('[MEDIA CONTROLLER] Faltan variables de entorno para S3/R2.');
            return res.status(500).json({ success: false, message: 'La infraestructura de almacenamiento no está configurada.' });
        }

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
            const fileName = \`uploads/\${uniqueSuffix}.webp\`;

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
            return \`\${cleanBase}/\${fileName}\`;
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
            message: 'Error interno del servidor al procesar las imágenes.' 
        });
    }
};
