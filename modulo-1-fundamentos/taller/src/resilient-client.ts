// ✅ CLIENTE RESILIENTE CON CIRCUIT BREAKER MANUAL
// Implementa el patrón Result<T, E> según Architecture.md

/**
 * Interfaz para la respuesta de pagos
 */
export interface PaymentResponse {
    status: 'success' | 'failure';
    transactionId: string;
}

/**
 * Estados posibles del Circuit Breaker
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

/**
 * Tipos de errores del Circuit Breaker
 */
export type CircuitBreakerError =
    | { type: 'CIRCUIT_OPEN'; retryInMs: number }
    | { type: 'TIMEOUT'; timeoutMs: number }
    | { type: 'SERVER_ERROR'; statusCode: number }
    | { type: 'HTTP_ERROR'; statusCode: number }
    | { type: 'NETWORK_ERROR'; message: string }
    | { type: 'PARSE_ERROR'; message: string };

/**
 * Patrón Result<T, E> para manejo de errores explícito
 * Cumple con Architecture.md: Elimina throw para errores de lógica
 */
export type Result<T, E> =
    | { success: true; value: T }
    | { success: false; error: E };

/**
 * Helper functions para crear Results
 */
export const Success = <T>(value: T): Result<T, never> => ({
    success: true,
    value,
});

export const Failure = <E>(error: E): Result<never, E> => ({
    success: false,
    error,
});

/**
 * Cliente resiliente con implementación manual del patrón Circuit Breaker
 * 
 * Estados:
 * - CLOSED: Funcionamiento normal, permite todas las peticiones
 * - OPEN: Circuito abierto, rechaza peticiones inmediatamente (fail-fast)
 * - HALF-OPEN: Permite una petición de prueba para verificar si el servicio se recuperó
 * 
 * Cumple con Architecture.md: No usa throw para errores de lógica, usa Result<T, E>
 */
export class ResilientClient {
    private state: CircuitState = 'CLOSED';
    private failureCount: number = 0;
    private readonly failureThreshold: number = 3;
    private readonly resetTimeoutMs: number = 5000;
    private readonly requestTimeoutMs: number = 4000;
    private lastFailureTime: number | null = null;

    /**
     * Procesa un pago de forma resiliente usando el patrón Circuit Breaker
     * 
     * @param paymentData - Datos del pago a procesar
     * @returns Result con PaymentResponse o CircuitBreakerError
     */
    async processPayment(
        paymentData: unknown
    ): Promise<Result<PaymentResponse, CircuitBreakerError>> {
        // Estado OPEN: Verificar si debe pasar a HALF-OPEN
        if (this.state === 'OPEN') {
            const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);

            if (timeSinceLastFailure < this.resetTimeoutMs) {
                // Fail-fast: Rechazar inmediatamente sin intentar la petición
                return Failure({
                    type: 'CIRCUIT_OPEN',
                    retryInMs: this.resetTimeoutMs - timeSinceLastFailure,
                });
            }

            // Tiempo de espera expirado: Pasar a HALF-OPEN para petición de prueba
            this.state = 'HALF-OPEN';
            console.log('Circuit breaker: OPEN → HALF-OPEN (attempting test request)');
        }

        // Ejecutar la petición HTTP con timeout
        const result = await this.executeRequest(paymentData);

        if (result.success) {
            // Petición exitosa: Resetear contador y cerrar circuito si estaba en HALF-OPEN
            this.onSuccess();
            return Success(result.value);
        } else {
            // Petición fallida: Incrementar contador y gestionar estado
            this.onFailure();
            return Failure(result.error);
        }
    }

    /**
     * Ejecuta la petición HTTP con timeout usando AbortController
     */
    private async executeRequest(
        paymentData: unknown
    ): Promise<Result<PaymentResponse, CircuitBreakerError>> {
        // Crear AbortController para implementar timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

        try {
            const response = await fetch('https://api-externa.com/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentData),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Verificar código de respuesta HTTP
            if (response.status >= 500) {
                return Failure({
                    type: 'SERVER_ERROR',
                    statusCode: response.status,
                });
            }

            if (!response.ok) {
                return Failure({
                    type: 'HTTP_ERROR',
                    statusCode: response.status,
                });
            }

            // Parsear respuesta JSON
            try {
                const data: PaymentResponse = await response.json();
                return Success(data);
            } catch (parseError) {
                return Failure({
                    type: 'PARSE_ERROR',
                    message: parseError instanceof Error ? parseError.message : 'Unknown parse error',
                });
            }
        } catch (error) {
            clearTimeout(timeoutId);

            // Distinguir entre timeout y otros errores
            if (error instanceof Error && error.name === 'AbortError') {
                return Failure({
                    type: 'TIMEOUT',
                    timeoutMs: this.requestTimeoutMs,
                });
            }

            return Failure({
                type: 'NETWORK_ERROR',
                message: error instanceof Error ? error.message : 'Unknown network error',
            });
        }
    }

    /**
     * Maneja el caso de éxito de una petición
     */
    private onSuccess(): void {
        // Resetear contador de fallos
        this.failureCount = 0;

        // Si estaba en HALF-OPEN, cerrar el circuito
        if (this.state === 'HALF-OPEN') {
            this.state = 'CLOSED';
            console.log('Circuit breaker: HALF-OPEN → CLOSED (service recovered)');
        }
    }

    /**
     * Maneja el caso de fallo de una petición
     */
    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF-OPEN') {
            // Si falla en HALF-OPEN, volver a OPEN
            this.state = 'OPEN';
            console.log('Circuit breaker: HALF-OPEN → OPEN (test request failed)');
        } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
            // Si alcanza el umbral de fallos en CLOSED, abrir el circuito
            this.state = 'OPEN';
            console.log(
                `Circuit breaker: CLOSED → OPEN (${this.failureCount} consecutive failures)`
            );
        }
    }

    /**
     * Obtiene el estado actual del circuito (útil para debugging y monitoreo)
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Obtiene el contador de fallos actual (útil para debugging y monitoreo)
     */
    getFailureCount(): number {
        return this.failureCount;
    }
}

// cambios completos
