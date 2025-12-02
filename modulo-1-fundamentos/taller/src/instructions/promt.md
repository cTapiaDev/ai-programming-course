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

