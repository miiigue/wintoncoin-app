# 🗄️ Sistema de Gestión de Base de Datos - WintonCoin

## 📋 Descripción General

Este sistema proporciona herramientas seguras y profesionales para la gestión, mantenimiento y limpieza de la base de datos de WintonCoin. Diseñado siguiendo las mejores prácticas de seguridad bancaria y fintech.

## 🛡️ Principios de Seguridad

### ✅ Características de Seguridad Implementadas

1. **Backup Automático**: Toda operación de limpieza crea un backup automático antes de ejecutarse
2. **Validaciones Estrictas**: Límites mínimos de tiempo para evitar eliminaciones accidentales
3. **Protección de Datos Críticos**: Los usuarios de plataforma nunca son eliminados
4. **Logging Completo**: Todas las acciones quedan registradas en los logs del servidor
5. **Rollback Automático**: Fallos durante operaciones revierten todos los cambios
6. **Autenticación Requerida**: Solo administradores autenticados pueden ejecutar operaciones

### ⚠️ Restricciones de Seguridad

- **Usuarios inactivos**: Mínimo 30 días de inactividad
- **Publicaciones antiguas**: Mínimo 90 días de antigüedad
- **Solo saldos por defecto**: Los usuarios deben mantener saldos iniciales para ser eliminados
- **Estados específicos**: Solo publicaciones completadas/pagadas son eliminables

## 🔧 Herramientas Disponibles

### 1. Scripts de Línea de Comandos

#### **Backup de Base de Datos**
```bash
# Crear un backup completo
node backup-database.js backup

# Listar backups existentes
node backup-database.js list

# Restaurar desde un backup específico
node backup-database.js restore backups/backup-2024-01-15T10-30-00-000Z.sql
```

#### **Limpieza de Base de Datos**
```bash
# Mostrar estadísticas actuales
node cleanup-database.js stats

# Limpiar datos de prueba
node cleanup-database.js test-data

# Limpiar usuarios inactivos (por defecto 90 días)
node cleanup-database.js inactive-users [días]

# Limpiar publicaciones antiguas (por defecto 180 días)
node cleanup-database.js old-publications [días]

# PELIGROSO: Reset completo de la base de datos
node cleanup-database.js reset
```

### 2. Panel de Administración Web

Accede a la sección **"Gestión de Base de Datos"** en el panel administrativo para:

- Ver estadísticas en tiempo real de la base de datos
- Crear backups manuales
- Ejecutar operaciones de limpieza con interfaz visual
- Monitorear el estado de las operaciones

## 📊 Estadísticas Disponibles

El sistema proporciona las siguientes métricas:

- **total_users**: Total de usuarios registrados
- **test_users**: Usuarios con nombres de prueba (test/demo/example)
- **inactive_users**: Usuarios inactivos con saldos por defecto
- **total_publications**: Total de publicaciones
- **old_publications**: Publicaciones antiguas elegibles para limpieza
- **total_transactions**: Total de transacciones registradas
- **total_notifications**: Total de notificaciones
- **old_notifications**: Notificaciones antiguas (>30 días)
- **active_debts**: Deudas RED activas
- **active_escrows**: Escrows BLUE activos
- **database_size**: Tamaño total de la base de datos

## 🧹 Tipos de Limpieza

### 1. **Limpieza de Datos de Prueba**
Elimina automáticamente:
- Usuarios con nombres que contengan 'test', 'demo', 'example'
- Publicaciones con títulos que contengan 'test', 'demo', 'example'
- Notificaciones con más de 30 días de antigüedad

### 2. **Limpieza de Usuarios Inactivos**
Elimina usuarios que cumplan **TODOS** estos criterios:
- Creados hace más de X días (mínimo 30)
- No son usuarios de plataforma
- Mantienen saldo BLUE líquido exactamente en 100.0000
- Mantienen saldo BLUE en escrow en 0.0000
- Mantienen saldo RED en 0.0000

### 3. **Limpieza de Publicaciones Antiguas**
Elimina publicaciones que cumplan **TODOS** estos criterios:
- Creadas hace más de X días (mínimo 90)
- Estado 'completed' o 'confirmed_paid'

## 🔄 Proceso de Backup y Restauración

### Estructura de Backups

Los backups se almacenan en `backend/backups/` con formato:
```
backup-YYYY-MM-DDTHH-mm-ss-sssZ.sql
```

### Contenido del Backup

Cada backup incluye:
- **Metadatos**: Fecha y hora de creación
- **Datos completos**: Todas las tablas con todos los registros
- **Formato SQL**: Instrucciones INSERT compatibles con PostgreSQL

### Restauración

⚠️ **ADVERTENCIA**: La restauración elimina TODOS los datos actuales y los reemplaza con los del backup.

```bash
node backup-database.js restore backups/backup-YYYY-MM-DDTHH-mm-ss-sssZ.sql
```

## 🔐 Endpoints de API

### Estadísticas
```
GET /api/admin/database/stats
```

### Backup Manual
```
POST /api/admin/database/backup
```

### Limpieza de Datos de Prueba
```
POST /api/admin/database/cleanup-test-data
```

### Limpieza de Usuarios Inactivos
```
POST /api/admin/database/cleanup-inactive-users
Body: { "daysInactive": 90 }
```

### Limpieza de Publicaciones Antiguas
```
POST /api/admin/database/cleanup-old-publications
Body: { "daysOld": 180 }
```

## 📝 Logs y Monitoreo

### Logs del Servidor

Todas las operaciones se registran con el prefijo `[ADMIN CLEANUP]`:

```
[ADMIN CLEANUP] Administrador inició limpieza de datos de prueba
[ADMIN CLEANUP] Limpieza completada - Usuarios: 5, Publicaciones: 3, Notificaciones: 120
[ADMIN CLEANUP] Usuarios inactivos eliminados: 15
[ADMIN CLEANUP] Publicaciones antiguas eliminadas: 8
```

### Logs de Backup

```
🔄 Iniciando backup de la base de datos...
📋 Respaldando tabla: users
📋 Respaldando tabla: publications
✅ Backup completado exitosamente: /path/to/backup.sql
📊 Total de tablas respaldadas: 18
```

## ⚡ Mejores Prácticas

### Antes de Cualquier Operación

1. **Verificar el entorno**: Confirmar que estás en el entorno correcto
2. **Revisar estadísticas**: Ejecutar `node cleanup-database.js stats`
3. **Backup manual**: Crear un backup adicional si es operación crítica
4. **Notificar al equipo**: Informar sobre mantenimientos programados

### Durante las Operaciones

1. **Monitorear logs**: Observar la salida del servidor en tiempo real
2. **Verificar conectividad**: Asegurar conexión estable a la base de datos
3. **No interrumpir**: Permitir que las transacciones se completen

### Después de las Operaciones

1. **Verificar integridad**: Comprobar que el sistema funciona correctamente
2. **Revisar estadísticas**: Confirmar que los números son los esperados
3. **Documentar cambios**: Registrar qué se realizó y cuándo
4. **Notificar resultados**: Informar al equipo sobre los resultados

## 🚨 Procedimiento de Emergencia

### Si algo sale mal durante una operación:

1. **No pánico**: Las operaciones están en transacciones que se revierten automáticamente
2. **Revisar logs**: Identificar el error específico en los logs del servidor
3. **Verificar estado**: Comprobar si la base de datos mantiene integridad
4. **Restaurar si es necesario**: Usar el backup automático creado antes de la operación

### Comando de restauración de emergencia:

```bash
# Listar backups disponibles
node backup-database.js list

# Restaurar el más reciente
node backup-database.js restore backups/[backup-mas-reciente].sql
```

## 📞 Soporte y Contacto

Para cualquier duda o problema con estas herramientas:

1. **Revisar este README** primero
2. **Consultar los logs** del servidor para errores específicos
3. **Verificar configuración** de la base de datos
4. **Contactar al equipo técnico** con información específica del error

## 🔍 Troubleshooting

### Error: "Usuario de plataforma no encontrado"
```bash
# Verificar variable de entorno
echo $PLATFORM_USERNAME

# Si no está definida, se usa el valor por defecto
# 'Plataforma WintonCoin'
```

### Error: "No se puede conectar a la base de datos"
```bash
# Verificar variable de entorno
echo $DATABASE_URL

# Verificar conectividad
node -e "require('./server.js')"
```

### Error: "Archivo de backup no encontrado"
```bash
# Listar backups disponibles
node backup-database.js list

# Verificar ruta completa
ls -la backend/backups/
```

## 🚀 Actualizaciones Futuras

Funcionalidades planificadas:

- [ ] Backup incremental automático
- [ ] Compresión de backups antiguos
- [ ] Restauración selectiva por tabla
- [ ] Programación de limpiezas automáticas
- [ ] Dashboard de monitoreo en tiempo real
- [ ] Alertas por email/Slack
- [ ] Métricas de rendimiento de base de datos

---

**Última actualización**: Enero 2024  
**Versión del sistema**: 2.0.0  
**Compatibilidad**: PostgreSQL 12+ 