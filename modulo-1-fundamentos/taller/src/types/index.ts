export enum CircuitBreakerState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export interface User {
    id: string;
    name: string;
    email: string;
    [key: string]: unknown;
}

export class CircuitBreakerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CircuitBreakerError';
    }
}

export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

export class HttpError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = 'HttpError';
    }
}
