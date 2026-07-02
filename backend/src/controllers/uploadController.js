// ============================================================================
// CONTROLADOR DE SUBIDA DE ARCHIVOS (UPLOAD CONTROLLER)
// ============================================================================
// Maneja la lógica posterior a la subida exitosa de archivos validados 
// por el middleware de seguridad de Multer.
// ============================================================================

exports.uploadCampaignImage = async (req, res) => {
    try {
        // req.file contiene la información del archivo subido gracias a Multer
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No se recibió ninguna imagen. Por favor, selecciona un archivo válido.' 
            });
        }

        // Construir la ruta relativa pública (integrado bajo el prefijo /api del router central)
        const publicUrl = '/api/uploads/campaigns/' + req.file.filename;

        // Opcional: Podríamos guardar la URL automáticamente en app_settings aquí mismo,
        // pero por modularidad y previsibilidad, es mejor que el frontend reciba la URL 
        // y luego envíe el guardado normal junto con el resto de settings (título, botón).

        return res.status(200).json({
            success: true,
            message: 'Imagen subida exitosamente.',
            url: publicUrl,
            filename: req.file.filename,
            size: req.file.size
        });

    } catch (error) {
        console.error('[UPLOAD CONTROLLER] Error interno al subir imagen de campaña:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor al procesar la imagen.' 
        });
    }
};
