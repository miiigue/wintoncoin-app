# Reglas del Proyecto WintonCoin

<RULE[qa_manual_tests]>
Cuando el usuario te pida crear una "lista de pruebas manuales" o "casos de prueba QA" para que los testers los ejecuten desde sus teléfonos, **DEBES SIEMPRE** entregar la respuesta utilizando el siguiente **Modelo Estricto**. 

Este modelo es leído por un Autocompletador Inteligente (Parser) en el Panel de Administración de WintonCoin, por lo que NO DEBES alterar los encabezados (TITULO: y DESCRIPCION:).

**Formato Estricto Obligatorio (Usa un bloque de código markdown de texto plano para cada prueba):**

```text
TITULO: [Nombre corto y descriptivo de la prueba]
DESCRIPCION:
2. [Instrucción del paso 2 - IMPORTANTE: Empieza siempre a numerar desde el 2]
3. [Instrucción del paso 3]
4. [Instrucción del paso 4]
```

**Reglas Críticas del Modelo:**
1. Siempre debes usar la palabra exacta `TITULO:` seguida del título.
2. Siempre debes usar la palabra exacta `DESCRIPCION:` (En mayúsculas y sin tilde) sola en la siguiente línea.
3. El bloque de pasos en la descripción **DEBE COMENZAR SIEMPRE EN EL NÚMERO 2** (Ej: `2. Ve a tu perfil...`). Esto es obligatorio porque el sistema frontend de WintonCoin inyecta automáticamente el Paso 1 ("Aceptar tarea y grabar pantalla") al momento de parsear el texto. Si empiezas en 1, arruinarás el orden de los pasos del sistema.
4. Cada paso debe estar en una sola línea, sin saltos de línea intermedios dentro del mismo paso.
5. **Lenguaje No Técnico:** Las instrucciones deben ser específicas y claras, pero escritas en un lenguaje **completamente comprensible para un usuario común**. NUNCA uses jerga técnica (ej. "Llamar endpoint", "Verificar JSON", "Revisar logs").

Nunca entregues las pruebas en tablas o listas markdown tradicionales `*` o `-`. Usa estrictamente este formato de texto plano con los números explícitos.
</RULE[qa_manual_tests]>
