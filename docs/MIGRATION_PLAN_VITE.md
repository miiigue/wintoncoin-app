# Plan de Migración a Vite + Workbox

## Resumen Ejecutivo

**Objetivo**: Migrar el frontend de WintonCoin desde un sistema de assets estáticos con versionado manual a un pipeline moderno con Vite + Workbox.

**Estándar**: Siguiendo mejores prácticas de la industria fintech/bancaria:
- Zero-downtime deployment
- Rollback instantáneo
- Cache busting automático
- Service Worker gestionado por Workbox (Google)
- Auditoría completa antes de merge

---

## Estado Actual vs Estado Objetivo

### Antes (Manual)
```
frontend/
├── style.v1.5.0.css          ← Versionado manual
├── utils.v1.5.0.js           ← Funciones globales
├── interaction.v1.5.0.js     ← Scripts por página
├── sw.js                     ← Service Worker manual
└── *.html                    ← Referencias hardcoded
```

### Después (Vite + Workbox)
```
frontend/
├── src/
│   ├── styles/
│   │   └── main.css          ← CSS sin versión
│   ├── modules/
│   │   ├── utils.js          ← Módulo ES con exports
│   │   └── alerts.js         ← Funciones separadas
│   ├── pages/
│   │   ├── dashboard.js      ← Entry point por página
│   │   └── login.js
│   └── main.js               ← Entry point común
├── public/
│   ├── assets/icons/         ← Assets estáticos
│   └── manifest.json
├── index.html                ← HTML entry points
├── vite.config.js            ← Configuración Vite
└── dist/                     ← Build de producción
    ├── assets/
    │   ├── main.a3f8b2c.js   ← Hash automático
    │   └── main.x7y9z1k.css
    └── sw.js                 ← Generado por Workbox
```

---

## Fases de Migración

### Fase 0: Preparación (Actual)
- [x] Crear rama `feature/vite-migration`
- [x] Documentar plan de migración
- [ ] Instalar dependencias de desarrollo

### Fase 1: Setup Básico de Vite
**Riesgo**: Bajo
**Rollback**: Eliminar archivos nuevos

Acciones:
1. Crear `package.json` en frontend (si no existe)
2. Instalar Vite + plugins necesarios
3. Crear `vite.config.js` básico
4. Verificar que el servidor de desarrollo funciona

### Fase 2: Migrar Utilidades a Módulos ES
**Riesgo**: Medio
**Rollback**: Restaurar archivos originales

Acciones:
1. Crear directorio `src/modules/`
2. Refactorizar `utils.v1.5.0.js` a módulos ES con `export`
3. Mantener compatibilidad global temporalmente (window.funcName)
4. Probar que las funciones siguen funcionando

### Fase 3: Migrar Primer HTML (Prueba)
**Riesgo**: Medio
**Rollback**: Revertir cambios en HTML

Acciones:
1. Elegir `index.html` (login) como prueba
2. Cambiar script tags a `type="module"`
3. Usar imports ES en lugar de scripts globales
4. Verificar funcionalidad completa

### Fase 4: Configurar Workbox
**Riesgo**: Alto (afecta PWA)
**Rollback**: Restaurar sw.js manual

Acciones:
1. Instalar `vite-plugin-pwa`
2. Configurar estrategias de cache equivalentes
3. Generar Service Worker automático
4. Probar PWA en dispositivo real

### Fase 5: Migrar Resto del Frontend
**Riesgo**: Medio
**Rollback**: Revertir commits individuales

Acciones:
1. Migrar cada HTML/JS uno por uno
2. Probar cada página después de migrar
3. Eliminar archivos versionados obsoletos

### Fase 6: Testing y Merge
**Riesgo**: Bajo (si fases anteriores OK)

Acciones:
1. Testing completo en staging
2. Lighthouse audit (PWA, Performance)
3. Crear PR con checklist
4. Merge a main
5. Verificar producción

---

## Configuración Vite Propuesta

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: '.', // frontend/
  base: '/',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Para debugging en producción
    rollupOptions: {
      input: {
        main: 'index.html',
        dashboard: 'contract_interaction.html',
        register: 'register.html',
        // ... más entry points
      }
    }
  },
  
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/icons/*.png', 'manifest.json'],
      manifest: false, // Usar manifest.json existente
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
        runtimeCaching: [
          // Network First para HTML
          {
            urlPattern: /\.html$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: { maxAgeSeconds: 60 * 60 * 24 }
            }
          },
          // Cache First para assets estáticos
          {
            urlPattern: /\.(css|js|png|jpg|svg|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // Network Only para API
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly'
          },
          // Fonts de Google
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

---

## Conversión de Módulos

### Antes (Global)
```javascript
// utils.v1.5.0.js
function showCustomAlert(message, onClose) {
  // ...
}

window.getApiUrl = function() {
  // ...
};
```

### Después (ES Modules)
```javascript
// src/modules/alerts.js
export function showCustomAlert(message, onClose) {
  // ...
}

// src/modules/config.js
export function getApiUrl() {
  // ...
}

// Para compatibilidad temporal
if (typeof window !== 'undefined') {
  window.showCustomAlert = showCustomAlert;
  window.getApiUrl = getApiUrl;
}
```

### Uso en páginas
```javascript
// src/pages/dashboard.js
import { showCustomAlert } from '../modules/alerts.js';
import { getApiUrl } from '../modules/config.js';

// Usar normalmente
showCustomAlert('Mensaje');
```

---

## Checklist de Seguridad (Fintech)

### Pre-Deployment
- [ ] Todos los endpoints API usan HTTPS
- [ ] No hay secrets en código fuente
- [ ] CSP headers configurados
- [ ] Sourcemaps solo en staging, no en prod

### Testing
- [ ] Funcionalidad completa verificada
- [ ] PWA instalable y funcional offline
- [ ] Lighthouse score > 90 en todas las categorías
- [ ] Probado en Chrome, Safari, Firefox
- [ ] Probado en Android e iOS

### Rollback Plan
1. Si falla Fase 1-3: `git checkout main`
2. Si falla Fase 4 (PWA): Restaurar `sw.js` manual
3. Si falla en producción: Revertir deploy, notificar equipo

---

## Cronograma Estimado

| Fase | Duración | Riesgo |
|------|----------|--------|
| 0: Preparación | 15 min | Bajo |
| 1: Setup Vite | 30 min | Bajo |
| 2: Módulos ES | 45 min | Medio |
| 3: HTML prueba | 30 min | Medio |
| 4: Workbox | 45 min | Alto |
| 5: Migración completa | 2-3 horas | Medio |
| 6: Testing/Merge | 1 hora | Bajo |

**Total estimado**: 5-6 horas de trabajo técnico

---

## Notas Importantes

1. **No tocar main**: Todo el trabajo se hace en `feature/vite-migration`
2. **Commits atómicos**: Un commit por cambio lógico
3. **Testing continuo**: Probar después de cada fase
4. **Documentar cambios**: Actualizar EVOLUCION.md al completar

---

*Documento creado: 2026-01-11*
*Autor: AI Assistant*
*Versión: 1.0*
