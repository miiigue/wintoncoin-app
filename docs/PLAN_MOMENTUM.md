# 🚀 Plan de Implementación: "Winton Momentum"
## Sistema Integral de Gestión de Influencers

**Fecha:** 2026-02-23
**Estado:** Pendiente de aprobación

---

## 1. VISIÓN GENERAL

Sistema modular de dos frentes (Portal de Creadores + Panel Admin) para gestionar
el programa de impulsores/influencers de WintonCoin.

### Principios de Diseño
- **Modularidad Total**: Nuevo módulo independiente, CERO modificaciones al código existente
- **Reutilización**: Usa la infraestructura existente (emailService, auth middleware, pool DB)
- **Escalabilidad**: Backend como rutas Express separadas, frontend como páginas independientes
- **Seguridad**: JWT auth, validación de permisos por tier, auditoría completa

---

## 2. ARQUITECTURA DE ARCHIVOS (Nuevos)

```
backend/
├── src/
│   ├── controllers/
│   │   └── momentumController.js    ← Toda la lógica de endpoints
│   ├── routes/
│   │   └── momentumRoutes.js        ← Definición de rutas Express
│   └── services/
│       └── momentumService.js       ← Lógica de negocio reutilizable
├── migrations/
│   └── 029_create_momentum_system.js ← Migración de esquema DB
│
frontend/
├── momentum-landing.html            ← Landing pública /impulsores
├── momentum-dashboard.html          ← Dashboard privado del influencer
├── momentum-landing.css             ← Estilos landing (Dark Fintech)
├── momentum-dashboard.css           ← Estilos dashboard
├── src/
│   ├── pages/
│   │   ├── momentum-landing.js      ← Lógica landing (simulador, FOMO)
│   │   └── momentum-dashboard.js    ← Lógica dashboard (misiones, saldos)
│   └── modules/
│       └── momentum-admin.js        ← Módulo admin (se carga en admin-panel)
```

### Integración con código existente (MÍNIMA)
Solo se necesitan **2 líneas** en `server.js`:
```js
// En startServer(), después de las rutas existentes:
const momentumRoutes = require('./src/routes/momentumRoutes');
app.use('/api/momentum', momentumRoutes);
```

---

## 3. ESQUEMA DE BASE DE DATOS

### Tabla: `momentum_profiles` (Perfiles de Influencer)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL PK | ID único |
| user_id | INT FK → users(id) | Vínculo a cuenta WintonCoin |
| nickname | VARCHAR(100) | Nombre artístico |
| social_platform | VARCHAR(50) | Plataforma principal |
| social_link | VARCHAR(500) | URL del perfil |
| social_screenshot_url | VARCHAR(500) | Captura de estadísticas |
| followers_count | INT | Número de seguidores |
| tier | VARCHAR(20) DEFAULT 'PENDIENTE' | PENDIENTE/BRONCE/PLATA/ORO |
| confirmed_iou_balance | NUMERIC(19,4) DEFAULT 0 | Saldo BLUE IOU confirmado |
| pending_iou_balance | NUMERIC(19,4) DEFAULT 0 | Saldo pendiente de verificación |
| admin_notes | TEXT | Notas internas del admin |
| status | VARCHAR(20) DEFAULT 'active' | active/suspended |
| created_at | TIMESTAMPTZ | Fecha de registro |
| updated_at | TIMESTAMPTZ | Última actualización |

### Tabla: `momentum_global_config` (Configuración Global)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | INT PK DEFAULT 1 | Singleton |
| multiplier | NUMERIC(10,2) DEFAULT 15 | Multiplicador vigente |
| phase_name | VARCHAR(100) DEFAULT 'Etapa 2' | Nombre de la fase actual |
| phase_end_date | TIMESTAMPTZ | Fecha fin del contador |
| total_slots | INT DEFAULT 100 | Cupos totales |
| occupied_slots | INT DEFAULT 0 | Cupos ocupados |
| updated_at | TIMESTAMPTZ | Última modificación |

### Tabla: `momentum_campaigns` (Campañas/Tareas)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL PK | ID único |
| title | VARCHAR(255) | Título de la campaña |
| description | TEXT | Instrucciones detalladas |
| base_pay_bronce | NUMERIC(19,4) | Pago base nivel Bronce |
| base_pay_plata | NUMERIC(19,4) | Pago base nivel Plata |
| base_pay_oro | NUMERIC(19,4) | Pago base nivel Oro |
| is_active | BOOLEAN DEFAULT TRUE | Activa o pausada |
| created_by | INT FK → users(id) | Admin que la creó |
| created_at | TIMESTAMPTZ | Fecha creación |
| updated_at | TIMESTAMPTZ | Última modificación |

### Tabla: `momentum_submissions` (Entregas de Tareas)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL PK | ID único |
| profile_id | INT FK → momentum_profiles(id) | Influencer |
| campaign_id | INT FK → momentum_campaigns(id) | Campaña |
| proof_link | VARCHAR(1000) | URL del contenido realizado |
| status | VARCHAR(20) DEFAULT 'PENDIENTE' | PENDIENTE/APROBADO/RECHAZADO |
| admin_note | TEXT | Nota de auditoría |
| bonus_amount | NUMERIC(19,4) DEFAULT 0 | Bono extra por desempeño |
| paid_amount | NUMERIC(19,4) | Monto final pagado |
| reviewed_by | INT FK → users(id) | Admin que revisó |
| submitted_at | TIMESTAMPTZ | Fecha de envío |
| reviewed_at | TIMESTAMPTZ | Fecha de revisión |

### Tabla: `momentum_ledger` (Historial de movimientos IOU)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL PK | ID único |
| profile_id | INT FK → momentum_profiles(id) | Influencer |
| type | VARCHAR(50) | task_payment, bonus, adjustment |
| amount | NUMERIC(19,4) | Monto (+/-) |
| balance_type | VARCHAR(20) | confirmed/pending |
| description | TEXT | Descripción del movimiento |
| related_submission_id | INT FK nullable | Entrega relacionada |
| created_at | TIMESTAMPTZ | Fecha del movimiento |

---

## 4. ENDPOINTS API (Backend)

### Públicos (Sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/momentum/landing-data | Config pública (multiplicador, cupos, fase) |
| GET | /api/momentum/recent-payments | Últimas misiones pagadas (Social Proof) |

### Influencer (verifyUserToken)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/momentum/apply | Postularse como influencer |
| GET | /api/momentum/profile | Mi perfil momentum |
| GET | /api/momentum/campaigns | Campañas disponibles para mi tier |
| POST | /api/momentum/submissions | Enviar entrega de tarea |
| GET | /api/momentum/submissions | Mis entregas |
| GET | /api/momentum/balance | Mis saldos (confirmado + pendiente) |
| GET | /api/momentum/ledger | Mi historial de movimientos |

### Admin (verifyAdminToken)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/momentum/admin/config | Obtener config global |
| PUT | /api/momentum/admin/config | Editar config global |
| GET | /api/momentum/admin/applicants | Lista de postulantes |
| PUT | /api/momentum/admin/profiles/:id/tier | Asignar tier |
| GET | /api/momentum/admin/profiles | Lista de influencers |
| GET | /api/momentum/admin/profiles/:id | Detalle de influencer |
| POST | /api/momentum/admin/campaigns | Crear campaña |
| PUT | /api/momentum/admin/campaigns/:id | Editar campaña |
| DELETE | /api/momentum/admin/campaigns/:id | Desactivar campaña |
| GET | /api/momentum/admin/submissions | Entregas pendientes |
| POST | /api/momentum/admin/submissions/:id/approve | Aprobar y pagar |
| POST | /api/momentum/admin/submissions/:id/reject | Rechazar |
| GET | /api/momentum/admin/export-ledger | Exportar ledger CSV |

---

## 5. FRONTEND - PÁGINAS

### A. Landing Pública (`momentum-landing.html`)
- Simulador interactivo (tarifa × multiplicador = resultado en dorado brillante)
- Barra de FOMO (cupos agotados + contador regresivo)
- Tabla de "Últimas Misiones Pagadas" (Social Proof)
- Formulario de postulación (red social + captura de estadísticas)
- Estética: Dark Fintech (#0D1117, #FFD700, Azul eléctrico)

### B. Dashboard Influencer (`momentum-dashboard.html`)
- Widgets de saldo: "Confirmado" vs "Pendiente de Verificación"
- Marketplace de misiones (filtrado por tier, muestra pago_base × multiplicador)
- Módulo de entrega (pega link + envía a revisión)
- Historial de movimientos
- Autenticación requerida (JWT)

### C. Panel Admin (módulo en admin-panel existente)
- Configurador Global (multiplicador, cupos, fase)
- Gestión de Influencers (asignar tier, ver historial)
- Creador de Campañas (valores por nivel)
- Verificador de Tareas (aprobar/rechazar con notas)
- Exportar Ledger (CSV)

---

## 6. REGLAS DE NEGOCIO INMUTABLES

1. **Pago final = Valor_Base_Tier × Multiplicador_Global**
2. **Un influencer NO puede ver tareas de nivel superior al suyo**
3. **Saldo "Pendiente" NO es sumable al líquido hasta aprobación manual**
4. **Al aprobar tarea → se envía email de notificación automático**
5. **Al asignar tier → el influencer desbloquea tareas de su rango**
6. **El admin puede aplicar bonos extra al momento de aprobar**

---

## 7. PREGUNTAS CRÍTICAS (ANTES DE CODIFICAR)

> Estas preguntas necesitan respuesta para tomar las decisiones arquitectónicas correctas.

### P1: Relación con el sistema Booster existente
El proyecto ya tiene tablas `booster_*` (booster_blue_ledger, booster_transactions, etc.).
**¿El sistema Momentum es INDEPENDIENTE o debe integrarse con el sistema Booster existente?**
- Opción A: Totalmente independiente (tablas separadas `momentum_*`)
- Opción B: Integrado (usa `booster_blue_ledger` para los saldos confirmados)
- **Mi recomendación: Opción A** (independiente), para no romper la lógica existente y
  poder migrar después si conviene.

### P2: Autenticación de Influencers
**¿Los influencers usan cuentas de usuario existentes de WintonCoin?**
- Opción A: Sí, se registran como usuarios normales y luego "aplican" al programa
- Opción B: Sistema de login separado solo para influencers
- **Mi recomendación: Opción A** (reusar usuarios existentes)

### P3: Landing en `/impulsores` vs subdominio
**¿Dónde va la landing?**
- Opción A: Como página del frontend actual (`momentum-landing.html`)
- Opción B: Subdominio separado (`momentum.wintoncoin.com`)
- **Mi recomendación: Opción A** (dentro del frontend existente, más simple)

### P4: Módulo Admin
**¿Se integra en el panel admin existente (`admin-panel.js`) o es una página separada?**
- Opción A: Pestaña/sección nueva dentro del admin-panel existente
- Opción B: Página admin separada
- **Mi recomendación: Opción A** si el admin-panel no está excesivamente grande,
  **Opción B** si preferimos aislamiento total. Dado que admin-panel.js tiene ~126KB,
  recomiendo **Opción B** (página admin separada `momentum-admin.html`).

### P5: Bono Extra
**¿Quieres que el Admin pueda agregar un bono EXTRA de BLUE IOU al aprobar una tarea?**
(Ej: si el video fue viral, sumar un bonus adicional)
- **Mi recomendación: Sí**, es una buena práctica. Lo implemento como campo opcional.

---

## 8. ORDEN DE EJECUCIÓN

1. Migración de Base de Datos (029_create_momentum_system.js)
2. Backend: Service → Controller → Routes
3. Integración mínima en server.js (2 líneas)
4. Frontend: Landing → Dashboard → Admin Module
5. Testing manual completo
6. Documentación de API
