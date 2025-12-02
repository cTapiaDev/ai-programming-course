# Reglas de Arquitectura del Proyecto

## 1. Stack Tecnológico
- **Runtime:** Node.js v18+ (Utilizar Streams Nativos y Async Iterators).
- **Lenguaje:** TypeScript Strict Mode.
- **Api:**  fetch nativo

## 2. Reglas de Arquitectura
- **implementacion:** Evitar servicios gigantes; dividir según contexto.
- **patrones:** Utilizar patron Circuit Breaker.
- **errores:** Implementar manejo de errores con detalle y contexto.
- **tipos:** Utilizar tipos estrictos y validacion de datos.