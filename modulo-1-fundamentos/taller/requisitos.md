El código actual es un desastre:

Usa el módulo https antiguo con callbacks anidados.
No tiene Timeouts: Cuando la pasarela externa se cuelga, nuestro servidor se queda esperando infinitamente hasta agotar los recursos.
No maneja errores: Si la API devuelve basura, el servicio explota.


Requisitos migracion

1. Stack Moderno
Lenguaje: Migrar a TypeScript con strict: true. Define interfaces para las respuestas.
API: Eliminar https: y usar fetch nativo de Node.js (v18+).
2. Lógica del Circuit Breaker (Core Challenge)
implementar una máquina de estados manual (sin librerías externas):

Estado CLOSED: El flujo normal.
Estado OPEN: Si ocurren 3 fallos consecutivos, el circuito se abre. Todas las peticiones posteriores deben fallar inmediatamente (Fail Fast) sin llamar a la API externa.
Estado HALF-OPEN: Tras 5 segundos en estado OPEN, el sistema debe permitir pasar una petición de prueba. Si funciona, el circuito se cierra (Reset). Si falla, vuelve a OPEN.

3. Restricciones
⛔ PROHIBIDO: Escribir la lógica del if (failures > 3).
⛔ PROHIBIDO: Usar librerías como opossum o axios-retry. en realidad no se puede usar ninguna libreria, se debe generar el codigo sin librerias

4 listar las vulnerabilidades del archivo legacy-client.ts en un archivo .md

5 debes generar un archivo ResilientClient (donde se maneje las peticiones)

6 llevar archivo .env con url de la api y reintentos

7 generar archivo resilientClient donde se manejen las peticiones

8 Auditoria
¿Usó AbortSignal para el timeout del fetch?
¿La lógica de reintento (Half-Open) tiene sentido?
¿Está tragando errores o los propaga correctamente?