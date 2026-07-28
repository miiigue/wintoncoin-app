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

Nunca entregues las pruebas en tablas o listas markdown tradicionales. Usa estrictamente este formato.
</RULE[qa_manual_tests]>
