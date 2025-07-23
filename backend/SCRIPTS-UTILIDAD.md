# Scripts de Utilidad - WintonCoin

## 📋 Descripción

Estos scripts ayudan a mantener la integridad de las reglas económicas y corregir problemas específicos.

## 🛠️ Scripts Disponibles

### 1. `fix-booster-task.js`
**Propósito:** Verificar y corregir publicaciones que deberían ser tareas de impulsor.

**Cuándo usar:**
- Se crean nuevas publicaciones de la plataforma
- Se olvida marcar `is_booster_task = TRUE`
- Se detectan tareas de impulsor que no están marcadas correctamente

**Uso:**
```bash
node backend/fix-booster-task.js
```

**Qué hace:**
- Busca publicaciones con "prueba" en el título o descripción
- Verifica si son de la plataforma
- Marca como `is_booster_task = TRUE` si corresponde
- Muestra el estado antes y después

### 2. `cleanup-incorrect-balance.js`
**Propósito:** Limpiar saldos incorrectos en la billetera principal.

**Cuándo usar:**
- Se detectan violaciones de las reglas económicas
- Los fondos de impulsores aparecen en la billetera principal
- Se necesita limpiar escrows incorrectos

**Uso:**
```bash
node backend/cleanup-incorrect-balance.js
```

**Qué hace:**
- Verifica usuarios con saldo en escrow
- Limpia saldos incorrectos para usuarios específicos
- Muestra el estado antes y después

## ⚠️ Importante

- **Solo usar cuando sea necesario**
- **Verificar el estado antes y después**
- **Hacer backup antes de usar en producción**
- **Eliminar estos scripts cuando ya no sean necesarios**

## 🔄 Mantenimiento

Estos scripts son temporales y deben eliminarse cuando:
1. El sistema esté completamente estable
2. No se detecten más violaciones de reglas
3. Los procesos estén automatizados

---

**Última actualización:** $(date)
**Versión:** 1.0 