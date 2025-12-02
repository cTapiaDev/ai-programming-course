/**
 * EJEMPLOS DE USO - ResilientClient
 * Demostra cómo usar el cliente con Circuit Breaker
 */

import { ResilientClient, CircuitState } from './resilient-client'

// ============================================================================
// EJEMPLO 1: Uso básico con GET
// ============================================================================
async function example1_basicGet() {
  console.log('📌 EJEMPLO 1: GET básico')

  const client = new ResilientClient({
    baseUrl: 'https://api.github.com'
  })

  const result = await client.get('/users/torvalds')

  if (result.ok) {
    console.log(`✅ Usuario encontrado: ${result.data}`)
    console.log(`Status: ${result.status}`)
  } else {
    console.log(`❌ Error: ${result.error}`)
    if (result.status) {
      console.log(`Status HTTP: ${result.status}`)
    }
  }
}

// ============================================================================
// EJEMPLO 2: Validación con schema
// ============================================================================
async function example2_schemaValidation() {
  console.log('\n📌 EJEMPLO 2: Validación con schema')

  const userSchema = {
    parse: (data: unknown) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'id' in data &&
        'name' in data
      ) {
        return data as { id: number; name: string }
      }
      throw new Error('Invalid user schema')
    }
  }

  const client = new ResilientClient({
    baseUrl: 'https://jsonplaceholder.typicode.com'
  })

  const result = await client.get('/users/1', userSchema)

  if (result.ok) {
    console.log(`✅ Usuario validado:`)
    console.log(`  - ID: ${result.data.id}`)
    console.log(`  - Nombre: ${result.data.name}`)
  } else {
    console.log(`❌ ${result.error}`)
  }
}

// ============================================================================
// EJEMPLO 3: POST con datos
// ============================================================================
async function example3_postWithData() {
  console.log('\n📌 EJEMPLO 3: POST con datos')

  const client = new ResilientClient({
    baseUrl: 'https://jsonplaceholder.typicode.com'
  })

  const result = await client.post('/posts', {
    title: 'Mi primer post',
    body: 'Este es un ejemplo de POST',
    userId: 1
  })

  if (result.ok) {
    console.log(`✅ Post creado:`)
    console.log(`  ${JSON.stringify(result.data, null, 2)}`)
  } else {
    console.log(`❌ ${result.error}`)
  }
}

// ============================================================================
// EJEMPLO 4: Monitorear estado del Circuit Breaker
// ============================================================================
async function example4_monitorCircuitState() {
  console.log('\n📌 EJEMPLO 4: Monitorear estado del circuito')

  const client = new ResilientClient({
    baseUrl: 'https://api.example-down.com',
    failureThreshold: 2,
    halfOpenAfterMs: 2000
  })

  console.log(`Estado inicial: ${client.getState()}`)

  // Simular fallos
  for (let i = 0; i < 3; i++) {
    const result = await client.get('/test')
    console.log(`Intento ${i + 1}: ${result.ok ? '✅ OK' : '❌ Fallo'}`)
    console.log(`  Estado: ${client.getState()}`)
  }

  // Circuito abierto
  console.log('\n🔴 Circuito OPEN - Rechazando peticiones inmediatamente')
  const blockedResult = await client.get('/test')
  if (!blockedResult.ok) {
    console.log(`Resultado: ${blockedResult.error}`)
  }

  // Esperar a HALF_OPEN
  console.log('\n⏳ Esperando a transición a HALF_OPEN...')
  await new Promise(resolve => setTimeout(resolve, 2100))
  console.log(`Estado: ${client.getState()}`)
}

// ============================================================================
// EJEMPLO 5: Manejo de errores detallado
// ============================================================================
async function example5_errorHandling() {
  console.log('\n📌 EJEMPLO 5: Manejo detallado de errores')

  const client = new ResilientClient({
    baseUrl: 'https://api.github.com',
    timeoutMs: 1000
  })

  const result = await client.get('/repos/nonexistent/repo')

  if (!result.ok) {
    console.log(`❌ Error en request:`)
    console.log(`   Mensaje: ${result.error}`)
    if (result.status) {
      console.log(`   Status HTTP: ${result.status}`)
    }

    // Clasificar error
    if (result.error.includes('Timeout')) {
      console.log('   Tipo: Timeout (conección lenta)')
    } else if (result.error.includes('CircuitOpenFailFast')) {
      console.log('   Tipo: Circuito abierto (servicio caído)')
    } else if (result.error.includes('HTTP 404')) {
      console.log('   Tipo: Recurso no encontrado')
    } else {
      console.log('   Tipo: Error de red')
    }
  }
}

// ============================================================================
// EJEMPLO 6: Reset después de recuperación
// ============================================================================
async function example6_resetCircuit() {
  console.log('\n📌 EJEMPLO 6: Resetear circuito manualmente')

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com'
  })

  // Simular que el circuito está abierto (in real code)
  console.log(`Estado: ${client.getState()}`)

  // Resetear circuito
  client.reset()
  console.log(`Después de reset: ${client.getState()}`)
  console.log('✅ Circuito listo para nuevas peticiones')
}

// ============================================================================
// EJEMPLO 7: Patrón de reintentos con Circuit Breaker
// ============================================================================
async function example7_retryPattern() {
  console.log('\n📌 EJEMPLO 7: Patrón de reintentos con backoff exponencial')

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    timeoutMs: 3000,
    failureThreshold: 3
  })

  async function retryWithBackoff<T>(
    fn: () => Promise<{ ok: boolean }>,
    maxRetries = 3
  ) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await fn()

      if (result.ok) {
        return { success: true, attempt }
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000
        console.log(`  Reintento ${attempt}: esperando ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return { success: false, attempt: maxRetries }
  }

  const result = await retryWithBackoff(() => client.get('/data'))
  console.log(`Resultado: ${result.success ? '✅ Éxito' : '❌ Falló'} en intento ${result.attempt}`)
}

// ============================================================================
// EJEMPLO 8: Timeout configuration
// ============================================================================
async function example8_timeoutConfiguration() {
  console.log('\n📌 EJEMPLO 8: Configurar timeouts')

  // Cliente con timeout corto (para operaciones rápidas)
  const fastClient = new ResilientClient({
    baseUrl: 'https://api.example.com',
    timeoutMs: 1000 // 1 segundo
  })

  // Cliente con timeout largo (para operaciones pesadas)
  const slowClient = new ResilientClient({
    baseUrl: 'https://api.example.com/heavy',
    timeoutMs: 30000 // 30 segundos
  })

  console.log('✅ Clientes configurados con diferentes timeouts')
}

// ============================================================================
// EJEMPLO 9: Monitoreo y logging
// ============================================================================
async function example9_monitoringAndLogging() {
  console.log('\n📌 EJEMPLO 9: Monitoreo del circuit breaker')

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com'
  })

  // Función helper para logging
  async function requestWithLogging(endpoint: string) {
    const stateBefore = client.getState()
    const result = await client.get(endpoint)
    const stateAfter = client.getState()

    console.log(`[${endpoint}]`)
    console.log(`  Estado antes: ${stateBefore}`)
    console.log(`  Resultado: ${result.ok ? '✅' : '❌'}`)
    console.log(`  Estado después: ${stateAfter}`)

    if (!result.ok) {
      console.log(`  Error: ${result.error}`)
    }

    return result
  }

  // Usar función de logging
  await requestWithLogging('/data')
}

// ============================================================================
// Notas de Implementación
// ============================================================================

/*
✅ CARACTERÍSTICAS IMPLEMENTADAS:

1. MÁQUINA DE ESTADOS FSM:
   - CLOSED: Flujo normal, cuenta fallos
   - OPEN: Rechaza inmediatamente (fail-fast), espera 5s
   - HALF_OPEN: Permite 1 probe, valida recuperación

2. PROTECCIONES:
   - ✅ Timeouts con AbortController (no cuelga)
   - ✅ Async/await puro (sin callbacks)
   - ✅ Tipado strict TypeScript
   - ✅ JSON parsing validado
   - ✅ Errores explícitos (sin null silencioso)
   - ✅ Control de probe único en HALF_OPEN
   - ✅ Diferenciación AbortError → "Timeout"
   - ✅ URLs robustas con new URL()

3. CONFIGURACIÓN:
   - timeoutMs: 3000 (ms)
   - failureThreshold: 3 (fallos antes de OPEN)
   - halfOpenAfterMs: 5000 (ms en OPEN antes de probe)

4. API PÚBLICA:
   - get<T>() / post<T>(): Peticiones con validación
   - getState(): Ver estado actual
   - reset(): Restaurar a CLOSED

5. MANEJO DE ERRORES:
   - HttpResponseErr siempre contiene error
   - Status HTTP incluido cuando existe
   - Sin errores silenciosos
*/
