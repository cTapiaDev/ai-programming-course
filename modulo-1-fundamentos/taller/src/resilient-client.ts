// ✅ CÓDIGO RESILIENTE CON CIRCUIT BREAKER ✅

/**
 * Estados del Circuit Breaker
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Configuración del Circuit Breaker
 */
interface CircuitBreakerConfig {
    failureThreshold: number;    // Número de fallas consecutivas para abrir el circuito
    resetTimeout: number;         // Tiempo en ms para intentar recuperación (OPEN → HALF_OPEN)
    requestTimeout: number;       // Timeout por petición individual en ms
}

/**
 * Respuesta tipada de usuario de la API
 */
interface UserData {
    id: string;
    name: string;
    email: string;
    [key: string]: unknown;  // Campos adicionales opcionales
}

/**
 * Error personalizado del Circuit Breaker con contexto
 */
class CircuitBreakerError extends Error {
    constructor(
        message: string,
        public readonly state: CircuitState,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'CircuitBreakerError';
    }
}

/**
 * Implementación del patrón Circuit Breaker
 */
class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private readonly config: CircuitBreakerConfig;

    constructor(config: CircuitBreakerConfig) {
        this.config = config;
    }

    /**
     * Verifica si se puede ejecutar una petición según el estado del circuito
     */
    public canExecute(): boolean {
        // Si está OPEN, verificar si es momento de intentar recuperación
        if (this.state === 'OPEN') {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;

            // Después de resetTimeout, pasar a HALF_OPEN para probar
            if (timeSinceLastFailure >= this.config.resetTimeout) {
                this.state = 'HALF_OPEN';
                return true;
            }

            // Aún en OPEN, rechazar inmediatamente (Fail Fast)
            return false;
        }

        // CLOSED y HALF_OPEN permiten ejecución
        return true;
    }

    /**
     * Registra un éxito en la petición
     */
    public recordSuccess(): void {
        // Resetear contador de fallas
        this.failureCount = 0;

        // Si estaba en HALF_OPEN, volver a CLOSED (recuperación exitosa)
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
        }
    }

    /**
     * Registra una falla en la petición
     */
    public recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        // Si alcanzamos el umbral de fallas, abrir el circuito
        if (this.failureCount >= this.config.failureThreshold) {
            this.state = 'OPEN';
        }

        // Si estábamos en HALF_OPEN y falló la prueba, volver a OPEN
        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
        }
    }

    /**
     * Obtiene el estado actual del circuito
     */
    public getState(): CircuitState {
        return this.state;
    }

    /**
     * Obtiene el contador de fallas actual
     */
    public getFailureCount(): number {
        return this.failureCount;
    }
}

/**
 * Instancia global del Circuit Breaker con configuración específica
 */
const circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,      // 3 fallas consecutivas
    resetTimeout: 5000,       // 5 segundos antes de probar recuperación
    requestTimeout: 5000      // 5 segundos de timeout por petición
});

/**
 * Realiza una petición fetch con timeout configurable
 * @param url - URL a la que hacer la petición
 * @param timeout - Tiempo máximo de espera en ms
 * @returns Respuesta de la petición
 * @throws Error si se excede el timeout o falla la petición
 */
async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    // Usar AbortController para implementar timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);

        // Distinguir entre timeout y otros errores
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms for ${url}`);
        }

        throw error;
    }
}

/**
 * Obtiene los datos de un usuario aplicando el patrón Circuit Breaker
 * @param userId - ID del usuario a consultar
 * @returns Datos del usuario
 * @throws CircuitBreakerError si el circuito está abierto
 * @throws Error si la petición falla
 */
export async function getUserData(userId: string): Promise<UserData> {
    // Verificar si el Circuit Breaker permite ejecutar la petición
    if (!circuitBreaker.canExecute()) {
        throw new CircuitBreakerError(
            'Circuit breaker is OPEN. Request rejected to protect the system.',
            circuitBreaker.getState(),
            {
                userId,
                failureCount: circuitBreaker.getFailureCount(),
                hint: 'The external service is experiencing issues. Please try again later.'
            }
        );
    }

    try {
        // Realizar petición con timeout
        const response = await fetchWithTimeout(
            `https://api-externa.com/users/${userId}`,
            circuitBreaker['config'].requestTimeout
        );

        // Validar código de estado HTTP
        if (!response.ok) {
            throw new Error(
                `HTTP Error: ${response.status} ${response.statusText} for user ${userId}`
            );
        }

        // Obtener texto de respuesta
        const responseText = await response.text();

        // Parsear JSON de forma segura con try-catch
        let userData: UserData;
        try {
            userData = JSON.parse(responseText) as UserData;
        } catch (parseError) {
            throw new Error(
                `Failed to parse JSON response for user ${userId}. Response: ${responseText.substring(0, 100)}`
            );
        }

        // Validar estructura mínima de datos
        if (!userData.id || !userData.name || !userData.email) {
            throw new Error(
                `Invalid user data structure for user ${userId}. Missing required fields: id, name, or email.`
            );
        }

        // ✅ Éxito: registrar en el Circuit Breaker
        circuitBreaker.recordSuccess();

        return userData;

    } catch (error) {
        // ❌ Falla: registrar en el Circuit Breaker
        circuitBreaker.recordFailure();

        // Propagar error con contexto mejorado
        if (error instanceof CircuitBreakerError) {
            throw error;
        }

        if (error instanceof Error) {
            throw new Error(
                `Failed to fetch user data for userId="${userId}". ` +
                `Circuit State: ${circuitBreaker.getState()}. ` +
                `Failure Count: ${circuitBreaker.getFailureCount()}/${circuitBreaker['config'].failureThreshold}. ` +
                `Reason: ${error.message}`
            );
        }

        throw new Error(`Unknown error fetching user ${userId}`);
    }
}

