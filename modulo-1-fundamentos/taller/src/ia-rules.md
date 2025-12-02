Actúa como un Senior Backend Architect experto en Node.js y TypeScript.

Tengo un código heredado (`legacy-client.ts`) que está causando problemas en producción debido a la falta de manejo de errores y timeouts. Tu tarea es refactorizar este código creando una nueva clase llamada `ResilientClient`.

Sigue estrictamente las siguientes instrucciones y restricciones técnicas:

### 1. Stack Tecnológico
* **Lenguaje:** TypeScript con tipado estricto. Define interfaces para las respuestas.
* **Transporte:** Elimina el módulo `https`. Usa exclusivamente **Native `fetch`** (Node.js 18+).
* **Timeouts:** Implementa un timeout obligatorio usando `AbortController` y `AbortSignal`.

### 2. Lógica Core: Circuit Breaker Manual
No puedes usar librerías externas (como 'opossum' o 'axios-retry'). Debes implementar una máquina de estados finitos manualmente con la siguiente lógica:

* **Estados:** El cliente debe tener 3 estados internos: `CLOSED`, `OPEN`, `HALF-OPEN`.
* **Regla de Fallo (CLOSED -> OPEN):** Si ocurren **3 fallos consecutivos** (excepciones de red o timeouts), el estado pasa a `OPEN`.
* **Regla de Fail-Fast (OPEN):** Mientras esté en `OPEN`, cualquier petición debe lanzar un error inmediatamente sin intentar conectar a la red.
* **Regla de Reset (OPEN -> HALF-OPEN):** Después de **5000ms** en estado `OPEN`, la siguiente petición debe permitirse (estado `HALF-OPEN`).
    * Si esta petición "de prueba" tiene éxito: El circuito se cierra (`CLOSED`) y el contador de fallos vuelve a 0.
    * Si esta petición falla: El circuito vuelve a abrirse (`OPEN`) inmediatamente y reinicia el temporizador.

### 3. Código a Refactorizar
(Asume que el código original usaba `https.get` con callbacks anidados y sin manejo de errores).

Por favor, genera el código completo de la clase `ResilientClient` en TypeScript. Incluye comentarios breves explicando dónde ocurre cada transición de estado.