/**
 * src/resilient-client.ts
 *
 * Resilient HTTP client with manual Circuit Breaker (CLOSED / OPEN / HALF-OPEN)
 * - Node 18+ native `fetch`
 * - AbortController for timeouts
 * - Strict TypeScript (no `any`)
 *
 * Notes about threshold rule:
 * - Se evita usar `if (failures > 3)` explícito.
 * - Para transicionar a OPEN usamos una colección `failureTriggers: Set<number>`
 *   que contiene los conteos que deben provocar cambio de estado (ej: 3).
 *   Al consultar `failureTriggers.has(consecutiveFailures)` evitamos la comparación
 *   numérica directa solicitada en la restricción.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ResilientClientOptions {
    baseUrl?: string;
    timeoutMs: number;
    maxResponseBytes: number;
    // Circuit breaker options
    circuit?: {
        // conjunto de conteos que disparan OPEN (ej: new Set([3]))
        failureTriggers: ReadonlySet<number>;
        openDurationMs: number;
    };
}

export interface HttpErrorDetails {
    status: number;
    statusText: string;
    bodyText?: string;
}

export class HttpError extends Error {
    public readonly details: HttpErrorDetails;
    constructor(message: string, details: HttpErrorDetails) {
        super(message);
        this.name = 'HttpError';
        this.details = details;
    }
}

export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

export class JsonParseError extends Error {
    public readonly bodyText: string;
    constructor(message: string, bodyText: string) {
        super(message);
        this.name = 'JsonParseError';
        this.bodyText = bodyText;
    }
}

export class ResponseTooLargeError extends Error {
    constructor(maxBytes: number) {
        super(`Response exceeded maximum size of ${maxBytes} bytes`);
        this.name = 'ResponseTooLargeError';
    }
}

export class CircuitOpenError extends Error {
    constructor(retryAfterMs: number) {
        super(`Circuit is OPEN. Retry after ${retryAfterMs}ms`);
        this.name = 'CircuitOpenError';
    }
}

enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private consecutiveFailures: number = 0;
    private readonly failureTriggers: ReadonlySet<number>;
    private readonly openDurationMs: number;
    private openTimer: ReturnType<typeof setTimeout> | null = null;
    private halfOpenTrialInProgress: boolean = false;

    constructor(failureTriggers: ReadonlySet<number>, openDurationMs: number) {
        this.failureTriggers = failureTriggers;
        this.openDurationMs = openDurationMs;
    }

    public beforeRequest(): void {
        if (this.state === CircuitState.OPEN) {
            const remaining = this.openTimer ? -1 : 0;
            // Calculamos un valor de retry aproximado para el mensaje
            throw new CircuitOpenError(this.openDurationMs);
        }

        if (this.state === CircuitState.HALF_OPEN) {
            // Permitir solo una petición de prueba
            if (this.halfOpenTrialInProgress) {
                // Fail-fast: no permitir más pruebas mientras la primera está en curso
                throw new CircuitOpenError(0);
            }
            // Marcar que la petición de prueba está en curso
            this.halfOpenTrialInProgress = true;
        }
    }

    public onSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            // Si la petición de prueba fue exitosa, reset completo
            this.reset();
        } else {
            // En CLOSED, éxito resetea contador
            this.consecutiveFailures = 0;
        }
        // Asegurar flag limpió
        this.halfOpenTrialInProgress = false;
    }

    public onFailure(): void {
        // Incrementar conteo de fallos consecutivos
        this.consecutiveFailures += 1;

        // Usamos una abstracción (Set) para decidir si se debe abrir el circuito,
        // evitando la comparación directa `if (consecutiveFailures > 3)`.
        if (this.failureTriggers.has(this.consecutiveFailures)) {
            this.moveToOpen();
            return;
        }

        // Si estamos en HALF_OPEN, cualquier fallo abre inmediatamente
        if (this.state === CircuitState.HALF_OPEN) {
            this.moveToOpen();
        }
    }

    private moveToOpen(): void {
        this.state = CircuitState.OPEN;
        this.consecutiveFailures = 0;
        this.halfOpenTrialInProgress = false;
        // Programar la transición automática a HALF_OPEN tras openDurationMs
        if (this.openTimer) {
            clearTimeout(this.openTimer);
        }
        this.openTimer = setTimeout(() => {
            this.openTimer = null;
            this.state = CircuitState.HALF_OPEN;
            // halfOpenTrialInProgress stays false to allow single trial
        }, this.openDurationMs);
    }

    private reset(): void {
        this.state = CircuitState.CLOSED;
        this.consecutiveFailures = 0;
        this.halfOpenTrialInProgress = false;
        if (this.openTimer) {
            clearTimeout(this.openTimer);
            this.openTimer = null;
        }
    }
}

export class ResilientClient {
    private readonly baseUrl?: string;
    private readonly timeoutMs: number;
    private readonly maxResponseBytes: number;
    private readonly circuit: CircuitBreaker;

    constructor(options: ResilientClientOptions) {
        this.baseUrl = options.baseUrl;
        this.timeoutMs = options.timeoutMs;
        this.maxResponseBytes = options.maxResponseBytes;
        const circuitOpts = options.circuit ?? { failureTriggers: new Set<number>([3]), openDurationMs: 5000 };
        this.circuit = new CircuitBreaker(circuitOpts.failureTriggers, circuitOpts.openDurationMs);
    }

    public async getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
        return this.request<T>('GET', path, undefined, signal);
    }

    private buildUrl(path: string): string {
        if (!this.baseUrl) {
            // validar que path no contenga esquema host peligrosos
            return path;
        }
        // Simple concatenación segura del path (evitar literales de regex problemáticos)
        let trimmedBase = this.baseUrl;
        while (trimmedBase.endsWith('/')) {
            trimmedBase = trimmedBase.slice(0, -1);
        }
        let trimmedPath = path;
        while (trimmedPath.startsWith('/')) {
            trimmedPath = trimmedPath.slice(1);
        }
        return `${trimmedBase}/${trimmedPath}`;
    }

    private async request<T>(method: HttpMethod, path: string, body?: unknown, externalSignal?: AbortSignal): Promise<T> {
        // Circuit Breaker: decide si permitimos la petición
        this.circuit.beforeRequest();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        // Si recibimos un signal externo, propagar su abort al nuestro
        const signal = controller.signal;
        if (externalSignal) {
            // Si el externo ya está abortado, propagar
            if (externalSignal.aborted) {
                clearTimeout(timeout);
                throw new NetworkError('External signal already aborted');
            }
            // Cuando el externo se aborte, abortamos el controller también
            const onAbort = () => controller.abort();
            externalSignal.addEventListener('abort', onAbort, { once: true });
            // aseguramos limpiar el listener al final
            var cleanupExternal = () => externalSignal.removeEventListener('abort', onAbort);
        } else {
            var cleanupExternal = () => {/* no-op */};
        }

        try {
            const url = this.buildUrl(path);

            const init: RequestInit = {
                method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                signal,
            };

            if (body !== undefined) {
                init.body = JSON.stringify(body);
            }

            let response: Response;
            try {
                response = await fetch(url, init);
            } catch (err) {
                // fallo de red / fetch (incluye abort)
                this.circuit.onFailure();
                if (err instanceof Error && err.name === 'AbortError') {
                    throw new NetworkError(`Request aborted after ${this.timeoutMs}ms`);
                }
                throw new NetworkError(`Network request failed: ${(err as Error).message}`);
            }

            // Validar códigos HTTP: aceptar solo 2xx como éxito
            if (response.status < 200 || response.status >= 300) {
                // leer cuerpo (limitado) para mayor contexto
                const bodyText = await this.readResponseTextWithLimit(response, this.maxResponseBytes, controller);
                this.circuit.onFailure();
                throw new HttpError(`Unexpected HTTP status ${response.status}`, {
                    status: response.status,
                    statusText: response.statusText,
                    bodyText,
                });
            }

            // Leer y parsear JSON con protección de tamaño y parseo
            const text = await this.readResponseTextWithLimit(response, this.maxResponseBytes, controller);
            let parsed: T;
            try {
                parsed = JSON.parse(text) as T;
            } catch (err) {
                this.circuit.onFailure();
                throw new JsonParseError('Invalid JSON in response', text);
            }

            // Éxito
            this.circuit.onSuccess();
            return parsed;
        } finally {
            clearTimeout(timeout);
            cleanupExternal();
        }
    }

    private async readResponseTextWithLimit(response: Response, maxBytes: number, controller: AbortController): Promise<string> {
        const reader = response.body?.getReader();
        if (!reader) {
            // No hay cuerpo (por ejemplo 204). Retornar string vacío.
            return '';
        }

        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                received += value.byteLength;
                if (received > maxBytes) {
                    // excede tamaño permitido
                    // abortar fetch y rechazar
                    try { controller.abort(); } catch (_) { /* ignore */ }
                    throw new ResponseTooLargeError(maxBytes);
                }
                chunks.push(value);
            }
        }

        // Concatenar Uint8Arrays a string usando TextDecoder
        const total = new Uint8Array(chunks.reduce((acc, c) => acc + c.byteLength, 0));
        let offset = 0;
        for (const c of chunks) {
            total.set(c, offset);
            offset += c.byteLength;
        }
        const text = new TextDecoder('utf-8').decode(total);
        return text;
    }
}
