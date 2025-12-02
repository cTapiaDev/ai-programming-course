/**
 * 🛡️ RESILIENT HTTP CLIENT CON CIRCUIT BREAKER
 * 
 * Implementa el patrón Circuit Breaker para proteger contra fallos en cascada
 * Estados: CLOSED (normal) -> OPEN (fail fast) -> HALF_OPEN (prueba)
 */

// ===== TIPOS E INTERFACES =====

/**
 * Estados del Circuit Breaker
 */
enum CircuitState {
  CLOSED = 'CLOSED',       // Funcionamiento normal
  OPEN = 'OPEN',           // Circuito abierto, fail fast
  HALF_OPEN = 'HALF_OPEN'  // Permitir una petición de prueba
}

/**
 * Configuración del cliente resiliente
 */
interface ResilientClientConfig {
  baseUrl: string;
  timeout: number;              // Timeout en milisegundos
  failureThreshold: number;     // Número de fallos consecutivos para abrir el circuito
  resetTimeout: number;         // Tiempo en ms antes de intentar HALF_OPEN
}

/**
 * Respuesta tipada de la API de usuarios
 */
interface UserData {
  id: string;
  name: string;
  email: string;
  [key: string]: unknown;  // Permite campos adicionales
}

/**
 * Error personalizado para cuando el circuito está abierto
 */
class CircuitBreakerOpenError extends Error {
  constructor() {
    super('Circuit breaker is OPEN. Request rejected (Fail Fast)');
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Error de timeout
 */
class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

// ===== CLIENTE RESILIENTE =====

class ResilientClient {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;

  constructor(private config: ResilientClientConfig) {}

  /**
   * Obtiene datos de usuario con protección de Circuit Breaker
   */
  async getUserData(userId: string): Promise<UserData> {
    // Verificar estado del Circuit Breaker
    this.updateCircuitState();

    // Si el circuito está OPEN, fallar inmediatamente (Fail Fast)
    if (this.state === CircuitState.OPEN) {
      throw new CircuitBreakerOpenError();
    }

    try {
      const userData = await this.makeRequest(userId);
      this.onSuccess();
      return userData;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Realiza la petición HTTP con timeout
   */
  private async makeRequest(userId: string): Promise<UserData> {
    const url = `${this.config.baseUrl}/users/${userId}`;
    
    // Crear AbortController para implementar timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      // Validar código de estado HTTP
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parsear JSON con manejo de errores
      let data: unknown;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Validar estructura básica de la respuesta
      if (!this.isValidUserData(data)) {
        throw new Error('Invalid user data structure received');
      }

      return data as UserData;

    } catch (error) {
      clearTimeout(timeoutId);

      // Manejar timeout específicamente
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(this.config.timeout);
      }

      // Re-lanzar otros errores
      throw error;
    }
  }

  /**
   * Valida la estructura de los datos de usuario
   */
  private isValidUserData(data: unknown): data is UserData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      typeof obj.email === 'string'
    );
  }

  /**
   * Actualiza el estado del Circuit Breaker basándose en el tiempo
   */
  private updateCircuitState(): void {
    const now = Date.now();

    // Si estamos en OPEN y ha pasado el tiempo de reset, pasar a HALF_OPEN
    if (this.state === CircuitState.OPEN && now >= this.nextAttemptTime) {
      this.state = CircuitState.HALF_OPEN;
      console.log(`[Circuit Breaker] Estado: OPEN -> HALF_OPEN (permitiendo petición de prueba)`);
    }
  }

  /**
   * Maneja una petición exitosa
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // Si estábamos en HALF_OPEN y la prueba funcionó, cerrar el circuito
      console.log(`[Circuit Breaker] Petición de prueba exitosa. Estado: HALF_OPEN -> CLOSED`);
      this.reset();
    } else if (this.failureCount > 0) {
      // Reset parcial en estado CLOSED
      this.failureCount = 0;
      console.log(`[Circuit Breaker] Petición exitosa. Contador de fallos reseteado.`);
    }
  }

  /**
   * Maneja un fallo en la petición
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    console.log(`[Circuit Breaker] Fallo #${this.failureCount} registrado`);

    if (this.state === CircuitState.HALF_OPEN) {
      // Si la petición de prueba falló, volver a OPEN
      this.openCircuit();
      console.log(`[Circuit Breaker] Petición de prueba falló. Estado: HALF_OPEN -> OPEN`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      // Si alcanzamos el umbral de fallos, abrir el circuito
      this.openCircuit();
      console.log(`[Circuit Breaker] Umbral alcanzado (${this.config.failureThreshold} fallos). Estado: CLOSED -> OPEN`);
    }
  }

  /**
   * Abre el circuito y establece el tiempo de próximo intento
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    console.log(`[Circuit Breaker] Circuito ABIERTO. Próximo intento en ${this.config.resetTimeout}ms`);
  }

  /**
   * Resetea el Circuit Breaker al estado inicial
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * Obtiene el estado actual del circuito (útil para monitoreo)
   */
  getCircuitState(): CircuitState {
    return this.state;
  }

  /**
   * Obtiene métricas actuales (útil para observabilidad)
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
}

// ===== EXPORTACIÓN =====

/**
 * Factory para crear una instancia del cliente con configuración por defecto
 */
export function createResilientClient(baseUrl: string): ResilientClient {
  return new ResilientClient({
    baseUrl,
    timeout: 5000,           // 5 segundos
    failureThreshold: 3,     // 3 fallos consecutivos
    resetTimeout: 5000       // 5 segundos en OPEN antes de HALF_OPEN
  });
}

export { ResilientClient, CircuitState, CircuitBreakerOpenError, TimeoutError };
export type { ResilientClientConfig, UserData };
