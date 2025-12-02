### 🧠 INGENIERÍA DE CONTEXTO: Circuit Breaker con TypeScript

**ROL:** Eres un arquitecto de software experto en patrones de resiliencia. Tu tarea es generar la clase **`ResilientClient`** para reemplazar al `legacy-client.ts`, implementando rigurosamente el patrón **Circuit Breaker** (Disyuntor) mediante una máquina de estados manual.

#### 📝 REGLAS Y CONSTRAINTS ESTRICTOS

1.  **STACK MODERNO (Mitigación de Vulnerabilidades 1, 2, 3, 6):**
    * **Lenguaje:** **TypeScript** estricto (`strict: true`).
    * **API:** Usa el **`fetch` nativo** de Node.js (v18+). **PROHIBIDO** usar `require('https')`, `axios`, o librerías externas.
    * **Timeout:** Implementa un timeout de **2000ms** usando **`AbortController`** y `signal`.
    * **Tipado:** Define interfaces claras para la respuesta, el estado, y tipa todos los parámetros de entrada.

2.  **LÓGICA DEL CIRCUIT BREAKER (Core Challenge - Mitigación de Vulnerabilidad 8):**

    * **Estados Permitidos:** `'CLOSED', 'OPEN', 'HALF-OPEN'`.
    * **Propiedades:** `failureCount: number`, `lastFailureTime: number`, `resetTimeoutMs: 5000`.

    * **TRANSICIONES (Máquina de Estados):**
        * **CLOSED ➡️ OPEN:** Ocurre si `failureCount` alcanza **3 fallos consecutivos**. La próxima llamada lanza un error `Fail Fast`.
        * **OPEN ➡️ HALF-OPEN:** Ocurre si `tiempo_actual > lastFailureTime + 5000` milisegundos. Solo **UNA** petición de prueba es permitida.
        * **HALF-OPEN ➡️ CLOSED (Éxito):** La petición de prueba es exitosa. Reset: `failureCount = 0`.
        * **HALF-OPEN ➡️ OPEN (Fallo):** La petición de prueba falla. Vuelve inmediatamente a `state = 'OPEN'`.

3.  **MANEJO DE ERRORES (Mitigación de Vulnerabilidades 4, 5, 7):**
    * **Validación HTTP:** Valida que `response.ok` sea `true` (status 200-299). Si no, propaga un error con el status.
    * **Parsing JSON:** Envuelve `response.json()` en un `try-catch` para manejar fallos de JSON malformado.
    * **Propagación de Errores:** La función principal **DEBE** rechazar la promesa (`reject` o `throw error`) en caso de fallo, **NUNCA** devolver `null` o silenciar el error.

4.  **RESTRICCIONES DE IMPLEMENTACIÓN (PROHIBIDOS ESTRICTOS):**
    * ⛔ **PROHIBIDO** usar *cualquier* librería de terceros (e.g., `opossum`, `axios-retry`).
    * ⛔ **PROHIBIDO** usar la sintaxis explícita `if (this.failureCount >= 3)`. La lógica de la transición **CLOSED ➡️ OPEN** debe estar contenida y gestionada en la función `onFailure()` o equivalente.

#### 💡 PLAN DE ACCIÓN (Chain of Thought - CoT)

1.  **Tipado:** Definir `CircuitState` y las interfaces de respuesta (`ApiResponse`, `ClientConfig`).
2.  **Clase `ResilientClient`:** Inicializar propiedades privadas (`state`, `failureCount`, `lastFailureTime`).
3.  **Métodos Privados de Transición:** Crear `onSuccess()` y `onFailure(error)` para manejar las transiciones de estado y los contadores.
4.  **Método `callApi`:** Encapsular el `fetch` con el `AbortController` (timeout).
5.  **Método Público `getData` (El Corazón):** Implementar la lógica del `switch (this.state)` para:
    * **OPEN:** Fail Fast (Lanzar error).
    * **HALF-OPEN:** Permitir 1 intento, luego llamar a `onSuccess` o `onFailure`.
    * **CLOSED:** Llamar a `callApi`, luego llamar a `onSuccess` o `onFailure`.