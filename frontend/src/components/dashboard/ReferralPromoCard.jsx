import React, { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../../modules/config';
import { showCustomAlert } from '../../modules/alerts';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: ReferralPromoCard (React SPA 2026)
 * ============================================================================
 * Tarjeta de invitación y bonos de referidos en tiempo real:
 * - Consulta dinámica a /api/referral-settings y /api/users/:username/referral-info.
 * - Muestra cupos disponibles de la fase promocional activa.
 * - Soporta fondos de campaña personalizados con overlay visual de alto impacto.
 * - Acción de compartir optimizada para Android/PWA (Web Share API) con
 *   fallback automático a portapapeles en navegadores de escritorio.
 * ============================================================================
 */
export default function ReferralPromoCard({ username }) {
  const [promoData, setPromoData] = useState({
    rewardAmount: 1000,
    remainingSlots: null,
    cardTitle: 'CUPOS DISPONIBLES:',
    cardSubtitle: 'Bono por referir hoy',
    buttonText: 'Compartir mi código',
    customShareCodeEnabled: false,
    customShareCode: null,
    campaignImageUrl: null,
    template: '¡Hola! Únete a WintonCoin usando mi código {code} y ambos ganaremos {reward} BLUE IOU de bienvenida.\n\n👉 Regístrate gratis aquí: {link}',
  });
  const [userReferralCode, setUserReferralCode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Consulta de configuración de referidos y código del usuario
  const loadReferralInfo = useCallback(async () => {
    try {
      const API_URL = getApiUrl();
      const [settingsRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/referral-settings`),
        username ? fetch(`${API_URL}/api/users/${encodeURIComponent(username)}/referral-info`) : Promise.resolve(null)
      ]);

      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setPromoData(prev => ({
          ...prev,
          rewardAmount: parseInt(settings.referral_reward_amount, 10) || 1000,
          remainingSlots: typeof settings.referral_remaining_slots !== 'undefined'
            ? parseInt(settings.referral_remaining_slots, 10)
            : null,
          cardTitle: settings.referral_card_title || 'CUPOS DISPONIBLES:',
          cardSubtitle: settings.referral_card_subtitle || 'Bono por referir hoy',
          buttonText: settings.referral_card_button_text || 'Compartir mi código',
          customShareCodeEnabled: settings.referral_custom_share_code_enabled === true,
          customShareCode: settings.referral_custom_share_code || null,
          campaignImageUrl: settings.referral_campaign_image_url || null,
          template: settings.referral_share_message_template || prev.template
        }));
      }

      if (userRes && userRes.ok) {
        const uData = await userRes.json();
        if (uData.referral_code) {
          setUserReferralCode(uData.referral_code);
        }
      }
    } catch (err) {
      console.warn('[ReferralPromoCard] Error al cargar configuración de referidos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadReferralInfo();
  }, [loadReferralInfo]);

  // Manejador para compartir el enlace
  const handleShare = async () => {
    const codeToShare = promoData.customShareCodeEnabled && promoData.customShareCode
      ? promoData.customShareCode
      : (userReferralCode || username || 'WINTON');

    const registrationUrl = `${window.location.origin}/register?ref=${encodeURIComponent(codeToShare)}`;
    const textToShare = promoData.template
      .replace(/{code}/g, codeToShare)
      .replace(/{reward}/g, promoData.rewardAmount)
      .replace(/{link}/g, registrationUrl);

    if (navigator.share) {
      try {
        await navigator.share({
          title: '¡Únete a WintonCoin!',
          text: textToShare,
        });
      } catch (err) {
        // Ignorar AbortError si el usuario canceló el diálogo nativo
        if (err.name !== 'AbortError') {
          console.error('[ReferralPromoCard] Error en Web Share API:', err);
        }
      }
    } else {
      // Fallback a portapapeles
      try {
        await navigator.clipboard.writeText(textToShare);
        showCustomAlert('¡Mensaje de invitación copiado al portapapeles! Compártelo con tus amigos.');
      } catch (clipErr) {
        console.error('[ReferralPromoCard] Error al copiar al portapapeles:', clipErr);
        showCustomAlert(`Copia tu enlace de registro: ${registrationUrl}`);
      }
    }
  };

  if (isLoading) {
    return null;
  }

  // Si no quedan cupos y el monto es 0, ocultamos la tarjeta
  if (promoData.remainingSlots !== null && promoData.remainingSlots <= 0 && promoData.rewardAmount <= 0) {
    return null;
  }

  const isCampaign = promoData.customShareCodeEnabled && promoData.campaignImageUrl;

  return (
    <div style={{ margin: '0 auto 20px auto', maxWidth: '800px' }}>
      <div
        id="shareReferralCard"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '20px',
          padding: '24px',
          background: isCampaign
            ? 'transparent'
            : 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          color: '#fff',
          textAlign: 'center'
        }}
      >
        {/* Overlay dinámico de campaña si existe imagen */}
        {isCampaign && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `url('${promoData.campaignImageUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              zIndex: 1
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%)'
              }}
            />
          </div>
        )}

        {/* Contenido interactivo */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* 1. Cupos restantes */}
          {promoData.remainingSlots !== null && (
            <div style={{ marginBottom: '14px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: isCampaign ? '#fff' : '#94a3b8'
                }}
              >
                {promoData.cardTitle}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Quedan
                </span>
                <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)' }}>
                  {promoData.remainingSlots.toLocaleString('es-ES')}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  cupos
                </span>
              </div>
            </div>
          )}

          {/* 2. Recompensa destacada */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 500 }}>
              {promoData.cardSubtitle}
            </div>
            <div
              style={{
                fontSize: '2.4rem',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 4px 20px rgba(245, 158, 11, 0.3)'
              }}
            >
              {promoData.rewardAmount} <small style={{ fontSize: '1.1rem', color: '#f59e0b', WebkitTextFillColor: '#f59e0b' }}>BLUE IOU</small>
            </div>
          </div>

          {/* 3. Botón de Compartir (CTA Principal) */}
          <button
            type="button"
            onClick={handleShare}
            style={{
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '50px',
              padding: '12px 32px',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(56, 189, 248, 0.4)',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>{promoData.buttonText}</span>
          </button>

          {/* Aviso de código de campaña si aplica */}
          {promoData.customShareCodeEnabled && promoData.customShareCode && (
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Código oficial activo: <strong>{promoData.customShareCode}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
