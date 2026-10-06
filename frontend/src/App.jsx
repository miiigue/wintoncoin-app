import React from 'react';
import OperationAuthorization from './components/OperationAuthorization.jsx';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Wallet from './pages/Wallet.jsx';
import Exchange from './pages/Exchange.jsx';
import AdminGate from './components/AdminGate.jsx';
import AdminWeb3Panel from './pages/AdminWeb3Panel.jsx';
import ArchitectureFlows from './pages/ArchitectureFlows.jsx';
import Dashboard from './pages/Dashboard.jsx';

/**
 * ============================================================================
 * [WINTONCOIN] - ENRUTADOR PRINCIPAL: App
 * ============================================================================
 * Define el mapa de navegación SPA de la plataforma con resiliencia total:
 * 
 * Estructura de Rutas:
 * - "/" & "/index.html" & "/index" -> MainLayout (Header + Landing + Footer + BackToTop)
 * - "/dashboard" & "/contract_interaction.html" -> Dashboard (Panel central React 2026)
 * - "/wallet" & "/wallet.html" -> Wallet (Billetera FinTech React 2026)
 * - "/exchange" & "/exchange.html" -> Exchange (Exchange Oficial FIFO 2026)
 * - "/flows" & "/admin/flows" -> ArchitectureFlows (Simulador Dinámico de Arquitectura)
 * - "/login" & "/login.html" -> Login (Vista de autenticación independiente)
 * - "/register" & "/register.html" -> Register (Wizard de registro independiente)
 * - "/forgot-password" & "/forgot-password.html" -> ForgotPassword (Recuperación)
 * - "*" (Comodín) -> Redirección segura a "/" para garantizar CERO pantallas en blanco.
 * ============================================================================
 */
function App() {
  return (
    <OperationAuthorization><Routes>
      {/* Vistas Corporativas / Landing con Layout Maestro (Header y Footer globales) */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="index.html" element={<Home />} />
        <Route path="index" element={<Home />} />
      </Route>

      {/* Dashboard Principal del Usuario (100% React SPA) */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/contract_interaction.html" element={<Dashboard />} />

      {/* Aplicación Web3 FinTech (Billetera & Exchange) - Sin Footer de marketing innecesario */}
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/wallet.html" element={<Wallet />} />
      <Route path="/exchange" element={<Exchange />} />
      <Route path="/exchange.html" element={<Exchange />} />

      {/* Simulador Dinámico de Arquitectura y Flujos de Procesos React */}
      <Route path="/flows" element={<ArchitectureFlows />} />
      <Route path="/architecture" element={<ArchitectureFlows />} />
      <Route path="/admin/flows" element={<AdminGate><ArchitectureFlows /></AdminGate>} />

      {/* Panel Administrativo Web3 y Gobernanza de Smart Contracts V4 */}
      <Route path="/admin/web3" element={<AdminGate><AdminWeb3Panel /></AdminGate>} />
      <Route path="/admin/contracts" element={<AdminGate><AdminWeb3Panel /></AdminGate>} />
      <Route path="/admin-contracts.html" element={<AdminGate><AdminWeb3Panel /></AdminGate>} />
      <Route path="/admin-web3.html" element={<AdminGate><AdminWeb3Panel /></AdminGate>} />

      {/* Rutas de Autenticación Independientes (Sin Header/Footer) */}
      <Route path="/login" element={<Login />} />
      <Route path="/login.html" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register.html" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forgot-password.html" element={<ForgotPassword />} />

      {/* Fallback Universal: Si ninguna ruta coincide, redirige de forma segura al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></OperationAuthorization>
  );
}

export default App;

