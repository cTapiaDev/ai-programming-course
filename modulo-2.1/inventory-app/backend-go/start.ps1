# Script para iniciar el servidor de inventario

Write-Host "🚀 Iniciando servidor de inventario..." -ForegroundColor Cyan
Write-Host ""

# Verificar que existe el archivo inventory.csv
if (-Not (Test-Path "inventory.csv")) {
    Write-Host "❌ Error: No se encuentra el archivo inventory.csv" -ForegroundColor Red
    exit 1
}

# Verificar que existe main.go
if (-Not (Test-Path "main.go")) {
    Write-Host "❌ Error: No se encuentra el archivo main.go" -ForegroundColor Red
    exit 1
}

# Verificar que go.mod existe, si no, inicializar
if (-Not (Test-Path "go.mod")) {
    Write-Host "📦 Inicializando módulo Go..." -ForegroundColor Yellow
    go mod init inventory-api
}

# Instalar dependencias si no están
Write-Host "📦 Verificando dependencias..." -ForegroundColor Yellow
go mod tidy

# Ejecutar el servidor
Write-Host ""
Write-Host "✅ Iniciando servidor en http://localhost:8080" -ForegroundColor Green
Write-Host ""
Write-Host "Endpoints disponibles:" -ForegroundColor Cyan
Write-Host "  - GET http://localhost:8080/api/inventory" -ForegroundColor White
Write-Host "  - GET http://localhost:8080/health" -ForegroundColor White
Write-Host ""
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

go run main.go
