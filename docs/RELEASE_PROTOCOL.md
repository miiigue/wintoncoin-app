# Protocolo de Release (Fintech/Banca)

Este documento explica **cómo versionar y desplegar** de forma profesional.
Debe usarse **en cada release** y sirve como guía si cambias de chat.

## Objetivo
- Mantener cambios auditables y seguros.
- Evitar errores por frontend viejo + backend nuevo.
- Asegurar consistencia entre Render (backend) y Hostinger (frontend).

## Conceptos clave
- **Commit**: cambio interno (no es release).
- **Release**: cambios en producción (Render + Hostinger).
- **Versión**: se actualiza **solo en release**, no en cada commit.

## SemVer (estándar)
Formato: `MAJOR.MINOR.PATCH`
- **MAJOR**: cambios incompatibles.
- **MINOR**: nuevas funciones sin romper compatibilidad.
- **PATCH**: correcciones.

Ejemplos:
- `1.0.1` = bugfix
- `1.1.0` = feature nueva
- `2.0.0` = cambio grande

## Checklist de Release (obligatorio)
1) **Backend listo**
   - Migraciones revisadas y ejecutadas.
   - Logs sin errores.
2) **Frontend listo**
   - UI revisada.
3) **Seguridad**
   - Secrets fuera de Git.
4) **Versionado**
   - Elegir número de versión SemVer.
   - Actualizar archivo `VERSION`.
5) **Deploy ordenado**
   - Render → Hostinger → Validación.

## Versionado de assets (manual, sin build)
Se recomienda **versionado por release**.
Ejemplo:
- `style.v1.4.0.css`
- `interaction.v1.4.0.js`
- `utils.v1.4.0.js`

En HTML:
```html
<link rel="stylesheet" href="style.v1.4.0.css">
<script src="utils.v1.4.0.js"></script>
<script src="interaction.v1.4.0.js"></script>
```

## Procedimiento de Release (paso a paso)
1) **Definir versión** (SemVer).
2) **Actualizar nombres de assets** (si aplica).
3) **Actualizar referencias en HTML**.
4) **Actualizar `docs/CHANGELOG.md` y `docs/EVOLUCION.md`.**
5) **Commit del release** (mensaje claro).
6) **Deploy backend en Render.**
7) **Deploy frontend en Hostinger.**
8) **Validación rápida en producción.**

## Notas importantes
- No hacer release por cada commit.
- Un release = versión estable y probada.
- Mantener trazabilidad en `CHANGELOG.md` y `EVOLUCION.md`.
