import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { onRequest as substackFeed } from './functions/api/substack.js';
const root = new URL('./', import.meta.url);
const types = { js:'text/javascript', mjs:'text/javascript', css:'text/css', html:'text/html', wav:'audio/wav', webp:'image/webp', png:'image/png', svg:'image/svg+xml', ico:'image/x-icon', webmanifest:'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/api/substack' || path === '/api/substack/') {
      const response = await substackFeed({request:new Request('http://localhost'+req.url,{method:req.method}),waitUntil:promise=>promise.catch(()=>{})});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const file = new URL('.' + (path === '/' ? '/index.html' : path), root);
    if (!file.href.startsWith(root.href) || path.includes('/.')) throw new Error('Invalid path');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[file.pathname.split('.').pop()] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.argv[2] || 4173), '127.0.0.1', () => {
  console.log('Preview: http://127.0.0.1:' + server.address().port);
});
