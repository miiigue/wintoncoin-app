// vite.config.js
import { defineConfig } from "file:///C:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/node_modules/vite/dist/node/index.js";
import { VitePWA } from "file:///C:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/node_modules/vite-plugin-pwa/dist/index.js";
import { resolve } from "path";
var __vite_injected_original_dirname = "C:\\Users\\migue\\OneDrive\\Escritorio\\WINTONCOIN\\smart-contract\\frontend";
var vite_config_default = defineConfig({
  // Directorio raíz del proyecto
  root: ".",
  // Base URL para assets (./ para rutas relativas - compatible con Hostinger)
  base: "./",
  // Directorio para archivos estáticos (se copian tal cual al dist)
  publicDir: "public",
  // Configuración de resolución de módulos
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "src"),
      "@modules": resolve(__vite_injected_original_dirname, "src/modules"),
      "@styles": resolve(__vite_injected_original_dirname, "src/styles")
    }
  },
  // ============================================================================
  // BUILD CONFIGURATION
  // ============================================================================
  build: {
    // Directorio de salida
    outDir: "dist",
    // Directorio para assets (CSS, JS, imágenes procesadas)
    assetsDir: "assets",
    // Generar sourcemaps para debugging (desactivar en producción si es necesario)
    sourcemap: true,
    // Limpiar directorio antes de build
    emptyOutDir: true,
    // Configuración de Rollup
    rollupOptions: {
      // Entry points - cada HTML es un entry point
      input: {
        // Páginas principales
        main: resolve(__vite_injected_original_dirname, "index.html"),
        dashboard: resolve(__vite_injected_original_dirname, "contract_interaction.html"),
        register: resolve(__vite_injected_original_dirname, "register.html"),
        // Páginas de funcionalidad
        publish: resolve(__vite_injected_original_dirname, "publish.html"),
        publicationDetail: resolve(__vite_injected_original_dirname, "publication-detail.html"),
        profile: resolve(__vite_injected_original_dirname, "profile.html"),
        history: resolve(__vite_injected_original_dirname, "history.html"),
        transactions: resolve(__vite_injected_original_dirname, "transactions.html"),
        referrals: resolve(__vite_injected_original_dirname, "referrals.html"),
        boosterProfile: resolve(__vite_injected_original_dirname, "booster-profile.html"),
        // P2P
        p2p: resolve(__vite_injected_original_dirname, "p2p.html"),
        p2pHistory: resolve(__vite_injected_original_dirname, "p2p-history.html"),
        // Páginas informativas
        docs: resolve(__vite_injected_original_dirname, "docs.html"),
        comoFunciona: resolve(__vite_injected_original_dirname, "como-funciona.html"),
        love: resolve(__vite_injected_original_dirname, "love.html"),
        terms: resolve(__vite_injected_original_dirname, "terms.html"),
        privacy: resolve(__vite_injected_original_dirname, "privacy.html"),
        // Admin
        admin: resolve(__vite_injected_original_dirname, "admin.html"),
        adminPanel: resolve(__vite_injected_original_dirname, "admin-panel.html")
      },
      // Optimización de chunks
      output: {
        // Nombres de archivos con hash para cache busting
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
        // Separar vendors en chunk propio (mejor caching)
        manualChunks: {
          vendor: ["workbox-window"]
        }
      }
    },
    // Target de navegadores
    target: "es2020",
    // Minificación
    minify: "esbuild"
  },
  // ============================================================================
  // PWA CONFIGURATION (Workbox)
  // ============================================================================
  plugins: [
    VitePWA({
      // Modo de registro del Service Worker
      registerType: "autoUpdate",
      // Assets que se incluyen siempre
      includeAssets: [
        "assets/icons/*.png",
        "assets/icons/*.svg",
        "assets/*.png",
        "assets/*.svg",
        "manifest.json"
      ],
      // No generar manifest, usar el existente
      manifest: false,
      // Configuración de Workbox
      workbox: {
        // Patrones de archivos a precachear
        globPatterns: [
          "**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff,woff2,ttf}"
        ],
        // Excluir archivos
        globIgnores: [
          "**/node_modules/**",
          "sw.js",
          // El viejo SW manual
          "generate-*.js",
          // Scripts de generación
          "generate-*.html"
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
            handler: "NetworkFirst",
            options: {
              cacheName: "wintoncoin-html-v1",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
                // 24 horas
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
            handler: "CacheFirst",
            options: {
              cacheName: "wintoncoin-assets-v1",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 año (inmutables)
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
            handler: "CacheFirst",
            options: {
              cacheName: "wintoncoin-images-v1",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
                // 30 días
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
            handler: "CacheFirst",
            options: {
              cacheName: "wintoncoin-fonts-v1",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 año
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
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
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
            handler: "NetworkOnly",
            options: {
              backgroundSync: {
                name: "wintoncoin-api-queue",
                options: {
                  maxRetentionTime: 24 * 60
                  // 24 horas
                }
              }
            }
          },
          // ----------------------------------------
          // CDN externos (QRCode, etc): Cache First
          // ----------------------------------------
          {
            urlPattern: /^https:\/\/cdn\.rawgit\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "external-cdn",
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
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // Skip waiting y claim clients
        skipWaiting: true,
        clientsClaim: true
      },
      // Dev options
      devOptions: {
        enabled: true,
        // Habilitar en desarrollo para testing
        type: "module"
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
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      },
      "/notifications": {
        target: "http://localhost:3000",
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
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtaWd1ZVxcXFxPbmVEcml2ZVxcXFxFc2NyaXRvcmlvXFxcXFdJTlRPTkNPSU5cXFxcc21hcnQtY29udHJhY3RcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXG1pZ3VlXFxcXE9uZURyaXZlXFxcXEVzY3JpdG9yaW9cXFxcV0lOVE9OQ09JTlxcXFxzbWFydC1jb250cmFjdFxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvbWlndWUvT25lRHJpdmUvRXNjcml0b3Jpby9XSU5UT05DT0lOL3NtYXJ0LWNvbnRyYWN0L2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gV2ludG9uQ29pbiBGcm9udGVuZCAtIFZpdGUgQ29uZmlndXJhdGlvblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gQ29uZmlndXJhY2lcdTAwRjNuIHByb2Zlc2lvbmFsIHNpZ3VpZW5kbyBtZWpvcmVzIHByXHUwMEUxY3RpY2FzIGZpbnRlY2gvYmFuY2FyaWFcbi8vIC0gQnVpbGQgb3B0aW1pemFkbyBjb24gdHJlZS1zaGFraW5nXG4vLyAtIFBXQSBjb24gV29ya2JveCBhdXRvbVx1MDBFMXRpY29cbi8vIC0gQ2FjaGUgYnVzdGluZyBjb24gaGFzaGVzXG4vLyAtIFNvdXJjZW1hcHMgcGFyYSBkZWJ1Z2dpbmdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgLy8gRGlyZWN0b3JpbyByYVx1MDBFRHogZGVsIHByb3llY3RvXG4gIHJvb3Q6ICcuJyxcblxuICAvLyBCYXNlIFVSTCBwYXJhIGFzc2V0cyAoLi8gcGFyYSBydXRhcyByZWxhdGl2YXMgLSBjb21wYXRpYmxlIGNvbiBIb3N0aW5nZXIpXG4gIGJhc2U6ICcuLycsXG5cbiAgLy8gRGlyZWN0b3JpbyBwYXJhIGFyY2hpdm9zIGVzdFx1MDBFMXRpY29zIChzZSBjb3BpYW4gdGFsIGN1YWwgYWwgZGlzdClcbiAgcHVibGljRGlyOiAncHVibGljJyxcblxuICAvLyBDb25maWd1cmFjaVx1MDBGM24gZGUgcmVzb2x1Y2lcdTAwRjNuIGRlIG1cdTAwRjNkdWxvc1xuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKSxcbiAgICAgICdAbW9kdWxlcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL21vZHVsZXMnKSxcbiAgICAgICdAc3R5bGVzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc3R5bGVzJyksXG4gICAgfVxuICB9LFxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gQlVJTEQgQ09ORklHVVJBVElPTlxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIGJ1aWxkOiB7XG4gICAgLy8gRGlyZWN0b3JpbyBkZSBzYWxpZGFcbiAgICBvdXREaXI6ICdkaXN0JyxcblxuICAgIC8vIERpcmVjdG9yaW8gcGFyYSBhc3NldHMgKENTUywgSlMsIGltXHUwMEUxZ2VuZXMgcHJvY2VzYWRhcylcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxuXG4gICAgLy8gR2VuZXJhciBzb3VyY2VtYXBzIHBhcmEgZGVidWdnaW5nIChkZXNhY3RpdmFyIGVuIHByb2R1Y2NpXHUwMEYzbiBzaSBlcyBuZWNlc2FyaW8pXG4gICAgc291cmNlbWFwOiB0cnVlLFxuXG4gICAgLy8gTGltcGlhciBkaXJlY3RvcmlvIGFudGVzIGRlIGJ1aWxkXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG5cbiAgICAvLyBDb25maWd1cmFjaVx1MDBGM24gZGUgUm9sbHVwXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgLy8gRW50cnkgcG9pbnRzIC0gY2FkYSBIVE1MIGVzIHVuIGVudHJ5IHBvaW50XG4gICAgICBpbnB1dDoge1xuICAgICAgICAvLyBQXHUwMEUxZ2luYXMgcHJpbmNpcGFsZXNcbiAgICAgICAgbWFpbjogcmVzb2x2ZShfX2Rpcm5hbWUsICdpbmRleC5odG1sJyksXG4gICAgICAgIGRhc2hib2FyZDogcmVzb2x2ZShfX2Rpcm5hbWUsICdjb250cmFjdF9pbnRlcmFjdGlvbi5odG1sJyksXG4gICAgICAgIHJlZ2lzdGVyOiByZXNvbHZlKF9fZGlybmFtZSwgJ3JlZ2lzdGVyLmh0bWwnKSxcblxuICAgICAgICAvLyBQXHUwMEUxZ2luYXMgZGUgZnVuY2lvbmFsaWRhZFxuICAgICAgICBwdWJsaXNoOiByZXNvbHZlKF9fZGlybmFtZSwgJ3B1Ymxpc2guaHRtbCcpLFxuICAgICAgICBwdWJsaWNhdGlvbkRldGFpbDogcmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWNhdGlvbi1kZXRhaWwuaHRtbCcpLFxuICAgICAgICBwcm9maWxlOiByZXNvbHZlKF9fZGlybmFtZSwgJ3Byb2ZpbGUuaHRtbCcpLFxuICAgICAgICBoaXN0b3J5OiByZXNvbHZlKF9fZGlybmFtZSwgJ2hpc3RvcnkuaHRtbCcpLFxuICAgICAgICB0cmFuc2FjdGlvbnM6IHJlc29sdmUoX19kaXJuYW1lLCAndHJhbnNhY3Rpb25zLmh0bWwnKSxcbiAgICAgICAgcmVmZXJyYWxzOiByZXNvbHZlKF9fZGlybmFtZSwgJ3JlZmVycmFscy5odG1sJyksXG4gICAgICAgIGJvb3N0ZXJQcm9maWxlOiByZXNvbHZlKF9fZGlybmFtZSwgJ2Jvb3N0ZXItcHJvZmlsZS5odG1sJyksXG5cbiAgICAgICAgLy8gUDJQXG4gICAgICAgIHAycDogcmVzb2x2ZShfX2Rpcm5hbWUsICdwMnAuaHRtbCcpLFxuICAgICAgICBwMnBIaXN0b3J5OiByZXNvbHZlKF9fZGlybmFtZSwgJ3AycC1oaXN0b3J5Lmh0bWwnKSxcblxuICAgICAgICAvLyBQXHUwMEUxZ2luYXMgaW5mb3JtYXRpdmFzXG4gICAgICAgIGRvY3M6IHJlc29sdmUoX19kaXJuYW1lLCAnZG9jcy5odG1sJyksXG4gICAgICAgIGNvbW9GdW5jaW9uYTogcmVzb2x2ZShfX2Rpcm5hbWUsICdjb21vLWZ1bmNpb25hLmh0bWwnKSxcbiAgICAgICAgbG92ZTogcmVzb2x2ZShfX2Rpcm5hbWUsICdsb3ZlLmh0bWwnKSxcbiAgICAgICAgdGVybXM6IHJlc29sdmUoX19kaXJuYW1lLCAndGVybXMuaHRtbCcpLFxuICAgICAgICBwcml2YWN5OiByZXNvbHZlKF9fZGlybmFtZSwgJ3ByaXZhY3kuaHRtbCcpLFxuXG4gICAgICAgIC8vIEFkbWluXG4gICAgICAgIGFkbWluOiByZXNvbHZlKF9fZGlybmFtZSwgJ2FkbWluLmh0bWwnKSxcbiAgICAgICAgYWRtaW5QYW5lbDogcmVzb2x2ZShfX2Rpcm5hbWUsICdhZG1pbi1wYW5lbC5odG1sJyksXG4gICAgICB9LFxuXG4gICAgICAvLyBPcHRpbWl6YWNpXHUwMEYzbiBkZSBjaHVua3NcbiAgICAgIG91dHB1dDoge1xuICAgICAgICAvLyBOb21icmVzIGRlIGFyY2hpdm9zIGNvbiBoYXNoIHBhcmEgY2FjaGUgYnVzdGluZ1xuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0uW2hhc2hdLmpzJyxcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXS5qcycsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS5baGFzaF0uW2V4dF0nLFxuXG4gICAgICAgIC8vIFNlcGFyYXIgdmVuZG9ycyBlbiBjaHVuayBwcm9waW8gKG1lam9yIGNhY2hpbmcpXG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIHZlbmRvcjogWyd3b3JrYm94LXdpbmRvdyddLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIFRhcmdldCBkZSBuYXZlZ2Fkb3Jlc1xuICAgIHRhcmdldDogJ2VzMjAyMCcsXG5cbiAgICAvLyBNaW5pZmljYWNpXHUwMEYzblxuICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICB9LFxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gUFdBIENPTkZJR1VSQVRJT04gKFdvcmtib3gpXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgcGx1Z2luczogW1xuICAgIFZpdGVQV0Eoe1xuICAgICAgLy8gTW9kbyBkZSByZWdpc3RybyBkZWwgU2VydmljZSBXb3JrZXJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuXG4gICAgICAvLyBBc3NldHMgcXVlIHNlIGluY2x1eWVuIHNpZW1wcmVcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcbiAgICAgICAgJ2Fzc2V0cy9pY29ucy8qLnBuZycsXG4gICAgICAgICdhc3NldHMvaWNvbnMvKi5zdmcnLFxuICAgICAgICAnYXNzZXRzLyoucG5nJyxcbiAgICAgICAgJ2Fzc2V0cy8qLnN2ZycsXG4gICAgICAgICdtYW5pZmVzdC5qc29uJ1xuICAgICAgXSxcblxuICAgICAgLy8gTm8gZ2VuZXJhciBtYW5pZmVzdCwgdXNhciBlbCBleGlzdGVudGVcbiAgICAgIG1hbmlmZXN0OiBmYWxzZSxcblxuICAgICAgLy8gQ29uZmlndXJhY2lcdTAwRjNuIGRlIFdvcmtib3hcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgLy8gUGF0cm9uZXMgZGUgYXJjaGl2b3MgYSBwcmVjYWNoZWFyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1xuICAgICAgICAgICcqKi8qLntqcyxjc3MsaHRtbCxwbmcsanBnLGpwZWcsc3ZnLGljbyx3b2ZmLHdvZmYyLHR0Zn0nXG4gICAgICAgIF0sXG5cbiAgICAgICAgLy8gRXhjbHVpciBhcmNoaXZvc1xuICAgICAgICBnbG9iSWdub3JlczogW1xuICAgICAgICAgICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgICAgICAgICdzdy5qcycsIC8vIEVsIHZpZWpvIFNXIG1hbnVhbFxuICAgICAgICAgICdnZW5lcmF0ZS0qLmpzJywgLy8gU2NyaXB0cyBkZSBnZW5lcmFjaVx1MDBGM25cbiAgICAgICAgICAnZ2VuZXJhdGUtKi5odG1sJ1xuICAgICAgICBdLFxuXG4gICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgICAgLy8gUlVOVElNRSBDQUNISU5HIFNUUkFURUdJRVNcbiAgICAgICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgICAvLyBIVE1MOiBOZXR3b3JrIEZpcnN0IChzaWVtcHJlIGNvbnRlbmlkbyBmcmVzY28pXG4gICAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC5odG1sJC8sXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya0ZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnd2ludG9uY29pbi1odG1sLXYxJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDUwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAvLyAyNCBob3Jhc1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBuZXR3b3JrVGltZW91dFNlY29uZHM6IDEwLFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xuICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgICAvLyBDU1MvSlMgY29uIGhhc2g6IENhY2hlIEZpcnN0IChpbm11dGFibGUpXG4gICAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC9hc3NldHNcXC8uKlxcLlthLWYwLTldezh9XFwuKGNzc3xqcykkLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnd2ludG9uY29pbi1hc3NldHMtdjEnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSAvLyAxIGFcdTAwRjFvIChpbm11dGFibGVzKVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xuICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgICAvLyBJbVx1MDBFMWdlbmVzOiBDYWNoZSBGaXJzdCBjb24gcmV2YWxpZGFjaVx1MDBGM25cbiAgICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL1xcLihwbmd8anBnfGpwZWd8c3ZnfGdpZnxpY298d2VicCkkLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnd2ludG9uY29pbi1pbWFnZXMtdjEnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDMwIC8vIDMwIGRcdTAwRURhc1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xuICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgICAvLyBGb250czogQ2FjaGUgRmlyc3QgKGxhcmdhIGR1cmFjaVx1MDBGM24pXG4gICAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC4od29mZnx3b2ZmMnx0dGZ8b3RmKSQvLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICd3aW50b25jb2luLWZvbnRzLXYxJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDIwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSAvLyAxIGFcdTAwRjFvXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAgIC8vIEdvb2dsZSBGb250czogQ2FjaGUgRmlyc3RcbiAgICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdvb2dsZWFwaXNcXC5jb20vLFxuICAgICAgICAgICAgaGFuZGxlcjogJ1N0YWxlV2hpbGVSZXZhbGlkYXRlJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZ29vZ2xlLWZvbnRzLXN0eWxlc2hlZXRzJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDEwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ3N0YXRpY1xcLmNvbS8sXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2dvb2dsZS1mb250cy13ZWJmb250cycsXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAzMCxcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjVcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG5cbiAgICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgICAgLy8gQVBJIENhbGxzOiBOZXR3b3JrIE9ubHkgKGRhdG9zIGVuIHRpZW1wbyByZWFsKVxuICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwvYXBpXFwvLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrT25seScsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGJhY2tncm91bmRTeW5jOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3dpbnRvbmNvaW4tYXBpLXF1ZXVlJyxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICBtYXhSZXRlbnRpb25UaW1lOiAyNCAqIDYwIC8vIDI0IGhvcmFzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgICAvLyBDRE4gZXh0ZXJub3MgKFFSQ29kZSwgZXRjKTogQ2FjaGUgRmlyc3RcbiAgICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9jZG5cXC5yYXdnaXRcXC5jb20vLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdleHRlcm5hbC1jZG4nLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAsXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzBcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgXSxcblxuICAgICAgICAvLyBOYXZlZ2FjaVx1MDBGM24gb2ZmbGluZVxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrOiAnaW5kZXguaHRtbCcsXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2tEZW55bGlzdDogWy9eXFwvYXBpXFwvL10sXG5cbiAgICAgICAgLy8gU2tpcCB3YWl0aW5nIHkgY2xhaW0gY2xpZW50c1xuICAgICAgICBza2lwV2FpdGluZzogdHJ1ZSxcbiAgICAgICAgY2xpZW50c0NsYWltOiB0cnVlLFxuICAgICAgfSxcblxuICAgICAgLy8gRGV2IG9wdGlvbnNcbiAgICAgIGRldk9wdGlvbnM6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSwgLy8gSGFiaWxpdGFyIGVuIGRlc2Fycm9sbG8gcGFyYSB0ZXN0aW5nXG4gICAgICAgIHR5cGU6ICdtb2R1bGUnXG4gICAgICB9XG4gICAgfSlcbiAgXSxcblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIERFViBTRVJWRVIgQ09ORklHVVJBVElPTlxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIHNlcnZlcjoge1xuICAgIC8vIFB1ZXJ0byBkZSBkZXNhcnJvbGxvXG4gICAgcG9ydDogNTE3MyxcblxuICAgIC8vIEFicmlyIG5hdmVnYWRvciBhdXRvbVx1MDBFMXRpY2FtZW50ZVxuICAgIG9wZW46IGZhbHNlLFxuXG4gICAgLy8gUHJveHkgcGFyYSBBUEkgKGV2aXRhciBDT1JTIGVuIGRlc2Fycm9sbG8pXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICAgIH0sXG4gICAgICAnL25vdGlmaWNhdGlvbnMnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBDT1JTIGhlYWRlcnNcbiAgICBjb3JzOiB0cnVlLFxuXG4gICAgLy8gSG9zdCBwYXJhIGFjY2VzbyBkZXNkZSBMQU5cbiAgICBob3N0OiB0cnVlXG4gIH0sXG5cbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBQUkVWSUVXIFNFUlZFUiAocGFyYSBwcm9iYXIgYnVpbGRzKVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIHByZXZpZXc6IHtcbiAgICBwb3J0OiA0MTczLFxuICAgIGhvc3Q6IHRydWVcbiAgfVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBVUEsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQVp4QixJQUFNLG1DQUFtQztBQWN6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQTtBQUFBLEVBRTFCLE1BQU07QUFBQTtBQUFBLEVBR04sTUFBTTtBQUFBO0FBQUEsRUFHTixXQUFXO0FBQUE7QUFBQSxFQUdYLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsTUFDN0IsWUFBWSxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUM1QyxXQUFXLFFBQVEsa0NBQVcsWUFBWTtBQUFBLElBQzVDO0FBQUEsRUFDRjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRO0FBQUE7QUFB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
