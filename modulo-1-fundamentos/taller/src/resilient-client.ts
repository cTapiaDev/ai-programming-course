import { setTimeout } from 'timers/promises';

// Definición de los estados del Circuit Breaker
type BreakerState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

// Tipo de dato que esperamos de la API externa
interface User {
    id: number;
    name: string;
    email: string;
}

// Clase de error personalizada para el Circuit Breaker
class CircuitBreakerOpenError extends Error {
    constructor(message = 'Circuit Breaker is OPEN. Failing fast.') {
        super(message);
        this.name = 'CircuitBreakerOpenError';
    }
}

/**
 * Cliente Resiliente que implementa el patrón Circuit Breaker de forma manual.
 * Utiliza fetch nativo y AbortController para timeouts.
 */
export class ResilientClient {
    // === CONFIGURACIÓN DEL BREAKER ===
    private readonly FAILURE_THRESHOLD = 3;
    private readonly RESET_TIMEOUT_MS = 5000; // 5 segundos
    private readonly FETCH_TIMEOUT_MS = 3000; // 3 segundos

    // === ESTADO INTERNO DEL BREAKER ===
    private state: BreakerState = 'CLOSED';
    private failureCount = 0;
    private lastFailureTime = 0;

    /**
     * Lógica principal del Circuit Breaker:
     * 1. Verifica el estado y aplica la política de fallo rápido (Fail Fast).
     * 2. Si está en HALF-OPEN, permite la petición de prueba.
     * 3. Si está en CLOSED, permite la petición normal.
     */
    private async execute<T>(action: () => Promise<T>): Promise<T> {
        const now = Date.now();
        
        // 1. Lógica del Estado OPEN (incluyendo transición a HALF-OPEN)
        if (this.state === 'OPEN') {
            if (now > this.lastFailureTime + this.RESET_TIMEOUT_MS) {
                // Ha expirado el tiempo de espera, pasar a HALF-OPEN
                this.state = 'HALF-OPEN';
                console.warn('Circuit Breaker: Transición a HALF-OPEN. Intentando petición de prueba...');
            } else {
                // Si aún está dentro del tiempo de espera, fallo rápido
                throw new CircuitBreakerOpenError();
            }
        }

        // 2. Lógica de Petición
        try {
            const result = await action();
            
            // Si la petición es exitosa:
            this.success(); // Intenta RESETEAR el circuito
            return result;
        } catch (error) {
            
            // Si la petición falla:
            this.failure(); // Activa el conteo de fallos y la transición a OPEN
            throw error;
        }
    }

    /**
     * Registra un fallo de la petición, actualizando el estado del Circuit Breaker.
     * Si se supera el umbral, transiciona a OPEN.
     */
    private failure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        console.error(`Circuit Breaker: Fallo detectado. Conteo actual: ${this.failureCount}.`);

        if (this.state === 'HALF-OPEN') {
            // Falla la petición de prueba, volvemos inmediatamente a OPEN
            this.state = 'OPEN';
            console.error('Circuit Breaker: La petición de prueba falló. Volviendo a OPEN.');
            
        } else if (this.state === 'CLOSED' && this.failureCount >= this.FAILURE_THRESHOLD) {
            // Fallo en estado CLOSED supera el umbral, transición a OPEN
            this.state = 'OPEN';
            console.error(`Circuit Breaker: Umbral de ${this.FAILURE_THRESHOLD} fallos alcanzado. ¡CIRCUITO ABIERTO!`);
        }
    }

    /**
     * Registra un éxito de la petición, reseteando el Circuit Breaker a CLOSED.
     */
    private success(): void {
        if (this.state === 'HALF-OPEN') {
            // Éxito en la petición de prueba, volver a CLOSED
            console.info('Circuit Breaker: Petición de prueba exitosa. Circuito RESETEADO a CLOSED.');
        } else if (this.state === 'CLOSED') {
            // Éxito en estado CLOSED, simplemente reseteamos el contador
            // No hacemos nada si el estado es OPEN (debería ser imposible llegar aquí)
        }
        
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    /**
     * Refactorización de la función original para obtener datos de usuario.
     * Utiliza el Circuit Breaker y fetch con timeout.
     * @param userId ID del usuario.
     * @returns Promesa con los datos del usuario.
     */
    public async getUserData(userId: string | number): Promise<User | null> {
        // Validación de la entrada básica (Seguridad S1)
        if (!userId) {
            throw new Error('userId is required.');
        }

        const url = `https://api-externa.com/users/${encodeURIComponent(userId)}`;
        
        // La lógica de la petición (fetch con timeout)
        const fetchAction = async (): Promise<User> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(this.FETCH_TIMEOUT_MS, 'timeout');
            
            // Configurar el controlador para abortar después del timeout
            timeoutId.then(() => controller.abort()).catch(() => {}); 

            try {
                // FALLO 1 corregido: Implementación de Timeout (P1)
                const res = await fetch(url, { signal: controller.signal });
                
                // Limpiar el timeout si la petición finaliza antes
                clearTimeout(timeoutId as unknown as NodeJS.Timeout); 

                // Corregido S2: Manejo explícito de Códigos de Estado
                if (!res.ok) {
                    console.error(`Error HTTP: ${res.status} al obtener datos para ${userId}`);
                    // Rechaza explícitamente la promesa, no la resuelve con null (P2)
                    throw new Error(`External API Error: ${res.status} ${res.statusText}`);
                }

                const data = await res.text();
                
                // Corregido P3: Manejo de errores de JSON.parse usando try/catch
                try {
                    // M2 corregido: Tipado explícito del retorno
                    const user = JSON.parse(data) as User;
                    return user;
                } catch (parseError) {
                    console.error('Error al parsear JSON:', parseError);
                    throw new Error('Invalid JSON response from external API');
                }

            } catch (error) {
                // Si la causa es el timeout, lanzamos un error específico
                if (controller.signal.aborted) {
                    throw new Error(`Fetch timeout after ${this.FETCH_TIMEOUT_MS}ms`);
                }
                
                // Otros errores de red/fetch
                throw error;

            } finally {
                // Asegurarse de que el timer siempre se limpie en caso de éxito/fallo
                clearTimeout(timeoutId as unknown as NodeJS.Timeout); 
            }
        };

        // Envolvemos la petición con la lógica del Circuit Breaker (Lógica Prohibida Manualmente)
        try {
            return await this.execute(fetchAction);
        } catch (error) {
            // Aquí se capturan tanto los errores del Breaker (Fail Fast) como los errores de la petición real.
            // Corregido P2 y M4: Log útil y rechazo del error.
            console.error(`[Circuit Breaker Failure] No se pudieron obtener datos para el usuario ${userId}. Estado: ${this.state}`, error);
            
            // Devolver null si el caller lo espera, pero primero loguear y rechazar el flujo interno.
            return null;
        }
    }

    /**
     * Método de conveniencia para exponer el estado actual del Circuit Breaker.
     */
    public getBreakerState(): BreakerState {
        return this.state;
    }
}