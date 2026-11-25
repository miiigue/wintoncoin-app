# Tablero Persistente de Operaciones — Equipo Antigravity (`agent-ops`)

- **Coordinador General Técnico:** Codex (`CODEX-204`)
- **Líder de Ingeniería y Entrega:** Antigravity
- **Ámbito Estricto:** Exclusivamente Demo (`demo` / `origin/demo` / Optimism Sepolia `chainId 11155420`). Prohibido tocar `main`, Producción, fondos reales o ejecutar resets destructivos.
- **Límite de Concurrencia:** Máximo 3 subagentes trabajadores activos en paralelo + coordinador. Separación estricta autor ≠ revisor.
- **Última actualización:** 2026-11-24

---

## Registro de Subagentes Definidos y Activos

| Rol | Tipo (`define_subagent`) | `conversationId` Real | Workspace | Tarea Actual | Estado |
|---|---|---|---|---|---|
| `AG-01` Arquitectura/Tech Lead | `ag-01-architect` | `fde22b23-cf43-42da-a2a8-7ae6adae941b` | `inherit` | Revisión independiente `D01` | completado (`APROBADO`) |
| `AG-02` Blockchain/Economía | `ag-02-blockchain-econ` | `e6eec398-2c19-4219-942b-28c0c53f9545` | `inherit` (propiedad exclusiva D02) | Ola 2: corrección `CODEX-205` #3-#5 (actividad relevante post-bloque, declaración contención, preservación SQL vs migrador) | completado (`35/35` Jest PASS) |
| `AG-03` Backend/Datos | `ag-03-backend-data` | `7b54f5bd-e340-46fe-8cc8-3d8bdbe7e45f` | `inherit` | Cierre bloqueante `CODEX-206` D02: ensayo real PostgreSQL 17 (`v6-pg-isolated:55471`) con migraciones `128..131` | completado (`3/3` PG17 real PASS + `35/35` unitarias PASS) |
| `AG-06` Seguridad/Adversarial | `ag-06-security-audit` | `866bd47c-cb4b-4e7b-8a21-fe026bb61d28` | `inherit` | Re-auditoría `CODEX-206` sobre `D06` (falso OK línea 884 + `--fail-on-degraded` + `ref: demo`) | completado (`APROBADO` D06 — 0 hallazgos) |
| `AG-07` SRE/Plataforma | `ag-07-sre-platform` | `825c5baf-e6cb-4a81-b898-a71f0f0afba8` | `inherit` | Cierre bloqueante `CODEX-206` D06: corregir falso OK línea 884 + `indexerReady` + `--fail-on-degraded` + `ref: demo` | completado (`33/33` Jest PASS) |
| `AG-08` Auditoría Económica | `ag-08-econ-auditor` | `cf5f6690-38d3-4c81-b23b-df38430a1c1d` | `inherit` | Auditoría `CODEX-206` integración real PG17 (`v6DemoInventoryExporter.pg.test.js`) | completado (`APROBADO` D02 PG17) |
| `AG-11` Guardián Reglas Económicas y Estándares | `ag-11-standards-econ-guard` | `6c9a9607-092a-45c2-a329-7ce883c3b6a9` | `inherit` | Auditoría `CODEX-206` cierre final (`D02` PG17 + `D06` falso OK) | completado (`APROBADO` D02 y D06) |

---

## Tablero de Entregables (`D01`..`D08`)

| ID | Prioridad | Propietario | Revisor | Estado | Commit | Dependencias | Aceptación | Evidencia | Próximo Paso |
|---|---|---|---|---|---|---|---|---|---|
| **D01** | P0 | `AG-04`+`AG-05` (coord. Antigravity) | `AG-01` (`APROBADO`) | `lista` | `9a6dc2c` | Ninguna | Restauración aislada de `frontend/src/pages/estado-cuenta.js` (`8d52d0c...`), `build:demo` y checks en worktree limpio, push a `origin/demo` y verificación en vivo | Worktree limpio PASS (`test:wallet`, `test:account-security`, `build:demo`, `test:pwa`); `AG-01` APROBADO; `9a6dc2c` en `origin/demo`; en vivo `demo.wintoncoin.com/estado-cuenta.html` HTTP 200 (`estadoCuenta.BoPWzzwi.js`); backend `/api/web3/deployment` HTTP 200 (`V6_DEMO`, `11155420`); `/api/web3/exchange-queue` HTTP 503 controlado post-reinicio | Cerrado; reportar a Codex junto con `D02` |
| **D02** | P0 | `AG-02` (`e6eec398`) + `AG-03` (`7b54f5bd`) | `AG-06` (`APROBADO`), `AG-08` (`APROBADO`), `AG-11` (`APROBADO`), Codex (`CODEX-207` aprobado como herramienta diagnóstica) | `en ejecución` | commit aislado `D02` en curso (`origin/demo`) | `CODEX-203` + `CODEX-205` #1..#5 + `CODEX-206` PG17 + `CODEX-207` reproducibilidad | Exportador `backend/scripts/export-v6-demo-inventory.js` + ensayo real PG17 (`v6-pg-isolated`, `WINTON_MIGRATIONS_128_131_DIR`, `afterAll` fail-closed) | `35/35` unitarias + `3/3` PG17 real PASS (`14.573s`, clúster detenido `isready=2`), `153/153` imports PASS, `check-repo-structure.cjs` PASS; corrida on-chain real bloque `51877845` (`candidateEmptyAtBlock: true`) | Publicar commit aislado `D02` y ejecutar inventario completo SQL `READ ONLY` + on-chain en entorno Demo |
| **D03** | P0 | `AG-01`+`AG-02`+`AG-08` | Codex | `pendiente` | — | `D02` | Decisión basada en evidencia real entre Ruta A (vacía integralmente) o Ruta B (migrador ensayado) | Pendiente | Evaluar JSON sanitizado de `D02` |
| **D04** | P1 | `AG-03`+`AG-04`+`AG-07` | `AG-01`, `AG-06` | `bloqueada` | — | `D03` (causa: depende de decisión Ruta A/B y compatibilidad `RiskRegistry.profileUpdateVersion == 1`) | Integración de `9e9fbec`, migraciones `128..131`, manifiesto/hash/indexador sin publicar backend contra registro antiguo | Bloqueada por `D03` | Esperar veredicto de `D02`/`D03` |
| **D05** | P1 | `AG-05`+`AG-08` | Codex | `bloqueada` | — | `D04` (causa: requiere suite V6 compatible y `9e9fbec` desplegados en Demo) | E2E económico completo en el commit desplegado (`alta -> correo -> billetera -> KYC -> límite 100 -> publicar -> aceptar -> pagar -> comisión -> parking -> vencimiento/amortización`) y conciliación `@Test8` | Bloqueada por `D04` | Ejecutar tras `D04` |
| **D06** | P2 | `AG-07` (`825c5baf`) | `AG-06` (`APROBADO`), `AG-11` (`APROBADO`), Codex (`CODEX-207` aprobado como herramienta diagnóstica) | `en ejecución` | commit aislado `D06` en curso (`origin/demo`; cron **«PREPARADO, NO ACTIVO»**) | `D01` + cierre falso OK `CODEX-206` + `CODEX-207` | Smoke horario read-only en Demo con allowlist, readiness estricta (`status==='ready' && usable===true` + bloque válido + `chainId`), `indexerReady`, `--fail-on-degraded`, `ref: demo` y pruebas PASS | `33/33` Jest PASS, `check-repo-structure.cjs` PASS, sonda Codex `--fail-on-degraded` `4/4` OK (`exit 0`, bloque `51880948`) | Publicar commit aislado `D06`, investigar causa del `503` puntual en Render Demo y revisar semántica/umbral de `verifiedThroughBlock` + runner local horario |
| **D07** | P2 | `AG-07`+`AG-03`+`AG-02` | `AG-06` | `pendiente` | — | `D05` | Perfil de carga medido (p50/p95/p99, gas, nonce, DB pool, colas) y cuello de botella real documentado | Pendiente | Diseñar tras cierre funcional `D05` |
| **D08** | P2 | `AG-09`+`AG-05` | `AG-08` | `pendiente` | — | `D05` | Guía manual para Miguel/hija en formato QA estricto (`QA_TEST_CATALOG.md`) usando cuentas ordinarias Demo | Pendiente | Redactar tras verificación `D05` |
