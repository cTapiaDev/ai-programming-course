
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

interface ClientConfig {
    timeoutMs?: number;
    failureThreshold?: number;
    resetTimeoutMs?: number;
}

export class ResilientClient {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private lastFailureTime = 0;
    private readonly timeoutMs: number;
    private readonly failureThreshold: number;
    private readonly resetTimeoutMs: number;

    constructor(config: ClientConfig = {}) {
        this.timeoutMs = config.timeoutMs ?? 3000;
        this.failureThreshold = config.failureThreshold ?? 3;
        this.resetTimeoutMs = config.resetTimeoutMs ?? 5000;
    }

    public async getUserData<T>(userId: string): Promise<T | null> {
        // Check Circuit State
        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime > this.resetTimeoutMs) {
                this.transitionTo('HALF-OPEN'); // OPEN -> HALF-OPEN: Reset timeout passed
            } else {
                throw new Error('Circuit is OPEN: Fast-fail enabled'); // Fail-fast
            }
        }

        try {
            const data = await this.fetchWithTimeout<T>(`https://api-externa.com/users/${encodeURIComponent(userId)}`);

            if (this.state === 'HALF-OPEN') {
                this.transitionTo('CLOSED'); // HALF-OPEN -> CLOSED: Probe successful
            }
            this.resetFailures();
            return data;

        } catch (error) {
            this.handleFailure();
            // Re-throw error to caller, or return null if we want to mimic legacy behavior but safely?
            // The requirement says "Regla de Fail-Fast (OPEN): ... debe lanzar un error".
            // So I should probably throw the error here too or let it bubble up, 
            // but the legacy client returned null on error. 
            // However, the prompt says "Refactor... due to lack of error handling". 
            // And "Fail-fast... must throw an error". 
            // So I will throw the error.
            throw error;
        }
    }

    private async fetchWithTimeout<T>(url: string): Promise<T> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(url, { signal: controller.signal });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            return await response.json() as T;
        } finally {
            clearTimeout(id);
        }
    }

    private handleFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF-OPEN') {
            this.transitionTo('OPEN'); // HALF-OPEN -> OPEN: Probe failed
        } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
            this.transitionTo('OPEN'); // CLOSED -> OPEN: Threshold reached
        }
    }

    private resetFailures() {
        this.failureCount = 0;
    }

    private transitionTo(newState: CircuitState) {
        console.log(`Transitioning from ${this.state} to ${newState}`);
        this.state = newState;
        if (newState === 'OPEN') {
            this.lastFailureTime = Date.now(); // Start reset timer
        } else if (newState === 'CLOSED') {
            this.failureCount = 0;
        }
    }
}
