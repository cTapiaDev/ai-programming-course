## 📝 Reporte de Taller con IA

**Módulo:** 1
**Nombre del Alumno:** Ricardo Reyes Padilla

---

### 🤖 Prompt Engineering
*Por favor, pega aquí los prompts clave que utilizaste. Esto es lo más importante de la evaluación.*

1. **Prompt de Análisis / Estrategia:**
```markdown 
# Instrucciones taller 1

## Contexto
Eres un senior developer en typescript, debes refactorizar el archivo ***legacy-clients*** que es un cliente http heredado, tu mision es convertir dicho archivo a un **Cliente HTTP Resiliente** usando `Fetch` Nativo de Node.js (v18+), ademas no es solo arreglar dicho archivo, debes implementar el Patrón **Circuit Braker** para finalizar conexiones automaticamente cuando falle la pasarela de pagos externa que debe implementar los siguientes 3 estados.

- **Closed:** El Flujo normal
- **OPEN:** Si ocurre 3 fallos consecutivos, el circuito abre, Todas las peticiones posteriores deben falla (Fail Test) sin llamar a la API externa
- **HALF-OPEN:** Tras 5 segundos en estado `OPEN` el sistema debe permitir pasar *una* peticion de prueba, si funciona el circuito se cierra. Si falla vuelve a `OPEN`

Debes crear una clase `ResilientClient`, Ademas de listar todas las vulnerabilidades del archivo `legacy-client.ts`.

Por ultimo esto debe ser migrado a `typecript` con `strict: true`. Adicionalmente, para cada respuesta debes definir una interfaces, esta ultima debe ir es un carpeta llamada `interfaces` en la raíz del proyecto que es en `/taller`

## Prohibido Hacer (Critico)
- Logica de `if (failures) > 3` manualmente.
- Uso de librerias `opossum` o `axios-retry`.
- Sugerencias de ideas
- uso de comentarios con emojis
- ejecuccion de acciones sin mi aprobacion
- dejar importaciones sin usar
- Codigo final con erroes

## Permitido Hacer
- Modificar el codigo actual
- Aplicar timeouts
- usar AbortSignal para el timeout de fetch
- Comprobar si compila correctamente
```

2. **Prompt de Generación de Código:**
> Debes refactorizar el cliente http utilizando el set de instrucciones y conexto del archivo promt.md, debes seguir al pie de la letra las instrucciones asignadas, genera un archivo llamado, resilient-client.ts

3. **Prompt de Corrección / Refinamiento:**
> No realice un promt correctivo, use el refinamiento pero en mi caso el archivo `prompt.md` agrege 3 nuevas correciones, ***No dejar importaciones sin usar*** - ***Codigo sin Erroes*** - ***El Codigo debe compilar sin errores***

---

## 🧠 Resumen Técnico
*Responde brevemente:*

1. **¿Qué estrategia de arquitectura implementó la IA?** (ej. Circuit Breaker, Singleton, Factory...)
   - Utilizo la arquitectura sugerida `Circuit Breaker`

2. **¿Tuviste que corregir alguna "alucinación" o código inseguro?** ¿Cuál?
   - Ninguna correcion a mano, unicamente refinando el prompt de las instrucciones

---
*Al enviar este PR, certifico que he revisado y auditado el código generado por la IA.*
