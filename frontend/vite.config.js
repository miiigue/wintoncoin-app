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

export default defineConfig({
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
        dashboard: resolve(__dirname, 'contract_interaction.html'),
        register: resolve(__dirname, 'register.html'),

        // Páginas de funcionalidad
        publish: resolve(__dirname, 'publish.html'),
        publicationDetail: resolve(__dirname, 'publication-detail.html'),
        profile: resolve(__dirname, 'profile.html'),
        history: resolve(__dirname, 'history.html'),
        transactions: resolve(__dirname, 'transactions.html'),
        referrals: resolve(__dirname, 'referrals.html'),
        boosterProfile: resolve(__dirname, 'booster-profile.html'),

        // P2P
        p2p: resolve(__dirname, 'p2p.html'),
        p2pHistory: resolve(__dirname, 'p2p-history.html'),

        // Páginas informativas
        docs: resolve(__dirname, 'docs.html'),
        comoFunciona: resolve(__dirname, 'como-funciona.html'),
        love: resolve(__dirname, 'love.html'),
        terms: resolve(__dirname, 'terms.html'),
        privacy: resolve(__dirname, 'privacy.html'),

        // Admin
        admin: resolve(__dirname, 'admin.html'),
        adminPanel: resolve(__dirname, 'admin-panel.html'),
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
  // PWA CONFIGURATION (Workbox)
  // ============================================================================
  plugins: [
    VitePWA({
      // Modo de registro del Service Worker
      registerType: 'autoUpdate',

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

      // Configuración de Workbox
      workbox: {
        // Patrones de archivos a precachear
        globPatterns: [
          '**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff,woff2,ttf}'
        ],

        // Excluir archivos
        globIgnores: [
          '**/node_modules/**',
          'sw.js', // El viejo SW manual
          'generate-*.js', // Scripts de generación
          'generate-*.html'
        ],

        // ========================================
        // RUNTIME CACHING STRATEGIES
        // ========================================
        runtimeCaching: [
          // ----------------------------------------
          // HTML: Network First (siempre contenido fresco)
          // ----------------------------------------
          {
            urlPattern: /\.html$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'wintoncoin-html-v1',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 horas
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },

          // ----------------------------------------
          // CSS/JS con hash: Cache First (inmutable)
          // ----------------------------------------
          {
            urlPattern: /\/assets\/.*\.[a-f0-9]{8}\.(css|js)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wintoncoin-assets-v1',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año (inmutables)
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },

          // ----------------------------------------
          // Imágenes: Cache First con revalidación
          // ----------------------------------------
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|ico|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wintoncoin-images-v1',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },

          // ----------------------------------------
          // Fonts: Cache First (larga duración)
          // ----------------------------------------
          {
            urlPattern: /\.(woff|woff2|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wintoncoin-fonts-v1',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },

          // ----------------------------------------
          // Google Fonts: Cache First
          // ----------------------------------------
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },

          // ----------------------------------------
          // API Calls: Network Only (datos en tiempo real)
          // ----------------------------------------
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'wintoncoin-api-queue',
                options: {
                  maxRetentionTime: 24 * 60 // 24 horas
                }
              }
            }
          },

          // ----------------------------------------
          // CDN externos (QRCode, etc): Cache First
          // ----------------------------------------
          {
            urlPattern: /^https:\/\/cdn\.rawgit\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-cdn',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],

        // Navegación offline
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],

        // Skip waiting y claim clients
        skipWaiting: true,
        clientsClaim: true,
      },

      // Dev options
      devOptions: {
        enabled: true, // Habilitar en desarrollo para testing
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
});
