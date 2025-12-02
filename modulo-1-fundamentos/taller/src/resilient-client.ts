// CIRCUIT BREAKER PATTERN - Implementación Robusta
// Protege contra fallos repetidos y sobrecarga de servicios

/**
 * Opciones de configuración para ResilientClient
 */
export interface ResilientClientOptions {
  baseUrl: string
  timeoutMs?: number
  failureThreshold?: number
  halfOpenAfterMs?: number
}

/**
 * Respuesta HTTP exitosa tipada
 */
export interface HttpResponseOk<T> {
  ok: true
  status: number
  data: T
}

/**
 * Respuesta HTTP con error
 */
export interface HttpResponseErr {
  ok: false
  status?: number
  error: string
}

/**
 * Tipo discriminado para resultados HTTP
 */
export type HttpResult<T> = HttpResponseOk<T> | HttpResponseErr

/**
 * Estados de la máquina de estados del Circuit Breaker
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * ResilientClient: Cliente HTTP con Circuit Breaker Pattern
 * 
 * Protege contra:
 * - Timeouts indefinidos
 * - Fallos en cascada
 * - Sobrecarga de servicios caídos
 * - Errores silenciosos
 * 
 * Estados:
 * CLOSED → Peticiones normales, contar fallos
 * OPEN → Rechazar inmediatamente (fail-fast), esperar 5s
 * HALF_OPEN → Permitir 1 petición probe para validar recuperación
 */
export class ResilientClient {
  private baseUrl: string
  private timeoutMs: number
  private failureThreshold: number
  private halfOpenAfterMs: number

  // Estado del Circuit Breaker
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private lastFailureTime: number | null = null
  private halfOpenProbeInProgress: boolean = false

  constructor(options: ResilientClientOptions) {
    this.baseUrl = options.baseUrl
    this.timeoutMs = options.timeoutMs ?? 3000
    this.failureThreshold = options.failureThreshold ?? 3
    this.halfOpenAfterMs = options.halfOpenAfterMs ?? 5000
  }

  /**
   * Obtiene el estado actual del circuit breaker
   */
  public getState(): CircuitState {
    return this.state
  }

  /**
   * Realiza una petición GET con protección de Circuit Breaker
   */
  async get<T>(
    endpoint: string,
    schema?: { parse: (data: unknown) => T }
  ): Promise<HttpResult<T>> {
    return this.request<T>('GET', endpoint, undefined, schema)
  }

  /**
   * Realiza una petición POST con Circuit Breaker
   */
  async post<T>(
    endpoint: string,
    body: unknown,
    schema?: { parse: (data: unknown) => T }
  ): Promise<HttpResult<T>> {
    return this.request<T>('POST', endpoint, body, schema)
  }

  /**
   * Método privado que factoriza la lógica común GET/POST
   * Maneja: validación de estado, construcción de URL, timeout, JSON parsing, schema validation
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown,
    schema?: { parse: (data: unknown) => T }
  ): Promise<HttpResult<T>> {
    // Verificar estado del circuito
    const stateCheck = this.checkCircuitState()
    if (!stateCheck.ok) {
      return stateCheck as HttpResponseErr
    }

    try {
      // Construir URL robusta usando URL API
      const url = new URL(endpoint, this.baseUrl).toString()

      // Preparar opciones del request
      const init: RequestInit = { method }
      if (method === 'POST') {
        init.headers = { 'Content-Type': 'application/json' }
        init.body = JSON.stringify(body)
      }

      // Realizar fetch con timeout
      const response = await this.fetchWithTimeout(url, this.timeoutMs, init)

      // Validar respuesta HTTP
      if (!response.ok) {
        return this.handleFailure({
          ok: false,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`
        })
      }

      // Parsear JSON con validación
      let data: unknown
      try {
        data = await response.json()
      } catch (parseError) {
        return this.handleFailure({
          ok: false,
          status: response.status,
          error: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        })
      }

      // Validar contra schema si se proporciona
      if (schema) {
        try {
          const validatedData = schema.parse(data)
          this.handleSuccess()
          return {
            ok: true,
            status: response.status,
            data: validatedData
          }
        } catch (schemaError) {
          return this.handleFailure({
            ok: false,
            status: response.status,
            error: `Schema validation failed: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`
          })
        }
      }

      this.handleSuccess()
      return {
        ok: true,
        status: response.status,
        data: data as T
      }
    } catch (error) {
      // Diferenciar AbortError (timeout) de otros errores
      let errorMessage: string
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'Timeout'
      } else {
        errorMessage = error instanceof Error ? error.message : 'Unknown error'
      }

      return this.handleFailure({
        ok: false,
        error: `Request failed: ${errorMessage}`
      })
    }
  }

  /**
   * MÁQUINA DE ESTADOS: Verifica y maneja transiciones del circuito
   * 
   * CLOSED: Procesa todas las peticiones
   * OPEN: Rechaza inmediatamente, espera para pasar a HALF_OPEN
   * HALF_OPEN: Permite exactamente 1 petición probe
   */
  private checkCircuitState(): { ok: true } | HttpResponseErr {
    const now = Date.now()

    // TRANSICIÓN: OPEN → HALF_OPEN después de halfOpenAfterMs
    if (
      this.state === CircuitState.OPEN &&
      this.lastFailureTime !== null &&
      now - this.lastFailureTime >= this.halfOpenAfterMs
    ) {
      this.state = CircuitState.HALF_OPEN
      this.halfOpenProbeInProgress = false
    }

    // Estado CLOSED: procesar normalmente
    if (this.state === CircuitState.CLOSED) {
      return { ok: true }
    }

    // Estado OPEN: rechazar inmediatamente (fail-fast)
    if (this.state === CircuitState.OPEN) {
      return {
        ok: false,
        error: 'CircuitOpenFailFast'
      }
    }

    // Estado HALF_OPEN: permitir solo 1 petición probe
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenProbeInProgress) {
        return {
          ok: false,
          error: 'HalfOpenProbeRejected'
        }
      }
      // Marcar que una petición probe está en progreso
      this.halfOpenProbeInProgress = true
      return { ok: true }
    }

    return { ok: true }
  }

  /**
   * Maneja fallos: incrementa contador y transiciona a OPEN si es necesario
   */
  private handleFailure(error: HttpResponseErr): HttpResponseErr {
    this.failureCount++
    this.lastFailureTime = Date.now()

    // TRANSICIÓN: CLOSED → OPEN si se alcanza el threshold
    if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitState.OPEN
    }

    // TRANSICIÓN: HALF_OPEN → OPEN si el probe falla
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN
      this.halfOpenProbeInProgress = false
    }

    return error
  }

  /**
   * Maneja éxitos: resetea contador y transiciona a CLOSED
   */
  private handleSuccess(): void {
    this.failureCount = 0
    this.lastFailureTime = null

    // TRANSICIÓN: HALF_OPEN → CLOSED si el probe tiene éxito
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED
    }

    this.halfOpenProbeInProgress = false
  }

  /**
   * Realiza fetch con timeout
   * Evita que las conexiones cuelguen indefinidamente
   */
  private async fetchWithTimeout(
    url: string,
    timeoutMs: number,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Resetea el circuit breaker al estado inicial
   * Útil para testing o recuperación manual
   */
  public reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.lastFailureTime = null
    this.halfOpenProbeInProgress = false
  }
}
