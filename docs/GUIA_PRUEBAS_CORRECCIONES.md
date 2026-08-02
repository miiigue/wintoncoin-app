# Guía de Pruebas - Correcciones de Reglas Económicas

Esta guía te ayudará a verificar que todas las correcciones funcionan correctamente.

## 📋 Índice
1. [Preparación del Entorno](#preparación)
2. [Prueba 1: Bonos de Referidos y Bienvenida](#prueba-1)
3. [Prueba 2: Comisiones de la Plataforma](#prueba-2)
4. [Prueba 3: Venta Rápida sin Saldo BLUE](#prueba-3)
5. [Verificación de Base de Datos](#verificación-db)

---

## 🔧 Preparación del Entorno {#preparación}

### Paso 1: Asegurar que el servidor esté corriendo
```bash
cd backend
node server.js
```

### Paso 2: Verificar que estás en la rama correcta
```bash
git branch
# Debe mostrar: * fix/economic-rules-compliance
```

### Paso 3: Preparar herramientas de prueba
Puedes usar:
- **Postman** o **Insomnia** para hacer peticiones HTTP
- **Navegador** con la consola de desarrollador (F12)
- **curl** desde la terminal

### Paso 4: Obtener tokens de autenticación
Necesitarás tokens JWT para las pruebas. Regístrate o inicia sesión primero.

---

## 🧪 Prueba 1: Bonos de Referidos y Bienvenida {#prueba-1}

**Objetivo**: Verificar que los bonos se registran en `booster_blue_ledger` en lugar de `booster_blue_balance`.

### 1.1 Verificar Estado Inicial

**Endpoint**: `GET /users/:username/booster-profile`

**Petición** (reemplaza `usuario_test` con un usuario real):
```bash
curl http://localhost:3000/api/users/usuario_test/booster-profile
```

**Resultado esperado**: 
```json
{
  "is_booster": false,
  "message": "Este usuario aún no forma parte del programa de impulsores."
}
```

### 1.2 Activar Modo Pre-Lanzamiento

**Endpoint**: `PUT /api/admin/settings/pre_launch_mode_enabled`

**Petición** (necesitas token de admin):
```bash
curl -X PUT http://localhost:3000/api/admin/settings/pre_launch_mode_enabled \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -d '{"value": "true"}'
```

### 1.3 Registrar Usuario Nuevo SIN Código de Referido

**Endpoint**: `POST /api/register-verify`

**Petición**:
```bash
curl -X POST http://localhost:3000/api/register-verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "1234567890",
    "verificationCode": "123456",
    "referral_code": null
  }'
```

### 1.4 Verificar que el Bono se Registró en `booster_blue_ledger`

**Consulta SQL directa** (en PostgreSQL):
```sql
-- Verificar que el bono está en booster_blue_ledger
SELECT 
    u.username,
    bbl.amount,
    bbl.created_at,
    bbl.source_publication_id
FROM booster_blue_ledger bbl
JOIN users u ON bbl.user_id = u.id
WHERE u.username = 'NOMBRE_DEL_USUARIO_NUEVO'
ORDER BY bbl.created_at DESC;
```

**Resultado esperado**: 
- Debe haber un registro con `amount = 25.0000` (o el valor configurado)
- `source_publication_id` debe ser `NULL` (porque es un bono, no una publicación)

### 1.5 Verificar Perfil de Impulsor

**Endpoint**: `GET /api/users/:username/booster-profile`

**Petición**:
```bash
curl http://localhost:3000/api/users/NOMBRE_DEL_USUARIO_NUEVO/booster-profile
```

**Resultado esperado**:
```json
{
  "is_booster": true,
  "username": "NOMBRE_DEL_USUARIO_NUEVO",
  "booster_blue_balance": 25.0000,
  "publications": []
}
```

### 1.6 Probar Bono por Referido

1. **Registrar usuario con código de referido**:
```bash
curl -X POST http://localhost:3000/api/register-verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "verificationCode": "123456",
    "referral_code": "CODIGO_DEL_USUARIO_ANTERIOR"
  }'
```

2. **Verificar que ambos usuarios recibieron el bono**:
```sql
-- Verificar bonos de referido
SELECT 
    u.username,
    bbl.amount,
    bt.type,
    bt.description
FROM booster_blue_ledger bbl
JOIN users u ON bbl.user_id = u.id
LEFT JOIN booster_transactions bt ON bt.user_id = u.id
WHERE u.username IN ('USUARIO_REFERENTE', 'USUARIO_REFERIDO')
ORDER BY bbl.created_at DESC;
```

**Resultado esperado**: 
- Ambos usuarios deben tener registros en `booster_blue_ledger`
- Debe haber transacciones de tipo `referral_bonus_sent` y `referral_bonus_received`

---

## 💰 Prueba 2: Comisiones de la Plataforma {#prueba-2}

**Objetivo**: Verificar que las comisiones se asignan como tokens BLUE reales a la plataforma.

### 2.1 Verificar Saldo Inicial de la Plataforma

**Endpoint**: `GET /api/admin/platform-wallet/balance`

**Petición**:
```bash
curl http://localhost:3000/api/admin/platform-wallet/balance \
  -H "Authorization: Bearer TU_TOKEN_ADMIN"
```

**Anotar**: `liquidBlue` inicial de la plataforma

### 2.2 Desactivar Modo Pre-Lanzamiento

**Endpoint**: `PUT /api/admin/settings/pre_launch_mode_enabled`

**Petición**:
```bash
curl -X PUT http://localhost:3000/api/admin/settings/pre_launch_mode_enabled \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -d '{"value": "false"}'
```

### 2.3 Verificar Porcentaje de Comisión

**Endpoint**: `GET /api/admin/settings/platform_commission_percentage`

**Petición**:
```bash
curl http://localhost:3000/api/admin/settings/platform_commission_percentage \
  -H "Authorization: Bearer TU_TOKEN_ADMIN"
```

**Anotar**: El porcentaje (ej: 5% = 5)

### 2.4 Realizar una Transacción que Genere Comisión

**Opción A: Completar una Solicitud**

1. Crear una publicación de tipo "solicitud" con costo (ej: 100 BLUE)
2. Aceptar la solicitud
3. Completar y pagar la solicitud

**Opción B: Completar una Venta/Donación**

1. Crear una publicación de tipo "venta" o "donación" con costo (ej: 100 BLUE)
2. Aceptar la publicación
3. Completar y pagar

### 2.5 Verificar que la Plataforma Recibió BLUE

**Consulta SQL**:
```sql
-- Verificar saldo BLUE líquido de la plataforma
SELECT 
    username,
    liquid_blue_balance,
    escrow_blue_balance,
    red_balance
FROM users
WHERE username = 'Plataforma WintonCoin';
```

**Resultado esperado**: 
- `liquid_blue_balance` debe haber aumentado
- Si la transacción fue de 100 BLUE con 5% de comisión, debe aumentar en 5.0000 BLUE

### 2.6 Verificar Transacciones de la Plataforma

**Consulta SQL**:
```sql
-- Ver transacciones de comisión de la plataforma
SELECT 
    type,
    description,
    blue_change,
    red_change,
    created_at
FROM transactions
WHERE user_id = (SELECT id FROM users WHERE username = 'Plataforma WintonCoin')
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado**: 
- Debe haber transacciones de tipo `commission_received`
- `blue_change` debe ser positivo (la comisión)
- `red_change` debe ser 0

### 2.7 Verificar Log de Comisiones

**Consulta SQL**:
```sql
-- Ver log de comisiones
SELECT 
    pcl.commission_amount_blue,
    pcl.created_at,
    p.title as publication_title
FROM platform_commission_log pcl
JOIN publications p ON pcl.related_publication_id = p.id
ORDER BY pcl.created_at DESC
LIMIT 10;
```

**Resultado esperado**: 
- Debe haber registros con `commission_amount_blue` > 0
- Debe coincidir con las transacciones realizadas

### 2.8 Verificar Balance Total de Comisiones

**Endpoint**: `GET /api/admin/platform-wallet/balance`

**Petición**:
```bash
curl http://localhost:3000/api/admin/platform-wallet/balance \
  -H "Authorization: Bearer TU_TOKEN_ADMIN"
```

**Resultado esperado**: 
- `commissionBalance` debe coincidir con la suma de `commission_amount_blue` en el log
- `liquidBlue` debe ser igual o mayor que `commissionBalance` (porque la plataforma recibe BLUE real)

---

## 🛒 Prueba 3: Venta Rápida sin Saldo BLUE {#prueba-3}

**Objetivo**: Verificar que las ventas rápidas crean tokens RED cuando el comprador no tiene BLUE suficiente.

### 3.1 Preparar Usuario de Prueba

**Crear o usar un usuario con saldo BLUE = 0**:
```sql
-- Verificar saldo de un usuario
SELECT 
    username,
    liquid_blue_balance,
    escrow_blue_balance,
    red_balance
FROM users
WHERE username = 'USUARIO_COMPRADOR';
```

Si tiene saldo, puedes reducirlo temporalmente:
```sql
-- ⚠️ SOLO PARA PRUEBAS - Reducir saldo a 0
UPDATE users 
SET liquid_blue_balance = 0 
WHERE username = 'USUARIO_COMPRADOR';
```

### 3.2 Crear una Venta Rápida

**Endpoint**: `POST /api/quick-sale`

**Petición**:
```bash
curl -X POST http://localhost:3000/api/quick-sale \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "blueCost": 60.0000,
    "targetUsername": null,
    "duration_minutes": 5
  }'
```

**Anotar**: El `id` de la venta rápida creada

### 3.3 Intentar Pagar la Venta Rápida (sin saldo BLUE)

**Endpoint**: `POST /api/quick-sale/:id/pay`

**Petición**:
```bash
curl -X POST http://localhost:3000/api/quick-sale/ID_DE_LA_VENTA/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "buyerUsername": "USUARIO_COMPRADOR"
  }'
```

**Resultado esperado**: 
- ✅ **NO debe aparecer error de "Fondos insuficientes"**
- ✅ Debe completarse exitosamente
- ✅ Debe crear tokens RED para el comprador

### 3.4 Verificar que se Crearon Tokens RED

**Consulta SQL**:
```sql
-- Verificar deuda RED del comprador
SELECT 
    username,
    amount,
    due_at,
    is_settled,
    created_at
FROM red_token_debts
WHERE username = 'USUARIO_COMPRADOR'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado**: 
- Debe haber una nueva deuda RED
- El `amount` debe ser: `costo + comisión` (ej: 60 + 3 = 63 BLUE si la comisión es 5%)
- `is_settled` debe ser `FALSE`

### 3.5 Verificar que se Crearon Tokens BLUE para el Vendedor

**Consulta SQL**:
```sql
-- Verificar escrow BLUE del vendedor
SELECT 
    username,
    amount,
    unlock_at,
    is_released,
    created_at
FROM blue_token_escrows
WHERE username = 'USUARIO_VENDEDOR'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado**: 
- Debe haber un nuevo depósito en escrow
- El `amount` debe ser igual al costo de la venta (ej: 60.0000 BLUE)
- `is_released` debe ser `FALSE`

### 3.6 Verificar que la Plataforma Recibió Comisión

**Consulta SQL**:
```sql
-- Verificar comisión de la venta rápida
SELECT 
    pcl.commission_amount_blue,
    p.title,
    p.blue_cost
FROM platform_commission_log pcl
JOIN publications p ON pcl.related_publication_id = p.id
WHERE p.id = ID_DE_LA_VENTA;
```

**Resultado esperado**: 
- Debe haber un registro de comisión
- `commission_amount_blue` debe ser: `costo * porcentaje_comision / 100`

### 3.7 Verificar Balance del Comprador

**Endpoint**: `GET /users/:username/balance`

**Petición**:
```bash
curl http://localhost:3000/users/USUARIO_COMPRADOR/balance
```

**Resultado esperado**:
```json
{
  "blue_balance": "0.0000",
  "escrow_blue_balance": "0.0000",
  "red_balance": "63.0000",  // costo + comisión
  "next_due_at": "...",
  "next_unlock_at": null,
  "total_penalized_debt": "0.0000"
}
```

---

## 🔍 Verificación de Base de Datos {#verificación-db}

### Verificar Integridad de Datos

**Consulta SQL completa**:
```sql
-- 1. Verificar que todos los bonos están en booster_blue_ledger
SELECT 
    u.username,
    u.booster_blue_balance as columna_balance,
    COALESCE(SUM(bbl.amount), 0) as ledger_balance,
    CASE 
        WHEN u.booster_blue_balance != COALESCE(SUM(bbl.amount), 0) 
        THEN '⚠️ INCONSISTENCIA'
        ELSE '✅ OK'
    END as estado
FROM users u
LEFT JOIN booster_blue_ledger bbl ON u.id = bbl.user_id
WHERE u.is_booster = TRUE
GROUP BY u.id, u.username, u.booster_blue_balance
HAVING u.booster_blue_balance != COALESCE(SUM(bbl.amount), 0);
```

**Resultado esperado**: No debe haber filas (sin inconsistencias)

### Verificar Balance Total del Sistema

**Consulta SQL**:
```sql
-- Verificar que BLUE total = RED total (equilibrio económico)
SELECT 
    (SELECT COALESCE(SUM(liquid_blue_balance + escrow_blue_balance), 0) FROM users) as total_blue,
    (SELECT COALESCE(SUM(red_balance), 0) FROM users) as total_red,
    (SELECT COALESCE(SUM(liquid_blue_balance + escrow_blue_balance), 0) FROM users) - 
    (SELECT COALESCE(SUM(red_balance), 0) FROM users) as diferencia;
```

**Resultado esperado**: 
- La diferencia debe ser igual a las comisiones acumuladas de la plataforma
- `total_blue - total_red = comisiones_plataforma`

### Verificar Comisiones de la Plataforma

**Consulta SQL**:
```sql
-- Verificar que las comisiones están correctamente asignadas
SELECT 
    (SELECT liquid_blue_balance FROM users WHERE username = 'Plataforma WintonCoin') as plataforma_blue,
    (SELECT COALESCE(SUM(commission_amount_blue), 0) FROM platform_commission_log) as total_comisiones_log,
    (SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1) as total_comisiones_wallet;
```

**Resultado esperado**: 
- `plataforma_blue` debe ser >= `total_comisiones_log`
- `total_comisiones_log` debe ser igual a `total_comisiones_wallet`

---

## ✅ Checklist Final

- [ ] Los bonos se registran en `booster_blue_ledger` (no en `booster_blue_balance`)
- [ ] Las comisiones se asignan como BLUE real a la plataforma
- [ ] Las ventas rápidas funcionan sin saldo BLUE (crean RED)
- [ ] No hay errores de "Fondos insuficientes" en ventas rápidas
- [ ] Las transacciones se registran correctamente
- [ ] El balance del sistema está equilibrado (BLUE - RED = comisiones)

---

## 🐛 Si Algo No Funciona

### Verificar Logs del Servidor
Revisa la consola donde corre `node server.js` para ver errores.

### Verificar Base de Datos
Usa las consultas SQL de verificación para identificar inconsistencias.

### Revertir Cambios si es Necesario
```bash
git status
git diff backend/server.js
# Si necesitas revertir:
git checkout backend/server.js
```

---

## 📝 Notas Importantes

1. **Modo Pre-Lanzamiento**: Los bonos solo funcionan cuando `pre_launch_mode_enabled = true`
2. **Comisiones**: Solo se generan en modo normal (no en pre-lanzamiento)
3. **Ventas Rápidas**: Ahora crean tokens en lugar de transferir, cumpliendo las reglas económicas
4. **Base de Datos**: Siempre verifica con consultas SQL directas para confirmar los cambios

---

**¡Buena suerte con las pruebas!** 🚀

---

## 🌐 Prueba 4: Integración Web3 y Winton Trust Score (WTS) {#prueba-4}

**Objetivo**: Verificar que las billeteras se generan correctamente, la UI "Azure Glass" responde, y las transacciones se sincronizan on-chain en Optimism Sepolia.

### 4.1 Generación de Billetera Invisible
**Pasos**:
1. Entra al entorno Demo o Local y crea una **nueva cuenta** desde `/register.html`.
2. Una vez dentro, ve al **Dashboard** o a `/contract_interaction.html`.
3. Verifica la sección "Tu Billetera Web3".
**Resultados esperados**:
- ✅ Debe mostrar una dirección que empiece por `0x...` truncada (ej: `0x1234...abcd`).
- ✅ Al hacer clic en el botón de copiar, debe salir la alerta "¡Dirección copiada!" y guardar la dirección completa en el portapapeles.
- ✅ *Backend*: En la base de datos, la tabla `users` debe tener `web3_wallet_address` y el blob encriptado en `web3_private_key_encrypted`.

### 4.2 Sincronización del Scoring WTS (On-Login)
**Pasos**:
1. Cierra sesión y vuelve a **iniciar sesión** con cualquier cuenta.
2. Revisa los logs de la terminal del servidor (Render o Local).
**Resultados esperados**:
- ✅ El login debe ser exitoso (No Error 500).
- ✅ En los logs debe aparecer el mensaje de sincronización del `CreditScoringService` indicando que calculó el límite base (ej. 100) más bonos, y lo envió a la blockchain.
- ✅ *Opcional*: Si el usuario tiene 2 referidos, el límite calculado debe ser 110 (100 base + 5x2).

### 4.3 Verificación de Diseño "Azure Glass"
**Pasos**:
1. Ve a `/contract_interaction.html` (o la pestaña de referidos del Dashboard).
**Resultados esperados**:
- ✅ El banner principal debe tener un fondo de cristal esmerilado azul.
- ✅ La tipografía debe ser "Inter" (limpia y moderna, no serif).
- ✅ Debe mostrar tu código de referido destacado y el bono de "5 BLUE" centrado, sin las flechas rojas antiguas.
- ✅ El diseño debe ser responsive (adaptable si reduces el tamaño de la ventana).

### 4.4 Sincronización de Pagos On-Chain (Web3 Bridge)
**Pasos**:
1. Realiza una acción que transfiera BLUE entre dos usuarios (ej. aceptar una publicación o hacer un pago P2P).
2. Observa los logs del servidor (Terminal de Render o Local).
**Resultados esperados**:
- ✅ El pago off-chain debe completarse al instante en la UI.
- ✅ En los logs de Render debe aparecer: `[WEB3 BRIDGE] Iniciando sincronización de pago...`
- ✅ Unos segundos después (dependiendo de la red Sepolia), debe aparecer: `[WEB3 BRIDGE] Sincronización EXITOSA. Tx: 0x...`
- ✅ Si buscas ese hash (`0x...`) en [Optimistic Sepolia Etherscan](https://sepolia-optimism.etherscan.io/), debe mostrar una transacción exitosa hacia el `WintonProtocol`.
