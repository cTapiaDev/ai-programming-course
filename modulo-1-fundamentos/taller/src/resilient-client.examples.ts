async function ejemploBasico() {
    console.log('\n=== EJEMPLO 1: Uso Básico ===\n');

    const result = await resilientClient.getUserData('user123');

    if (result.success) {
        console.log('✅ Usuario obtenido:', result.data);
        console.log('Estado del circuito:', result.circuitState);
    } else {
        console.error('❌ Error:', result.error?.message);
        console.log('Estado del circuito:', result.circuitState);
    }
}

// ============================================================================
// EJEMPLO 2: Demostración de los 3 estados del Circuit Breaker
// ============================================================================

async function ejemploEstadosCircuitBreaker() {
    console.log('\n=== EJEMPLO 2: Estados del Circuit Breaker ===\n');

    const client = new ResilientHttpClient({
        failureThreshold: 3,
        resetTimeout: 5000,
        requestTimeout: 2000
    });

    console.log('📊 Estado inicial:', client.getCircuitState());

    // Simular 3 fallos consecutivos (userId inválido para forzar error)
    console.log('\n--- Provocando 3 fallos consecutivos ---');

    for (let i = 1; i <= 3; i++) {
        const result = await client.getUserData('invalid@user'); // Caracteres inválidos
        console.log(`Intento ${i}:`, {
            success: result.success,
            circuitState: result.circuitState,
            error: result.error?.message.substring(0, 50) + '...'
        });
    }

    console.log('\n📊 Estado después de 3 fallos:', client.getCircuitState());

    // Intentar una petición con el circuito OPEN (debe fallar inmediatamente)
    console.log('\n--- Intento con circuito OPEN (Fail Fast) ---');
    const failFastResult = await client.getUserData('user123');
    console.log('Resultado:', {
        success: failFastResult.success,
        circuitState: failFastResult.circuitState,
        error: failFastResult.error?.message
    });

    // Esperar 5 segundos para que pase a HALF_OPEN
    console.log('\n--- Esperando 5 segundos para transición a HALF_OPEN ---');
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Intentar petición de prueba (estado HALF_OPEN)
    console.log('\n--- Petición de prueba en estado HALF_OPEN ---');
    const halfOpenResult = await client.getUserData('user123');
    console.log('Resultado:', {
        success: halfOpenResult.success,
        circuitState: halfOpenResult.circuitState
    });

    console.log('\n📊 Estado final:', client.getCircuitState());
    console.log('📈 Métricas finales:', client.getMetrics());
}

// ============================================================================
// EJEMPLO 3: Validación de entrada (prevención de inyección)
// ============================================================================

async function ejemploValidacionEntrada() {
    console.log('\n=== EJEMPLO 3: Validación de Entrada ===\n');

    const client = new ResilientHttpClient();

    // Casos de prueba con diferentes entradas
    const testCases = [
        { userId: 'user123', descripcion: 'ID válido' },
        { userId: 'user-456', descripcion: 'ID válido con guión' },
        { userId: 'user_789', descripcion: 'ID válido con guión bajo' },
        { userId: '../admin', descripcion: 'Intento de path traversal' },
        { userId: 'user@123', descripcion: 'Caracteres especiales inválidos' },
        { userId: '', descripcion: 'ID vacío' },
        { userId: 'a'.repeat(150), descripcion: 'ID demasiado largo' }
    ];

    for (const testCase of testCases) {
        const result = await client.getUserData(testCase.userId);
        console.log(`\n${testCase.descripcion}:`);
        console.log(`  Input: "${testCase.userId}"`);
        console.log(`  Válido: ${result.success ? '✅' : '❌'}`);
        if (!result.success) {
            console.log(`  Error: ${result.error?.message}`);
        }
    }
}

// ============================================================================
// EJEMPLO 4: Configuración personalizada
// ============================================================================

async function ejemploConfiguracionPersonalizada() {
    console.log('\n=== EJEMPLO 4: Configuración Personalizada ===\n');

    // Cliente más tolerante (5 fallos, 10 segundos de reset)
    const clientTolerant = new ResilientHttpClient({
        failureThreshold: 5,
        resetTimeout: 10000,
        requestTimeout: 15000
    });

    console.log('Cliente tolerante configurado:');
    console.log('  - Umbral de fallos: 5');
    console.log('  - Timeout de reset: 10 segundos');
    console.log('  - Timeout de petición: 15 segundos');

    // Cliente más estricto (2 fallos, 3 segundos de reset)
    const clientStrict = new ResilientHttpClient({
        failureThreshold: 2,
        resetTimeout: 3000,
        requestTimeout: 5000
    });

    console.log('\nCliente estricto configurado:');
    console.log('  - Umbral de fallos: 2');
    console.log('  - Timeout de reset: 3 segundos');
    console.log('  - Timeout de petición: 5 segundos');
}

// ============================================================================
// EJEMPLO 5: Monitoreo de métricas
// ============================================================================

async function ejemploMonitoreoMetricas() {
    console.log('\n=== EJEMPLO 5: Monitoreo de Métricas ===\n');

    const client = new ResilientHttpClient();

    // Realizar varias peticiones
    console.log('Realizando 10 peticiones...\n');

    for (let i = 1; i <= 10; i++) {
        // Alternar entre IDs válidos e inválidos
        const userId = i % 2 === 0 ? 'user123' : 'invalid@id';
        await client.getUserData(userId);
    }

    // Mostrar métricas
    const metrics = client.getMetrics();
    console.log('📈 Métricas del Circuit Breaker:');
    console.log(`  Total de peticiones: ${metrics.totalRequests}`);
    console.log(`  Peticiones exitosas: ${metrics.successfulRequests}`);
    console.log(`  Peticiones fallidas: ${metrics.failedRequests}`);
    console.log(`  Veces que se abrió el circuito: ${metrics.circuitOpenCount}`);
    console.log(`  Último éxito: ${metrics.lastSuccessTime || 'N/A'}`);
    console.log(`  Último fallo: ${metrics.lastFailureTime || 'N/A'}`);

    const successRate = metrics.totalRequests > 0
        ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
        : 0;
    console.log(`  Tasa de éxito: ${successRate}%`);
}

// ============================================================================
// EJEMPLO 6: Manejo de errores en producción
// ============================================================================

async function ejemploManejoErroresProduccion() {
    console.log('\n=== EJEMPLO 6: Manejo de Errores en Producción ===\n');

    const client = new ResilientHttpClient();

    try {
        const result = await client.getUserData('user123');

        if (result.success && result.data) {
            // Caso exitoso
            console.log('✅ Usuario procesado correctamente');
            console.log(`   ID: ${result.data.id}`);
            console.log(`   Nombre: ${result.data.name}`);
        } else {
            // Caso de error
            console.error('❌ Error al obtener usuario');

            // Verificar si es por Circuit Breaker abierto
            if (result.circuitState === CircuitState.OPEN) {
                console.error('   Razón: Circuit Breaker está OPEN (servicio degradado)');
                console.error('   Acción: Usar datos en caché o mostrar mensaje al usuario');
            } else {
                console.error(`   Razón: ${result.error?.message}`);
                console.error('   Acción: Reintentar o notificar al usuario');
            }

            // Logging para monitoreo
            console.log('\n📊 Estado del sistema:');
            console.log(`   Circuit State: ${result.circuitState}`);
            console.log(`   Métricas:`, client.getMetrics());
        }
    } catch (error) {
        // Este catch no debería ejecutarse ya que todos los errores
        // están manejados dentro del Circuit Breaker
        console.error('❌ Error inesperado:', error);
    }
}

// ============================================================================
// EJECUTAR EJEMPLOS
// ============================================================================

async function ejecutarTodosLosEjemplos() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   EJEMPLOS DE USO: RESILIENT HTTP CLIENT                  ║');
    console.log('║   Patrón Circuit Breaker - Implementación Profesional     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Descomentar los ejemplos que desees ejecutar:

    // await ejemploBasico();
    // await ejemploEstadosCircuitBreaker();
    // await ejemploValidacionEntrada();
    // await ejemploConfiguracionPersonalizada();
    // await ejemploMonitoreoMetricas();
    // await ejemploManejoErroresProduccion();

    console.log('\n✨ Ejemplos completados\n');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    ejecutarTodosLosEjemplos().catch(console.error);
}

export {
    ejemploBasico,
    ejemploEstadosCircuitBreaker,
    ejemploValidacionEntrada,
    ejemploConfiguracionPersonalizada,
    ejemploMonitoreoMetricas,
    ejemploManejoErroresProduccion
};
