# ✅ PROYECTO COMPLETADO - Inventory API en Go

## 📦 ¿Qué se ha creado?

Un servidor HTTP en Go que lee un archivo CSV de inventario usando **procesamiento paralelo con goroutines** y expone los datos mediante una API REST con soporte CORS.

---

## 📁 Estructura del Proyecto

```
backend-go/
├── main.go              # Aplicación principal
├── inventory.csv        # Datos del inventario (6 productos)
├── go.mod              # Dependencias del módulo
├── go.sum              # Checksums de dependencias
├── start.ps1           # Script para iniciar el servidor
├── test-api.ps1        # Script de pruebas
└── README.md           # Documentación completa
```

---

## 🎯 Características Implementadas

### ✅ 1. Lectura de CSV con Librería Externa
- **Librería**: `github.com/gocarina/gocsv`
- **Beneficio**: Mapeo automático de columnas CSV → structs de Go
- **Sin código manual** de parseo campo por campo

### ✅ 2. Procesamiento Paralelo con Goroutines
- **4 workers** procesando filas en paralelo
- **Channels** para comunicación entre goroutines
- **sync.WaitGroup** para sincronización
- **Simula** el procesamiento de archivos masivos

### ✅ 3. Servidor HTTP en Puerto 8080
- **Router**: `github.com/gorilla/mux`
- **Endpoints**:
  - `GET /api/inventory` - Devuelve todos los productos en JSON
  - `GET /health` - Health check del servidor

### ✅ 4. CORS Habilitado
- **Librería**: `github.com/rs/cors`
- **Origen permitido**: `http://localhost:3000`
- **Métodos**: GET, POST, PUT, DELETE, OPTIONS
- **Sin código manual** de CORS

### ✅ 5. Manejo de Errores
- Manejo apropiado de errores de lectura de archivos
- Códigos HTTP correctos (200, 500)
- Logs informativos
- Thread-safe con `sync.RWMutex`

---

## 🚀 Cómo Usar

### Opción 1: Script Automático (Recomendado)
```powershell
.\start.ps1
```

### Opción 2: Comandos Manuales
```bash
# Instalar dependencias (solo la primera vez)
go mod tidy

# Ejecutar servidor
go run main.go
```

### Opción 3: Compilar y Ejecutar
```bash
# Compilar
go build -o inventory-server.exe main.go

# Ejecutar
.\inventory-server.exe
```

---

## 🧪 Probar la API

### Usando el Script de Pruebas
```powershell
.\test-api.ps1
```

**Resultado esperado:**
```
Testing Inventory API...

Test 1: Health Check
OK - Health check successful
   Status: ok
   Items: 6

Test 2: Get Inventory
OK - Inventory retrieved successfully
   Total items: 6

   First 3 products:
   - [101] Gaming Mouse Pro - $59.99
   - [102] Mech Keyboard RGB - $129.5
   - [103] Ultra Monitor 4K - $349

Test 3: Verify CORS Headers
OK - CORS configured correctly
   Allow-Origin: http://localhost:3000

Tests completed!
```

### Usando cURL
```bash
# Health check
curl http://localhost:8080/health

# Obtener inventario completo
curl http://localhost:8080/api/inventory
```

### Desde Frontend (JavaScript)
```javascript
// Desde http://localhost:3000
fetch('http://localhost:8080/api/inventory')
  .then(response => response.json())
  .then(data => {
    console.log('Productos:', data);
    console.log('Total:', data.length);
  })
  .catch(error => console.error('Error:', error));
```

---

## 📊 Formato del CSV

El archivo `inventory.csv` tiene las siguientes columnas:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | string | ID único del producto |
| `sku` | string | Código SKU |
| `product_name` | string | Nombre del producto |
| `category` | string | Categoría |
| `stock` | int | Cantidad en inventario |
| `price` | float64 | Precio |
| `last_updated` | string | Fecha última actualización |

**Ejemplo de datos:**
```csv
id,sku,product_name,category,stock,price,last_updated
101,GM-001,Gaming Mouse Pro,Peripherals,45,59.99,2023-10-01
102,KB-MECHANICAL,Mech Keyboard RGB,Peripherals,12,129.50,2023-09-15
```

---

## 🔧 Dependencias Instaladas

```bash
go get github.com/gocarina/gocsv    # v0.0.0-20240520201108
go get github.com/gorilla/mux       # v1.8.1
go get github.com/rs/cors           # v1.11.1
```

---

## 🏗️ Arquitectura del Procesamiento Paralelo

```
CSV File
   │
   ├─→ CSV Reader (lee todas las filas)
   │
   ├─→ Row Channel (buffer de 100)
   │     │
   │     ├─→ Worker 1 (goroutine)
   │     ├─→ Worker 2 (goroutine)
   │     ├─→ Worker 3 (goroutine)
   │     └─→ Worker 4 (goroutine)
   │           │
   └─────────→ Result Channel
                 │
                 └─→ Global Inventory Slice (thread-safe)
```

---

## 🔐 Thread Safety

- **sync.RWMutex** protege el slice global de inventario
- **Lectura concurrente** permitida (múltiples requests GET simultáneos)
- **Escritura exclusiva** durante la carga inicial
- Sin race conditions

---

## 📝 Logs del Servidor

Cuando inicias el servidor, verás:

```
2025/12/02 22:11:51 Cargando inventario desde inventory.csv...
2025/12/02 22:11:51 Inventario cargado exitosamente: 6 items
2025/12/02 22:11:51 Servidor escuchando en el puerto 8080...
2025/12/02 22:11:51 Endpoint disponible: http://localhost:8080/api/inventory
2025/12/02 22:11:51 Health check disponible: http://localhost:8080/health
```

---

## ✨ Próximos Pasos (Opcional)

Si quieres extender el proyecto:

1. **CRUD completo**: Agregar POST, PUT, DELETE endpoints
2. **Persistencia**: Guardar cambios de vuelta al CSV
3. **Base de datos**: Migrar de CSV a PostgreSQL/MySQL
4. **Paginación**: Implementar límite y offset en `/api/inventory`
5. **Filtros**: Agregar búsqueda por categoría, precio, etc.
6. **Autenticación**: JWT tokens para proteger endpoints
7. **Docker**: Containerizar la aplicación
8. **Tests unitarios**: Agregar tests con `testing` package

---

## 🎉 Estado Actual

✅ **El servidor está corriendo en http://localhost:8080**

✅ **Todos los tests pasaron exitosamente**

✅ **CORS funcionando correctamente para localhost:3000**

✅ **6 productos cargados desde inventory.csv**

---

## 📞 Comandos Útiles

```bash
# Ver logs en tiempo real (si ejecutas como background)
# El servidor imprime automáticamente en la consola

# Detener el servidor
# Presiona Ctrl+C en la terminal donde corre

# Verificar que el puerto 8080 está en uso
netstat -ano | findstr :8080

# Reiniciar el servidor
# Ctrl+C para detener, luego .\start.ps1 para iniciar
```

---

**🎯 Proyecto listo para usar!** 🚀
