# 🛠️ Taller Módulo 1: Operation Resilience

**Nivel:** Senior / Architect
**Tiempo Estimado:** 40 minutos
**Stack:** Node.js + TypeScript + IA assistant (Copilot/Claude/GPT)

**NOMBRE ALUMNO: ISRAEL VERGARA**
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
