import React, { useState } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: EmergencyBanner
 * ============================================================================
 * Banner de Campaña Humanitaria SOS Venezuela:
 * - Informa sobre la campaña de emergencia por terremotos.
 * - Permite donar tokens BLUE IOU sin costo para el usuario.
 * - Incluye modal interactivo con detalles y enlace directo a causas solidarias.
 * - Diseñado para no obstruir si el usuario decide cerrarlo.
 * ============================================================================
 */
export default function EmergencyBanner({ onSelectSolidarioFilter }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (isDismissed) return null;

  return (
    <>
      <div className="emergency-banner" style={{ margin: '15px auto', maxWidth: '800px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))', borderRadius: '16px', padding: '12px 18px', color: '#fff', boxShadow: '0 8px 25px rgba(239, 68, 68, 0.35)' }}>
        <div className="emergency-banner-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
            <span style={{ background: '#fff', color: '#b91c1c', fontWeight: 800, fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🚨 EMERGENCIA
            </span>
            <span style={{ fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.4 }}>
              Dos Terremotos en Venezuela. Dona tus BLUE IOU acumulados para apoyar a damnificados.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{ background: '#fff', color: '#b91c1c', border: 'none', padding: '7px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >
              Ver Causas
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
              title="Cerrar aviso"
            >
              &times;
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '16px' }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '24px', maxWidth: '480px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 60px rgba(239, 68, 68, 0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ height: '160px', background: 'linear-gradient(135deg, #b91c1c 0%, #450a0a 100%)', display: 'flex', alignItems: 'flex-end', padding: '1.5rem' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 800, fontSize: '0.75rem', padding: '4px 10px', borderRadius: '50px', letterSpacing: '1px' }}>
                CAMPAÑA DE AYUDA DIRECTA
              </span>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '0.75rem', fontWeight: 700 }}>
                SOS Venezuela: Dos Terremotos
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Dos terremotos devastadores han afectado a comunidades vulnerables en Venezuela. Familias enteras necesitan refugio, alimentos e insumos de emergencia.
              </p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Puedes ayudar desde donde estés donando tus tokens <strong>BLUE IOU</strong> acumulados de forma totalmente gratuita. El 100% de lo recaudado se destina a casos verificados.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    if (onSelectSolidarioFilter) onSelectSolidarioFilter();
                  }}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ❤️ Ir a Donar
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}
                >
                  Quizás luego
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
