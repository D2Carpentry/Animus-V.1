import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../www/', import.meta.url));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
http.createServer(async (request, response) => {
  try {
    const target = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname));
    if (!target.startsWith(root)) throw new Error('Invalid path');
    response.writeHead(200, {'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    response.end(await readFile(target));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(8792, '127.0.0.1', () => console.log('ANIMUS Android preview: http://127.0.0.1:8792'));
