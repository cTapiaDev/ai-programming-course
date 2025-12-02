/**
 * Resilient HTTP Client with Circuit Breaker Pattern
 * Implementación profesional sin librerías externas
 * @author Senior TypeScript Developer
 */

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

/**
 * Estados posibles del Circuit Breaker
 */
enum CircuitState {
    CLOSED = 'CLOSED',     // Funcionamiento normal
    OPEN = 'OPEN',         // Circuito abierto, rechaza peticiones
    HALF_OPEN = 'HALF_OPEN' // Permitiendo petición de prueba
}

/**
 * Respuesta tipada de la API externa
 */
interface UserData {
    id: string;
    name: string;
    email: string;
    [key: string]: unknown; // Permite campos adicionales
}

/**
 * Resultado de una operación con Circuit Breaker
 */
interface CircuitBreakerResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    circuitState: CircuitState;
}

/**
 * Configuración del Circuit Breaker
 */
interface CircuitBreakerConfig {
    failureThreshold: number;    // Número de fallos antes de abrir el circuito
    resetTimeout: number;         // Tiempo en ms antes de intentar HALF_OPEN
    requestTimeout: number;       // Timeout para peticiones HTTP
}

/**
 * Métricas del Circuit Breaker
 */
interface CircuitMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    circuitOpenCount: number;
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
}

// ============================================================================
// IMPLEMENTACIÓN DEL CIRCUIT BREAKER
// ============================================================================

class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number | null = null;
    private metrics: CircuitMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        circuitOpenCount: 0
    };

    constructor(private config: CircuitBreakerConfig) { }

    /**
     * Verifica si se puede ejecutar una petición
     */
    private canExecute(): boolean {
        // Estado CLOSED: siempre permite peticiones
        if (this.state === CircuitState.CLOSED) {
            return true;
        }

        // Estado HALF_OPEN: permite una petición de prueba
        if (this.state === CircuitState.HALF_OPEN) {
            return true;
        }

        // Estado OPEN: verificar si ha pasado el tiempo de reset
        if (this.state === CircuitState.OPEN && this.lastFailureTime) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;

            if (timeSinceLastFailure >= this.config.resetTimeout) {
                this.transitionTo(CircuitState.HALF_OPEN);
                return true;
            }
        }

        return false;
    }

    /**
     * Transición entre estados del circuito
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        console.log(`[Circuit Breaker] Transición: ${oldState} → ${newState}`);

        if (newState === CircuitState.OPEN) {
            this.metrics.circuitOpenCount++;
        }
    }

    /**
     * Registra un éxito en la ejecución
     */
    private onSuccess(): void {
        this.failureCount = 0;
        this.metrics.successfulRequests++;
        this.metrics.lastSuccessTime = new Date();

        // Si estábamos en HALF_OPEN y tuvo éxito, cerramos el circuito
        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.CLOSED);
        }
    }

    /**
     * Registra un fallo en la ejecución
     */
    private onFailure(): void {
        this.failureCount++;
        this.metrics.failedRequests++;
        this.metrics.lastFailureTime = new Date();
        this.lastFailureTime = Date.now();

        // Si estábamos en HALF_OPEN y falló, volvemos a OPEN
        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.OPEN);
            return;
        }

        // Si alcanzamos el umbral de fallos, abrimos el circuito
        if (this.failureCount >= this.config.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }
    }

    /**
     * Ejecuta una función protegida por el Circuit Breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
        this.metrics.totalRequests++;

        // Verificar si podemos ejecutar la petición
        if (!this.canExecute()) {
            return {
                success: false,
                error: new Error(
                    `Circuit Breaker is OPEN. Failing fast to prevent cascading failures. ` +
                    `Will retry after ${this.config.resetTimeout}ms.`
                ),
                circuitState: this.state
            };
        }

        try {
            const data = await fn();
            this.onSuccess();

            return {
                success: true,
                data,
                circuitState: this.state
            };
        } catch (error) {
            this.onFailure();

            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitState: this.state
            };
        }
    }

    /**
     * Obtiene el estado actual del circuito
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Obtiene las métricas del circuito
     */
    getMetrics(): Readonly<CircuitMetrics> {
        return { ...this.metrics };
    }

    /**
     * Resetea manualmente el circuito (útil para testing)
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
    }
}

// ============================================================================
// CLIENTE HTTP RESILIENTE
// ============================================================================

class ResilientHttpClient {
    private circuitBreaker: CircuitBreaker;

    constructor(config?: Partial<CircuitBreakerConfig>) {
        const defaultConfig: CircuitBreakerConfig = {
            failureThreshold: 3,    // 3 fallos consecutivos
            resetTimeout: 5000,     // 5 segundos
            requestTimeout: 10000   // 10 segundos timeout por petición
        };

        this.circuitBreaker = new CircuitBreaker({
            ...defaultConfig,
            ...config
        });
    }

    /**
     * Valida y sanitiza el userId para prevenir inyección de URL
     */
    private validateUserId(userId: string): string {
        // Validación estricta: solo alfanuméricos, guiones y guiones bajos
        const sanitized = userId.trim();

        if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
            throw new Error(
                `Invalid userId format: "${userId}". Only alphanumeric characters, hyphens, and underscores are allowed.`
            );
        }

        if (sanitized.length === 0 || sanitized.length > 100) {
            throw new Error(`Invalid userId length: must be between 1 and 100 characters.`);
        }

        return sanitized;
    }

    /**
     * Realiza una petición HTTP con timeout
     */
    private async fetchWithTimeout(
        url: string,
        timeout: number
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'ResilientClient/1.0'
                }
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }

            throw error;
        }
    }

    /**
     * Parsea JSON de forma segura
     */
    private async parseJsonSafely<T>(response: Response): Promise<T> {
        const text = await response.text();

        try {
            return JSON.parse(text) as T;
        } catch (error) {
            throw new Error(
                `Invalid JSON response. Status: ${response.status}, ` +
                `Body preview: ${text.substring(0, 100)}...`
            );
        }
    }

    /**
     * Obtiene datos de usuario con protección de Circuit Breaker
     */
    async getUserData(userId: string): Promise<CircuitBreakerResult<UserData>> {
        // Validar y sanitizar el userId
        let validatedUserId: string;
        try {
            validatedUserId = this.validateUserId(userId);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitState: this.circuitBreaker.getState()
            };
        }

        // Ejecutar petición protegida por Circuit Breaker
        return this.circuitBreaker.execute(async () => {
            const url = `https://api-externa.com/users/${validatedUserId}`;

            // Realizar petición con timeout
            const response = await this.fetchWithTimeout(url, 10000);

            // Validar código de estado HTTP
            if (!response.ok) {
                throw new Error(
                    `HTTP Error: ${response.status} ${response.statusText} for user ${validatedUserId}`
                );
            }

            // Parsear JSON de forma segura
            const data = await this.parseJsonSafely<UserData>(response);

            // Validar estructura mínima de la respuesta
            if (!data.id || !data.name) {
                throw new Error(`Invalid user data structure: missing required fields`);
            }

            return data;
        });
    }

    /**
     * Obtiene el estado actual del Circuit Breaker
     */
    getCircuitState(): CircuitState {
        return this.circuitBreaker.getState();
    }

    /**
     * Obtiene métricas del Circuit Breaker
     */
    getMetrics(): Readonly<CircuitMetrics> {
        return this.circuitBreaker.getMetrics();
    }

    /**
     * Resetea el Circuit Breaker (útil para testing)
     */
    resetCircuit(): void {
        this.circuitBreaker.reset();
    }
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

export {
    ResilientHttpClient,
    CircuitState,
    type CircuitBreakerResult,
    type UserData,
    type CircuitMetrics,
    type CircuitBreakerConfig
};

export const resilientClient = new ResilientHttpClient();
export default ResilientHttpClient;
