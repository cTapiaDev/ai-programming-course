# 🛠️ Taller Módulo 1: Operation Resilience

**Nivel:** Senior / Architect
**Tiempo Estimado:** 40 minutos
**Stack:** Node.js + TypeScript + IA assistant (Copilot/Claude/GPT)

---

## 🚨 El Escenario

**SITUACIÓN CRÍTICA EN PRODUCCIÓN.**

El microservicio de pagos está sufriendo fallos en cascada. El equipo de SRE ha identificado al culpable: un cliente HTTP heredado (`legacy-client.ts`) que se conecta a una pasarela de pagos inestable.

El código actual es un desastre:
1. Usa el módulo `https` antiguo con callbacks anidados.
2. **No tiene Timeouts:** Cuando la pasarela externa se cuelga, nuestro servidor se queda esperando infinitamente hasta agotar los recursos.
3. **No maneja errores:** Si la API devuelve basura, el servicio explota.

## 🎯 Tu Misión

Debes utilizar tu **Asistente de IA** para refactorizar este código y convertirlo en un **Cliente HTTP Resiliente**.

No se trata solo de "arreglarlo"; debes implementar el **Patrón Circuit Breaker** para cortar la conexión automáticamente cuando la pasarela externa falle repetidamente.

---

## ⚙️ Instrucciones de Setup

1. Asegúrate de estar en la carpeta del alumno:
   ```bash
   cd modulo-1-fundamentos/taller
   ```
2. Instala las dependencias base:
   ``` bash
   npm install
   ```
3. Abre el archivo **`src/legacy-client.ts`**. Analízalo brevemente.

---

# 📋 Requisitos Técnicos (Constraints)

Tu refactorización debe cumplir estrictamente con estas reglas. **Usa Ingeniería de Contexto y Prompts para que la IA cumpla estas normas por ti.**

### 1. Stack Moderno
* **Lenguaje:** Migrar a **TypeScript** con `strict: true`. Define interfaces para las respuestas.
* **API:** Eliminar `https:` y usar **`fetch` nativo** de Node.js (v18+).

### 2. Lógica del Circuit Breaker (Core Challenge)
La IA debe implementar una máquina de estados manual (sin librerías externas):
* **Estado CLOSED:** El flujo normal.
* **Estado OPEN:** Si ocurren **3 fallos consecutivos**, el circuito se abre. Todas las peticiones posteriores deben fallar inmediatamente (Fail Fast) sin llamar a la API externa.
* **Estado HALF-OPEN:** Tras **5 segundos** en estado OPEN, el sistema debe permitir pasar *una* petición de prueba. Si funciona, el circuito se cierra (Reset). Si falla, vuelve a OPEN.

### 3. Restricciones de IA
* ⛔ **PROHIBIDO:** Escribir la lógica del `if (failures > 3)` manualmente.
* ⛔ **PROHIBIDO:** Usar librerías como `opossum` o `axios-retry`. Queremos ver cómo tu IA genera la lógica.
* ✅ **PERMITIDO:** Escribir pseudocódigo en el prompt, usar Chain of Thought, o pegar ejemplos de interfaces.

---

## 🚀 Pasos para la Solución

1. **Análisis con IA:** Pide a tu asistente que liste las vulnerabilidades del archivo `legacy-client.ts`.
2. **Estrategia:** Diseña un prompt robusto. Define los estados del Circuit Breaker y las reglas de tiempo.
3. **Generación:** Pide a la IA que genere la clase `ResilientClient`.
4. **Auditoría:** Revisa el código.
    * ¿Usó `AbortSignal` para el timeout del fetch?
    * ¿La lógica de reintento (Half-Open) tiene sentido?
    * ¿Está tragando errores o los propaga correctamente?
5. **Iteración:** Si la IA falló, refina tu prompt (no corrijas el código a mano salvo detalles menores).

---

## 📤 Entrega

1. El archivo final debe llamarse `src/resilient-client.ts`.
2. Asegúrate de que el código compile: (Opcional)
    ```bash
    npx tsc --noEmit
    ```
3. Haz commit de tus cambios en tu rama.
4. Sube los cambios y **abre un Pull Request** contra el repositorio original.
5. **IMPORTANTE:** En la descripción del Pull Request, completa la plantilla con los **Prompts** que utilizaste. ¡Evaluamos tu capacidad de dialogar con la IA, no solo el código!

---

> *"Un Senior Developer no escribe código; describe arquitecturas para que la máquina escriba el código."*

Prompt Utilizado 

Actúa como un Senior Software Architect especializado en Node.js, TypeScript (strict: true), sistemas resilientes y diseño de máquinas de estados.

Voy a migrar y refactorizar el archivo legacy-client.ts, que contiene un cliente HTTP heredado con múltiples vulnerabilidades.
Quiero que me ayudes a generar un Cliente HTTP Resiliente con patrón Circuit Breaker implementado manualmente.

Quiero que sigas EXACTAMENTE estas instrucciones:

1.###OBJETIVO PRINCIPAL

- Crear un nuevo archivo: src/resilient-client.ts
- Que contenga una clase: ResilientClient
- Esta clase debe: Estar escrita en TypeScript con strict:true.
- Reemplazar el uso de https por fetch nativo (Node 18+).
- Usar AbortController para timeouts.
- Tener interfaces de tipado estrictas.
- Manejar correctamente errores de red, JSON inválido y códigos HTTP inesperados.
- Implementar un Circuit Breaker real, basado en una máquina de estados.

2.###LÓGICA EXACTA DEL CIRCUIT BREAKER
Debes implementar un Circuit Breaker manual, sin librerías externas.

##Estados requeridos:

##CLOSED
- Flujo normal.
- Cada error aumenta un contador interno.
- Cuando ocurre el tercer fallo consecutivo, el breaker pasa a OPEN.

##OPEN
- Fail-Fast (NO llamar a la API externa).
- Mantenerse 5 segundos.
- Tras 5 segundos, permitir transición automática a HALF-OPEN.

##HALF-OPEN
- Permitir una petición de prueba.
- Si la respuesta es exitosa → reset y volver a CLOSED.
- Si falla → volver inmediatamente a OPEN.

3.###RESTRICCIONES DURAS (DE CUMPLIMIENTO OBLIGATORIO)

##Prohibido:
- Escribir la comparación manual if (failures > 3) o equivalentes.
- Usar librerías de resiliencia (opossum, axios-retry, etc.).
- Usar clientes HTTP externos (axios, got, superagent, etc.).
- Usar any o tipos implícitos.
- Silenciar errores o devolver null.

##Permitido:
- Usar abstracciones creativas para gestionar umbrales (tablas, maps, reducers, funciones, etc.).
- Generar pseudocódigo antes de generar código.
- Reescribir toda la arquitectura, siempre en TypeScript.

4.###ARCHIVOS QUE QUIERO GENERAR

- legacy-vulnerabilities.txt
→ Lista detallada de todas las vulnerabilidades encontradas en legacy-client.ts.

- src/resilient-client.ts
→ Implementación final del cliente resiliente.

5.###REGLA DE INTERACCIÓN OBLIGATORIA

#Cada vez que vayas a:
- Crear un archivo nuevo
- Modificar un archivo
- Eliminar un archivo

##Debes PEDIRME confirmación primero, mostrando el diff o el contenido propuesto.

####TAREA INICIAL

Primero:
- Analiza el archivo legacy-client.ts.
- Dame un listado claro de sus vulnerabilidades.
- Espera mi confirmación antes de crear cualquier archivo.