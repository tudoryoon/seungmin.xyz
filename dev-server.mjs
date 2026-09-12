import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const types = { js:'text/javascript', mjs:'text/javascript', css:'text/css', html:'text/html', webp:'image/webp', png:'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
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
