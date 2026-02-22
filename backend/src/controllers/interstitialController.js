const interstitialService = require('../services/interstitialService');

/**
 * Controlador para gestionar la entrega de mensajes intersticiales
 */
const getGlobalInterstitial = async (req, res) => {
    try {
        const config = await interstitialService.getGlobalConfig();
        res.status(200).json(config);
    } catch (error) {
        console.error('Error en getGlobalInterstitial:', error);
        res.status(500).json({ message: 'Error interno al obtener configuración intersticial.' });
    }
};

module.exports = {
    getGlobalInterstitial
};
