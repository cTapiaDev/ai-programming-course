

A partir del siguiente JSON devuelto por mi API de inventario, genera una interfaz TypeScript estricta llamada InventoryItem:

No adivines tipos: 
- infiérelos de los valores que esten en el JSON
- Constraint: price y stock deben ser numéricos (number).
- last_updated debe ser string o Date.
- Los demás campos deben tener tipos estrictos (string, number, boolean, etc.), sin any.
- No generes código de lógica, solo la interfaz.

Ejemplo de JSON:
[
{
"id": "103",
"sku": "MN-4K-27",
"product_name": "Ultra Monitor 4K",
"category": "Screens",
"stock": 5,
"price": 349,
"last_updated": "2023-11-20"
},
{
"id": "102",
"sku": "KB-MECHANICAL",
"product_name": "Mech Keyboard RGB",
"category": "Peripherals",
"stock": 12,
"price": 129.5,
"last_updated": "2023-09-15"
}
]



Construccion de componente

Estoy usando React con TypeScript.
Genera un componente InventoryDashboard.tsx que viva en src/components/InventoryDashboard.tsx.
Requisitos:

Importa la interfaz InventoryItem desde ../types/inventory.
Usa useState para mantener:
items: InventoryItem[] con todos los ítems traídos del backend.
filteredItems: InventoryItem[] o bien filtra en render.
selectedCategory: string para el filtro.

Usa useEffect para hacer el fetch a http://localhost:8080/api/inventory solamente al montar el componente (dependencias correctas: arreglo vacío []).

Regla Zero Logic Coding: no puedo escribir a mano la lógica de fetch; genera tú el código de fetch dentro del useEffect, usando async/await, manejo básico de errores y tipado de la respuesta como InventoryItem[].

Genera la lista de categorías automáticamente a partir de los datos (items), sin que yo escriba a mano los valores, usando por ejemplo Array.from(new Set(...)).

El filtro por categoría debe funcionar mediante un <select> (dropdown):
- Opción “Todas” que muestra todo.
- Otras opciones generadas desde las categorías distintas encontradas en los datos.

Muestra una tabla HTML estilizada con CSS simple o Tailwind (elige una opción y genera también el CSS necesario si es CSS plain).
    Columnas al menos: name, category, price, stock, last_updated.
    Si stock === 0, muestra la fila o la celda de stock con un estilo visual de alerta (por ejemplo, texto en rojo y negrita o fondo rojo claro).
    
El useEffect debe tener correctamente las dependencias para evitar bucles infinitos (solo debe ejecutar el fetch al montar).

No uses ninguna librería de estado global.

Exporta el componente por defecto.
