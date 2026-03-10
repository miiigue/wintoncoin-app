// ============================================================================
// WintonCoin Frontend - Vite Configuration
// ============================================================================
// Configuración profesional siguiendo mejores prácticas fintech/bancaria
// - Build optimizado con tree-shaking
// - PWA con Workbox automático
// - Cache busting con hashes
// - Sourcemaps para debugging
// ============================================================================

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// Plugin personalizado para inyectar alertas visuales de DEMO en la interfaz
const demoModePlugin = (mode) => {
  return {
    name: 'html-transform-demo',
    transformIndexHtml(html) {
      if (mode === 'demo') {
        // Ribbon diagonal profesional 
        const demoRibbon = `
          <div style="position: fixed; top: 0; right: 0; width: 150px; height: 150px; overflow: hidden; z-index: 999999; pointer-events: none;">
            <div style="position: absolute; top: 30px; right: -40px; background: linear-gradient(90deg, #e83e8c, #8B5CF6); color: white; padding: 5px 40px; transform: rotate(45deg); font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 800; text-align: center; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); letter-spacing: 2px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
              DEMO MODE
            </div>
          </div>
        `;

        // Inyectamos el ribbon estático antes del cierre del body
        let modifiedHtml = html.replace('</body>', `${demoRibbon}\n</body>`);

        // Interceptamos la etiqueta title para anteponerle la palabra [DEMO]
        modifiedHtml = modifiedHtml.replace(/<title>(.*?)<\/title>/, '<title>[DEMO] $1</title>');

        return modifiedHtml;
      }
      return html;
    }
  };
};

export default defineConfig(({ mode }) => ({
  // Directorio raíz del proyecto
  root: '.',

  // Base URL para assets (./ para rutas relativas - compatible con Hostinger)
  base: './',

  // Directorio para archivos estáticos (se copian tal cual al dist)
  publicDir: 'public',

  // Configuración de resolución de módulos
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@styles': resolve(__dirname, 'src/styles'),
    }
  },

  // ============================================================================
  // BUILD CONFIGURATION
  // ============================================================================
  build: {
    // Directorio de salida
    outDir: 'dist',

    // Directorio para assets (CSS, JS, imágenes procesadas)
    assetsDir: 'assets',

    // Generar sourcemaps para debugging (desactivar en producción si es necesario)
    sourcemap: true,

    // Limpiar directorio antes de build
    emptyOutDir: true,

    // Configuración de Rollup
    rollupOptions: {
      // Entry points - cada HTML es un entry point
      input: {
        // Páginas principales
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        dashboard: resolve(__dirname, 'contract_interaction.html'),
        register: resolve(__dirname, 'register.html'),
        forgotPassword: resolve(__dirname, 'forgot-password.html'),
        migrate: resolve(__dirname, 'migrate.html'),

        // Páginas de funcionalidad
        publish: resolve(__dirname, 'publish.html'),
        publicationDetail: resolve(__dirname, 'publication-detail.html'),
        profile: resolve(__dirname, 'profile.html'),
        history: resolve(__dirname, 'history.html'),
        transactions: resolve(__dirname, 'transactions.html'),
        referrals: resolve(__dirname, 'referrals.html'),
        boosterProfile: resolve(__dirname, 'booster-profile.html'),

        // Páginas de Marketing
        faq: resolve(__dirname, 'faq.html'),
        ofrecerAyuda: resolve(__dirname, 'ofrecer-ayuda.html'),
        pedirAyuda: resolve(__dirname, 'pedir-ayuda.html'),

        // P2P
        p2p: resolve(__dirname, 'p2p.html'),
        p2pHistory: resolve(__dirname, 'p2p-history.html'),

        // Páginas informativas
        docs: resolve(__dirname, 'docs.html'),
        documentation: resolve(__dirname, 'documentation.html'),
        roadmap: resolve(__dirname, 'roadmap.html'),
        comoFunciona: resolve(__dirname, 'como-funciona.html'),
        legado: resolve(__dirname, 'legado.html'),
        love: resolve(__dirname, 'love.html'),
        terms: resolve(__dirname, 'terms.html'),
        privacy: resolve(__dirname, 'privacy.html'),

        // Admin
        admin: resolve(__dirname, 'admin.html'),
        adminPanel: resolve(__dirname, 'admin-panel.html'),

        // Momentum System
        momentumLanding: resolve(__dirname, 'momentum-landing.html'),
        momentumDashboard: resolve(__dirname, 'momentum-dashboard.html'),
        momentumAdmin: resolve(__dirname, 'momentum-admin.html'),

        // WintonCoin Solidario (Casos Humanitarios)
        solicitudSolidaria: resolve(__dirname, 'solicitud-solidaria.html'),
        causaSolidaria: resolve(__dirname, 'causa-solidaria.html'),
      },

      // Optimización de chunks
      output: {
        // Nombres de archivos con hash para cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',

        // Separar vendors en chunk propio (mejor caching)
        manualChunks: {
          vendor: ['workbox-window'],
        }
      }
    },

    // Target de navegadores
    target: 'es2020',

    // Minificación
    minify: 'esbuild',
  },

  // ============================================================================
  // PWA CONFIGURATION (Workbox) & CUSTOM PLUGINS
  // ============================================================================
  plugins: [
    demoModePlugin(mode), // Inyecta listones visuales si mode === 'demo'
    VitePWA({
      // Modo de registro del Service Worker
      registerType: 'autoUpdate',

      // CRÍTICO: Usar injectManifest para incluir push notification handlers
      // generateSW NO soporta custom event listeners (push, notificationclick)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw-source.js',

      // Assets que se incluyen siempre
      includeAssets: [
        'assets/icons/*.png',
        'assets/icons/*.svg',
        'assets/*.png',
        'assets/*.svg',
        'manifest.json'
      ],

      // No generar manifest, usar el existente
      manifest: false,

      // Configuración de InjectManifest
      injectManifest: {
        // Patrones de archivos a precachear
        globPatterns: [
          '**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff,woff2,ttf}'
        ],

        // Excluir archivos
        globIgnores: [
          '**/node_modules/**',
          'sw.js',
          'generate-*.js',
          'generate-*.html'
        ],
      },

      // Dev options
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],

  // ============================================================================
  // DEV SERVER CONFIGURATION
  // ============================================================================
  server: {
    // Puerto de desarrollo
    port: 5173,

    // Abrir navegador automáticamente
    open: false,

    // Proxy para API (evitar CORS en desarrollo)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/notifications': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    },

    // CORS headers
    cors: true,

    // Host para acceso desde LAN
    host: true
  },

  // ============================================================================
  // PREVIEW SERVER (para probar builds)
  // ============================================================================
  preview: {
    port: 4173,
    host: true
  }
}));
