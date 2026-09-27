import React, { useState, useMemo } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: PublicationsFeed (React SPA 2026)
 * ============================================================================
 * Feed interactivo de publicaciones y causas solidarias con paridad visual 100%:
 * - Filtros por chips: Todos, En proceso, Solicitudes, Servicios, Donaciones, Ocultas.
 * - Búsqueda reactiva por texto (título, descripción, autor).
 * - Ordenamiento determinista (más reciente, más antigua, mayor/menor recompensa).
 * - Barra de progreso en vivo para donaciones y causas humanitarias (recaudado vs meta).
 * - Soporte para carrusel/imágenes de publicaciones.
 * - Acciones de ocultar y restaurar publicaciones (anti-ruido para el usuario).
 * - Sanitización estricta anti-XSS renderizada mediante Virtual DOM de React.
 * ============================================================================
 */
export default function PublicationsFeed({
  publications = [],
  isLoading = false,
  onSelectPublication,
  onHidePublication,
  onUnhidePublication,
  onFilterChange,
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const handleChipClick = (filterId) => {
    setActiveFilter(filterId);
    if (onFilterChange) {
      onFilterChange(filterId);
    }
  };

  // Filtrado y ordenamiento reactivo memoizado
  const filteredPublications = useMemo(() => {
    let result = [...publications];

    // 1. Filtro por tipo o estado
    if (activeFilter !== 'all') {
      result = result.filter((p) => {
        if (activeFilter === 'request') {
          return p.category === 'request' || p.type === 'request' || (!p.is_sell_post && !p.is_humanitarian_cause && p.category !== 'donation');
        }
        if (activeFilter === 'sell') {
          return p.is_sell_post === true || p.category === 'sell' || p.type === 'sell';
        }
        if (activeFilter === 'donation') {
          return p.is_humanitarian_cause === true || p.category === 'donation' || p.type === 'donation';
        }
        if (activeFilter === 'pending') {
          return p.status === 'in_progress' || p.user_acceptance_status === 'in_progress';
        }
        if (activeFilter === 'hidden') {
          return true; // Si el padre ya filtró o pasó las ocultas
        }
        return true;
      });
    }

    // 2. Búsqueda por texto (título, descripción, usuario autor o beneficiario)
    if (searchText.trim()) {
      const q = searchText.toLowerCase().trim();
      result = result.filter((p) =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.author_username && p.author_username.toLowerCase().includes(q)) ||
        (p.beneficiary_username && p.beneficiary_username.toLowerCase().includes(q))
      );
    }

    // 3. Ordenamiento determinista
    result.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      const valA = parseFloat(a.blue_cost || a.goal_amount || a.reward || 0);
      const valB = parseFloat(b.blue_cost || b.goal_amount || b.reward || 0);
      if (sortBy === 'reward_desc') return valB - valA;
      if (sortBy === 'reward_asc') return valA - valB;
      return 0;
    });

    return result;
  }, [publications, activeFilter, searchText, sortBy]);

  const getBadgeStyle = (pub) => {
    if (pub.is_humanitarian_cause || pub.category === 'donation') {
      return { background: 'rgba(232, 62, 140, 0.15)', color: '#e83e8c', border: '1px solid rgba(232, 62, 140, 0.3)' };
    }
    if (pub.is_sell_post || pub.category === 'sell') {
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
    }
    if (pub.is_booster_task) {
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
    }
    return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' };
  };

  const getBadgeLabel = (pub) => {
    if (pub.is_humanitarian_cause || pub.category === 'donation') return '❤️ Donación';
    if (pub.is_sell_post || pub.category === 'sell') return '🏷️ Venta / Servicio';
    if (pub.is_booster_task) return '🚀 Impulsor';
    return '🤝 Solicitud';
  };

  const getAmountDisplay = (pub) => {
    if (pub.is_humanitarian_cause || pub.category === 'donation') {
      return parseFloat(pub.goal_amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    }
    return parseFloat(pub.blue_cost || pub.reward || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  return (
    <div style={{ margin: '0 auto', maxWidth: '800px' }}>
      {/* Título de Sección con Conteo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
          Publicaciones Activas
        </h2>
        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700 }}>
          {filteredPublications.length} disponibles
        </span>
      </div>

      {/* Controles de Filtrado: Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px', scrollbarWidth: 'none' }}>
        {[
          { id: 'all', label: 'Todos' },
          { id: 'request', label: '🤝 Solicitudes' },
          { id: 'sell', label: '🏷️ Servicios' },
          { id: 'donation', label: '❤️ Donaciones' },
          { id: 'pending', label: '⏳ En proceso' },
          { id: 'hidden', label: '📁 Ocultas' },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleChipClick(chip.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '50px',
              border: activeFilter === chip.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
              background: activeFilter === chip.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeFilter === chip.id ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Barra de Búsqueda y Ordenamiento */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Buscar por título, descripción o usuario..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#fff',
              fontSize: '0.88rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}
            >
              &times;
            </button>
          )}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#cbd5e1',
            fontSize: '0.85rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="recent">Más reciente</option>
          <option value="oldest">Más antigua</option>
          <option value="reward_desc">Mayor recompensa</option>
          <option value="reward_asc">Menor recompensa</option>
        </select>
      </div>

      {/* Lista de Publicaciones */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
          <div>Cargando publicaciones activas...</div>
        </div>
      ) : filteredPublications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
            {activeFilter === 'hidden' ? '📁' : '🚀'}
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            {activeFilter === 'hidden'
              ? 'No tienes publicaciones archivadas u ocultas.'
              : 'No se encontraron publicaciones en esta categoría.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredPublications.map((pub) => {
            const badgeStyle = getBadgeStyle(pub);
            const badgeLabel = getBadgeLabel(pub);
            const isDonation = pub.is_humanitarian_cause || pub.category === 'donation';
            const amountText = getAmountDisplay(pub);

            // Cálculo de barra de progreso en donaciones
            const currentAmount = parseFloat(pub.current_amount || 0);
            const goalAmount = parseFloat(pub.goal_amount || 0);
            const holdAmount = parseFloat(pub.amount_on_hold || 0);
            const totalRaised = currentAmount + holdAmount;
            const percentageTotal = goalAmount > 0 ? Math.min(100, Math.round((totalRaised / goalAmount) * 100)) : 0;
            const percentageReleased = goalAmount > 0 ? Math.min(100, (currentAmount / goalAmount) * 100) : 0;
            const percentageHold = goalAmount > 0 ? Math.min(100 - percentageReleased, (holdAmount / goalAmount) * 100) : 0;

            const hasImage = pub.image_urls && pub.image_urls.length > 0;
            const imageUrl = hasImage ? pub.image_urls[0] : null;

            return (
              <div
                key={pub.id}
                onClick={() => {
                  if (onSelectPublication) {
                    onSelectPublication(pub);
                  } else if (pub.is_humanitarian_cause) {
                    window.location.href = `causa-solidaria.html?id=${pub.cause_id}`;
                  } else {
                    window.location.href = `publication-detail.html?id=${pub.id}`;
                  }
                }}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: isDonation ? '1px solid rgba(232, 62, 140, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '18px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = isDonation ? '#e83e8c' : 'rgba(56, 189, 248, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isDonation ? 'rgba(232, 62, 140, 0.3)' : 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {/* Fila superior: Autor, badge y botón de ocultar/restaurar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                      @{pub.author_username || 'usuario'}
                    </span>
                    <span style={{ ...badgeStyle, padding: '2px 8px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 700 }}>
                      {badgeLabel}
                    </span>
                    {pub.available_slots && !isDonation && (
                      <span style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                        {pub.available_slots > 0 ? `${pub.available_slots} cupos` : 'Agotado'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: isDonation ? '#f472b6' : '#38bdf8' }}>
                      {amountText} <small style={{ fontSize: '0.75rem' }}>BLUE</small>
                    </div>

                    {/* Botón Ocultar / Restaurar */}
                    {activeFilter === 'hidden' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onUnhidePublication) onUnhidePublication(pub);
                        }}
                        style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '1rem', padding: '2px 6px' }}
                        title="Restaurar publicación"
                      >
                        ↩
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onHidePublication) onHidePublication(pub);
                        }}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 6px', lineHeight: 1 }}
                        title="Ocultar publicación"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>

                {/* Imagen opcional si la publicación la incluye */}
                {imageUrl && (
                  <div style={{ marginBottom: '12px', borderRadius: '12px', overflow: 'hidden', maxHeight: '180px' }}>
                    <img
                      src={imageUrl}
                      alt={pub.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}

                {/* Título de la publicación */}
                <h3 style={{ fontSize: '1.05rem', color: '#fff', margin: '0 0 6px 0', fontWeight: 600 }}>
                  {pub.title}
                </h3>

                {/* Descripción resumida */}
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 12px 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {pub.description}
                </p>

                {/* Barra de progreso para donaciones / causas */}
                {isDonation && (
                  <div style={{ marginTop: '10px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>
                      <span>
                        <strong style={{ color: '#fff' }}>{totalRaised.toLocaleString('es-ES')}</strong> de {goalAmount.toLocaleString('es-ES')} BLUE
                      </span>
                      <span style={{ fontWeight: 700, color: '#f472b6' }}>
                        {percentageTotal}%
                      </span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '50px', overflow: 'hidden', display: 'flex' }}>
                      <div
                        style={{
                          width: `${percentageReleased}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #ec4899, #db2777)'
                        }}
                      />
                      {percentageHold > 0 && (
                        <div
                          style={{
                            width: `${percentageHold}%`,
                            height: '100%',
                            background: 'repeating-linear-gradient(45deg, rgba(232, 62, 140, 0.4), rgba(232, 62, 140, 0.4) 6px, rgba(232, 62, 140, 0.7) 6px, rgba(232, 62, 140, 0.7) 12px)'
                          }}
                        />
                      )}
                    </div>
                    {holdAmount > 0 && (
                      <div style={{ fontSize: '0.72rem', color: '#f472b6', marginTop: '4px' }}>
                        {holdAmount} BLUE en custodia preventiva hasta validación KYC
                      </div>
                    )}
                  </div>
                )}

                {/* Fila inferior: Ubicación y enlace a detalle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                  <span>📍 {pub.location || 'En línea'}</span>
                  <span style={{ color: isDonation ? '#f472b6' : '#38bdf8', fontWeight: 600 }}>
                    {isDonation ? 'Ver causa y donar →' : 'Ver detalles →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
