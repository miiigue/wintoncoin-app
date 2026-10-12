import React from 'react';
import { Link } from 'react-router-dom';
import AccountSecurity from '../components/AccountSecurity.jsx';
import styles from './Wallet.module.css';

/**
 * ============================================================================
 * [WINTONCOIN] - PANTALLA OFICIAL DE RECUPERACIÓN Y SEGURIDAD (React SPA 2026)
 * ============================================================================
 * Centraliza la gestión de recuperación y cambio de dispositivos autorizados:
 * - Opciones secundarias segregadas de la billetera para evitar confusión cotidiana.
 * - Guía contextual explícita sobre cuándo y por qué utilizar esta herramienta.
 * - Desencadena autenticación biométrica / Passkey local para vincular nuevos equipos.
 * ============================================================================
 */
export default function Recovery() {
  return (
    <div className={styles.walletContainer}>
      <div className={styles.walletWrapper}>
        <nav aria-label="Navegación de recuperación" className={styles.walletNav}>
          <Link to="/wallet" className={styles.backLink}>
            <span aria-hidden="true">←</span> Volver a la billetera
          </Link>
          <span className={styles.navTitle}>Seguridad y Recuperación</span>
        </nav>

        <header className={styles.userHeader}>
          <div className={styles.userInfo}>
            <h2 className={styles.userName}>🛡️ Centro de Recuperación</h2>
            <div className={styles.userStatus} role="status" style={{ color: '#38bdf8' }}>
              <span className={styles.statusDot} aria-hidden="true" style={{ background: '#38bdf8' }} />
              <span>Gestión de acceso y dispositivos autorizados</span>
            </div>
          </div>
        </header>

        <div style={{
          background: 'rgba(2, 132, 199, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '16px',
          padding: '16px 20px',
          margin: '16px 0 24px',
          color: '#e0f2fe'
        }}>
          <strong style={{ color: '#38bdf8', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            💡 ¿En qué momento es necesario usar esta pantalla?
          </strong>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: '#cbd5e1' }}>
            Usa esta pantalla únicamente si <strong>cambiaste de teléfono celular</strong>, perdiste tu equipo anterior o necesitas transferir el acceso seguro a otro dispositivo. En tu día a día no necesitas tocar nada aquí; tu cuenta ya está blindada con tu llave maestra y tu dispositivo autorizado.
          </p>
        </div>

        {/* Componente central de seguridad y recuperación (modo standalone con detalles visibles) */}
        <AccountSecurity hideWhenActive={false} />

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/dashboard" style={{ color: '#94a3b8', fontSize: '0.85rem', textDecoration: 'underline' }}>
            Ir al panel principal
          </Link>
        </div>
      </div>
    </div>
  );
}
