import React, { useState, useMemo } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: PublicationsFeed (React SPA 2026)
 * ============================================================================
 * Feed interactivo de publicaciones y causas solidarias con paridad 100% estricta
 * respecto a las reglas de negocio de la versión anterior (contract-interaction.js):
 *
 * 1. Jerarquía de Prioridad Absoluta (Tareas en Proceso y Causas Humanitarias al Tope):
 *    - Prioridad -1: Causas humanitarias / solidarias (flotan al inicio absoluto del marketplace).
 *    - Prioridad  0: Creador/Autor con participantes esperando aprobación (status: 'pending_approval').
 *    - Prioridad  1: Creador/Autor con participantes que completaron y esperan pago (status: 'completed').
 *    - Prioridad  2: Participante aprobado para realizar la tarea (status: 'approved').
 *    - Prioridad  3: Participante postulado en espera de aprobación (status: 'pending_approval').
 *    - Prioridad  4: Participante que completó tarea y espera confirmación (status: 'completed').
 *    - Prioridad  5: Publicaciones regulares sin interacción pendiente.
 *
 * 2. Ordenamiento Secundario Estable (Preserva selección del usuario):
 *    - Más reciente, Más antigua, Mayor recompensa, Menor recompensa.
 *    - Gracias al ordenamiento estable (ES2019+), las publicaciones dentro de un
 *      mismo nivel de prioridad conservan el orden seleccionado por el usuario.
 *
 * 3. Filtro "En proceso" (Chip 'pending'):
 *    - Muestra exactamente las tareas donde el usuario tiene una acción pendiente,
 *      ya sea como participante activo o como autor con postulantes.
 *
 * 4. Componentes Visuales Canónicos:
 *    - Banner de estado en cabecera (.publication-status-banner) con colores canónicos.
 *    - Insignia de expiración dinámica (.expiration-info) con conteo regresivo.
 *    - Clasificación por estrellas de reputación del autor.
 *    - Barra de progreso KYC/hold para donaciones humanitarias.
 *    - Estandarización de unidad: "BLUE IOU" en pre-lanzamiento / tareas de impulsor.
 * ============================================================================
 */

/**
 * Determina el tipo de publicación para filtrado estandarizado
 * @param {Object} pub Publicación o causa humanitaria
 * @returns {'donation' | 'sell' | 'request'}
 */
function getPublicationType(pub) {
  if (pub.is_humanitarian_cause || pub.category === 'donation') return 'donation';
  if (pub.is_sell_post || pub.category === 'sell') return 'sell';
  return 'request';
}

/**
 * Obtiene la marca de tiempo exacta para ordenamiento cronológico determinista
 * @param {Object} pub Publicación o causa
 * @returns {number} Timestamp en milisegundos
 */
function getPublicationTimestamp(pub) {
  const dateValue = pub.created_at || pub.createdAt;
  const date = dateValue ? new Date(dateValue) : null;
  if (date && !Number.isNaN(date.getTime())) return date.getTime();
  return Number(pub.id) || 0;
}

/**
 * Determina si una publicación requiere atención activa del usuario
 * (Paridad estricta 100% con contract-interaction.js)
 * @param {Object} pub Publicación a evaluar
 * @param {string} username Nombre de usuario actual en sesión
 * @returns {boolean} True si requiere atención
 */
function isPendingForUser(pub, username) {
  if (!username) return false;

  // Como participante: esperando aprobación, aprobado para iniciar o completado esperando pago
  const status = pub.user_acceptance_status;
  if (status === 'approved' || status === 'pending_approval' || status === 'completed') {
    return true;
  }

  // Como autor: tiene participantes pendientes de aprobar o por confirmar pago
  if (pub.author_username === username && Array.isArray(pub.participants) && pub.participants.length > 0) {
    const hasPendingActions = pub.participants.some(
      (p) => p.status === 'pending_approval' || p.status === 'completed'
    );
    if (hasPendingActions) return true;
  }

  return false;
}

/**
 * Asigna la prioridad numérica según el rol y estado (menor número = mayor prioridad)
 * Algoritmo canónico de WintonCoin:
 * @param {Object} pub Publicación o causa
 * @param {string} username Nombre de usuario en sesión
 * @returns {number} Prioridad (-1 al 5)
 */
function getPendingPriority(pub, username) {
  // 1. Causas humanitarias tienen prioridad máxima absoluta en el marketplace
  if (pub.is_humanitarian_cause) return -1;

  const isAuthor = pub.author_username === username;

  // 2. Prioridad de Autor / Creador de la publicación
  if (isAuthor && Array.isArray(pub.participants) && pub.participants.length > 0) {
    const hasPendingApproval = pub.participants.some((p) => p.status === 'pending_approval');
    const hasPendingPayment = pub.participants.some((p) => p.status === 'completed');

    // Autor con participantes por aprobar = máxima prioridad (0)
    if (hasPendingApproval) return 0;
    // Autor con participantes por pagar = alta prioridad (1)
    if (hasPendingPayment) return 1;
  }

  // 3. Prioridad de Participante
  const userStatus = pub.user_acceptance_status;
  if (userStatus === 'approved') return 2;        // Aprobado - listo para trabajar o compra aprobada
  if (userStatus === 'pending_approval') return 3; // Postulado - esperando aprobación del autor
  if (userStatus === 'completed') return 4;        // Finalizó tarea - esperando liberación de fondos

  // 4. Sin interacción o publicación regular
  return 5;
}

/**
 * Genera el banner informativo de estado en la parte superior de la tarjeta
 * @param {Object} pub Publicación a evaluar
 * @param {string} username Nombre de usuario en sesión
 * @returns {{ message: string, className: string } | null}
 */
function getCardStatusMessage(pub, username) {
  const isAuthor = pub.author_username === username;

  // --- Vista del Autor / Creador ---
  if (isAuthor && Array.isArray(pub.participants) && pub.participants.length > 0) {
    const pendingApproval = pub.participants.filter((p) => p.status === 'pending_approval').length;
    const pendingPayment = pub.participants.filter((p) => p.status === 'completed').length;

    if (pendingApproval > 0 || pendingPayment > 0) {
      const parts = [];
      if (pendingApproval > 0) parts.push(`${pendingApproval} por aprobar`);
      if (pendingPayment > 0) parts.push(`${pendingPayment} por pagar`);
      return {
        message: parts.join(' · '),
        className: 'status-author-action'
      };
    }
  }

  // --- Vista del Participante ---
  const userStatus = pub.user_acceptance_status;
  if (userStatus === 'approved') {
    return {
      message: pub.is_sell_post ? 'Pendiente pago' : '¡Puedes comenzar!',
      className: 'status-approved'
    };
  }
  if (userStatus === 'completed') {
    return {
      message: 'Esperando confirmación',
      className: 'status-completed'
    };
  }
  if (userStatus === 'pending_approval') {
    return {
      message: 'Esperando aprobación',
      className: 'status-pending'
    };
  }

  return null;
}

/**
 * Calcula y formatea el estado de expiración de una publicación
 * @param {Object} pub Publicación a evaluar
 * @returns {{ isExpired: boolean, text: string, className: string } | null}
 */
function getExpirationStatus(pub) {
  if (!pub.expires_at) return null;

  const now = new Date();
  const expDate = new Date(pub.expires_at);
  const diff = expDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { isExpired: true, text: 'Expirada', className: 'expiration-info expired' };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let timeLeft = '';
  if (days > 1) timeLeft = `Vence en ${days} días`;
  else if (days === 1) timeLeft = `Vence en ${days} día`;
  else if (hours > 1) timeLeft = `Vence en ${hours} horas`;
  else if (hours === 1) timeLeft = `Vence en ${hours} hora`;
  else if (minutes > 0) timeLeft = `Vence en ${minutes} min`;
  else timeLeft = `Vence en <1 min`;

  return { isExpired: false, text: timeLeft, className: 'expiration-info' };
}

/**
 * Renderizado de estrellas de reputación del autor
 */
function renderStarRating(rating, count) {
  if (!count || count === 0) return null;
  const numRating = Number(rating) || 0;
  const fullStars = Math.floor(numRating);
  const halfStar = numRating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = Math.max(0, 5 - fullStars - halfStar);

  const stars = '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
  return (
    <span className="stars-wrapper" style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#f59e0b' }}>
      <span className="stars">{stars}</span>{' '}
      <span className="rating-count" style={{ opacity: 0.7, fontSize: '0.75rem' }}>({count})</span>
    </span>
  );
}

export default function PublicationsFeed({
  publications = [],
  isLoading = false,
  currentUsername = '',
  isPreLaunch = false,
  onSelectPublication,
  onHidePublication,
  onUnhidePublication,
  onFilterChange,
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const effectiveUsername = currentUsername || (typeof window !== 'undefined' ? localStorage.getItem('username') : '') || '';

  const handleChipClick = (filterId) => {
    const prevFilter = activeFilter;
    setActiveFilter(filterId);
    if (onFilterChange) {
      if (filterId === 'hidden') {
        onFilterChange('hidden');
      } else if (prevFilter === 'hidden') {
        onFilterChange('all');
      }
    }
  };

  /**
   * Filtrado y ordenamiento determinista memoizado (Paso 0 a Paso 3)
   * Paridad 100% con applySortAndFilter() de la versión anterior
   */
  const filteredPublications = useMemo(() => {
    let result = [...publications];

    // --- Paso 0: Búsqueda reactiva por texto (título, descripción, autor, beneficiario) ---
    if (searchText.trim()) {
      const q = searchText.toLowerCase().trim();
      result = result.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.author_username && p.author_username.toLowerCase().includes(q)) ||
          (p.beneficiary_username && p.beneficiary_username.toLowerCase().includes(q))
      );
    }

    // --- Paso 1: Filtro por tipo o estado activo ---
    if (activeFilter === 'pending') {
      result = result.filter((p) => isPendingForUser(p, effectiveUsername));
    } else if (activeFilter === 'request' || activeFilter === 'sell' || activeFilter === 'donation') {
      result = result.filter((p) => getPublicationType(p) === activeFilter);
    }
    // 'all' y 'hidden' no requieren filtro adicional por tipo

    // --- Paso 2: Ordenamiento determinista según preferencia del usuario ---
    if (sortBy === 'recent' || sortBy === 'oldest') {
      result.sort((a, b) => {
        const diff = getPublicationTimestamp(b) - getPublicationTimestamp(a);
        return sortBy === 'recent' ? diff : -diff;
      });
    } else if (sortBy === 'reward_desc' || sortBy === 'reward_asc') {
      result.sort((a, b) => {
        const costA = Number(a.blue_cost ?? a.goal_amount ?? a.reward ?? 0);
        const costB = Number(b.blue_cost ?? b.goal_amount ?? b.reward ?? 0);
        const diff = costB - costA;
        return sortBy === 'reward_desc' ? diff : -diff;
      });
    }

    // --- Paso 3: Priorización jerárquica de tareas en proceso y causas humanitarias al tope ---
    // En JavaScript ES2019+, Array.prototype.sort() es ESTABLE:
    // Los elementos con la misma prioridad mantienen exactamente el orden cronológico
    // o de recompensa calculado en el Paso 2.
    result.sort(
      (a, b) => getPendingPriority(a, effectiveUsername) - getPendingPriority(b, effectiveUsername)
    );

    return result;
  }, [publications, activeFilter, searchText, sortBy, effectiveUsername]);

  const getAmountDisplay = (pub) => {
    if (pub.is_humanitarian_cause || pub.category === 'donation') {
      return parseFloat(pub.goal_amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    }
    return parseFloat(pub.blue_cost || pub.reward || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  const getBlueLabel = (pub) => {
    if (isPreLaunch || pub.is_booster_task) return 'BLUE IOU';
    return 'BLUE';
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
            const blueLabel = getBlueLabel(pub);
            const rewardText = `${getAmountDisplay(pub)} ${blueLabel}`;

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

            // Banners y badges canónicos
            const statusInfo = getCardStatusMessage(pub, effectiveUsername);
            const expirationInfo = getExpirationStatus(pub);
            const isExpired = expirationInfo?.isExpired;

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
                <div className={`publication-item ${isExpired ? 'expired' : ''} ${isDonation ? 'donation-card' : ''} ${hasImage ? 'has-images' : ''}`} data-id={pub.id}>
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

                  {/* Fila superior: Botón ocultar/restaurar, banner de estado y ribbon de recompensa */}
                  <div className={`card-top-row ${statusInfo ? 'has-status' : ''}`}>
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

                    {/* Banner de estado interactivo cuando el usuario tiene acciones pendientes */}
                    {statusInfo && (
                      <div className={`publication-status-banner ${statusInfo.className}`}>
                        {statusInfo.message}
                      </div>
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
                          <strong style={{ color: '#fff' }}>{totalRaised.toLocaleString('es-ES')}</strong> de {goalAmount.toLocaleString('es-ES')} {blueLabel}
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
                      {holdAmount > 0 && (
                        <div style={{ fontSize: '10px', color: '#f472b6', marginTop: '5px', opacity: 0.9 }}>
                          {holdAmount.toLocaleString('es-ES')} {blueLabel} en hold por verificación KYC
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer de la tarjeta con reputación de autor y tiempo de expiración */}
                  <div className="publication-footer">
                    <div className="pub-meta" style={{ display: 'flex', alignItems: 'center' }}>
                      <span>Por: <strong>{pub.author_username || 'usuario'}</strong></span>
                      {pub.author_ratings_count > 0 && renderStarRating(pub.author_average_rating, pub.author_ratings_count)}
                    </div>
                    <div className="pub-meta-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!isDonation && (
                        <div className={`slots-info ${slotsClass}`}>{slotsText}</div>
                      )}
                      {expirationInfo && (
                        <div className={expirationInfo.className}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            {isExpired ? (
                              <>
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </>
                            ) : (
                              <polyline points="12 6 12 12 16 14" />
                            )}
                          </svg>{' '}
                          {expirationInfo.text}
                        </div>
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

