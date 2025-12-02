/**
 * Tests para Resilient HTTP Client con Circuit Breaker
 * Valida el comportamiento de los 3 estados y las transiciones
 */

import {
    ResilientHttpClient,
    CircuitState,
    type CircuitBreakerResult,
    type UserData
} from './resilient-client.js';

// ============================================================================
// MOCK DE FETCH PARA TESTING
// ============================================================================

type FetchMockBehavior = 'success' | 'failure' | 'timeout' | 'invalid-json';

class FetchMock {
    private behavior: FetchMockBehavior = 'success';
    private callCount = 0;

    setBehavior(behavior: FetchMockBehavior): void {
        this.behavior = behavior;
        this.callCount = 0;
    }

    getCallCount(): number {
        return this.callCount;
    }

    async fetch(url: string, options?: RequestInit): Promise<Response> {
        this.callCount++;

        // Simular timeout
        if (this.behavior === 'timeout') {
            await new Promise(resolve => setTimeout(resolve, 15000));
        }

        // Simular error de red
        if (this.behavior === 'failure') {
            throw new Error('Network error: Connection refused');
        }

        // Simular respuesta exitosa
        if (this.behavior === 'success') {
            const userData: UserData = {
                id: 'user123',
                name: 'John Doe',
                email: 'john@example.com'
            };

            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => JSON.stringify(userData),
                json: async () => userData
            } as Response;
        }

        // Simular JSON inválido
        if (this.behavior === 'invalid-json') {
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => '<html>Not JSON</html>',
                json: async () => { throw new Error('Invalid JSON'); }
            } as Response;
        }

        throw new Error('Unknown mock behavior');
    }
}

// ============================================================================
// SUITE DE TESTS
// ============================================================================

class TestRunner {
    private passedTests = 0;
    private failedTests = 0;
    private fetchMock = new FetchMock();

    constructor() {
        // Reemplazar fetch global con el mock
        (global as any).fetch = this.fetchMock.fetch.bind(this.fetchMock);
    }

    private assert(condition: boolean, message: string): void {
        if (condition) {
            console.log(`  ✅ ${message}`);
            this.passedTests++;
        } else {
            console.error(`  ❌ ${message}`);
            this.failedTests++;
        }
    }

    private assertEqual<T>(actual: T, expected: T, message: string): void {
        this.assert(actual === expected, `${message} (esperado: ${expected}, obtenido: ${actual})`);
    }

    // ==========================================================================
    // TEST 1: Estado inicial debe ser CLOSED
    // ==========================================================================

    async test1_EstadoInicialClosed(): Promise<void> {
        console.log('\n📝 TEST 1: Estado inicial debe ser CLOSED');

        const client = new ResilientHttpClient();
        this.assertEqual(
            client.getCircuitState(),
            CircuitState.CLOSED,
            'Estado inicial es CLOSED'
        );
    }

    // ==========================================================================
    // TEST 2: Petición exitosa en estado CLOSED
    // ==========================================================================

    async test2_PeticionExitosaClosed(): Promise<void> {
        console.log('\n📝 TEST 2: Petición exitosa en estado CLOSED');

        this.fetchMock.setBehavior('success');
        const client = new ResilientHttpClient();

        const result = await client.getUserData('user123');

        this.assert(result.success, 'La petición fue exitosa');
        this.assert(result.data !== undefined, 'Se recibieron datos');
        this.assertEqual(result.data?.id, 'user123', 'ID del usuario es correcto');
        this.assertEqual(
            client.getCircuitState(),
            CircuitState.CLOSED,
            'El circuito permanece CLOSED'
        );
    }

    // ==========================================================================
    // TEST 3: Validación de entrada rechaza caracteres inválidos
    // ==========================================================================

    async test3_ValidacionEntrada(): Promise<void> {
        console.log('\n📝 TEST 3: Validación de entrada');

        const client = new ResilientHttpClient();

        // Intentar con caracteres inválidos
        const result1 = await client.getUserData('../admin');
        this.assert(!result1.success, 'Rechaza path traversal');
        this.assert(
            result1.error?.message.includes('Invalid userId format'),
            'Mensaje de error correcto para formato inválido'
        );

        // Intentar con ID vacío
        const result2 = await client.getUserData('');
        this.assert(!result2.success, 'Rechaza ID vacío');

        // Intentar con ID demasiado largo
        const result3 = await client.getUserData('a'.repeat(150));
        this.assert(!result3.success, 'Rechaza ID demasiado largo');

        // ID válido debe pasar
        this.fetchMock.setBehavior('success');
        const result4 = await client.getUserData('user-123_valid');
        this.assert(result4.success, 'Acepta ID válido con guiones y guiones bajos');
    }

    // ==========================================================================
    // TEST 4: Transición a OPEN después de 3 fallos consecutivos
    // ==========================================================================

    async test4_TransicionAOpen(): Promise<void> {
        console.log('\n📝 TEST 4: Transición a OPEN después de 3 fallos');

        this.fetchMock.setBehavior('failure');
        const client = new ResilientHttpClient({
            failureThreshold: 3,
            resetTimeout: 5000,
            requestTimeout: 2000
        });

        // Provocar 3 fallos consecutivos
        await client.getUserData('user1');
        this.assertEqual(
            client.getCircuitState(),
            CircuitState.CLOSED,
            'Después de 1 fallo: CLOSED'
        );

        await client.getUserData('user2');
        this.assertEqual(
            client.getCircuitState(),
            CircuitState.CLOSED,
            'Después de 2 fallos: CLOSED'
        );

        await client.getUserData('user3');
        this.assertEqual(
            client.getCircuitState(),
            CircuitState.OPEN,
            'Después de 3 fallos: OPEN'
        );

        const metrics = client.getMetrics();
        this.assertEqual(metrics.failedRequests, 3, 'Contador de fallos es 3');
        this.assertEqual(metrics.circuitOpenCount, 1, 'El circuito se abrió 1 vez');
    }

    // ==========================================================================
    // TEST 5: Fail Fast cuando el circuito está OPEN
    // ==========================================================================

    async test5_FailFastEnOpen(): Promise<void> {
        console.log('\n📝 TEST 5: Fail Fast cuando el circuito está OPEN');

        this.fetchMock.setBehavior('failure');
        const client = new ResilientHttpClient({
            failureThreshold: 3,
            resetTimeout: 5000,
            requestTimeout: 2000
        });

        // Abrir el circuito con 3 fallos
        await client.getUserData('user1');
        await client.getUserData('user2');
        await client.getUserData('user3');

        const callCountBefore = this.fetchMock.getCallCount();

        // Intentar petición con circuito OPEN
        const result = await client.getUserData('user4');

        const callCountAfter = this.fetchMock.getCallCount();

        this.assert(!result.success, 'La petición falla');
        this.assert(
            result.error?.message.includes('Circuit Breaker is OPEN'),
            'Mensaje de error indica circuito abierto'
        );
        this.assertEqual(
            callCountBefore,
            callCountAfter,
            'NO se realizó llamada a la API (Fail Fast)'
        );
    }

    // ==========================================================================
    // TEST 6: Transición a HALF_OPEN después del timeout
    // ==========================================================================

    async test6_TransicionAHalfOpen(): Promise<void> {
        console.log('\n📝 TEST 6: Transición a HALF_OPEN después del timeout');

        this.fetchMock.setBehavior('failure');
        const client = new ResilientHttpClient({
            failureThreshold: 3,
            resetTimeout: 2000, // 2 segundos para acelerar el test
            requestTimeout: 2000
        });

        // Abrir el circuito
        await client.getUserData('user1');
        await client.getUserData('user2');
        await client.getUserData('user3');

        this.assertEqual(client.getCircuitState(), CircuitState.OPEN, 'Circuito está OPEN');

        // Esperar el timeout
        console.log('  ⏳ Esperando 2.1 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2100));

        // La próxima petición debe transicionar a HALF_OPEN
        this.fetchMock.setBehavior('success');
        const result = await client.getUserData('user4');

        this.assert(result.success, 'Petición de prueba exitosa');
        this.assertEqual(
            client.getCircuitState(),
            CircuitState.CLOSED,
            'Circuito se cerró después de petición exitosa en HALF_OPEN'
        );
    }

    // ==========================================================================
    // TEST 7: Volver a OPEN si falla en HALF_OPEN
    // ==========================================================================

    async test7_VolverAOpenDesdHalfOpen(): Promise<void> {
        console.log('\n📝 TEST 7: Volver a OPEN si falla en HALF_OPEN');

        this.fetchMock.setBehavior('failure');
        const client = new ResilientHttpClient({
            failureThreshold: 3,
            resetTimeout: 2000,
            requestTimeout: 2000
        });

        // Abrir el circuito
        await client.getUserData('user1');
        await client.getUserData('user2');
        await client.getUserData('user3');

        // Esperar el timeout
        await new Promise(resolve => setTimeout(resolve, 2100));

        // Petición de prueba que fallará
        const result = await client.getUserData('user4');

        this.assert(!result.success, 'Petición de prueba falló');
        this.assertEqual(
            client.getCircuitState(),
            CircuitState.OPEN,
            'Circuito vuelve a OPEN después de fallo en HALF_OPEN'
        );
    }

    // ==========================================================================
    // TEST 8: Reset de contador de fallos después de éxito
    // ==========================================================================

    async test8_ResetContadorFallos(): Promise<void> {
        console.log('\n📝 TEST 8: Reset de contador de fallos después de éxito');

        const client = new ResilientHttpClient({
            failureThreshold: 3,
            resetTimeout: 5000,
            requestTimeout: 2000
        });

        // 2 fallos
        this.fetchMock.setBehavior('failure');
        await client.getUserData('user1');
        await client.getUserData('user2');

        this.assertEqual(
            client.getCircuitState(),
            CircuitState.CLOSED,
            'Después de 2 fallos: aún CLOSED'
        );

        // 1 éxito (debe resetear el contador)
        this.fetchMock.setBehavior('success');
        await client.getUserData('user3');

        // Otros 2 fallos (no debería abrir porque se reseteó)
        this.fetchMock.setBehavior('failure');
        await client.getUserData('user4');
        await client.getUserData('user5');

        this.assertEqual(
            client.getCircuitState(),
            CircuitState.CLOSED,
            'El circuito permanece CLOSED porque el contador se reseteó'
        );
    }

    // ==========================================================================
    // TEST 9: Métricas se actualizan correctamente
    // ==========================================================================

    async test9_ActualizacionMetricas(): Promise<void> {
        console.log('\n📝 TEST 9: Métricas se actualizan correctamente');

        const client = new ResilientHttpClient();

        // 3 peticiones exitosas
        this.fetchMock.setBehavior('success');
        await client.getUserData('user1');
        await client.getUserData('user2');
        await client.getUserData('user3');

        // 2 peticiones fallidas
        this.fetchMock.setBehavior('failure');
        await client.getUserData('user4');
        await client.getUserData('user5');

        const metrics = client.getMetrics();

        this.assertEqual(metrics.totalRequests, 5, 'Total de peticiones: 5');
        this.assertEqual(metrics.successfulRequests, 3, 'Peticiones exitosas: 3');
        this.assertEqual(metrics.failedRequests, 2, 'Peticiones fallidas: 2');
        this.assert(metrics.lastSuccessTime !== undefined, 'Timestamp de último éxito registrado');
        this.assert(metrics.lastFailureTime !== undefined, 'Timestamp de último fallo registrado');
    }

    // ==========================================================================
    // TEST 10: Manejo de JSON inválido
    // ==========================================================================

    async test10_ManejoJsonInvalido(): Promise<void> {
        console.log('\n📝 TEST 10: Manejo de JSON inválido');

        this.fetchMock.setBehavior('invalid-json');
        const client = new ResilientHttpClient();

        const result = await client.getUserData('user123');

        this.assert(!result.success, 'La petición falla con JSON inválido');
        this.assert(
            result.error?.message.includes('Invalid JSON'),
            'Mensaje de error indica JSON inválido'
        );
    }

    // ==========================================================================
    // EJECUTAR TODOS LOS TESTS
    // ==========================================================================

    async runAllTests(): Promise<void> {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║   TEST SUITE: RESILIENT HTTP CLIENT                       ║');
        console.log('║   Circuit Breaker Pattern - Validación Completa           ║');
        console.log('╚════════════════════════════════════════════════════════════╝');

        const startTime = Date.now();

        await this.test1_EstadoInicialClosed();
        await this.test2_PeticionExitosaClosed();
        await this.test3_ValidacionEntrada();
        await this.test4_TransicionAOpen();
        await this.test5_FailFastEnOpen();
        await this.test6_TransicionAHalfOpen();
        await this.test7_VolverAOpenDesdHalfOpen();
        await this.test8_ResetContadorFallos();
        await this.test9_ActualizacionMetricas();
        await this.test10_ManejoJsonInvalido();

        const duration = Date.now() - startTime;

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║   RESULTADOS                                               ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`\n✅ Tests pasados: ${this.passedTests}`);
        console.log(`❌ Tests fallidos: ${this.failedTests}`);
        console.log(`⏱️  Duración: ${duration}ms`);
        console.log(`📊 Tasa de éxito: ${((this.passedTests / (this.passedTests + this.failedTests)) * 100).toFixed(2)}%`);

        if (this.failedTests === 0) {
            console.log('\n🎉 ¡Todos los tests pasaron exitosamente!');
        } else {
            console.log('\n⚠️  Algunos tests fallaron. Revisar implementación.');
        }
    }
}

// ============================================================================
// EJECUTAR TESTS
// ============================================================================

async function ejecutarTests() {
    const runner = new TestRunner();
    await runner.runAllTests();
}

// Ejecutar si se llama directamente
if (require.main === module) {
    ejecutarTests().catch(console.error);
}

export { TestRunner, ejecutarTests };
