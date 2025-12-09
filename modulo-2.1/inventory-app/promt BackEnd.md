Primer promt


Necesito que Generes un programa en Go  en un solo archivo main.go que:

Al iniciar, lea un archivo llamado inventory.csv que estará en el mismo directorio.
usa encoding/csv para leer un archivo inventory.csv del mismo directorio al iniciar la aplicación.

Usa una librería externa que convierta automáticamente las filas del CSV en structs de Go
,sin que yo tenga que escribir lógica manual de parseo campo por campo.​

Define un struct llamado InventoryItem, con los tags de CSV para que las columnas del archivo se mapeen correctamente.

Todo el contenido del CSV debe cargarse en memoria dentro de un slice, y ese slice debe quedar disponible en una variable global o en alguna estructura que luego podamos servir vía HTTP.

Cierre correctamente el archivo

Después de eso, debe exponer en un servidor HTTP en el puerto 8080 con lo siguiente:

Endpoint GET /api/inventory que devuelva el slice completo en JSON.

Usa net/http y, si es necesario, un router sencillo como github.com/gorilla/mux.

Habilita los CORS para permitir peticiones desde http://localhost:3000, usando un middleware,  No quiero escribir la lógica de CORS a mano - así que usa un paquete como github.com/rs/cors.



Nota: simula que el archivo es masivo. Para eso, quiero que la lectura del CSV se haga en paralelo usando goroutines.
Por ejemplo, podrías usar un canal y varias goroutines para convertir las filas en structs. Eso sí, mantén el API simple: el endpoint /api/inventory solo debe devolver el slice ya cargado.



maneja los errores de forma razonable y devolver códigos HTTP apropiados.

Incluye las instrucciones de go get necesarias para las dependencias externas.





