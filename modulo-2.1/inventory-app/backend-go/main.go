package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gocarina/gocsv"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

// InventoryItem representa un item del inventario
type InventoryItem struct {
	ID          string  `csv:"id" json:"id"`
	SKU         string  `csv:"sku" json:"sku"`
	ProductName string  `csv:"product_name" json:"product_name"`
	Category    string  `csv:"category" json:"category"`
	Stock       int     `csv:"stock" json:"stock"`
	Price       float64 `csv:"price" json:"price"`
	LastUpdated string  `csv:"last_updated" json:"last_updated"`
}

// Variable global que contendrá todo el inventario
var inventory []InventoryItem
var inventoryMutex sync.RWMutex

// loadInventoryParallel carga el archivo CSV usando goroutines para procesamiento paralelo
func loadInventoryParallel(filename string) error {
	// Abrir el archivo
	file, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("error al abrir el archivo: %w", err)
	}
	defer file.Close()

	// Leer el archivo CSV
	csvReader := csv.NewReader(file)

	// Leer la cabecera primero
	header, err := csvReader.Read()
	if err != nil {
		return fmt.Errorf("error al leer la cabecera: %w", err)
	}

	// Canales para procesamiento paralelo
	type rowData struct {
		index int
		row   []string
		err   error
	}

	rowChannel := make(chan rowData, 100)
	resultChannel := make(chan InventoryItem, 100)
	errorChannel := make(chan error, 1)

	// WaitGroup para las goroutines de procesamiento
	var wg sync.WaitGroup

	// Número de workers para procesamiento paralelo
	numWorkers := 4

	// Iniciar workers que convierten filas en structs
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for row := range rowChannel {
				if row.err != nil {
					select {
					case errorChannel <- row.err:
					default:
					}
					return
				}

				// Usar gocsv para parsear la fila individual
				// Creamos un reader temporal con la cabecera y la fila actual
				csvData := [][]string{header, row.row}
				csvString := ""
				for _, record := range csvData {
					for j, field := range record {
						if j > 0 {
							csvString += ","
						}
						csvString += field
					}
					csvString += "\n"
				}

				// Parsear usando gocsv
				var items []InventoryItem
				err := gocsv.UnmarshalString(csvString, &items)
				if err != nil {
					select {
					case errorChannel <- fmt.Errorf("error al parsear fila %d: %w", row.index, err):
					default:
					}
					return
				}

				if len(items) > 0 {
					resultChannel <- items[0]
				}
			}
		}()
	}

	// Goroutine para recolectar resultados
	var results []InventoryItem
	var resultWg sync.WaitGroup
	resultWg.Add(1)
	go func() {
		defer resultWg.Done()
		for item := range resultChannel {
			results = append(results, item)
		}
	}()

	// Leer todas las filas y enviarlas al canal
	rowIndex := 0
	for {
		row, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		rowIndex++

		rowChannel <- rowData{
			index: rowIndex,
			row:   row,
			err:   err,
		}
	}

	// Cerrar el canal de filas y esperar a que los workers terminen
	close(rowChannel)
	wg.Wait()

	// Cerrar el canal de resultados y esperar a que se recolecten todos
	close(resultChannel)
	resultWg.Wait()

	// Verificar si hubo errores
	select {
	case err := <-errorChannel:
		return err
	default:
	}

	// Actualizar la variable global de forma segura
	inventoryMutex.Lock()
	inventory = results
	inventoryMutex.Unlock()

	log.Printf("Inventario cargado exitosamente: %d items\n", len(results))
	return nil
}

// Handler para GET /api/inventory
func getInventoryHandler(w http.ResponseWriter, r *http.Request) {
	// Bloquear para lectura
	inventoryMutex.RLock()
	defer inventoryMutex.RUnlock()

	// Establecer cabecera de respuesta
	w.Header().Set("Content-Type", "application/json")

	// Codificar el inventario como JSON
	err := json.NewEncoder(w).Encode(inventory)
	if err != nil {
		http.Error(w, "Error al codificar respuesta JSON", http.StatusInternalServerError)
		log.Printf("Error al codificar JSON: %v\n", err)
		return
	}
}

// Handler para verificar el estado del servidor
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	inventoryMutex.RLock()
	count := len(inventory)
	inventoryMutex.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"items":  count,
	})
}

func main() {
	// Cargar el inventario desde el archivo CSV
	log.Println("Cargando inventario desde inventory.csv...")
	err := loadInventoryParallel("inventory.csv")
	if err != nil {
		log.Fatalf("Error fatal al cargar el inventario: %v\n", err)
	}

	// Crear el router
	router := mux.NewRouter()

	// Definir las rutas
	router.HandleFunc("/api/inventory", getInventoryHandler).Methods("GET")
	router.HandleFunc("/health", healthCheckHandler).Methods("GET")

	// Configurar CORS usando rs/cors
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	// Aplicar el middleware de CORS
	handler := corsHandler.Handler(router)

	// Iniciar el servidor
	port := "8080"
	log.Printf("Servidor escuchando en el puerto %s...\n", port)
	log.Printf("Endpoint disponible: http://localhost:%s/api/inventory\n", port)
	log.Printf("Health check disponible: http://localhost:%s/health\n", port)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Error al iniciar el servidor: %v\n", err)
	}
}
