import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Wallet from './pages/Wallet.jsx';
import Exchange from './pages/Exchange.jsx';

/**
 * ============================================================================
 * [WINTONCOIN] - ENRUTADOR PRINCIPAL: App
 * ============================================================================
 * Define el mapa de navegación SPA de la plataforma con resiliencia total:
 * 
 * Estructura de Rutas:
 * - "/" & "/index.html" & "/index" -> MainLayout (Header + Landing + Footer + BackToTop)
 * - "/wallet" & "/wallet.html" -> MainLayout (Billetera FinTech React 2026)
 * - "/exchange" & "/exchange.html" -> MainLayout (Exchange Oficial FIFO 2026)
 * - "/login" & "/login.html" -> Login (Vista de autenticación independiente)
 * - "/register" & "/register.html" -> Register (Wizard de registro independiente)
 * - "/forgot-password" & "/forgot-password.html" -> ForgotPassword (Recuperación)
 * - "*" (Comodín) -> Redirección segura a "/" para garantizar CERO pantallas en blanco.
 * ============================================================================
 */
function App() {
  return (
    <Routes>
      {/* Vistas con Layout Maestro (Header y Footer globales) */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="index.html" element={<Home />} />
        <Route path="index" element={<Home />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="wallet.html" element={<Wallet />} />
        <Route path="exchange" element={<Exchange />} />
        <Route path="exchange.html" element={<Exchange />} />
      </Route>

      {/* Rutas directas para compatibilidad total con WebView, Service Workers y Servidores */}
      <Route path="/index.html" element={<MainLayout><Home /></MainLayout>} />
      <Route path="/index" element={<MainLayout><Home /></MainLayout>} />
      <Route path="/wallet" element={<MainLayout><Wallet /></MainLayout>} />
      <Route path="/wallet.html" element={<MainLayout><Wallet /></MainLayout>} />
      <Route path="/exchange" element={<MainLayout><Exchange /></MainLayout>} />
      <Route path="/exchange.html" element={<MainLayout><Exchange /></MainLayout>} />

      {/* Rutas de Autenticación Independientes (Sin Header/Footer) */}
      <Route path="/login" element={<Login />} />
      <Route path="/login.html" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register.html" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forgot-password.html" element={<ForgotPassword />} />

      {/* Fallback Universal: Si ninguna ruta coincide, redirige de forma segura al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
