import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../modules/config';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: SolidarioHistoryModal (React SPA 2026)
 * ============================================================================
 * Modal de Historial de Causas Solidarias (#solidarioHistoryModal):
 * - Consulta inmutable de causas postuladas por el usuario (/api/humanitarian/causes/my).
 * - Desglose de estado (Activa, Culminada, Pendiente), recaudación y fecha.
 * - Acceso directo a causa-solidaria.html?id=...
 * - Clases maestras de style.css.
 * ============================================================================
 */
export default function SolidarioHistoryModal({ isOpen, onClose }) {
  const [causes, setCauses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchMyCauses = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const API_URL = getApiUrl();
        const res = await fetch(`${API_URL}/api/humanitarian/causes/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCauses(Array.isArray(data.causes) ? data.causes : []);
        }
      } catch (err) {
        console.warn('[SolidarioHistoryModal] Error al consultar causas propias:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyCauses();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="solidarioHistoryModal"
      className="modal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <span
          className="close-button solidario-history-close"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Cerrar"
        >
          &times;
        </span>

        <h2 style={{ color: '#e83e8c', marginBottom: '5px' }}>Historial de Causas</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
          Registro inmutable y transparente de tus recaudaciones pasadas
        </p>

        <div
          id="solidarioHistoryList"
          style={{
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            paddingRight: '5px'
          }}
        >
          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
              Cargando historial de causas...
            </p>
          ) : causes.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
              No tienes causas registradas todavía.
            </p>
          ) : (
            causes.map((cause) => {
              const current = parseFloat(cause.current_amount || 0);
              const hold = parseFloat(cause.amount_on_hold || 0);
              const total = current + hold;
              const formattedDate = new Date(cause.created_at).toLocaleDateString('es-ES');

              let badgeBg = 'rgba(239, 68, 68, 0.2)';
              let badgeColor = '#ef4444';
              let badgeText = cause.status;

              if (cause.status === 'completed') {
                badgeBg = 'rgba(16, 185, 129, 0.2)';
                badgeColor = '#10b981';
                badgeText = 'Culminada';
              } else if (cause.status === 'approved') {
                badgeBg = 'rgba(168, 85, 247, 0.2)';
                badgeColor = '#a855f7';
                badgeText = 'Activa';
              } else if (cause.status === 'pending') {
                badgeBg = 'rgba(234, 179, 8, 0.2)';
                badgeColor = '#eab308';
                badgeText = 'Pendiente';
              }

              const canViewPublic = cause.status === 'approved' || cause.status === 'completed';

              return (
                <div
                  key={cause.id}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '15px',
                    borderRadius: '12px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', lineHeight: 1.3, maxWidth: '70%' }}>
                      {cause.title}
                    </h4>
                    <span
                      style={{
                        background: badgeBg,
                        color: badgeColor,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      {badgeText}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8' }}>
                    <span>
                      Recaudado:{' '}
                      <strong style={{ color: 'white' }}>
                        {total.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} BLUE
                      </strong>
                    </span>
                    <span>{formattedDate}</span>
                  </div>

                  {canViewPublic && (
                    <a
                      href={`causa-solidaria.html?id=${cause.id}`}
                      style={{
                        color: '#e83e8c',
                        fontSize: '0.8rem',
                        textDecoration: 'underline',
                        marginTop: '5px',
                        display: 'inline-block'
                      }}
                    >
                      Ver Detalle Público
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
