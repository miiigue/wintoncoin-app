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
      <div className="nav-links">
        <a href="#como-funciona">¿Cómo Funciona?</a>
        <a href="#valores">Seguridad</a>
        <a href="#economia">Tokenomics</a>
        <Link to="/register" className="btn-primary-nav">Iniciar App</Link>
      </div>
    </nav>
  );
}

export default Header;
