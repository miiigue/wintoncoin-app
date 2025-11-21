# 📚 Explicación Detallada: Event Sourcing + Ledger Inmutable

## 🎯 ¿Qué es Event Sourcing?

**Event Sourcing** es un patrón de diseño donde, en lugar de guardar el **estado actual** de los datos (como los saldos), guardas **todos los eventos** que han ocurrido. Es como un libro de contabilidad bancaria: en lugar de solo tener el saldo final, tienes el historial completo de todas las transacciones.

---

## 🔍 Analogía Simple: El Libro de Banco

### **Sistema Actual (Sin Event Sourcing)**
Imagina que tienes una cuenta bancaria y solo guardas el saldo actual:

```
Usuario: Juan
Saldo actual: $1,000
```

**Problema**: Si alguien modifica directamente el saldo a $5,000, no hay forma de saber qué pasó. No hay historial.

### **Sistema con Event Sourcing**
En lugar de solo guardar el saldo, guardas TODOS los eventos:

```
Evento 1: Juan depositó $500 (Saldo anterior: $0, Saldo nuevo: $500)
Evento 2: Juan recibió pago de $300 (Saldo anterior: $500, Saldo nuevo: $800)
Evento 3: Juan pagó $200 (Saldo anterior: $800, Saldo nuevo: $600)
Evento 4: Juan recibió comisión $400 (Saldo anterior: $600, Saldo nuevo: $1,000)
```

**Ventaja**: El saldo actual ($1,000) se calcula sumando todos los eventos. Si alguien intenta modificar un evento anterior, se detecta porque los hashes no coinciden.

---

## 🏗️ Cómo Funciona Técnicamente

### **Paso 1: Estructura de Datos**

#### **Tabla Actual (users)**
```sql
users
├── id
├── username
├── liquid_blue_balance  ← Se actualiza directamente
├── escrow_blue_balance  ← Se actualiza directamente
└── red_balance          ← Se actualiza directamente
```

**Problema**: Un administrador puede hacer:
```sql
UPDATE users SET liquid_blue_balance = 999999 WHERE username = 'Juan';
```
Y no hay forma de detectarlo o auditarlo.

#### **Nueva Tabla (balance_events) - Ledger Inmutable**
```sql
balance_events
├── id (auto-increment)
├── event_id (UUID único)
├── user_id
├── event_type ('credit', 'debit', 'transfer', 'burn')
├── balance_type ('liquid_blue', 'escrow_blue', 'red')
├── amount (cantidad del cambio)
├── previous_balance (saldo ANTES del evento)
├── new_balance (saldo DESPUÉS del evento)
├── related_transaction_id
├── created_at
├── event_hash (SHA-256 del evento + hash anterior)
└── previous_event_hash (hash del evento anterior)
```

**Ventaja**: Cada evento tiene un hash que depende del evento anterior. Si modificas un evento, toda la cadena se rompe.

---

## 🔐 Cómo Funciona la Cadena de Hashes (Inmutabilidad)

### **Ejemplo Visual**

```
Evento 1: Juan recibió 100 BLUE
├── Hash: abc123...
└── previous_event_hash: NULL (es el primero)

Evento 2: Juan pagó 50 BLUE
├── Hash: def456... (calculado con: datos del evento 2 + hash del evento 1)
└── previous_event_hash: abc123...

Evento 3: Juan recibió 25 BLUE
├── Hash: ghi789... (calculado con: datos del evento 3 + hash del evento 2)
└── previous_event_hash: def456...
```

**Si alguien intenta modificar el Evento 2:**
- El hash del Evento 2 cambiaría
- El Evento 3 tiene el hash anterior guardado (def456...)
- Al verificar, detectarías que el hash no coincide
- **¡Manipulación detectada!**

---

## 📊 Flujo de Trabajo Completo

### **Escenario: Juan completa una tarea y recibe 100 BLUE**

#### **ANTES (Sistema Actual)**
```javascript
// 1. Leer saldo actual
const user = await db.query('SELECT escrow_blue_balance FROM users WHERE username = $1', ['Juan']);
const currentBalance = user.rows[0].escrow_blue_balance; // Ejemplo: 50

// 2. Actualizar saldo directamente
await db.query('UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2', [100, 'Juan']);
// Nuevo saldo: 150

// 3. Registrar transacción (opcional, puede no hacerse)
await db.query('INSERT INTO transactions (...) VALUES (...)');
```

**Problemas**:
- Si alguien modifica el UPDATE, no hay forma de detectarlo
- No hay historial completo
- No hay verificación de integridad

#### **DESPUÉS (Con Event Sourcing)**
```javascript
// 1. Obtener el último evento del usuario (para saber el saldo actual y el hash anterior)
const lastEvent = await db.query(`
    SELECT new_balance, event_hash 
    FROM balance_events 
    WHERE user_id = $1 AND balance_type = 'escrow_blue' 
    ORDER BY created_at DESC 
    LIMIT 1
`, [userId]);

const previousBalance = lastEvent.rows[0]?.new_balance || 0; // 50
const previousHash = lastEvent.rows[0]?.event_hash || null;

// 2. Calcular nuevo saldo
const newBalance = previousBalance + 100; // 150

// 3. Crear el nuevo evento (INMUTABLE - solo INSERT, nunca UPDATE)
const eventData = {
    user_id: userId,
    event_type: 'credit',
    balance_type: 'escrow_blue',
    amount: 100,
    previous_balance: previousBalance,
    new_balance: newBalance,
    related_transaction_id: transactionId,
    created_at: new Date(),
    previous_event_hash: previousHash
};

// 4. Calcular hash del nuevo evento
const eventHash = calculateHash(eventData, previousHash);

// 5. INSERTAR el evento (append-only, nunca modificar)
await db.query(`
    INSERT INTO balance_events (
        user_id, event_type, balance_type, amount,
        previous_balance, new_balance, related_transaction_id,
        previous_event_hash, event_hash, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
`, [
    userId, 'credit', 'escrow_blue', 100,
    previousBalance, newBalance, transactionId,
    previousHash, eventHash, new Date()
]);

// 6. ACTUALIZAR el saldo en la tabla users (solo como CACHE para lectura rápida)
await db.query('UPDATE users SET escrow_blue_balance = $1 WHERE id = $2', [newBalance, userId]);
```

**Ventajas**:
- El evento es inmutable (solo INSERT, nunca UPDATE)
- El hash detecta cualquier manipulación
- Historial completo disponible
- El saldo en `users` es solo un cache optimizado

---

## 🚀 Optimización: Snapshots (Balance Snapshots)

### **Problema de Rendimiento**

Si un usuario tiene 10,000 eventos, calcular su saldo sumando todos los eventos sería lento:

```sql
-- LENTO: Sumar 10,000 eventos cada vez
SELECT SUM(amount) FROM balance_events 
WHERE user_id = 123 AND balance_type = 'liquid_blue';
```

### **Solución: Snapshots Periódicos**

Cada cierto tiempo (por ejemplo, cada día), guardamos un "snapshot" (foto) del saldo:

```sql
balance_snapshots
├── user_id
├── balance_type
├── balance (saldo en ese momento)
├── snapshot_date (fecha del snapshot)
└── last_event_id (último evento incluido en el snapshot)
```

**Cálculo Optimizado**:
```sql
-- RÁPIDO: Obtener snapshot más reciente + eventos después del snapshot
SELECT 
    snapshot.balance + COALESCE(SUM(events.amount), 0) as current_balance
FROM balance_snapshots snapshot
LEFT JOIN balance_events events 
    ON events.user_id = snapshot.user_id 
    AND events.balance_type = snapshot.balance_type
    AND events.id > snapshot.last_event_id
WHERE snapshot.user_id = 123 
    AND snapshot.balance_type = 'liquid_blue'
    AND snapshot.snapshot_date = (
        SELECT MAX(snapshot_date) 
        FROM balance_snapshots 
        WHERE user_id = 123 AND balance_type = 'liquid_blue'
    );
```

**Ejemplo**:
- Snapshot del 1 de enero: saldo = 1,000 (incluye eventos 1-5,000)
- Eventos después del snapshot: eventos 5,001-10,000 suman +500
- Saldo actual = 1,000 + 500 = 1,500

---

## ✅ Compatibilidad con PostgreSQL

### **Sí, funciona perfectamente con PostgreSQL**

PostgreSQL tiene todas las características necesarias:

1. **UUID**: `gen_random_uuid()` para IDs únicos
2. **SHA-256**: Extensión `pgcrypto` para hashes
3. **Transacciones**: `BEGIN`, `COMMIT`, `ROLLBACK`
4. **Índices**: Para búsquedas rápidas
5. **JSONB**: Para metadata flexible
6. **Triggers**: Para validaciones automáticas

### **Extensiones Necesarias**

```sql
-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar extensión para funciones criptográficas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## 📋 Qué se Necesita para Implementar

### **1. Crear las Tablas Nuevas**

```sql
-- Tabla principal de eventos (Ledger Inmutable)
CREATE TABLE balance_events (...);

-- Tabla de snapshots (optimización)
CREATE TABLE balance_snapshots (...);
```

### **2. Función para Calcular Hashes**

```sql
CREATE FUNCTION calculate_event_hash(
    event_data JSONB,
    previous_hash TEXT
) RETURNS TEXT AS $$
BEGIN
    -- Combinar datos del evento + hash anterior
    -- Calcular SHA-256
    RETURN encode(
        digest(
            (event_data::text || COALESCE(previous_hash, '')), 
            'sha256'
        ), 
        'hex'
    );
END;
$$ LANGUAGE plpgsql;
```

### **3. Función para Registrar Eventos**

```sql
CREATE FUNCTION record_balance_event(
    p_user_id INTEGER,
    p_event_type VARCHAR(50),
    p_balance_type VARCHAR(20),
    p_amount NUMERIC(19, 4),
    p_related_transaction_id INTEGER
) RETURNS VOID AS $$
DECLARE
    v_previous_balance NUMERIC(19, 4);
    v_previous_hash TEXT;
    v_new_balance NUMERIC(19, 4);
    v_event_hash TEXT;
BEGIN
    -- 1. Obtener último evento
    SELECT new_balance, event_hash INTO v_previous_balance, v_previous_hash
    FROM balance_events
    WHERE user_id = p_user_id AND balance_type = p_balance_type
    ORDER BY created_at DESC LIMIT 1;
    
    -- Si no hay eventos anteriores, empezar desde 0
    v_previous_balance := COALESCE(v_previous_balance, 0);
    v_previous_hash := COALESCE(v_previous_hash, NULL);
    
    -- 2. Calcular nuevo saldo
    IF p_event_type IN ('credit', 'transfer_in') THEN
        v_new_balance := v_previous_balance + p_amount;
    ELSIF p_event_type IN ('debit', 'transfer_out', 'burn') THEN
        v_new_balance := v_previous_balance - p_amount;
    END IF;
    
    -- 3. Calcular hash
    v_event_hash := calculate_event_hash(
        jsonb_build_object(
            'user_id', p_user_id,
            'event_type', p_event_type,
            'balance_type', p_balance_type,
            'amount', p_amount,
            'previous_balance', v_previous_balance,
            'new_balance', v_new_balance,
            'timestamp', NOW()
        ),
        v_previous_hash
    );
    
    -- 4. Insertar evento (INMUTABLE)
    INSERT INTO balance_events (
        user_id, event_type, balance_type, amount,
        previous_balance, new_balance, related_transaction_id,
        previous_event_hash, event_hash, created_at
    ) VALUES (
        p_user_id, p_event_type, p_balance_type, p_amount,
        v_previous_balance, v_new_balance, p_related_transaction_id,
        v_previous_hash, v_event_hash, NOW()
    );
    
    -- 5. Actualizar cache en tabla users
    IF p_balance_type = 'liquid_blue' THEN
        UPDATE users SET liquid_blue_balance = v_new_balance WHERE id = p_user_id;
    ELSIF p_balance_type = 'escrow_blue' THEN
        UPDATE users SET escrow_blue_balance = v_new_balance WHERE id = p_user_id;
    ELSIF p_balance_type = 'red' THEN
        UPDATE users SET red_balance = v_new_balance WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

### **4. Función para Verificar Integridad**

```sql
CREATE FUNCTION verify_balance_integrity(p_user_id INTEGER)
RETURNS TABLE(
    balance_type VARCHAR(20),
    is_valid BOOLEAN,
    invalid_event_id BIGINT
) AS $$
BEGIN
    -- Verificar que cada evento tenga el hash correcto
    -- Comparar previous_event_hash de cada evento con el event_hash del evento anterior
    RETURN QUERY
    WITH ordered_events AS (
        SELECT 
            id,
            balance_type,
            event_hash,
            previous_event_hash,
            LAG(event_hash) OVER (PARTITION BY user_id, balance_type ORDER BY created_at) as expected_previous_hash
        FROM balance_events
        WHERE user_id = p_user_id
    )
    SELECT 
        balance_type,
        (previous_event_hash = expected_previous_hash) as is_valid,
        id as invalid_event_id
    FROM ordered_events
    WHERE previous_event_hash IS NOT NULL 
        AND previous_event_hash != expected_previous_hash;
END;
$$ LANGUAGE plpgsql;
```

### **5. Refactorizar Código JavaScript**

Cambiar todas las funciones que hacen `UPDATE users SET ... balance` para que:
1. Llamen a `record_balance_event()` primero
2. La función actualiza automáticamente el cache en `users`

**Ejemplo de cambio**:

**ANTES**:
```javascript
await client.query('UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2', [100, 'Juan']);
```

**DESPUÉS**:
```javascript
// Obtener user_id
const userResult = await client.query('SELECT id FROM users WHERE username = $1', ['Juan']);
const userId = userResult.rows[0].id;

// Registrar evento (esto actualiza automáticamente el cache)
await client.query(
    'SELECT record_balance_event($1, $2, $3, $4, $5)',
    [userId, 'credit', 'escrow_blue', 100, transactionId]
);
```

---

## 🔄 Migración de Datos Existentes

### **Paso 1: Crear Eventos desde Transacciones Existentes**

Si ya tienes datos en la tabla `transactions`, puedes crear eventos retroactivos:

```sql
-- Crear eventos desde transacciones históricas
INSERT INTO balance_events (user_id, event_type, balance_type, amount, ...)
SELECT 
    user_id,
    CASE 
        WHEN blue_change > 0 THEN 'credit'
        WHEN blue_change < 0 THEN 'debit'
    END,
    'liquid_blue',
    ABS(blue_change),
    ...
FROM transactions
WHERE blue_change != 0
ORDER BY created_at;
```

### **Paso 2: Crear Snapshots Iniciales**

```sql
-- Crear snapshot inicial para cada usuario
INSERT INTO balance_snapshots (user_id, balance_type, balance, last_event_id)
SELECT 
    user_id,
    'liquid_blue',
    SUM(amount) FILTER (WHERE event_type IN ('credit', 'transfer_in')) 
    - SUM(amount) FILTER (WHERE event_type IN ('debit', 'transfer_out', 'burn')),
    MAX(id)
FROM balance_events
GROUP BY user_id;
```

---

## 🛡️ Protecciones Adicionales

### **1. Trigger para Prevenir UPDATEs Directos**

```sql
CREATE FUNCTION prevent_direct_balance_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.liquid_blue_balance IS DISTINCT FROM NEW.liquid_blue_balance
    OR OLD.escrow_blue_balance IS DISTINCT FROM NEW.escrow_blue_balance
    OR OLD.red_balance IS DISTINCT FROM NEW.red_balance THEN
        
        -- Solo permitir si viene de la función record_balance_event
        IF current_setting('app.allow_balance_update', true) != 'true' THEN
            RAISE EXCEPTION 'Direct balance updates are not allowed. Use record_balance_event() function.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_direct_balance_update_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_balance_update();
```

### **2. Función Modificada que Permite Updates**

```sql
CREATE FUNCTION record_balance_event(...) AS $$
BEGIN
    -- Habilitar temporalmente los updates
    PERFORM set_config('app.allow_balance_update', 'true', true);
    
    -- ... resto del código ...
    
    -- Actualizar cache
    UPDATE users SET ...;
    
    -- Deshabilitar updates
    PERFORM set_config('app.allow_balance_update', 'false', true);
END;
$$;
```

---

## 📊 Resumen: Qué Hacer Primero

### **Fase 1: Preparación (Sin cambios al código actual)**
1. ✅ Crear tabla `balance_events`
2. ✅ Crear tabla `balance_snapshots`
3. ✅ Crear funciones SQL (`calculate_event_hash`, `record_balance_event`, `verify_balance_integrity`)
4. ✅ Crear triggers de protección
5. ✅ Migrar datos existentes (crear eventos desde transacciones históricas)

### **Fase 2: Refactorización Gradual**
1. ✅ Cambiar una función a la vez (empezar con las más críticas)
2. ✅ Probar cada cambio exhaustivamente
3. ✅ Verificar integridad después de cada cambio

### **Fase 3: Optimización**
1. ✅ Implementar sistema de snapshots
2. ✅ Crear jobs periódicos para generar snapshots
3. ✅ Optimizar consultas de saldo

### **Fase 4: Monitoreo**
1. ✅ Crear dashboard de verificación de integridad
2. ✅ Alertas si se detecta manipulación
3. ✅ Auditoría periódica

---

## ❓ Preguntas Frecuentes

### **¿Afecta el rendimiento?**
- **Lectura**: Con snapshots, es igual o más rápido
- **Escritura**: Ligeramente más lento (insertar evento + actualizar cache), pero aceptable
- **Almacenamiento**: Más espacio (pero manejable con PostgreSQL)

### **¿Qué pasa si hay un error?**
- Los eventos son inmutables, pero puedes crear eventos de "corrección"
- Ejemplo: Si se registró mal, crear evento de reverso + evento correcto

### **¿Puedo seguir usando la tabla users?**
- Sí, la tabla `users` sigue existiendo
- Los campos de balance son ahora un **cache optimizado**
- Se actualizan automáticamente cuando se crean eventos

### **¿Es compatible con el código actual?**
- Sí, después de la migración, el código sigue funcionando igual
- Solo cambia cómo se actualizan los saldos (a través de eventos)

---

**Última actualización**: 2025-11-19




