# 🔌 ResilientClient - Circuit Breaker Pattern

Una implementación robusta de un cliente HTTP con **Circuit Breaker Pattern** en TypeScript para proteger aplicaciones contra fallos en cascada.

## 📋 Características

### ✅ Máquina de Estados (FSM)
```
CLOSED → (3 fallos) → OPEN → (5s timeout) → HALF_OPEN → (probe exitoso) → CLOSED
                      ↑         ↓                              ↓
                      └─────────(probe falla)──────────────────┘
```

- **CLOSED**: Estado normal. Peticiones fluyen, se cuentan fallos.
- **OPEN**: Rechaza inmediatamente (fail-fast). Espera 5 segundos para pasar a HALF_OPEN.
- **HALF_OPEN**: Permite exactamente 1 petición "probe" para validar recuperación.

### 🛡️ Protecciones

| Problema Legado | Solución |
|---|---|
| ❌ Sin timeouts (cuelga indefinido) | ✅ AbortController (3s defecto) |
| ❌ Callbacks + Promesas (callback hell) | ✅ Async/await puro |
| ❌ Sin tipos TypeScript | ✅ `strict: true`, tipos completos |
| ❌ Errores silenciosos (devuelve null) | ✅ `HttpResult<T>` discriminado |
| ❌ Sin protección contra fallos repetidos | ✅ Circuit Breaker con 3 intentos |

### 🔧 Características Implementadas

- ✅ Diferenciación de AbortError → "Timeout"
- ✅ URLs robustas con `new URL(endpoint, baseUrl)`
- ✅ Factorización: método privado `request<T>()` para GET/POST
- ✅ Control único de probe en HALF_OPEN
- ✅ Fail-fast en OPEN (no hace fetch)
- ✅ Validación JSON y schemas opcionales
- ✅ `getState()` y `reset()` públicos

## 📦 Instalación

```bash
cd taller
npm install typescript --save-dev
```

## 🚀 Uso Rápido

```typescript
import { ResilientClient, CircuitState } from './src/resilient-client'

// Crear cliente
const client = new ResilientClient({
  baseUrl: 'https://api.example.com',
  timeoutMs: 3000,           // 3 segundos (defecto)
  failureThreshold: 3,        // Abrir tras 3 fallos (defecto)
  halfOpenAfterMs: 5000       // Probe después de 5s (defecto)
})

// GET simple
const result = await client.get('/users/123')
if (result.ok) {
  console.log(result.data)
  console.log(`Status: ${result.status}`)
} else {
  console.log(`Error: ${result.error}`)
}

// GET con validación de schema
const userSchema = {
  parse: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'id' in data && 'name' in data) {
      return data as { id: number; name: string }
    }
    throw new Error('Invalid schema')
  }
}

const userResult = await client.get('/users/123', userSchema)

// POST con datos
const postResult = await client.post('/posts', {
  title: 'Mi Post',
  body: 'Contenido...',
  userId: 1
})

// Monitorear estado
console.log(client.getState()) // 'CLOSED' | 'OPEN' | 'HALF_OPEN'

// Reset manual
client.reset() // Restaura a CLOSED
```

## 📊 Configuración Detallada

### ResilientClientOptions

```typescript
interface ResilientClientOptions {
  baseUrl: string              // URL base (requerida)
  timeoutMs?: number           // Timeout por petición (defecto: 3000)
  failureThreshold?: number    // Fallos antes de OPEN (defecto: 3)
  halfOpenAfterMs?: number     // Tiempo OPEN antes de HALF_OPEN (defecto: 5000)
}
```

### HttpResult<T> - Tipo Discriminado

```typescript
// Éxito
{
  ok: true,
  status: 200,
  data: T
}

// Error
{
  ok: false,
  status?: number,
  error: string
}
```

## 🧪 Tests Unitarios

Verificar transiciones de estado:

```bash
# Compilar TypeScript
npx tsc --noEmit taller/src/resilient-client.ts taller/src/resilient-client.test.ts

# Ejecutar tests (Node 18+)
node taller/src/resilient-client.test.ts
```

### Tests Implementados

1. ✅ **test1**: Estado inicial es CLOSED
2. ✅ **test2**: CLOSED → OPEN tras 3 fallos
3. ✅ **test3**: Fail-Fast en OPEN (no hace fetch)
4. ✅ **test4**: OPEN → HALF_OPEN después de 5s
5. ✅ **test5**: HALF_OPEN permite solo 1 probe
6. ✅ **test6**: HALF_OPEN → CLOSED con probe exitoso
7. ✅ **test7**: Diferenciación AbortError → "Timeout"
8. ✅ **test8**: reset() restaura a CLOSED
9. ✅ **test9**: Construcción robusta de URLs

## 📈 Diagrama de Transiciones

```
    ┌─────────────────────────────────────────┐
    │           ESTADO INICIAL                │
    │          (CLOSED)                       │
    │  Peticiones normales                    │
    │  Contar fallos consecutivos             │
    └────────────┬────────────────────────────┘
                 │
          [3 fallos]
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │  OPEN (Fail-Fast)                       │
    │  Rechaza inmediatamente                 │
    │  Error: "CircuitOpenFailFast"           │
    │  Temporizador: 5 segundos               │
    └────────────┬────────────────────────────┘
                 │
           [5s timeout]
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │  HALF_OPEN (Probe Phase)                │
    │  Permite 1 petición probe               │
    │  Otras rechazadas: "HalfOpenProbeRejected"
    └────────┬───────────────────┬────────────┘
             │                   │
      [Probe OK]          [Probe Falla]
             │                   │
             ▼                   ▼
         CLOSED ◄──────────── OPEN
```

## 💻 Ejemplos Avanzados

### 1. Reintentos con Backoff Exponencial

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<HttpResult<T>>,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await fn()
    if (result.ok) return result

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('All retries failed')
}

// Usar
const data = await retryWithBackoff(() => client.get('/data'))
```

### 2. Validación con Zod (ejemplo)

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email()
})

const result = await client.get('/user', {
  parse: (data) => UserSchema.parse(data)
})
```

### 3. Timeout Diferenciado

```typescript
// API rápida (1 segundo)
const fast = new ResilientClient({
  baseUrl: 'https://api-fast.example.com',
  timeoutMs: 1000
})

// API pesada (30 segundos)
const heavy = new ResilientClient({
  baseUrl: 'https://api-heavy.example.com',
  timeoutMs: 30000
})
```

### 4. Monitoreo

```typescript
async function monitoredRequest(endpoint: string) {
  const before = client.getState()
  const result = await client.get(endpoint)
  const after = client.getState()

  console.log(`[${endpoint}]`)
  console.log(`  Estado: ${before} → ${after}`)
  console.log(`  Resultado: ${result.ok ? '✅' : '❌'} ${result.error || ''}`)

  return result
}
```

## ⚠️ Restricciones y Decisiones de Diseño

| Decisión | Razón |
|---|---|
| Timeout defecto: 3 segundos | Balance entre responsividad y estabilidad |
| Fallos antes de OPEN: 3 | Tolerancia a fallos transitorios |
| Tiempo OPEN→HALF_OPEN: 5 segundos | Dar tiempo a servicio para recuperarse |
| Solo 1 probe en HALF_OPEN | Evitar sobrecarga en fase de recuperación |
| Fail-fast en OPEN | Liberar recursos rápidamente |
| Sin errores silenciosos | Facilitar debugging |

## 🔍 Comparativa: Legado vs. ResilientClient

| Feature | Legacy | ResilientClient |
|---|---|---|
| Timeout indefinido | ❌ | ✅ (3s defecto) |
| Callback hell | ✅ | ❌ Async/await |
| TypeScript strict | ❌ | ✅ |
| Errores explícitos | ❌ | ✅ HttpResult |
| Circuit Breaker | ❌ | ✅ FSM completa |
| JSON validation | ❌ | ✅ |
| URL robusta | ❌ | ✅ new URL() |
| Schema validation | ❌ | ✅ Opcional |

## 📚 API Completa

### Método: get<T>()

```typescript
async get<T>(
  endpoint: string,
  schema?: { parse: (data: unknown) => T }
): Promise<HttpResult<T>>
```

### Método: post<T>()

```typescript
async post<T>(
  endpoint: string,
  body: unknown,
  schema?: { parse: (data: unknown) => T }
): Promise<HttpResult<T>>
```

### Método: getState()

```typescript
getState(): CircuitState
// Retorna: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
```

### Método: reset()

```typescript
reset(): void
// Restaura el circuito a CLOSED
```

## 🐛 Manejo de Errores

```typescript
const result = await client.get('/data')

if (!result.ok) {
  if (result.error.includes('Timeout')) {
    // Timeout (AbortError)
  } else if (result.error.includes('CircuitOpenFailFast')) {
    // Circuito abierto
  } else if (result.error.includes('HalfOpenProbeRejected')) {
    // Esperando en HALF_OPEN
  } else if (result.error.includes('Invalid JSON')) {
    // JSON parsing error
  } else if (result.error.includes('Schema validation')) {
    // Schema validation error
  } else if (result.status === 404) {
    // HTTP error
  } else {
    // Network error
  }
}
```

## 📝 Notas Técnicas

- **Node.js**: Requiere 18+ (fetch nativo)
- **TypeScript**: Compilar con `strict: true`
- **AbortController**: Usado para timeouts (Node 15+)
- **URL API**: Para construcción robusta de URLs
- **Sin dependencias externas**

## 🎯 Conclusión

`ResilientClient` implementa un patrón de Circuit Breaker robusto y production-ready que:

1. ✅ Protege contra fallos en cascada
2. ✅ Previene timeouts indefinidos
3. ✅ Proporciona máquina de estados clara
4. ✅ Valida tipos y datos
5. ✅ Facilita debugging explícito
6. ✅ Es extensible y testeable

Reemplaza completamente el código legado problemático con una solución segura y mantenible.
