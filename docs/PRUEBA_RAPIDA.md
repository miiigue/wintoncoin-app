# 🚀 Prueba Rápida - Verificación de Correcciones

## Prueba Rápida de Venta Rápida (La más importante)

### 1. Preparar
```bash
# Asegurar que el servidor está corriendo
cd backend
node server.js
```

### 2. Verificar que un usuario tiene saldo BLUE = 0
```sql
-- En PostgreSQL
SELECT username, liquid_blue_balance FROM users WHERE username = 'TU_USUARIO';
```

Si tiene saldo, reducirlo:
```sql
UPDATE users SET liquid_blue_balance = 0 WHERE username = 'TU_USUARIO';
```

### 3. Crear una Venta Rápida
Desde el frontend o con Postman:
- **URL**: `POST /api/quick-sale`
- **Body**: 
```json
{
  "blueCost": 60.0000,
  "targetUsername": null,
  "duration_minutes": 5
}
```

### 4. Pagar la Venta Rápida
- **URL**: `POST /api/quick-sale/:id/pay`
- **Body**:
```json
{
  "buyerUsername": "TU_USUARIO"
}
```

### 5. Verificar Resultado

**✅ ÉXITO**: 
- No aparece error "Fondos insuficientes"
- La transacción se completa
- Se crean tokens RED para el comprador

**Verificar en SQL**:
```sql
-- Debe haber una nueva deuda RED
SELECT * FROM red_token_debts 
WHERE username = 'TU_USUARIO' 
ORDER BY created_at DESC LIMIT 1;
```

---

## Prueba Rápida de Comisiones

### 1. Ver saldo inicial de plataforma
```sql
SELECT liquid_blue_balance FROM users WHERE username = 'Plataforma WintonCoin';
```

### 2. Realizar cualquier transacción (solicitud, venta, etc.)

### 3. Verificar que aumentó el saldo
```sql
SELECT liquid_blue_balance FROM users WHERE username = 'Plataforma WintonCoin';
```

**✅ ÉXITO**: El saldo debe haber aumentado con la comisión

---

## Prueba Rápida de Bonos

### 1. Activar modo pre-lanzamiento
Desde admin panel o SQL:
```sql
UPDATE app_settings SET setting_value = 'true' WHERE setting_key = 'pre_launch_mode_enabled';
```

### 2. Registrar usuario nuevo SIN código de referido

### 3. Verificar en SQL
```sql
SELECT * FROM booster_blue_ledger 
WHERE user_id = (SELECT id FROM users WHERE username = 'NUEVO_USUARIO');
```

**✅ ÉXITO**: Debe haber un registro con el bono de bienvenida

---

## ⚠️ Si Algo Falla

1. Revisa los logs del servidor (consola donde corre `node server.js`)
2. Verifica que estás en la rama correcta: `git branch`
3. Verifica que los cambios están guardados: `git status`

