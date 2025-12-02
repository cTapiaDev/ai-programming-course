### 🤖 Prompt Engineering

1. **Prompt de Análisis / Estrategia:**
> Eres un Senior Software Engineer con experiencia en Node.js y TypeScript, experto en arquitectura de software y patrones de diseño.
> El código actual tiene un error en el archivo legacy-client.ts, el cual describo a continuación:
> "El microservicio de pagos está sufriendo fallos en cascada. El equipo de SRE ha identificado al culpable: un cliente HTTP heredado (`legacy-client.ts`) que se conecta a una pasarela de pagos inestable.
> El código actual es un desastre:
> 1. Usa el módulo "https" antiguo con callbacks anidados.
> 2. **No tiene Timeouts:** Cuando la pasarela externa se cuelga, nuestro servidor se queda esperando infinitamente hasta agotar los recursos.
> 3. **No maneja errores:** Si la API devuelve basura, el servicio explota."

2. **Prompt de Generación de Código:**
> @[modulo-1-fundamentos/taller/ARCHITECTURE.md] 
> Instrucciones
> 1. Básate en el archivo ARCHITECTURE.md para los siguientes prompts/instrucciones que te vaya escribiendo.
> 
> 2. Analiza el archivo legacy-client.ts y: @codeContext:
> 2.1 dame un resumen de lo que realiza
> 2.2 Busca vulnerabilidades
> 
> 3. Necesito realizar lo siguiente:
> 3.1. Migrar a TypeScript con "strict:true".
> 3.2. Eliminar "https" obsoleto y cambiarlo a "fetch" nativo de Node.js en la versión descrita en el archivo ARCHITECTURE.md
> 3.3. Implementar la solución de los errores actuales descritos anteriormente con un patrón "Circuit breaker" sin librerías externas:
> 3.3.1 Estado CLOSED: el flujo normal
> 3.3.2 Estado OPEN: Si ocurren 3 fallos consecutivos, el circuito se abre. Todas las peticiones posteriores deben fallar inmediatamente (Fail Fast) sin llamar a la API externa.
> 3.3.3 Estado HALF-OPEN: Tras 5 segundos en estado OPEN, el sistema debe permitir pasar *una* petición de prueba. Si funciona, el circuito se cierra (Reset). Si falla, vuelve a OPEN.
> 3.3.4 Genera la clase "ResilientClient"
> 
> No debes realizar lo siguiente:
> a. Escribir la lógica del "if (failures > 3)" manualmente, se debe utilizar patrón de diseño.
> b. Usar librerías como "oposum" o "axios-retry" la lógica debe ser creada con código.
> 
> Final
> ⦁	Debes mantener el archivo actual de legacy-client.ts intacto, la solución debes añadirla en un archivo nuevo llamado "src/resilient-client.ts"
> ⦁	Coméntame si utilizaste algún patrón de diseño adicional a "Circuit breaker" y nómbralos de ser así.

3. **Prompt de Corrección / Refinamiento:**
> Tengo un error en el archivo @[modulo-1-fundamentos/taller/src/resilient-client.ts] en el import, cómo lo soluciono

---

## 🧠 Resumen Técnico

1. **¿Qué estrategia de arquitectura implementó la IA?**
   - La IA implementó el patrón **Circuit Breaker** para manejar la resiliencia ante fallos.
   - Utilizó el **State Pattern (Patrón de Estado)** para encapsular la lógica de transición y comportamiento de cada estado del circuito (Closed, Open, Half-Open), evitando condicionales complejos.
   - Aplicó el **Result Pattern** (`Result<T, E>`) para el manejo funcional de errores, evitando el uso de excepciones para el flujo de control, tal como se solicitó en las reglas de arquitectura.

2. **¿Tuviste que corregir alguna "alucinación" o código inseguro?** ¿Cuál?
   - Sí, hubo una pequeña corrección necesaria. La IA incluyó inicialmente un import innecesario (`import { EventEmitter } from 'events';`) en el archivo `resilient-client.ts` que no se estaba utilizando y causaba un error de compilación o linting. Se le solicitó corregirlo y procedió a eliminar la línea problemática y configurar correctamente el entorno TypeScript.
