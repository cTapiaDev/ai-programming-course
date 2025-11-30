const http = require('http');

let failCount = 0;

const server = http.createServer((req, res) => {
  if (req.url === '/unstable') {
    // Los primeros 3 requests fallan con 500, luego responde 200 JSON
    if (failCount < 3) {
      failCount += 1;
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('simulated failure');
      console.log(`[server] Responded 500 (failCount=${failCount})`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    console.log('[server] Responded 200 OK');
    return;
  }

  // Ruta por defecto
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});
