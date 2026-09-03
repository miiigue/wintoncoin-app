import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

/**
 * ============================================================================
 * [WINTONCOIN] - ENRUTADOR PRINCIPAL: App
 * ============================================================================
 * Define el mapa de navegación SPA de la plataforma.
 * 
 * Estructura de Rutas:
 * - "/" -> MainLayout (Header + Landing Page modular + Footer + BackToTop)
 * - "/login" & "/login.html" -> Login (Vista de autenticación independiente)
 * - "/register" & "/register.html" -> Register (Wizard de registro independiente)
 * ============================================================================
 */
function App() {
  return (
    <Routes>
      {/* Vistas con Layout Maestro (Header y Footer globales) */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Home />} />
      </Route>

      {/* Rutas de Autenticación Independientes (Sin Header/Footer) */}
      <Route path="/login" element={<Login />} />
      <Route path="/login.html" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register.html" element={<Register />} />
    </Routes>
  );
}

export default App;
