import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - DESIGN SYSTEM: TokenIcon Component (React SPA)
 * ============================================================================
 * Componente canónico de alta fidelidad para representar los activos del protocolo:
 * - BLUE: Activo / Moneda líquida y parking (icono azul plateado).
 * - RED: Compromiso RED (icono rojo rubí plateado en espejo simétrico).
 *
 * Sigue los principios de micro-animaciones, renderizado nítido en pantallas Retina,
 * prevención de saltos de maquetación (CLS) y accesibilidad WCAG 2.1 AA.
 *
 * @param {'BLUE'|'RED'} token - Tipo de token protocolar.
 * @param {number} size - Tamaño en píxeles (default: 24).
 * @param {string} className - Clases CSS adicionales.
 * @param {string} alt - Texto alternativo descriptivo.
 * @param {object} style - Estilos inline adicionales.
 * ============================================================================
 */
export default function TokenIcon({
  token = 'BLUE',
  size = 24,
  className = '',
  alt,
  style = {},
  withGlow = false
}) {
  const isRed = String(token).toUpperCase() === 'RED';
  const defaultAlt = isRed ? 'Compromiso RED' : 'Activo BLUE';

  // Selección inteligente del asset de mejor resolución según el tamaño requerido
  let iconSrc = '/assets/icons/icon-64x64.png';
  if (isRed) {
    if (size <= 32) {
      iconSrc = '/assets/icons/red-icon-32x32.png';
    } else if (size <= 64) {
      iconSrc = '/assets/icons/red-icon-64x64.png';
    } else if (size <= 128) {
      iconSrc = '/assets/icons/red-icon-128x128.png';
    } else if (size <= 256) {
      iconSrc = '/assets/icons/red-icon-192x192.png';
    } else {
      iconSrc = '/assets/icons/red-logo-high-res.png';
    }
  } else {
    if (size <= 32) {
      iconSrc = '/assets/icons/icon-32x32.png';
    } else if (size <= 64) {
      iconSrc = '/assets/icons/icon-64x64.png';
    } else if (size <= 128) {
      iconSrc = '/assets/icons/icon-128x128.png';
    } else if (size <= 256) {
      iconSrc = '/assets/icons/icon-192x192.png';
    } else {
      iconSrc = '/assets/icons/logo-high-res.png';
    }
  }

  const glowStyle = withGlow
    ? {
        filter: isRed
          ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.45))'
          : 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.45))'
      }
    : {};

  return (
    <img
      src={iconSrc}
      alt={alt || defaultAlt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`winton-token-icon ${isRed ? 'token-icon-red' : 'token-icon-blue'} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        objectFit: 'contain',
        verticalAlign: 'middle',
        display: 'inline-block',
        flexShrink: 0,
        ...glowStyle,
        ...style
      }}
    />
  );
}
