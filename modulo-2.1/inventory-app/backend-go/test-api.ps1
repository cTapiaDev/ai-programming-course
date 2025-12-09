# Inventory API - Tests

Write-Host "Testing Inventory API..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get
    Write-Host "OK - Health check successful" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor White
    Write-Host "   Items: $($health.items)" -ForegroundColor White
} catch {
    Write-Host "ERROR - Health check failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: Get Inventory
Write-Host "Test 2: Get Inventory" -ForegroundColor Yellow
try {
    $inventory = Invoke-RestMethod -Uri "http://localhost:8080/api/inventory" -Method Get
    Write-Host "OK - Inventory retrieved successfully" -ForegroundColor Green
    Write-Host "   Total items: $($inventory.Count)" -ForegroundColor White
    Write-Host ""
    Write-Host "   First 3 products:" -ForegroundColor Cyan
    $inventory | Select-Object -First 3 | ForEach-Object {
        Write-Host "   - [$($_.id)] $($_.product_name) - `$$($_.price)" -ForegroundColor White
    }
} catch {
    Write-Host "ERROR - Failed to get inventory: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: CORS Headers
Write-Host "Test 3: Verify CORS Headers" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/inventory" -Method Options -Headers @{
        "Origin" = "http://localhost:3000"
        "Access-Control-Request-Method" = "GET"
    }
    
    if ($response.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "OK - CORS configured correctly" -ForegroundColor Green
        Write-Host "   Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor White
    } else {
        Write-Host "WARNING - No CORS headers detected" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR - Failed to verify CORS: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Tests completed!" -ForegroundColor Green
