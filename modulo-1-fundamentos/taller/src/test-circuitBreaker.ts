import { getUserData } from './resilient-client';

async function testCircuitBreaker() {
    console.log("=== Prueba del Circuit Breaker ===");

    console.log("\nSimulando fallos consecutivos...");
    for (let i = 1; i <= 4; i++) {
        const result = await getUserData("invalid-user");
        console.log(`Intento ${i}:`, result);
    }

    console.log("\nIntentando solicitud con el circuito abierto...");
    const resultOpen = await getUserData("invalid-user");
    console.log("Resultado con circuito abierto:", resultOpen);

    console.log("\nEsperando 5 segundos para probar estado HALF-OPEN...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\nProbar solicitud en estado HALF-OPEN...");
    const resultHalfOpen = await getUserData("valid-user");
    console.log("Resultado en estado HALF-OPEN:", resultHalfOpen);

    console.log("\nProbar solicitud exitosa para cerrar el circuito...");
    const resultClosed = await getUserData("valid-user");
    console.log("Resultado con circuito cerrado:", resultClosed);
}

testCircuitBreaker();