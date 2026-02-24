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
        login: resolve(__vite_injected_original_dirname, "login.html"),
        dashboard: resolve(__vite_injected_original_dirname, "contract_interaction.html"),
        register: resolve(__vite_injected_original_dirname, "register.html"),
        forgotPassword: resolve(__vite_injected_original_dirname, "forgot-password.html"),
        migrate: resolve(__vite_injected_original_dirname, "migrate.html"),
        // Páginas de funcionalidad
        publish: resolve(__vite_injected_original_dirname, "publish.html"),
        publicationDetail: resolve(__vite_injected_original_dirname, "publication-detail.html"),
        profile: resolve(__vite_injected_original_dirname, "profile.html"),
        history: resolve(__vite_injected_original_dirname, "history.html"),
        transactions: resolve(__vite_injected_original_dirname, "transactions.html"),
        referrals: resolve(__vite_injected_original_dirname, "referrals.html"),
        boosterProfile: resolve(__vite_injected_original_dirname, "booster-profile.html"),
        // Páginas de Marketing
        faq: resolve(__vite_injected_original_dirname, "faq.html"),
        ofrecerAyuda: resolve(__vite_injected_original_dirname, "ofrecer-ayuda.html"),
        pedirAyuda: resolve(__vite_injected_original_dirname, "pedir-ayuda.html"),
        // P2P
        p2p: resolve(__vite_injected_original_dirname, "p2p.html"),
        p2pHistory: resolve(__vite_injected_original_dirname, "p2p-history.html"),
        // Páginas informativas
        docs: resolve(__vite_injected_original_dirname, "docs.html"),
        documentation: resolve(__vite_injected_original_dirname, "documentation.html"),
        roadmap: resolve(__vite_injected_original_dirname, "roadmap.html"),
        comoFunciona: resolve(__vite_injected_original_dirname, "como-funciona.html"),
        legado: resolve(__vite_injected_original_dirname, "legado.html"),
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
      // CRÍTICO: Usar injectManifest para incluir push notification handlers
      // generateSW NO soporta custom event listeners (push, notificationclick)
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw-source.js",
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
      // Configuración de InjectManifest
      injectManifest: {
        // Patrones de archivos a precachear
        globPatterns: [
          "**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff,woff2,ttf}"
        ],
        // Excluir archivos
        globIgnores: [
          "**/node_modules/**",
          "sw.js",
          "generate-*.js",
          "generate-*.html"
        ]
      },
      // Dev options
      devOptions: {
        enabled: true,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtaWd1ZVxcXFxPbmVEcml2ZVxcXFxFc2NyaXRvcmlvXFxcXFdJTlRPTkNPSU5cXFxcc21hcnQtY29udHJhY3RcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXG1pZ3VlXFxcXE9uZURyaXZlXFxcXEVzY3JpdG9yaW9cXFxcV0lOVE9OQ09JTlxcXFxzbWFydC1jb250cmFjdFxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvbWlndWUvT25lRHJpdmUvRXNjcml0b3Jpby9XSU5UT05DT0lOL3NtYXJ0LWNvbnRyYWN0L2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBXaW50b25Db2luIEZyb250ZW5kIC0gVml0ZSBDb25maWd1cmF0aW9uXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gQ29uZmlndXJhY2lcdTAwRjNuIHByb2Zlc2lvbmFsIHNpZ3VpZW5kbyBtZWpvcmVzIHByXHUwMEUxY3RpY2FzIGZpbnRlY2gvYmFuY2FyaWFcclxuLy8gLSBCdWlsZCBvcHRpbWl6YWRvIGNvbiB0cmVlLXNoYWtpbmdcclxuLy8gLSBQV0EgY29uIFdvcmtib3ggYXV0b21cdTAwRTF0aWNvXHJcbi8vIC0gQ2FjaGUgYnVzdGluZyBjb24gaGFzaGVzXHJcbi8vIC0gU291cmNlbWFwcyBwYXJhIGRlYnVnZ2luZ1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XHJcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgLy8gRGlyZWN0b3JpbyByYVx1MDBFRHogZGVsIHByb3llY3RvXHJcbiAgcm9vdDogJy4nLFxyXG5cclxuICAvLyBCYXNlIFVSTCBwYXJhIGFzc2V0cyAoLi8gcGFyYSBydXRhcyByZWxhdGl2YXMgLSBjb21wYXRpYmxlIGNvbiBIb3N0aW5nZXIpXHJcbiAgYmFzZTogJy4vJyxcclxuXHJcbiAgLy8gRGlyZWN0b3JpbyBwYXJhIGFyY2hpdm9zIGVzdFx1MDBFMXRpY29zIChzZSBjb3BpYW4gdGFsIGN1YWwgYWwgZGlzdClcclxuICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxyXG5cclxuICAvLyBDb25maWd1cmFjaVx1MDBGM24gZGUgcmVzb2x1Y2lcdTAwRjNuIGRlIG1cdTAwRjNkdWxvc1xyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKSxcclxuICAgICAgJ0Btb2R1bGVzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvbW9kdWxlcycpLFxyXG4gICAgICAnQHN0eWxlcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3N0eWxlcycpLFxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAvLyBCVUlMRCBDT05GSUdVUkFUSU9OXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gIGJ1aWxkOiB7XHJcbiAgICAvLyBEaXJlY3RvcmlvIGRlIHNhbGlkYVxyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcblxyXG4gICAgLy8gRGlyZWN0b3JpbyBwYXJhIGFzc2V0cyAoQ1NTLCBKUywgaW1cdTAwRTFnZW5lcyBwcm9jZXNhZGFzKVxyXG4gICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcclxuXHJcbiAgICAvLyBHZW5lcmFyIHNvdXJjZW1hcHMgcGFyYSBkZWJ1Z2dpbmcgKGRlc2FjdGl2YXIgZW4gcHJvZHVjY2lcdTAwRjNuIHNpIGVzIG5lY2VzYXJpbylcclxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcclxuXHJcbiAgICAvLyBMaW1waWFyIGRpcmVjdG9yaW8gYW50ZXMgZGUgYnVpbGRcclxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxyXG5cclxuICAgIC8vIENvbmZpZ3VyYWNpXHUwMEYzbiBkZSBSb2xsdXBcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgLy8gRW50cnkgcG9pbnRzIC0gY2FkYSBIVE1MIGVzIHVuIGVudHJ5IHBvaW50XHJcbiAgICAgIGlucHV0OiB7XHJcbiAgICAgICAgLy8gUFx1MDBFMWdpbmFzIHByaW5jaXBhbGVzXHJcbiAgICAgICAgbWFpbjogcmVzb2x2ZShfX2Rpcm5hbWUsICdpbmRleC5odG1sJyksXHJcbiAgICAgICAgbG9naW46IHJlc29sdmUoX19kaXJuYW1lLCAnbG9naW4uaHRtbCcpLFxyXG4gICAgICAgIGRhc2hib2FyZDogcmVzb2x2ZShfX2Rpcm5hbWUsICdjb250cmFjdF9pbnRlcmFjdGlvbi5odG1sJyksXHJcbiAgICAgICAgcmVnaXN0ZXI6IHJlc29sdmUoX19kaXJuYW1lLCAncmVnaXN0ZXIuaHRtbCcpLFxyXG4gICAgICAgIGZvcmdvdFBhc3N3b3JkOiByZXNvbHZlKF9fZGlybmFtZSwgJ2ZvcmdvdC1wYXNzd29yZC5odG1sJyksXHJcbiAgICAgICAgbWlncmF0ZTogcmVzb2x2ZShfX2Rpcm5hbWUsICdtaWdyYXRlLmh0bWwnKSxcclxuXHJcbiAgICAgICAgLy8gUFx1MDBFMWdpbmFzIGRlIGZ1bmNpb25hbGlkYWRcclxuICAgICAgICBwdWJsaXNoOiByZXNvbHZlKF9fZGlybmFtZSwgJ3B1Ymxpc2guaHRtbCcpLFxyXG4gICAgICAgIHB1YmxpY2F0aW9uRGV0YWlsOiByZXNvbHZlKF9fZGlybmFtZSwgJ3B1YmxpY2F0aW9uLWRldGFpbC5odG1sJyksXHJcbiAgICAgICAgcHJvZmlsZTogcmVzb2x2ZShfX2Rpcm5hbWUsICdwcm9maWxlLmh0bWwnKSxcclxuICAgICAgICBoaXN0b3J5OiByZXNvbHZlKF9fZGlybmFtZSwgJ2hpc3RvcnkuaHRtbCcpLFxyXG4gICAgICAgIHRyYW5zYWN0aW9uczogcmVzb2x2ZShfX2Rpcm5hbWUsICd0cmFuc2FjdGlvbnMuaHRtbCcpLFxyXG4gICAgICAgIHJlZmVycmFsczogcmVzb2x2ZShfX2Rpcm5hbWUsICdyZWZlcnJhbHMuaHRtbCcpLFxyXG4gICAgICAgIGJvb3N0ZXJQcm9maWxlOiByZXNvbHZlKF9fZGlybmFtZSwgJ2Jvb3N0ZXItcHJvZmlsZS5odG1sJyksXHJcblxyXG4gICAgICAgIC8vIFBcdTAwRTFnaW5hcyBkZSBNYXJrZXRpbmdcclxuICAgICAgICBmYXE6IHJlc29sdmUoX19kaXJuYW1lLCAnZmFxLmh0bWwnKSxcclxuICAgICAgICBvZnJlY2VyQXl1ZGE6IHJlc29sdmUoX19kaXJuYW1lLCAnb2ZyZWNlci1heXVkYS5odG1sJyksXHJcbiAgICAgICAgcGVkaXJBeXVkYTogcmVzb2x2ZShfX2Rpcm5hbWUsICdwZWRpci1heXVkYS5odG1sJyksXHJcblxyXG4gICAgICAgIC8vIFAyUFxyXG4gICAgICAgIHAycDogcmVzb2x2ZShfX2Rpcm5hbWUsICdwMnAuaHRtbCcpLFxyXG4gICAgICAgIHAycEhpc3Rvcnk6IHJlc29sdmUoX19kaXJuYW1lLCAncDJwLWhpc3RvcnkuaHRtbCcpLFxyXG5cclxuICAgICAgICAvLyBQXHUwMEUxZ2luYXMgaW5mb3JtYXRpdmFzXHJcbiAgICAgICAgZG9jczogcmVzb2x2ZShfX2Rpcm5hbWUsICdkb2NzLmh0bWwnKSxcclxuICAgICAgICBkb2N1bWVudGF0aW9uOiByZXNvbHZlKF9fZGlybmFtZSwgJ2RvY3VtZW50YXRpb24uaHRtbCcpLFxyXG4gICAgICAgIHJvYWRtYXA6IHJlc29sdmUoX19kaXJuYW1lLCAncm9hZG1hcC5odG1sJyksXHJcbiAgICAgICAgY29tb0Z1bmNpb25hOiByZXNvbHZlKF9fZGlybmFtZSwgJ2NvbW8tZnVuY2lvbmEuaHRtbCcpLFxyXG4gICAgICAgIGxlZ2FkbzogcmVzb2x2ZShfX2Rpcm5hbWUsICdsZWdhZG8uaHRtbCcpLFxyXG4gICAgICAgIGxvdmU6IHJlc29sdmUoX19kaXJuYW1lLCAnbG92ZS5odG1sJyksXHJcbiAgICAgICAgdGVybXM6IHJlc29sdmUoX19kaXJuYW1lLCAndGVybXMuaHRtbCcpLFxyXG4gICAgICAgIHByaXZhY3k6IHJlc29sdmUoX19kaXJuYW1lLCAncHJpdmFjeS5odG1sJyksXHJcblxyXG4gICAgICAgIC8vIEFkbWluXHJcbiAgICAgICAgYWRtaW46IHJlc29sdmUoX19kaXJuYW1lLCAnYWRtaW4uaHRtbCcpLFxyXG4gICAgICAgIGFkbWluUGFuZWw6IHJlc29sdmUoX19kaXJuYW1lLCAnYWRtaW4tcGFuZWwuaHRtbCcpLFxyXG4gICAgICB9LFxyXG5cclxuICAgICAgLy8gT3B0aW1pemFjaVx1MDBGM24gZGUgY2h1bmtzXHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vIE5vbWJyZXMgZGUgYXJjaGl2b3MgY29uIGhhc2ggcGFyYSBjYWNoZSBidXN0aW5nXHJcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXS5qcycsXHJcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXS5qcycsXHJcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXS5bZXh0XScsXHJcblxyXG4gICAgICAgIC8vIFNlcGFyYXIgdmVuZG9ycyBlbiBjaHVuayBwcm9waW8gKG1lam9yIGNhY2hpbmcpXHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICB2ZW5kb3I6IFsnd29ya2JveC13aW5kb3cnXSxcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLy8gVGFyZ2V0IGRlIG5hdmVnYWRvcmVzXHJcbiAgICB0YXJnZXQ6ICdlczIwMjAnLFxyXG5cclxuICAgIC8vIE1pbmlmaWNhY2lcdTAwRjNuXHJcbiAgICBtaW5pZnk6ICdlc2J1aWxkJyxcclxuICB9LFxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgLy8gUFdBIENPTkZJR1VSQVRJT04gKFdvcmtib3gpXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gIHBsdWdpbnM6IFtcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICAvLyBNb2RvIGRlIHJlZ2lzdHJvIGRlbCBTZXJ2aWNlIFdvcmtlclxyXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcclxuXHJcbiAgICAgIC8vIENSXHUwMENEVElDTzogVXNhciBpbmplY3RNYW5pZmVzdCBwYXJhIGluY2x1aXIgcHVzaCBub3RpZmljYXRpb24gaGFuZGxlcnNcclxuICAgICAgLy8gZ2VuZXJhdGVTVyBOTyBzb3BvcnRhIGN1c3RvbSBldmVudCBsaXN0ZW5lcnMgKHB1c2gsIG5vdGlmaWNhdGlvbmNsaWNrKVxyXG4gICAgICBzdHJhdGVnaWVzOiAnaW5qZWN0TWFuaWZlc3QnLFxyXG4gICAgICBzcmNEaXI6ICdzcmMnLFxyXG4gICAgICBmaWxlbmFtZTogJ3N3LXNvdXJjZS5qcycsXHJcblxyXG4gICAgICAvLyBBc3NldHMgcXVlIHNlIGluY2x1eWVuIHNpZW1wcmVcclxuICAgICAgaW5jbHVkZUFzc2V0czogW1xyXG4gICAgICAgICdhc3NldHMvaWNvbnMvKi5wbmcnLFxyXG4gICAgICAgICdhc3NldHMvaWNvbnMvKi5zdmcnLFxyXG4gICAgICAgICdhc3NldHMvKi5wbmcnLFxyXG4gICAgICAgICdhc3NldHMvKi5zdmcnLFxyXG4gICAgICAgICdtYW5pZmVzdC5qc29uJ1xyXG4gICAgICBdLFxyXG5cclxuICAgICAgLy8gTm8gZ2VuZXJhciBtYW5pZmVzdCwgdXNhciBlbCBleGlzdGVudGVcclxuICAgICAgbWFuaWZlc3Q6IGZhbHNlLFxyXG5cclxuICAgICAgLy8gQ29uZmlndXJhY2lcdTAwRjNuIGRlIEluamVjdE1hbmlmZXN0XHJcbiAgICAgIGluamVjdE1hbmlmZXN0OiB7XHJcbiAgICAgICAgLy8gUGF0cm9uZXMgZGUgYXJjaGl2b3MgYSBwcmVjYWNoZWFyXHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbXHJcbiAgICAgICAgICAnKiovKi57anMsY3NzLGh0bWwscG5nLGpwZyxqcGVnLHN2ZyxpY28sd29mZix3b2ZmMix0dGZ9J1xyXG4gICAgICAgIF0sXHJcblxyXG4gICAgICAgIC8vIEV4Y2x1aXIgYXJjaGl2b3NcclxuICAgICAgICBnbG9iSWdub3JlczogW1xyXG4gICAgICAgICAgJyoqL25vZGVfbW9kdWxlcy8qKicsXHJcbiAgICAgICAgICAnc3cuanMnLFxyXG4gICAgICAgICAgJ2dlbmVyYXRlLSouanMnLFxyXG4gICAgICAgICAgJ2dlbmVyYXRlLSouaHRtbCdcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG5cclxuICAgICAgLy8gRGV2IG9wdGlvbnNcclxuICAgICAgZGV2T3B0aW9uczoge1xyXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgdHlwZTogJ21vZHVsZSdcclxuICAgICAgfVxyXG4gICAgfSlcclxuICBdLFxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgLy8gREVWIFNFUlZFUiBDT05GSUdVUkFUSU9OXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gIHNlcnZlcjoge1xyXG4gICAgLy8gUHVlcnRvIGRlIGRlc2Fycm9sbG9cclxuICAgIHBvcnQ6IDUxNzMsXHJcblxyXG4gICAgLy8gQWJyaXIgbmF2ZWdhZG9yIGF1dG9tXHUwMEUxdGljYW1lbnRlXHJcbiAgICBvcGVuOiBmYWxzZSxcclxuXHJcbiAgICAvLyBQcm94eSBwYXJhIEFQSSAoZXZpdGFyIENPUlMgZW4gZGVzYXJyb2xsbylcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2VcclxuICAgICAgfSxcclxuICAgICAgJy9ub3RpZmljYXRpb25zJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2VcclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvLyBDT1JTIGhlYWRlcnNcclxuICAgIGNvcnM6IHRydWUsXHJcblxyXG4gICAgLy8gSG9zdCBwYXJhIGFjY2VzbyBkZXNkZSBMQU5cclxuICAgIGhvc3Q6IHRydWVcclxuICB9LFxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgLy8gUFJFVklFVyBTRVJWRVIgKHBhcmEgcHJvYmFyIGJ1aWxkcylcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgcHJldmlldzoge1xyXG4gICAgcG9ydDogNDE3MyxcclxuICAgIGhvc3Q6IHRydWVcclxuICB9XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBVUEsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQVp4QixJQUFNLG1DQUFtQztBQWN6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQTtBQUFBLEVBRTFCLE1BQU07QUFBQTtBQUFBLEVBR04sTUFBTTtBQUFBO0FBQUEsRUFHTixXQUFXO0FBQUE7QUFBQSxFQUdYLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsTUFDN0IsWUFBWSxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUM1QyxXQUFXLFFBQVEsa0NBQVcsWUFBWTtBQUFBLElBQzVDO0FBQUEsRUFDRjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRO0FBQUE7QUFBQSxJQUdSLFdBQVc7QUFBQTtBQUFBLElBR1gsV0FBVztBQUFBO0FBQUEsSUFHWCxhQUFhO0FBQUE7QUFBQSxJQUdiLGVBQWU7QUFBQTtBQUFBLE1BRWIsT0FBTztBQUFBO0FBQUEsUUFFTCxNQUFNLFFBQVEsa0NBQVcsWUFBWTtBQUFBLFFBQ3JDLE9BQU8sUUFBUSxrQ0FBVyxZQUFZO0FBQUEsUUFDdEMsV0FBVyxRQUFRLGtDQUFXLDJCQUEyQjtBQUFBLFFBQ3pELFVBQVUsUUFBUSxrQ0FB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
