# Sistema de Gobernanza Winton-Consensus - Guía de Configuración

## 📋 Requisitos Previos

1. Sistema de gobernanza inicializado (bootstrap completado)
2. Al menos 2 guardianes supervisores activos
3. (Opcional) `FRONTEND_URL` o auto-detección demo/producción para enlaces en correos

**Enlaces del correo:** los guardianes que deben votar reciben `?id=&focus=vote` (panel simplificado). El autor de la solicitud recibe solo `?id=` (panel completo para ver estado).

### WebAuthn y dominio (error "relying party ID…")

Los desafíos biométricos deben usar el **mismo dominio** que ves en el navegador (`demo.wintoncoin.com`, `sc.wintoncoin.com`, etc.). El backend toma el **Origin** de la petición al API y valida contra una lista permitida (incluye demo y producción por defecto; opcional `WEBAUTHN_ALLOWED_ORIGINS`).

Si antes registraste el dispositivo con un `rpId` incorrecto, tendrás que **volver a registrar** la biometría en ese entorno (una vez por dominio/dispositivo).

---

## 🔧 Configuración de Variables de Entorno

### Auto-detección de Entorno (Recomendado)

El sistema **detecta automáticamente** el entorno correcto para los links de email con la siguiente **prioridad**:

1. **DEMO** (Prioridad Alta) → Si `IS_DEMO_ENV=true` O `DATABASE_URL` contiene `wintoncoin_demo` → `https://demo.wintoncoin.com`
2. **Producción** → Si `NODE_ENV=production` (y no es demo) → `https://sc.wintoncoin.com`
3. **Local** → Por defecto → `http://localhost:3000`

### ⚠️ IMPORTANTE para Render (Demo)

En tu servicio de backend demo en Render, **debes configurar**:

```bash
IS_DEMO_ENV=true
```

O asegurarte de que tu `DATABASE_URL` contenga la palabra `wintoncoin_demo`.

**Sin esto, el backend asumirá que es producción** y los links apuntarán a `sc.wintoncoin.com` en lugar de `demo.wintoncoin.com`.

### Sobreescribir (Opcional)

Si necesitas forzar una URL específica (por ejemplo, para pruebas locales contra demo), agrega a tu `.env`:

```bash
FRONTEND_URL=https://demo.wintoncoin.com
```

**¿Por qué es necesaria?**
Los emails de gobernanza incluyen botones que deben apuntar a URLs absolutas para que funcionen correctamente cuando el guardián hace clic desde su cliente de correo (Gmail, Outlook, etc.).

---

## 🔐 Flujo de Votación con Biometría

### ¿Cómo funciona la biometría en gobernanza?

El sistema usa **WebAuthn (FIDO2)**, el estándar de la industria para autenticación biométrica:

```
┌─────────────────────────────────────────────────────────────┐
│  FLUJO COMPLETO DE VOTACIÓN                                 │
├─────────────────────────────────────────────────────────────┤
│  1. Guardián recibe EMAIL → "Votar Ahora"                   │
│  2. Click en botón → Abre governance-panel.html             │
│  3. Si no está logueado → Login con JWT (usuario/password)  │
│  4. Ve la solicitud → Click en "Aprobar" o "Rechazar"       │
│  5. Sistema solicita BIOMETRÍA del dispositivo              │
│  6. Guardián autentica con huella/Face ID/Windows Hello     │
│  7. Voto se registra con firma criptográfica                │
└─────────────────────────────────────────────────────────────┘
```

### Dispositivos Compatibles

- **Móvil Android**: Huella dactilar / Face Unlock
- **iPhone/iPad**: Touch ID / Face ID
- **Windows PC**: Windows Hello (huella, PIN, reconocimiento facial)
- **Mac**: Touch ID (MacBook Pro/Air con sensor)
- **Llave física**: YubiKey, Google Titan Key

### Primera Vez: Registro de Biometría

La primera vez que un guardián intenta votar:

1. El sistema detecta que no tiene biometría registrada
2. Muestra un modal: **"Registrar Dispositivo Biométrico"**
3. El guardián hace clic en "Registrar"
4. El navegador pide autenticación biométrica (huella/Face ID)
5. Se almacena la clave pública del dispositivo
6. Desde ese momento, ese guardián **debe usar biometría** para votar

### Votaciones Siguientes

Una vez registrado:
- Click en "Aprobar/Rechazar" → Pide biometría automáticamente
- Si falla la biometría → Voto rechazado
- Si pasa → Voto registrado con firma criptográfica

---

## 🚀 Inicialización del Sistema (Bootstrap)

### Desde el Admin Panel (Recomendado)

Ejecuta este código desde la **consola del navegador** (F12) mientras estás en `admin-panel.html`:

```javascript
(async () => {
    const API_URL = 'http://localhost:3000'; // Cambia según tu entorno
    
    // Define los guardianes iniciales
    const guardians = [
        { userId: 1, role: 'supervisor' },  // Reemplaza con userId real
        { userId: 2, role: 'supervisor' },  // Mínimo 2 supervisores
        { userId: 3, role: 'auxiliary' },   // Opcional
    ];
    
    const response = await fetch(`${API_URL}/api/governance/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ guardians })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        console.log('✅ Bootstrap exitoso');
        console.log('🔑 CÓDIGOS DE RECUPERACIÓN (CÓPIALOS AHORA):');
        result.recoveryCodes.forEach((code, i) => {
            console.log(`  ${i + 1}. ${code}`);
        });
        alert('Sistema inicializado. GUARDA LOS CÓDIGOS DE LA CONSOLA.');
    } else {
        console.error('❌ Error:', result);
    }
})();
```

**CRÍTICO**: Los códigos de recuperación **solo se muestran una vez**. Guárdalos en un lugar seguro.

---

## 📱 ¿Por qué la biometría no es "solo desde el teléfono"?

### Concepto Clave: Biometría = Dispositivo, no Persona

La biometría WebAuthn funciona así:

1. **Registro**: El guardián registra **un dispositivo específico** (su teléfono, su laptop, etc.)
2. **Votación**: Ese guardián **debe usar ese mismo dispositivo** para votar
3. **Multi-dispositivo**: Un guardián puede registrar **varios dispositivos** (teléfono + laptop)

### Ventajas de este enfoque (estándar de la industria):

- ✅ **No requiere app móvil**: Funciona en navegador web
- ✅ **Cross-platform**: Android, iOS, Windows, Mac, Linux
- ✅ **Resistente a phishing**: La firma criptográfica está atada al dominio
- ✅ **Sin contraseñas adicionales**: Usa el sensor del dispositivo
- ✅ **Auditable**: Cada voto tiene firma criptográfica verificable

### ¿Cómo forzar "solo desde teléfono"?

Si quieres que los guardianes **solo puedan votar desde móvil**:

1. **Opción A (UX)**: Mostrar un aviso en desktop: "Por favor, abre este link en tu teléfono"
2. **Opción B (Técnica)**: Detectar `User-Agent` y rechazar votos desde desktop
3. **Opción C (Política)**: Instruir a los guardianes que solo registren biometría en móvil

**Recomendación profesional**: Permitir cualquier dispositivo con biometría (como está ahora), porque:
- Es más flexible
- Sigue siendo muy seguro
- Es el estándar de la industria (Google, Microsoft, bancos)

---

## 🔍 Verificar que Todo Funciona

### 1. Verificar variable de entorno

Reinicia el servidor y verifica en la consola:

```bash
# Debe aparecer al iniciar
FRONTEND_URL configurada: http://localhost:3000
```

### 2. Crear solicitud de prueba

Desde el panel de gobernanza, crea una solicitud y verifica que el email llegue con el link correcto.

### 3. Probar biometría

Con otro guardián:
1. Abre el link del email
2. Inicia sesión
3. Click en "Aprobar"
4. Debe pedir biometría del dispositivo

---

## ❓ Preguntas Frecuentes

**P: ¿Qué pasa si un guardián pierde su dispositivo?**  
R: Debe registrar un nuevo dispositivo. El anterior queda inválido automáticamente.

**P: ¿Puedo votar desde varios dispositivos?**  
R: Sí, pero debes registrar cada dispositivo por separado.

**P: ¿Qué pasa si no tengo biometría en mi dispositivo?**  
R: El sistema permite votar sin biometría, pero queda registrado en auditoría que el voto no tiene firma biométrica.

**P: ¿El email permite votar directamente?**  
R: No, por seguridad. El email solo lleva al panel web donde se hace la votación autenticada.
