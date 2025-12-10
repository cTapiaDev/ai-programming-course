package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gocarina/gocsv"
	"github.com/rs/cors"
)

// InventoryItem represents a single inventory item from the CSV
type InventoryItem struct {
	ID          string  `csv:"id" json:"id"`
	SKU         string  `csv:"sku" json:"sku"`
	ProductName string  `csv:"product_name" json:"product_name"`
	Category    string  `csv:"category" json:"category"`
	Stock       int     `csv:"stock" json:"stock"`
	Price       float64 `csv:"price" json:"price"`
	LastUpdated string  `csv:"last_updated" json:"last_updated"`
}

// Global inventory storage
var inventory []InventoryItem
var inventoryMutex sync.RWMutex

// loadInventory reads the CSV file and processes it with concurrency
func loadInventory(filename string) error {
	// Open CSV file
	file, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("failed to open CSV file: %w", err)
	}
	defer file.Close()

	// Read all items using gocsv
	var items []InventoryItem
	if err := gocsv.UnmarshalFile(file, &items); err != nil {
		return fmt.Errorf("failed to parse CSV file: %w", err)
	}

	// Process items with goroutines and channels
	itemsChan := make(chan InventoryItem, len(items))
	resultsChan := make(chan InventoryItem, len(items))
	var wg sync.WaitGroup

	// Number of workers for concurrent processing
	numWorkers := 4
	if len(items) < numWorkers {
		numWorkers = len(items)
	}

	// Start worker goroutines
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range itemsChan {
				// Simulate processing (e.g., validation, transformation)
				// In a real scenario, you might perform expensive operations here
				resultsChan <- item
			}
		}()
	}

	// Send items to workers
	go func() {
		for _, item := range items {
			itemsChan <- item
		}
		close(itemsChan)
	}()

	// Wait for all workers to finish and close results channel
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect processed items
	var processedItems []InventoryItem
	for item := range resultsChan {
		processedItems = append(processedItems, item)
	}

	// Store in global inventory (thread-safe)
	inventoryMutex.Lock()
	inventory = processedItems
	inventoryMutex.Unlock()

	log.Printf("Successfully loaded %d items from inventory", len(processedItems))
	return nil
}

// inventoryHandler handles GET /api/inventory
func inventoryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read inventory safely
	inventoryMutex.RLock()
	items := inventory
	inventoryMutex.RUnlock()

	// Marshal to JSON
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(items); err != nil {
		log.Printf("Error encoding JSON: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func main() {
	// Load inventory from CSV
	if err := loadInventory("inventory.csv"); err != nil {
		log.Fatalf("Failed to load inventory: %v", err)
	}

	// Setup HTTP server
	mux := http.NewServeMux()
	mux.HandleFunc("/api/inventory", inventoryHandler)

	// Configure CORS to allow only localhost:3000
	corsHandler := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	})

	// Wrap handler with CORS middleware
	handler := corsHandler.Handler(mux)

	// Start server
	port := ":8080"
	log.Printf("Server starting on port %s", port)
	log.Printf("CORS enabled for: http://localhost:3000")
	
	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

/*
Installation instructions:

Initialize Go module (if not already done):
  go mod init fullstack-migration

Install required dependencies:
  go get github.com/gocarina/gocsv
  go get github.com/rs/cors

Run the server:
  go run main.go
*/
