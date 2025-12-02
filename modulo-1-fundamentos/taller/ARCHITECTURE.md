# Reglas de Arquitectura del Proyecto

## 1. Stack Tecnológico
- **Runtime:** Node.js v20+ (Utilizar Streams Nativos y Async Iterators).
- **Lenguaje:** TypeScript Strict Mode.

## 2. Manejo de Errores (Critical)
- **PROHIBIDO:** Lanzar excepciones para flujo de control.
- **REQUERIDO:** Usar patrón `Result<T, E>` (Success/Failure object).
- Capturar errores de streams explícitamente.

## 3. Validación de Datos
- Usar `zod` para validar CADA fila del CSV en tiempo de ejecución.
- Si una fila es inválida, registrar el error y continuar.

## 4. Performance
- **Zero-Copy:** Evitar cargar el archivo entero en RAM. Usar `readline` o `pipeline`.