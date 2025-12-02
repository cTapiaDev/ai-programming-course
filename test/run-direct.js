const path = require('path');

const { ResilientClient } = require(path.resolve(__dirname, '../dist/resilient-client.js'));

const client = new ResilientClient({
  baseUrl: 'http://localhost:3000',
  timeoutMs: 2000,
  maxResponseBytes: 1024 * 8,
  circuit: {
    failureTriggers: new Set([3]),
    openDurationMs: 5000,
  },
});

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  for (let i = 1; i <= 5; i++) {
    try {
      console.log(`[direct-test] Attempt ${i} -> /unstable`);
      const res = await client.getJson('/unstable');
      console.log('[direct-test] Success:', res);
    } catch (err) {
      console.error('[direct-test] Error:', err && err.message ? err.message : err);
    }
    await pause(500);
  }

  console.log('[direct-test] Waiting 6s to allow OPEN -> HALF-OPEN');
  await pause(6000);

  console.log('[direct-test] Probe after wait');
  try {
    const res = await client.getJson('/unstable');
    console.log('[direct-test] Probe success:', res);
  } catch (err) {
    console.error('[direct-test] Probe failed:', err && err.message ? err.message : err);
  }

  process.exit(0);
})();
