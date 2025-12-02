# Project Architecture & Engineering Standards

> **System Critical:** Este documento rige las decisiones arquitectónicas, estándares de código y patrones de rendimiento del proyecto. Se prioriza la mantenibilidad, la integridad de los datos y el bajo consumo de recursos.

---

## 1. Stack Tecnológico (Strict)
- **Runtime:** Node.js v20 LTS+ (Streams Nativos & Async Iterators requeridos).
- **Lenguaje:** TypeScript 5.x.
- **Config:** `strict: true` en `tsconfig.json` es obligatorio.
- **Validación:** Zod.

## 2. Arquitectura de Software (Clean Architecture)
El código debe organizarse respetando estrictamente la dirección de dependencias:

1.  **`/domain` (Core)**
    - Contiene: Entidades, Value Objects, Reglas de Negocio, Interfaces de Repositorios.
    - **Regla:** 0 dependencias externas. No frameworks, no DB drivers. Solo TS puro.
2.  **`/application` (Orquestación)**
    - Contiene: Casos de Uso (Use Cases), DTOs, Interfaces de Servicios.
    - **Regla:** Implementa la lógica de la aplicación usando las entidades del dominio.
3.  **`/infrastructure` (Implementación)**
    - Contiene: Repositorios concretos (SQL/NoSQL), Implementación de FS, Clientes HTTP, Parsers.
    - **Regla:** Única capa que puede tocar I/O real (Base de datos, FileSystem).
4.  **`/interfaces` (Entry Points)**
    - Contiene: API Controllers, CLI Commands, Event Subscribers.

---

## 3. Manejo de Errores & Flujo de Control
**Objetivo:** Eliminar la incertidumbre y los "runtime exceptions" no controlados.

- **PROHIBIDO:** Usar `throw` para errores de lógica de negocio o validación. `throw` se reserva exclusivamente para errores fatales del sistema (Out of Memory, Crash de proceso).
- **REQUERIDO:** Patrón `Result<T, E>`.
    - Todas las funciones de Dominio y Aplicación deben retornar un objeto result (Success/Failure).
    - *Ejemplo:* `createOrder(data): Promise<Result<Order, OrderValidationError>>`
- **Manejo de Streams:** Los errores en streams (`pipeline`) deben ser capturados explícitamente.

---

## 4. Rendimiento & Procesamiento de Datos
**Objetivo:** Procesar archivos gigantes con memoria constante (O(1)).

- **Zero-Copy / Streaming:**
    - Prohibido cargar archivos completos en memoria (`fs.readFile` prohibido para datos).
    - Usar `fs.createReadStream`, `readline` module o `stream.pipeline`.
- **Backpressure:**
    - Respetar siempre el backpressure. No leer más rápido de lo que se puede escribir/procesar.
- **Validación Resiliente (Fail-Safe):**
    - Al procesar listas/CSVs, usar `zod` para validar fila por fila.
    - **Si una fila falla:** Registrar error (Log/DLQ) y **CONTINUAR** con la siguiente. No abortar el proceso completo.

---

## 5. Estándares de Código (Code Quality)

- **No `any`:** Estrictamente prohibido. Usar `unknown` + Type Guards si es necesario.
- **Inmutabilidad:** Preferir `readonly` en propiedades de interfaces y DTOs.
- **Nominal Typing:** Usar "Branded Types" para identificadores críticos para evitar colisiones semánticas.
    - *Ejemplo:* `type UserId = string & { __brand: 'UserId' }`
- **Inyección de Dependencias:**
    - Los Casos de Uso reciben sus dependencias (repositorios/servicios) vía constructor (Interface). Nunca importar implementaciones concretas directamente en `/application`.

---

## 6. Logging & Observabilidad
- Usar logging estructurado (JSON).
- Niveles obligatorios:
    - `ERROR`: Intervención humana requerida.
    - `WARN`: Error recuperable (ej. fila CSV inválida omitida).
    - `INFO`: Hitos de alto nivel (Inicio/Fin de proceso).
    - `DEBUG`: Detalles internos para desarrollo (no activar en prod por defecto).

## 7. Testing
- **Unitarios:** Enfocados en `/domain` y `/application`. Deben correr en memoria sin mocks complejos de I/O.
- **Integración:** Enfocados en `/infrastructure` para validar la conexión real con BD/FS.