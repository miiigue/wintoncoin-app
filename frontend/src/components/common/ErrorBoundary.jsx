import React, { Component } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - COMPONENTE DE CIBERSEGURIDAD: ErrorBoundary
 * ============================================================================
 * Barrera de contención contra fallos de renderizado en React (Zero Blank Screens).
 * 
 * Estándar de Ingeniería & Resiliencia FinTech:
 * - Evita que un error imprevisto en cualquier submódulo o navegador móvil
 *   desmonte el árbol DOM completo y deje la pantalla en blanco.
 * - Registra la traza del error en consola para auditoría técnica.
 * - Proporciona al usuario una interfaz de recuperación intuitiva con botón de reinicio.
 * ============================================================================
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que el siguiente renderizado muestre la UI alternativa
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Registro auditable del fallo en consola
    console.error('[WintonCoin ErrorBoundary] Excepción no controlada en renderizado React:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // Limpia estados y redirige al inicio seguro
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          textAlign: 'center',
          background: '#1A1A2E',
          position: 'relative',
          zIndex: 9999
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '32px 24px',
            maxWidth: '440px',
            width: '100%',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#ef4444',
              fontSize: '24px'
            }}>
              ⚠️
            </div>
            
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 700, 
              marginBottom: '10px',
              color: '#ffffff'
            }}>
              Inconsistencia de Carga Detectada
            </h2>

            <p style={{ 
              color: '#94a3b8', 
              fontSize: '0.9rem', 
              lineHeight: 1.5, 
              marginBottom: '24px' 
            }}>
              Se ha evitado un cierre inesperado de la interfaz. Pulsa el botón a continuación para restablecer la aplicación de manera segura.
            </p>

            <button
              onClick={this.handleReload}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #4da6ff 0%, #8B5CF6 100%)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(77, 166, 255, 0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              Reiniciar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
