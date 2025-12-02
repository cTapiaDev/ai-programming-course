import { TimeoutError, HttpError } from '../types/index.js';

export interface ResilientClientConfig {
    timeout?: number;
    baseUrl?: string;
    maxRetries?: number;
    retryDelay?: number;
}

export class ResilientClient {
    private readonly timeout: number;
    private readonly baseUrl: string;
    private readonly maxRetries: number;
    private readonly retryDelay: number;

    constructor(config: ResilientClientConfig = {}) {
        this.timeout = config.timeout ?? 5000;
        this.baseUrl = config.baseUrl ?? '';
        this.maxRetries = config.maxRetries ?? 3;
        this.retryDelay = config.retryDelay ?? 1000;
    }


    async get<T>(path: string): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.executeRequest<T>(path);
            } catch (error) {
                lastError = error as Error;

                const isLastAttempt = attempt === this.maxRetries;
                if (isLastAttempt) {
                    break;
                }

                const shouldRetry = this.isRetryableError(error);
                if (!shouldRetry) {
                    throw error;
                }

                const delay = this.calculateBackoff(attempt);
                await this.sleep(delay);
            }
        }

        throw lastError!;
    }

    private async executeRequest<T>(path: string): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const url = this.baseUrl ? `${this.baseUrl}${path}` : path;
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new HttpError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status
                );
            }

            const text = await response.text();

            try {
                return JSON.parse(text) as T;
            } catch (parseError) {
                throw new HttpError('Invalid JSON response');
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new TimeoutError(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private isRetryableError(error: unknown): boolean {
        if (error instanceof TimeoutError) {
            return true;
        }

        if (error instanceof HttpError) {
            const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
            return error.statusCode ? retryableStatusCodes.includes(error.statusCode) : false;
        }

        return false;
    }

    private calculateBackoff(attempt: number): number {
        return this.retryDelay * Math.pow(2, attempt);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
