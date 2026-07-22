/**
 * Controlador de Administración — WintonCoin (FACHADA DE COMPATIBILIDAD 100%)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Módulo Fachada que re-exporta de manera unificada el 100% de las funciones administrativas
 * desde sus submódulos especializados en 'src/controllers/admin/'.
 *
 * Arquitectura de Software & Clean Code:
 *   - Garantiza CERO rupturas (Zero Regressions) para todas las rutas y tests existentes.
 *   - Preserva exactitud simbólica y retrocompatibilidad total con Express Router y Jest.
 *   - Cumple con el Principio de Responsabilidad Única (SRP) y los estándares SOC 2.
 *
 * Submódulos Integrados:
 *   1. adminAuthSecurityController   — Autenticación, OTP, Roles e Invitaciones
 *   2. adminUserController           — Gestión de Usuarios, KYC y Deudores
 *   3. adminPublicationsController   — Moderación y Publicaciones Institucionales
 *   4. adminSystemSettingsController — Configuraciones Globales, Tramos y Booster Settings
 *   5. adminAuditStatsController     — Métricas Dashboard, Auditoría, Billetera y Operaciones Demo
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// 1. Importación de Submódulos Especializados
const adminAuthSecurityController   = require('./admin/adminAuthSecurityController');
const adminUserController           = require('./admin/adminUserController');
const adminPublicationsController   = require('./admin/adminPublicationsController');
const adminSystemSettingsController = require('./admin/adminSystemSettingsController');
const adminAuditStatsController     = require('./admin/adminAuditStatsController');

// 2. Re-exportación Unificada Inmutable (Patrón Fachada)
module.exports = {
    ...adminAuthSecurityController,
    ...adminUserController,
    ...adminPublicationsController,
    ...adminSystemSettingsController,
    ...adminAuditStatsController
};
