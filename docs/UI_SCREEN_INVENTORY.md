# UI Screen Inventory (Frontend)

Objetivo: tener una vista unica y jerarquica de todas las pantallas UI, sus assets JS y sus modales/subventanas.
Regla: cada vez que se cree una pantalla nueva o se agregue un modal, actualizar este archivo.

## 1) Autenticacion y onboarding

- Login
  - HTML: `frontend/index.html`
  - JS: `frontend/login.v1.4.1.js`
  - Modales: `customAlertModal`, `oneAccountPolicyModal`
- Registro
  - HTML: `frontend/register.html`
  - JS: `frontend/register.v1.4.1.js`
  - Modales: `customAlertModal`, `oneAccountPolicyModal`, `referralCodeModal`

### Tabla - Autenticacion y onboarding

| Pantalla | HTML | JS | Modales |
| --- | --- | --- | --- |
| Login | `frontend/index.html` | `frontend/login.v1.4.1.js` | `customAlertModal`, `oneAccountPolicyModal` |
| Registro | `frontend/register.html` | `frontend/register.v1.4.1.js` | `customAlertModal`, `oneAccountPolicyModal`, `referralCodeModal` |

## 2) Core (usuario)

- Perfil de Impulsor
  - HTML: `frontend/booster-profile.html`
  - JS: `frontend/booster-profile.v1.4.1.js`
  - Modales: `customAlertModal`
- Panel principal / Interaccion
  - HTML: `frontend/contract_interaction.html`
  - JS: `frontend/interaction.v1.4.1.js`
  - Modales: `burnModal`, `customAlertModal`, `customConfirmModal`, `publicationTypeModal`, `qrCodeModal`, `quickSaleModal`, `ratingModal`
- Historial
  - HTML: `frontend/history.html`
  - JS: `frontend/history.v1.4.1.js`
  - Modales: `customAlertModal`
- Perfil de usuario
  - HTML: `frontend/profile.html`
  - JS: `frontend/profile.v1.4.1.js`
  - Modales: `customAlertModal`
- Detalle de publicacion
  - HTML: `frontend/publication-detail.html`
  - JS: `frontend/publication-detail.v1.4.1.js`
  - Modales: `customAlertModal`, `customConfirmModal`, `ratingModal`
- Publicar
  - HTML: `frontend/publish.html`
  - JS: `frontend/publish.v1.4.1.js`
  - Modales: `donationWarningModal`, `tutorRequiredModal`
- Referidos
  - HTML: `frontend/referrals.html`
  - JS: `frontend/referrals.v1.4.1.js`
  - Modales: `customAlertModal`
- Transacciones
  - HTML: `frontend/transactions.html`
  - JS: `frontend/transactions.v1.4.1.js`
  - Modales: `customAlertModal`

### Tabla - Core (usuario)

| Pantalla | HTML | JS | Modales |
| --- | --- | --- | --- |
| Perfil de Impulsor | `frontend/booster-profile.html` | `frontend/booster-profile.v1.4.1.js` | `customAlertModal` |
| Panel principal / Interaccion | `frontend/contract_interaction.html` | `frontend/interaction.v1.4.1.js` | `burnModal`, `customAlertModal`, `customConfirmModal`, `publicationTypeModal`, `qrCodeModal`, `quickSaleModal`, `ratingModal` |
| Historial | `frontend/history.html` | `frontend/history.v1.4.1.js` | `customAlertModal` |
| Perfil de usuario | `frontend/profile.html` | `frontend/profile.v1.4.1.js` | `customAlertModal` |
| Detalle de publicacion | `frontend/publication-detail.html` | `frontend/publication-detail.v1.4.1.js` | `customAlertModal`, `customConfirmModal`, `ratingModal` |
| Publicar | `frontend/publish.html` | `frontend/publish.v1.4.1.js` | `donationWarningModal`, `tutorRequiredModal` |
| Referidos | `frontend/referrals.html` | `frontend/referrals.v1.4.1.js` | `customAlertModal` |
| Transacciones | `frontend/transactions.html` | `frontend/transactions.v1.4.1.js` | `customAlertModal` |

## 3) P2P

- P2P historial
  - HTML: `frontend/p2p-history.html`
  - JS: `frontend/p2p-history.v1.4.1.js`
  - Modales: (sin modales)
- P2P principal
  - HTML: `frontend/p2p.html`
  - JS: `frontend/p2p.v1.4.1.js`
  - Modales: `p2pOfferModal`, `p2pOrderModal`

### Tabla - P2P

| Pantalla | HTML | JS | Modales | Subpantallas |
| --- | --- | --- | --- | --- |
| P2P historial | `frontend/p2p-history.html` | `frontend/p2p-history.v1.4.1.js` | (sin modales) | (sin subpantallas) |
| P2P principal | `frontend/p2p.html` | `frontend/p2p.v1.4.1.js` | `p2pOfferModal`, `p2pOrderModal` | `frontend/p2p-history.html` |

## 4) Admin

- Admin panel
  - HTML: `frontend/admin-panel.html`
  - JS: `frontend/admin-panel.v1.4.1.js`
  - Modales: `customAlertModal`
- Admin login
  - HTML: `frontend/admin.html`
  - JS: `frontend/admin-login.v1.4.1.js`
  - Modales: `customAlertModal`

### Tabla - Admin

| Pantalla | HTML | JS | Modales |
| --- | --- | --- | --- |
| Admin panel | `frontend/admin-panel.html` | `frontend/admin-panel.v1.4.1.js` | `customAlertModal` |
| Admin login | `frontend/admin.html` | `frontend/admin-login.v1.4.1.js` | `customAlertModal` |

## 5) Otras pantallas

- Love
  - HTML: `frontend/love.html`
  - JS: `frontend/love.v1.4.1.js`
  - Modales: (sin modales)

### Tabla - Otras pantallas

| Pantalla | HTML | JS | Modales |
| --- | --- | --- | --- |
| Love | `frontend/love.html` | `frontend/love.v1.4.1.js` | (sin modales) |

## 6) Pantallas estaticas (sin JS)

- Como funciona
  - HTML: `frontend/como-funciona.html`
- Privacidad
  - HTML: `frontend/privacy.html`
- Terminos
  - HTML: `frontend/terms.html`

## 7) Core utilities

- Utilidades globales
  - JS: `frontend/utils.v1.4.1.js`
  - Modales: `customAlertModal`, `customConfirmModal` (usados por varias pantallas)

### Tabla - Core utilities

| Item | JS | Modales |
| --- | --- | --- |
| Utilidades globales | `frontend/utils.v1.4.1.js` | `customAlertModal`, `customConfirmModal` |
