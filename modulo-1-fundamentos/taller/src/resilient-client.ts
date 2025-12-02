import { CircuitBreaker, CircuitBreakerState } from './utils/CircuitBreaker';

export interface UserData {
    id: string;
    name: string;
    email: string;
    [key: string]: any;
}

const REQUEST_TIMEOUT = 5000; 
const FAILURE_THRESHOLD = 3; 
const OPEN_STATE_TIMEOUT = 5000;

const circuitBreaker = new CircuitBreaker(FAILURE_THRESHOLD, OPEN_STATE_TIMEOUT);

export async function getUserData(userId: string): Promise<UserData | null> {
    if (!circuitBreaker.canRequest()) {
        console.error("Circuito abierto: solicitud bloqueada.");
        return null; 
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(`http://api-externa.com/users/${userId}`, {
            signal: controller.signal,
        });

        if (!response.ok) {
            console.error(`Error en la respuesta: ${response.status} ${response.statusText}`);
            circuitBreaker.recordFailure();
            return null;
        }

        const data: UserData = await response.json();
        circuitBreaker.recordSuccess();
        return data;
    } catch (error) {
        if (error.name === "AbortError") {
            console.error("La solicitud fue cancelada por timeout.");
        } else {
            console.error("Error en la solicitud:", error);
        }

        if (circuitBreaker.canRequest()) {
            circuitBreaker.recordFailure();
        } else if (circuitBreaker.getState() === CircuitBreakerState.HALF_OPEN) {
            circuitBreaker.recordHalfOpenFailure();
        }

        return null;
    } finally {
        clearTimeout(timeout);
    }
}