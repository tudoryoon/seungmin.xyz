const encoder = new TextEncoder();
const COOKIE = 'research_access';
const SESSION_SECONDS = 8 * 60 * 60;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64 = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));

export function createResearchAccess(sealed, { now = Date.now } = {}) {
  const attempts = new Map();
  let cachedSecret = '', opened = null;
  async function keys(secret) {
    if (!/^[a-f0-9]{64}$/.test(secret || '')) throw Error('Not configured');
    const raw = Uint8Array.from(secret.match(/../g), h => parseInt(h, 16));
    return {
      aes: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']),
      hmac: await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode('research-session-key:' + secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    };
  }
  async function payload(secret, aes) {
    if (secret !== cachedSecret) { opened = null; cachedSecret = secret; }
    if (!opened) {
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv), additionalData: encoder.encode('research-snapshot-v1') }, aes, unb64(sealed.ciphertext));
      opened = JSON.parse(new TextDecoder().decode(raw));
    }
    return opened;
  }
  const sign = async (hmac, value) => b64(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, encoder.encode('research-session:' + value))));
  async function validSession(request, hmac) {
    const cookie = request.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!cookie || cookie.length > 256) return false;
    const parts = cookie.split('.');
    if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-zA-Z0-9_-]{22}$/.test(parts[1])) return false;
    const expires = Number(parts[0]);
    if (expires <= now() || expires > now() + SESSION_SECONDS * 1000) return false;
    try { return await crypto.subtle.verify('HMAC', hmac, unb64(parts[2]), encoder.encode('research-session:' + parts[0] + '.' + parts[1])); } catch { return false; }
  }
  function response(status, body, extra = {}) {
    return new Response(JSON.stringify(body), { status, headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
      'Vary': 'Cookie', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', ...extra
    } });
  }
  function cookie(request, value, maxAge) {
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return `${COOKIE}=${value}; Path=/api/research; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
  }
  return async function handle(request, env = {}) {
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) return response(405, { error: 'method' }, { Allow: 'GET, POST, DELETE' });
    if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) return response(403, { error: 'origin' });
    if (request.method === 'DELETE') return response(200, { ok: true }, { 'Set-Cookie': cookie(request, '', 0) });
    let key;
    try { key = await keys(env.RESEARCH_SECRET); } catch { return response(503, { error: 'unconfigured' }); }
    if (request.method === 'GET') {
      if (!await validSession(request, key.hmac)) return response(401, { error: 'locked' });
      try { const content = await payload(env.RESEARCH_SECRET, key.aes); return response(200, content.data); }
      catch { return response(503, { error: 'unavailable' }); }
    }
    const ip = (request.headers.get('CF-Connecting-IP') || 'local').slice(0, 128);
    for (const [key, entry] of attempts) if (entry.until <= now()) attempts.delete(key);
    const previous = attempts.get(ip);
    if (previous?.count >= 5) return response(429, { error: 'too_many_attempts' }, { 'Retry-After': String(Math.ceil((previous.until - now()) / 1000)) });
    if (!request.headers.get('Content-Type')?.includes('application/json') || Number(request.headers.get('Content-Length') || 0) > 1024) return response(400, { error: 'invalid' });
    let password;
    try {
      const reader = request.body?.getReader(); let size = 0, chunks = [];
      if (!reader) return response(400, { error: 'invalid' });
      while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 1024) { await reader.cancel(); return response(400, { error: 'invalid' }); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      password = JSON.parse(new TextDecoder().decode(bytes)).password;
      if (typeof password !== 'string' || password.length > 128) return response(400, { error: 'invalid' });
    } catch { return response(400, { error: 'invalid' }); }
    let content;
    try { content = await payload(env.RESEARCH_SECRET, key.aes); } catch { return response(503, { error: 'unavailable' }); }
    const expected = await crypto.subtle.sign('HMAC', key.hmac, encoder.encode('research-password:' + content.password));
    const accepted = await crypto.subtle.verify('HMAC', key.hmac, expected, encoder.encode('research-password:' + password));
    if (!accepted) {
      if (!attempts.has(ip) && attempts.size >= 1000) attempts.delete(attempts.keys().next().value);
      attempts.set(ip, { count: (previous?.count || 0) + 1, until: previous?.until || now() + ATTEMPT_WINDOW });
      return response(401, { error: 'invalid_password' });
    }
    attempts.delete(ip);
    const token = (now() + SESSION_SECONDS * 1000) + '.' + b64(crypto.getRandomValues(new Uint8Array(16)));
    return response(200, { ok: true }, { 'Set-Cookie': cookie(request, token + '.' + await sign(key.hmac, token), SESSION_SECONDS) });
  };
}
