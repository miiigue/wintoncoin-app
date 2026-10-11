import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <nav className="glass-nav">
      <div className="logo">
        <img 
          src="assets/branding/wintoncoin_transparent_phrase.png" 
          alt="WintonCoin" 
          className="logo-phrase-img"
          style={{ height: '32px', width: 'auto' }}
        />
      </div>
      {/* Enlaces de navegación y acciones de autenticación */}
      <div className="nav-links">
        <a href="#como-funciona" className="nav-anchor">¿Cómo Funciona?</a>
        <a href="#valores" className="nav-anchor">Seguridad</a>
        <a href="#economia" className="nav-anchor">Tokenomics</a>
        {/* Botón de acceso directo a Iniciar Sesión (visible en mobile arriba a la derecha y en desktop) */}
        <Link to="/login" className="btn-login-nav" aria-label="Iniciar Sesión en WintonCoin">Iniciar Sesión</Link>
        {/* Botón de registro (Iniciar App) */}
        <Link to="/register" className="btn-primary-nav" aria-label="Registrarse en WintonCoin">Iniciar App</Link>
      </div>
    </nav>
  );
}

export default Header;
