import { CircuitBreaker } from '../circuit-breaker/circuit-breaker.js';
import { ResilientClient } from '../http/resilient-client.js';
import { User } from '../types/index.js';
import { config } from '../config/env.js';

export class UserService {
    private circuitBreaker: CircuitBreaker<User>;
    private httpClient: ResilientClient;

    constructor(baseUrl: string = config.apiBaseUrl) {
        this.circuitBreaker = new CircuitBreaker<User>();
        this.httpClient = new ResilientClient({
            baseUrl,
            timeout: config.apiTimeout,
            maxRetries: config.maxRetries,
            retryDelay: config.retryDelay
        });
    }

    async getUserData(userId: string): Promise<User> {
        return this.circuitBreaker.execute(async () => {
            return this.httpClient.get<User>(`/users/${userId}`);
        });
    }

    getCircuitState() {
        return this.circuitBreaker.getState();
    }
}
