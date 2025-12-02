import { CircuitBreakerState, CircuitBreakerError } from '../types/index.js';

interface StateTransition {
    onSuccess: CircuitBreakerState;
    onFailure: CircuitBreakerState;
    canExecute: boolean;
}

export class CircuitBreaker<T> {
    private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
    private failureCount = 0;
    private lastFailureTime: number | null = null;

    private readonly FAILURE_THRESHOLD = 3;
    private readonly TIMEOUT_DURATION = 5000;

    private readonly stateTransitions: Map<CircuitBreakerState, StateTransition> = new Map([
        [CircuitBreakerState.CLOSED, {
            onSuccess: CircuitBreakerState.CLOSED,
            onFailure: CircuitBreakerState.CLOSED,
            canExecute: true
        }],
        [CircuitBreakerState.OPEN, {
            onSuccess: CircuitBreakerState.OPEN,
            onFailure: CircuitBreakerState.OPEN,
            canExecute: false
        }],
        [CircuitBreakerState.HALF_OPEN, {
            onSuccess: CircuitBreakerState.CLOSED,
            onFailure: CircuitBreakerState.OPEN,
            canExecute: true
        }]
    ]);

    async execute(operation: () => Promise<T>): Promise<T> {
        this.checkAndUpdateState();

        const transition = this.stateTransitions.get(this.state)!;

        if (!transition.canExecute) {
            throw new CircuitBreakerError('Circuit breaker is OPEN - failing fast');
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private checkAndUpdateState(): void {
        if (this.state === CircuitBreakerState.OPEN && this.shouldAttemptReset()) {
            this.state = CircuitBreakerState.HALF_OPEN;
        }
    }

    private shouldAttemptReset(): boolean {
        if (this.lastFailureTime === null) return false;
        return Date.now() - this.lastFailureTime >= this.TIMEOUT_DURATION;
    }

    private onSuccess(): void {
        const transition = this.stateTransitions.get(this.state)!;
        this.state = transition.onSuccess;
        this.failureCount = 0;
        this.lastFailureTime = null;
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        const transition = this.stateTransitions.get(this.state)!;

        const shouldOpen = this.failureCount >= this.FAILURE_THRESHOLD;
        this.state = shouldOpen ? CircuitBreakerState.OPEN : transition.onFailure;
    }

    getState(): CircuitBreakerState {
        return this.state;
    }
}
