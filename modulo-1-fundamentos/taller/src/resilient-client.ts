// ✨ CÓDIGO MODERNO Y RESILIENTE ✨
// Implementación del patrón Circuit Breaker con TypeScript estricto

/**
 * Estados posibles del Circuit Breaker
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

/**
 * Interfaz para la respuesta de la API
 */
interface ApiResponse {
    id: string;
    name: string;
    email: string;
    [key: string]: unknown;
}

/**
 * Configuración del cliente resiliente
 */
interface ClientConfig {
    baseUrl: string;
    requestTimeoutMs: number;
    resetTimeoutMs: number;
    failureThreshold: number;
}

/**
 * Clase que implementa el patrón Circuit Breaker
 * para peticiones HTTP resilientes
 */
export class ResilientClient {
    private state: CircuitState = 'CLOSED';
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private readonly resetTimeoutMs: number = 5000;
    private readonly requestTimeoutMs: number = 2000;
    private readonly failureThreshold: number = 3;
    private readonly baseUrl: string;

    constructor(config?: Partial<ClientConfig>) {
        this.baseUrl = config?.baseUrl || 'https://api-externa.com';
        this.requestTimeoutMs = config?.requestTimeoutMs || 2000;
        this.resetTimeoutMs = config?.resetTimeoutMs || 5000;
        this.failureThreshold = config?.failureThreshold || 3;
    }

    /**
     * Obtiene datos de usuario
     * @param userId - ID del usuario a consultar
     * @returns Promise con los datos del usuario
     * @throws Error si el circuito está abierto o la petición falla
     */
    public async getUserData(userId: string): Promise<ApiResponse> {
        // Validación de entrada
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid userId: must be a non-empty string');
        }

        // Verificar si debemos transicionar de OPEN a HALF-OPEN
        this.checkStateTransition();

        // Lógica de la máquina de estados
        switch (this.state) {
            case 'OPEN':
                // Fail Fast: No llamar a la API, lanzar error inmediatamente
                throw new Error(
                    `Circuit breaker is OPEN. Service is temporarily unavailable. ` +
                    `Last failure: ${new Date(this.lastFailureTime).toISOString()}`
                );

            case 'HALF-OPEN':
                // Permitir UNA petición de prueba
                return this.attemptRequest(userId);

            case 'CLOSED':
                // Operación normal
                return this.attemptRequest(userId);

            default:
                // TypeScript debería prevenir esto, pero por seguridad
                throw new Error(`Invalid circuit state: ${this.state}`);
        }
    }

    /**
     * Verifica si debe transicionar de OPEN a HALF-OPEN
     */
    private checkStateTransition(): void {
        if (this.state === 'OPEN') {
            const timeElapsed = Date.now() - this.lastFailureTime;
            if (timeElapsed >= this.resetTimeoutMs) {
                this.state = 'HALF-OPEN';
            }
        }
    }

    /**
     * Intenta realizar la petición HTTP
     */
    private async attemptRequest(userId: string): Promise<ApiResponse> {
        try {
            const data = await this.callApi(userId);
            this.onSuccess();
            return data;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    /**
     * Realiza la llamada a la API con timeout
     */
    private async callApi(userId: string): Promise<ApiResponse> {
        // Implementar timeout con AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

        try {
            const response = await fetch(`${this.baseUrl}/users/${encodeURIComponent(userId)}`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // Validación HTTP: verificar que response.ok sea true (status 200-299)
            if (!response.ok) {
                throw new Error(
                    `HTTP Error: ${response.status} ${response.statusText}`
                );
            }

            // Parsing JSON con manejo de errores
            try {
                const data = await response.json() as ApiResponse;
                return data;
            } catch (parseError) {
                throw new Error(
                    `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
                );
            }
        } catch (error) {
            // Manejar timeout específicamente
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.requestTimeoutMs}ms`);
            }
            // Re-lanzar otros errores
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Maneja el éxito de una petición
     * Transiciones:
     * - HALF-OPEN -> CLOSED (petición de prueba exitosa)
     * - CLOSED -> CLOSED (operación normal)
     */
    private onSuccess(): void {
        if (this.state === 'HALF-OPEN') {
            // Petición de prueba exitosa: volver a CLOSED
            this.state = 'CLOSED';
            this.failureCount = 0;
        }
        // Si estamos en CLOSED, no hacer nada (operación normal)
    }

    /**
     * Maneja el fallo de una petición
     * Transiciones:
     * - CLOSED -> OPEN (si alcanza el umbral de fallos)
     * - HALF-OPEN -> OPEN (petición de prueba fallida)
     */
    private onFailure(error: unknown): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF-OPEN') {
            // Petición de prueba fallida: volver a OPEN
            this.state = 'OPEN';
        } else if (this.state === 'CLOSED') {
            // Verificar si alcanzamos el umbral de fallos
            if (this.failureCount >= this.failureThreshold) {
                // Transición CLOSED -> OPEN
                this.state = 'OPEN';
            }
        }
    }

    /**
     * Obtiene el estado actual del circuito (para debugging/monitoring)
     */
    public getState(): {
        state: CircuitState;
        failureCount: number;
        lastFailureTime: number;
    } {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
        };
    }

    /**
     * Resetea manualmente el circuito (útil para testing)
     */
    public reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}

// Exportar una instancia por defecto
export const resilientClient = new ResilientClient();
