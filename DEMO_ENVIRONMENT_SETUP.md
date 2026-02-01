# Guía de Configuración: Staging Demo para WintonCoin

Esta guía detalla cómo desplegar el entorno `demo.wintoncoin.com` para presentaciones a inversionistas.

## 1. Concepto
Un entorno separado que utiliza una base de datos "sucia" (con datos ficticios) para que puedas realizar acciones en vivo (transacciones, publicaciones) sin afectar los saldos reales de los usuarios.

## 2. Requisitos Previos
- **Dominio**: Acceso al panel de control de tu dominio para crear subdominios (`demo` y `demo-api`).
- **Hosting**: Un nuevo servicio en Render/Hostinger o un nuevo deploy en tu VPS actual.
- **Base de Datos**: Una nueva base de datos PostgreSQL vacía (llamada `wintoncoin_demo`).

## 3. Pasos de Configuración

### A. Base de Datos (PostgreSQL)
1. Crea la base de datos:
   ```sql
   CREATE DATABASE wintoncoin_demo;
   ```
2. (Opcional) Si usas el mismo servidor DB, crea un usuario específico para la demo para mayor seguridad.

### B. Backend (API)
Necesitas desplegar una INSTANCIA SEPARADA del backend.

1. **Variables de Entorno**:
   Crea un archivo `.env` en el nuevo servidor backend con:
   ```ini
   NODE_ENV=production
   IS_DEMO_ENV=true
   DATABASE_URL=postgres://usuario:password@host/wintoncoin_demo
   PORT=3001  # Si corre en el mismo servidor que prod, usa otro puerto
   JWT_SECRET=secreto_demo_123
   ```
   *Nota: `IS_DEMO_ENV=true` es importante si quieres agregar lógicas de seguridad específicas para demo en el futuro.*

2. **Inicializar Datos (Sembrado)**:
   Desde tu máquina local (configurando el `.env.demo` para apuntar a la DB remota) o desde el servidor demo, corre el script de sembrado:
   ```bash
   # Opción 1: Ejecutar directamente con node
   node backend/scripts/seed_demo_data.js
   ```
   **Resultado**: Esto creará el usuario `demo_investor` (pass: `password123`) y datos de relleno.

### C. Frontend (La Web)
Necesitas desplegar una versión del frontend que apunte al Backend Demo.

1. **Configuración de Dominio**:
   Asegúrate de que la URL en el navegador sea `demo.wintoncoin.com`. 
   El archivo `src/modules/config.js` ya ha sido actualizado para detectar este subdominio y cambiar automáticamente la API a `https://demo-api.wintoncoin.com`.

2. **DNS**:
   - Apunta `demo.wintoncoin.com` -> Tu hosting de Frontend (ej. Vercel/Netlify/Hostinger).
   - Apunta `demo-api.wintoncoin.com` -> Tu hosting de Backend Demo.

3. **Build & Deploy**:
   Simplemente haz deploy de tu rama `main` (o la rama que uses) en el entorno de Demo.
   - **IMPORTANTE**: Si no puedes configurar `demo-api` como subdominio y usas una URL generada (tipo `wintoncoin-demo.onrender.com`), debes editar manualmente `frontend/src/modules/config.js` línea 26 con la URL correcta antes de hacer build.

## 4. Ejecución de la Demo
1. Entra a `demo.wintoncoin.com`.
2. Logueate con:
   - **Usuario**: `demo_investor`
   - **Contraseña**: `password123`
3. ¡Muestra la plataforma! 
   - Puedes enviar dinero a `marta_fintech` o `pedro_trader`.
   - Puedes crear publicaciones y ver cómo aparecen.
   - Nada de esto afecta a la base de datos real.

## 5. Mantenimiento
Antes de cada nueva reunión con inversionistas, corre el script de sembrado nuevamente para "reiniciar" la demo a un estado limpio y perfecto:
```bash
node backend/scripts/seed_demo_data.js
```
