/**
 * TESTS UNITARIOS - ResilientClient Circuit Breaker
 * Valida transiciones de estado y comportamiento de fail-fast
 */

import { ResilientClient, CircuitState, HttpResult } from './resilient-client'

// Type declarations para Node.js globals
declare const process: { exit: (code: number) => never }

// Mock de fetch global
let mockResponse: {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
} | null = null
let fetchCallCount = 0
let fetchShouldTimeout = false

// @ts-ignore - Override global fetch
global.fetch = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  fetchCallCount++

  if (fetchShouldTimeout) {
    const controller = new AbortController()
    controller.abort()
    throw new DOMException('Aborted', 'AbortError')
  }

  if (!mockResponse) {
    throw new Error('No mock response configured')
  }

  return {
    ok: mockResponse.ok,
    status: mockResponse.status,
    statusText: mockResponse.statusText,
    json: mockResponse.json,
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: url,
    clone: function () { return this },
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => ''
  } as unknown as Response
}

// Helper para resetear mocks
function resetMocks() {
  mockResponse = null
  fetchCallCount = 0
  fetchShouldTimeout = false
}

// ============================================================================
// TEST 1: Estado Inicial - Circuito en CLOSED
// ============================================================================
async function test1_initialStateIsClosed() {
  console.log('\n📋 TEST 1: Estado inicial es CLOSED')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com'
  })

  const state = client.getState()
  if (state === CircuitState.CLOSED) {
    console.log('✅ PASS: Estado inicial es CLOSED')
    return true
  } else {
    console.log(`❌ FAIL: Estado inicial es ${state}, esperado CLOSED`)
    return false
  }
}

// ============================================================================
// TEST 2: Transición CLOSED → OPEN después de 3 fallos
// ============================================================================
async function test2_closedToOpenAfterThreeFailures() {
  console.log('\n📋 TEST 2: Transición CLOSED → OPEN después de 3 fallos consecutivos')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    failureThreshold: 3
  })

  // Fallo 1
  mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => ({ error: 'Server error' })
  }
  let result = await client.get('/test')
  if (!result.ok && client.getState() === CircuitState.CLOSED) {
    console.log('  ✓ Fallo 1: Circuito aún CLOSED')
  } else {
    console.log('  ✗ Fallo 1: Error inesperado')
    return false
  }

  // Fallo 2
  result = await client.get('/test')
  if (!result.ok && client.getState() === CircuitState.CLOSED) {
    console.log('  ✓ Fallo 2: Circuito aún CLOSED')
  } else {
    console.log('  ✗ Fallo 2: Error inesperado')
    return false
  }

  // Fallo 3 - Debe transicionar a OPEN
  result = await client.get('/test')
  if (!result.ok && client.getState() === CircuitState.OPEN) {
    console.log('  ✓ Fallo 3: Circuito transicionó a OPEN')
    console.log('✅ PASS: Transición CLOSED → OPEN correcta')
    return true
  } else {
    console.log(`  ✗ Fallo 3: Estado es ${client.getState()}, esperado OPEN`)
    console.log('❌ FAIL: No se realizó transición a OPEN')
    return false
  }
}

// ============================================================================
// TEST 3: Fail-Fast en OPEN
// ============================================================================
async function test3_failFastInOpen() {
  console.log('\n📋 TEST 3: Fail-Fast en OPEN (rechaza inmediatamente)')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    failureThreshold: 3
  })

  // Forzar 3 fallos para abrir el circuito
  mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => ({})
  }
  await client.get('/test')
  await client.get('/test')
  await client.get('/test')

  if (client.getState() !== CircuitState.OPEN) {
    console.log('❌ FAIL: Circuito no está en OPEN')
    return false
  }

  // Reset fetch counter
  fetchCallCount = 0

  // Intentar request en OPEN - debe fallar sin hacer fetch
  const result = await client.get('/test')

  if (!result.ok && result.error === 'CircuitOpenFailFast' && fetchCallCount === 0) {
    console.log('  ✓ Request rechazado sin hacer fetch')
    console.log(`  ✓ Error: "${result.error}"`)
    console.log('✅ PASS: Fail-Fast en OPEN funciona correctamente')
    return true
  } else {
    console.log(`  ✗ Resultado: ${JSON.stringify(result)}`)
    console.log(`  ✗ Fetch llamado ${fetchCallCount} veces (esperado 0)`)
    console.log('❌ FAIL: No se implementó fail-fast correctamente')
    return false
  }
}

// ============================================================================
// TEST 4: Transición OPEN → HALF_OPEN después de halfOpenAfterMs
// ============================================================================
async function test4_openToHalfOpenAfterDelay() {
  console.log('\n📋 TEST 4: Transición OPEN → HALF_OPEN después de 5s')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    failureThreshold: 3,
    halfOpenAfterMs: 500 // Reducido a 500ms para test rápido
  })

  // Forzar 3 fallos para abrir el circuito
  mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Error',
    json: async () => ({})
  }
  await client.get('/test')
  await client.get('/test')
  await client.get('/test')

  if (client.getState() !== CircuitState.OPEN) {
    console.log('❌ FAIL: Circuito no está en OPEN')
    return false
  }

  console.log('  ℹ Esperando 600ms para transición a HALF_OPEN...')
  await new Promise(resolve => setTimeout(resolve, 600))

  // Intentar request - debe transicionar a HALF_OPEN
  mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ data: 'test' })
  }

  if (client.getState() === CircuitState.HALF_OPEN) {
    console.log('  ✓ Circuito transicionó a HALF_OPEN')
    console.log('✅ PASS: Transición OPEN → HALF_OPEN correcta')
    return true
  } else {
    console.log(`  ✗ Estado actual: ${client.getState()}`)
    console.log('❌ FAIL: No se realizó transición a HALF_OPEN')
    return false
  }
}

// ============================================================================
// TEST 5: HALF_OPEN - Solo 1 probe permitido
// ============================================================================
async function test5_halfOpenOnlyOneProbe() {
  console.log('\n📋 TEST 5: HALF_OPEN permite solo 1 petición probe')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    failureThreshold: 1,
    halfOpenAfterMs: 100
  })

  // Forzar 1 fallo para abrir
  mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Error',
    json: async () => ({})
  }
  await client.get('/test')

  // Esperar transición a HALF_OPEN
  await new Promise(resolve => setTimeout(resolve, 150))

  // Primer probe - permitido
  mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ data: 'ok' })
  }

  const probe1 = await client.get('/test')
  if (probe1.ok) {
    console.log('  ✓ Primer probe permitido y exitoso')
  } else {
    console.log(`  ✗ Primer probe rechazado: ${probe1.error}`)
    return false
  }

  // Segundo probe - rechazado
  const probe2 = await client.get('/test')
  if (!probe2.ok && probe2.error === 'HalfOpenProbeRejected') {
    console.log('  ✓ Segundo probe rechazado con "HalfOpenProbeRejected"')
    console.log('✅ PASS: Control de probe único en HALF_OPEN funciona')
    return true
  } else {
    console.log(`  ✗ Segundo probe: ${JSON.stringify(probe2)}`)
    console.log('❌ FAIL: No se rechazó segundo probe')
    return false
  }
}

// ============================================================================
// TEST 6: HALF_OPEN - Cierre al éxito del probe
// ============================================================================
async function test6_halfOpenProbeSuccessClosesCircuit() {
  console.log('\n📋 TEST 6: HALF_OPEN → CLOSED cuando probe es exitoso')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    failureThreshold: 1,
    halfOpenAfterMs: 100
  })

  // Forzar fallo
  mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Error',
    json: async () => ({})
  }
  await client.get('/test')

  // Esperar y transicionar a HALF_OPEN
  await new Promise(resolve => setTimeout(resolve, 150))

  // Probe exitoso
  mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ status: 'recovered' })
  }

  const probeResult = await client.get('/test')

  if (probeResult.ok && client.getState() === CircuitState.CLOSED) {
    console.log('  ✓ Probe exitoso')
    console.log('  ✓ Circuito cerrado (CLOSED)')
    console.log('✅ PASS: Probe exitoso cierra el circuito')
    return true
  } else {
    console.log(`  ✗ Probe: ${JSON.stringify(probeResult)}`)
    console.log(`  ✗ Estado: ${client.getState()}`)
    console.log('❌ FAIL: No se cerró circuito tras probe exitoso')
    return false
  }
}

// ============================================================================
// TEST 7: Diferenciación de AbortError (Timeout)
// ============================================================================
async function test7_timeoutDifferentiation() {
  console.log('\n📋 TEST 7: Diferenciación AbortError → "Timeout"')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    timeoutMs: 100
  })

  fetchShouldTimeout = true

  const result = await client.get('/test')

  if (!result.ok && result.error.includes('Timeout')) {
    console.log(`  ✓ Error diferenciado: "${result.error}"`)
    console.log('✅ PASS: Timeout diferenciado correctamente')
    return true
  } else {
    console.log(`  ✗ Resultado: ${JSON.stringify(result)}`)
    console.log('❌ FAIL: Timeout no diferenciado')
    return false
  }
}

// ============================================================================
// TEST 8: Reset funciona correctamente
// ============================================================================
async function test8_resetFunctionality() {
  console.log('\n📋 TEST 8: Método reset() restaura estado inicial')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com',
    failureThreshold: 1
  })

  // Forzar fallo para abrir
  mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Error',
    json: async () => ({})
  }
  await client.get('/test')

  if (client.getState() !== CircuitState.OPEN) {
    console.log('❌ FAIL: No se abrió circuito')
    return false
  }

  // Reset
  client.reset()

  if (client.getState() === CircuitState.CLOSED) {
    console.log('  ✓ Estado restaurado a CLOSED')
    console.log('✅ PASS: Reset funciona correctamente')
    return true
  } else {
    console.log(`  ✗ Estado: ${client.getState()}`)
    console.log('❌ FAIL: Reset no restauró estado')
    return false
  }
}

// ============================================================================
// TEST 9: URL construction robusta con new URL()
// ============================================================================
async function test9_robustUrlConstruction() {
  console.log('\n📋 TEST 9: Construcción robusta de URLs con new URL()')
  resetMocks()

  const client = new ResilientClient({
    baseUrl: 'https://api.example.com/v1'
  })

  mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ ok: true })
  }

  // Fetch será llamado con URL construida
  let capturedUrl = ''
  // @ts-ignore
  const originalFetch = global.fetch
  // @ts-ignore
  global.fetch = async (url: string) => {
    capturedUrl = url
    return originalFetch(url)
  }

  await client.get('/users/123')

  // Restaurar fetch
  // @ts-ignore
  global.fetch = originalFetch

  const expectedUrl = 'https://api.example.com/v1/users/123'
  if (capturedUrl === expectedUrl) {
    console.log(`  ✓ URL construida: ${capturedUrl}`)
    console.log('✅ PASS: Construcción de URLs robusta')
    return true
  } else {
    console.log(`  ✗ URL: ${capturedUrl}`)
    console.log(`  ✗ Esperada: ${expectedUrl}`)
    console.log('❌ FAIL: URLs no se construyeron correctamente')
    return false
  }
}

// ============================================================================
// RUNNER
// ============================================================================
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🧪 SUITE DE TESTS - ResilientClient Circuit Breaker')
  console.log('═══════════════════════════════════════════════════════════════')

  const tests = [
    test1_initialStateIsClosed,
    test2_closedToOpenAfterThreeFailures,
    test3_failFastInOpen,
    test4_openToHalfOpenAfterDelay,
    test5_halfOpenOnlyOneProbe,
    test6_halfOpenProbeSuccessClosesCircuit,
    test7_timeoutDifferentiation,
    test8_resetFunctionality,
    test9_robustUrlConstruction
  ]

  const results: boolean[] = []
  for (const test of tests) {
    results.push(await test())
  }

  // Resumen
  const passed = results.filter(r => r).length
  const total = results.length

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`📊 RESUMEN: ${passed}/${total} tests pasaron`)
  console.log('═══════════════════════════════════════════════════════════════')

  if (passed === total) {
    console.log('🎉 ¡TODOS LOS TESTS PASARON!')
    process.exit(0)
  } else {
    console.log(`⚠️  ${total - passed} tests fallaron`)
    process.exit(1)
  }
}

// Ejecutar tests
runAllTests().catch(err => {
  console.error('Error fatal en tests:', err)
  process.exit(1)
})
