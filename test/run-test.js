const { spawnSync } = require('child_process');
const path = require('path');

// 1) Compilar src/resilient-client.ts a dist/ (commonjs) con tsc
console.log('[test] Compiling TypeScript...');
const tscResult = spawnSync('npx', ['-p', 'typescript', 'tsc', 'src/resilient-client.ts', '--outDir', 'dist', '--module', 'commonjs', '--lib', 'es2021,dom', '--target', 'es2021'], { stdio: 'inherit', shell: false });
if (tscResult.status !== 0) {
  console.error('[test] TypeScript compilation failed');
  process.exit(tscResult.status || 1);
}
console.log('[test] Compilation complete. Importing client...');

const { ResilientClient } = require(path.resolve(__dirname, '../dist/resilient-client.js'));

// Crear cliente apuntando al servidor de prueba
const client = new ResilientClient({
  baseUrl: 'http://localhost:3000',
  timeoutMs: 2000,
  maxResponseBytes: 1024 * 8,
  circuit: {
    failureTriggers: new Set([3]),
    openDurationMs: 5000,
  },
});

async function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  // Hacer 5 peticiones con pequeñas pausas para observar comportamiento
  for (let i = 1; i <= 5; i++) {
    try {
      console.log(`[test] Attempt ${i} -> /unstable`);
      const res = await client.getJson('/unstable');
      console.log(`[test] Success:`, res);
    } catch (err) {
      console.error(`[test] Error (attempt ${i}):`, err && err.message ? err.message : err);
    }
    await pause(500);
  }

  console.log('[test] Now waiting 6s to allow OPEN -> HALF-OPEN...');
  await pause(6000);

  console.log('[test] Single probe after wait');
  try {
    const res = await client.getJson('/unstable');
    console.log('[test] Probe success:', res);
  } catch (err) {
    console.error('[test] Probe failed:', err && err.message ? err.message : err);
  }

  process.exit(0);
})();
