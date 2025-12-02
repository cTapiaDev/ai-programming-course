

// --- Types & Interfaces ---

export type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

export interface User {
    id: string;
    [key: string]: any;
}

interface CircuitBreakerState {
    execute<T>(action: () => Promise<T>): Promise<Result<T, Error>>;
}

// --- Concrete States ---

class ClosedState implements CircuitBreakerState {
    private failureCount = 0;
    private readonly FAILURE_THRESHOLD = 3;

    constructor(private context: ResilientClient) { }

    async execute<T>(action: () => Promise<T>): Promise<Result<T, Error>> {
        try {
            const result = await action();
            this.reset();
            return { ok: true, value: result };
        } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.FAILURE_THRESHOLD) {
                this.context.transitionToOpen();
            }
            return { ok: false, error: error as Error };
        }
    }

    private reset() {
        this.failureCount = 0;
    }
}

class OpenState implements CircuitBreakerState {
    private readonly RESET_TIMEOUT_MS = 5000;
    private openTime: number;

    constructor(private context: ResilientClient) {
        this.openTime = Date.now();
    }

    async execute<T>(action: () => Promise<T>): Promise<Result<T, Error>> {
        const now = Date.now();
        if (now - this.openTime >= this.RESET_TIMEOUT_MS) {
            this.context.transitionToHalfOpen();
            // In Half-Open, we allow the call to proceed. 
            // The state transition happens, but we need to delegate to the NEW state immediately.
            return this.context.getState().execute(action);
        }
        // Fail Fast
        return { ok: false, error: new Error("Circuit Breaker is OPEN") };
    }
}

class HalfOpenState implements CircuitBreakerState {
    private isTesting = false;

    constructor(private context: ResilientClient) { }

    async execute<T>(action: () => Promise<T>): Promise<Result<T, Error>> {
        // Only allow one request to pass through as a probe
        if (this.isTesting) {
            return { ok: false, error: new Error("Circuit Breaker is HALF-OPEN (Probe in progress)") };
        }

        this.isTesting = true;
        try {
            const result = await action();
            // If successful, close the circuit
            this.context.transitionToClosed();
            return { ok: true, value: result };
        } catch (error) {
            // If failed, reopen the circuit
            this.context.transitionToOpen();
            return { ok: false, error: error as Error };
        } finally {
            this.isTesting = false;
        }
    }
}

// --- Context ---

export class ResilientClient {
    private state: CircuitBreakerState;

    constructor() {
        this.state = new ClosedState(this);
    }

    // State Management
    public transitionToClosed() {
        console.log("Circuit Breaker State: CLOSED");
        this.state = new ClosedState(this);
    }

    public transitionToOpen() {
        console.log("Circuit Breaker State: OPEN");
        this.state = new OpenState(this);
    }

    public transitionToHalfOpen() {
        console.log("Circuit Breaker State: HALF-OPEN");
        this.state = new HalfOpenState(this);
    }

    public getState(): CircuitBreakerState {
        return this.state;
    }

    // Public API
    public async getUserData(userId: string): Promise<Result<User, Error>> {
        return this.state.execute(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s Timeout

            try {
                const response = await fetch(`https://api-externa.com/users/${userId}`, {
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                // Basic validation
                if (!data || typeof data !== 'object' || !data.id) {
                    throw new Error("Invalid response format");
                }

                return data as User;
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    throw new Error("Request timed out");
                }
                throw error;
            } finally {
                clearTimeout(timeoutId);
            }
        });
    }
}
