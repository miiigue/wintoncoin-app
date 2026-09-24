# Reglas del Proyecto WintonCoin

<RULE[qa_manual_tests]>
Cuando el usuario te pida crear una "lista de pruebas manuales" o "casos de prueba QA" para que los testers los ejecuten desde sus teléfonos, **DEBES SIEMPRE** entregar la respuesta utilizando el siguiente **Modelo Estricto**. 

Este modelo es leído por un Autocompletador Inteligente (Parser) en el Panel de Administración de WintonCoin, por lo que NO DEBES alterar los encabezados (TITULO:, DESCRIPCION:, PASOS:).

**Formato Estricto Obligatorio (Usa un bloque de código markdown de texto plano para cada prueba):**

```text
TITULO: [Nombre corto y descriptivo de la prueba]
DESCRIPCION: [Un párrafo explicando los requisitos, el objetivo y lo que se necesita informar sobre la tarea. Debe ser específico y sin tecnicismos.]
PASOS:
2. [Instrucción del paso 2 - IMPORTANTE: Empieza siempre a numerar desde el 2]
3. [Instrucción del paso 3]
4. [Instrucción del paso 4]
```

**Reglas Críticas del Modelo:**
1. Siempre debes usar la palabra exacta `TITULO:` seguida del título.
2. Siempre debes usar la palabra exacta `DESCRIPCION:` (En mayúsculas y sin tilde) seguida de un texto limpio que explique la misión de forma amigable (SIN incluir los pasos aquí).
3. Siempre debes usar la palabra exacta `PASOS:` sola en una línea antes de comenzar a numerar las instrucciones.
4. El bloque de pasos **DEBE COMENZAR SIEMPRE EN EL NÚMERO 2** (Ej: `2. Ve a tu perfil...`). Esto es obligatorio porque el sistema frontend inyecta el Paso 1 automáticamente.
5. Cada paso debe estar en una sola línea, sin saltos de línea.
6. **Lenguaje No Técnico:** Las instrucciones y la descripción deben ser escritas en un lenguaje **completamente comprensible para un usuario común**. NUNCA uses jerga técnica.
7. **Registro Continuo (Catálogo QA):** Cada vez que generes nuevas pruebas QA, TIENES LA OBLIGACIÓN de agregarlas automáticamente al final del archivo `QA_TEST_CATALOG.md` ubicado en la raíz del proyecto para mantener el registro histórico de todas las misiones. Sigue estrictamente la numeración correlativa (si la última fue QA-5, la tuya será QA-6).

Nunca entregues las pruebas en tablas o listas markdown tradicionales. Usa estrictamente este formato.
</RULE[qa_manual_tests]>

<RULE[frontend_react_migration]>
A partir de ahora, cualquier pantalla, interfaz, vista o componente visual nuevo que se cree DEBE construirse obligatoriamente en React, utilizando el stack y la arquitectura de la migración activa ubicada en `frontend/src/` (Vite + React SPA).
Queda terminantemente prohibido crear nuevas pantallas en HTML o JavaScript vanilla legado, garantizando que todo el trabajo nuevo quede actualizado de una vez en React sin requerir una segunda migración posterior.
</RULE[frontend_react_migration]>

<RULE[treasury_incentive_mechanism]>
# Mecanismo Canónico de Pagos e Incentivos de Tesorería (Dogfooding Protocolar Puro)
Para preservar la prohibición estricta de transferencias P2P directas en `BlueToken.sol` y evitar puertas traseras o excepciones en los contratos (`CoreProtocol.sol` y `RedToken.sol`):
1. La Tesorería / Plataforma NUNCA transfiere tokens BLUE directamente a billeteras de usuarios por fuera del protocolo.
2. Toda recompensa, bono o incentivo dispersado por la Tesorería opera bajo el flujo estándar idéntico al de cualquier usuario: la Tesorería origina el pago vía `CoreProtocol` asumiendo el compromiso RED y pagando la comisión de plataforma correspondiente de forma ordinaria.
3. El pago genera los tokens BLUE con parking al beneficiario y los tokens BLUE de comisión a la Tesorería (preservando el flujo estándar sin excepciones `if (payer == treasury)` ni código especial).
4. La Tesorería amortiza su compromiso RED utilizando sus tokens BLUE acumulados por comisiones, preservando estrictamente la invariante de paridad: `TotalSupply(BLUE) == TotalSupply(RED)` con variación neta cero en la masa monetaria circulante.
</RULE[treasury_incentive_mechanism]>

