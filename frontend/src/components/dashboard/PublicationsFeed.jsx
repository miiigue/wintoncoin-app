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
    <>
      {/* Título de Sección con Conteo (publications-title legacy) */}
      <div className="publications-title">
        Publicaciones Activas{' '}
        <span className="publications-count-wrapper">
          <span id="publicationsCount" className="publications-count">
            {filteredPublications.length}
          </span>
        </span>
      </div>

      {/* Controles de filtrado y ordenamiento (publication-controls legacy) */}
      <div className="publication-controls">
        {/* Chips de filtro por tipo de publicación */}
        <div className="publication-filter-chips" id="publicationFilterChips" role="group" aria-label="Filtrar publicaciones por tipo">
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            data-filter="all"
            onClick={() => handleChipClick('all')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'pending' ? 'active' : ''}`}
            data-filter="pending"
            onClick={() => handleChipClick('pending')}
          >
            En proceso
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'request' ? 'active' : ''}`}
            data-filter="request"
            onClick={() => handleChipClick('request')}
          >
            Solicitud
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'sell' ? 'active' : ''}`}
            data-filter="sell"
            onClick={() => handleChipClick('sell')}
          >
            Venta
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'donation' ? 'active' : ''}`}
            data-filter="donation"
            onClick={() => handleChipClick('donation')}
          >
            Donación
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'hidden' ? 'active' : ''}`}
            data-filter="hidden"
            onClick={() => handleChipClick('hidden')}
          >
            Ocultas
          </button>
        </div>

        {/* Búsqueda + Ordenamiento (en línea horizontal) */}
        <div className="publication-sort-container">
          <div className="publication-search-wrapper">
            <input
              type="text"
              id="publicationSearchInput"
              className="publication-search-input"
              placeholder="Buscar..."
              autoComplete="off"
              aria-label="Buscar publicaciones por título, descripción o autor"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                type="button"
                className="publication-search-clear"
                id="publicationSearchClear"
                aria-label="Limpiar búsqueda"
                style={{ display: 'flex' }}
                onClick={() => setSearchText('')}
              >
                &times;
              </button>
            )}
          </div>
          <label htmlFor="publicationSortSelect" className="publication-sort-label">Ordenar:</label>
          <select
            id="publicationSortSelect"
            className="publication-sort-select"
            aria-label="Ordenar publicaciones"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="recent">Más reciente</option>
            <option value="oldest">Más antigua</option>
            <option value="reward_desc">Mayor recompensa</option>
            <option value="reward_asc">Menor recompensa</option>
          </select>
        </div>
      </div>

      {/* Lista de Publicaciones con id y clases legacy */}
      <div id="publications-list">
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
          filteredPublications.map((pub) => {
            const isDonation = pub.is_humanitarian_cause || pub.category === 'donation';
            const rewardText = isDonation
              ? `${getAmountDisplay(pub)} BLUE`
              : `${getAmountDisplay(pub)} BLUE`;

            let ribbonClass = '';
            if (pub.is_booster_task) ribbonClass = 'booster-ribbon';
            else if (isDonation) ribbonClass = 'donation-ribbon';
            else if (pub.is_sell_post) ribbonClass = 'sell-ribbon';

            const slotsClass = (pub.available_slots > 0) ? 'available' : 'full';
            const slotsText = isDonation
              ? 'Campaña Activa'
              : (pub.available_slots > 0 ? `${pub.available_slots} cupos` : 'Cupos agotados');

            const hasImage = pub.image_urls && pub.image_urls.length > 0;
            const isHiddenView = activeFilter === 'hidden';

            const detailUrl = pub.is_humanitarian_cause
              ? `causa-solidaria.html?id=${pub.cause_id}`
              : `publication-detail.html?id=${pub.id}`;

            // Cálculo de barra de progreso en donaciones
            const currentAmount = parseFloat(pub.current_amount || 0);
            const goalAmount = parseFloat(pub.goal_amount || 0);
            const holdAmount = parseFloat(pub.amount_on_hold || 0);
            const totalRaised = currentAmount + holdAmount;
            const percentageReleased = goalAmount > 0 ? Math.min((currentAmount / goalAmount) * 100, 100) : 0;
            const percentageHold = goalAmount > 0 ? Math.min((holdAmount / goalAmount) * 100, 100 - percentageReleased) : 0;
            const percentageTotal = goalAmount > 0 ? Math.min(100, Math.round((totalRaised / goalAmount) * 100)) : 0;

            const titleAndDesc = (
              <>
                <div className="publication-header">
                  <h3>{pub.title}</h3>
                </div>
                {!pub.is_humanitarian_cause && (
                  <p className="pub-description">{pub.description}</p>
                )}
              </>
            );

            return (
              <a
                key={pub.id}
                href={detailUrl}
                className="publication-item-link"
                onClick={(e) => {
                  if (onSelectPublication) {
                    e.preventDefault();
                    onSelectPublication(pub);
                  }
                }}
              >
                <div className={`publication-item ${isDonation ? 'donation-card' : ''} ${hasImage ? 'has-images' : ''}`} data-id={pub.id}>
                  {/* Si tiene imágenes: Hero Wrapper con clases legacy de style.css */}
                  {hasImage && (
                    <div className="card-images-wrapper">
                      <div className={`card-images-container ${pub.image_urls.length > 1 ? 'is-carousel' : 'single-image'}`}>
                        {pub.image_urls.map((url, idx) => (
                          <img key={idx} src={url} alt="Imagen de publicación" loading="lazy" />
                        ))}
                      </div>
                      {pub.image_urls.length > 1 && (
                        <div className="carousel-dots">
                          {pub.image_urls.map((_, i) => (
                            <span key={i} className={`carousel-dot ${i === 0 ? 'active' : ''}`} />
                          ))}
                        </div>
                      )}
                      <div className="hero-scrim" />
                      <div className="hero-content">
                        {titleAndDesc}
                      </div>
                    </div>
                  )}

                  {/* Fila superior: Botón ocultar/restaurar y ribbon de precio */}
                  <div className="card-top-row">
                    {isHiddenView ? (
                      <button
                        type="button"
                        className="card-close-btn restore-btn"
                        title="Restaurar publicación"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onUnhidePublication) onUnhidePublication(pub);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <polyline points="3 3 3 8 8 8" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="card-close-btn"
                        title="Ocultar publicación"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onHidePublication) onHidePublication(pub);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}

                    <div className={`cost-ribbon-right ${ribbonClass}`}>
                      {rewardText}
                    </div>
                  </div>

                  {/* Si NO tiene imágenes, renderizar título y descripción en el cuerpo */}
                  {!hasImage && titleAndDesc}

                  {/* Barra de progreso para donaciones */}
                  {isDonation && (
                    <div className="donation-progress-container">
                      <div className="donation-progress-labels" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.78rem' }}>
                        <span>
                          <strong style={{ color: '#fff' }}>{totalRaised.toLocaleString('es-ES')}</strong> de {goalAmount.toLocaleString('es-ES')} BLUE
                        </span>
                        <span style={{ fontWeight: 700, color: '#f472b6' }}>
                          {percentageTotal}%
                        </span>
                      </div>
                      <div className="donation-progress-bar" style={{ display: 'flex', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div className="donation-progress-fill" style={{ width: `${percentageReleased}%`, background: 'linear-gradient(90deg, #ec4899, #db2777)' }} />
                        {percentageHold > 0 && (
                          <div style={{ width: `${percentageHold}%`, background: 'repeating-linear-gradient(45deg, rgba(232, 62, 140, 0.4), rgba(232, 62, 140, 0.4) 6px, rgba(232, 62, 140, 0.7) 6px, rgba(232, 62, 140, 0.7) 12px)' }} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer de la tarjeta */}
                  <div className="publication-footer">
                    <div className="pub-meta">
                      <span>Por: <strong>{pub.author_username || 'usuario'}</strong></span>
                    </div>
                    <div className="pub-meta-right">
                      {!isDonation && (
                        <div className={`slots-info ${slotsClass}`}>{slotsText}</div>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            );
          })
        )}
      </div>
    </>
  );
}
