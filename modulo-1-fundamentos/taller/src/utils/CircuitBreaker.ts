export enum CircuitBreakerState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN",
}

export class CircuitBreaker {
    private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
    private failureCount = 0;
    private nextAttempt = Date.now();

    constructor(
        private readonly failureThreshold: number,
        private readonly openStateTimeout: number
    ) {}

    public canRequest(): boolean {
        if (this.state === CircuitBreakerState.OPEN && Date.now() > this.nextAttempt) {
            this.state = CircuitBreakerState.HALF_OPEN;
        }
        return this.state !== CircuitBreakerState.OPEN;
    }

    public recordFailure(): void {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitBreakerState.OPEN;
            this.nextAttempt = Date.now() + this.openStateTimeout;
            console.error("Circuito abierto: demasiados fallos consecutivos.");
        }
    }

    public recordSuccess(): void {
        this.failureCount = 0;
        this.state = CircuitBreakerState.CLOSED;
        console.log("Circuito cerrado: el sistema se ha recuperado.");
    }

    public recordHalfOpenFailure(): void {
        this.state = CircuitBreakerState.OPEN;
        this.nextAttempt = Date.now() + this.openStateTimeout;
        console.error("Circuito reabierto: fallo en estado HALF-OPEN.");
    }

    public getState(): CircuitBreakerState {
        return this.state;
    }
}