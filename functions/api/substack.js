const FEED_URL = 'https://tudoryoon.substack.com/feed';
const MAX_BYTES = 3 * 1024 * 1024;
const headers = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox"
};

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', {
    status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' }
  });
  // One fixed public feed, with a cache key independent of visitor cookies or queries.
  const key = new Request(new URL('/api/substack', request.url), { method: 'GET' });
  let cache;
  try {
    cache = globalThis.caches?.default;
    const hit = await cache?.match(key);
    if (hit) return hit;
  } catch { /* A cache outage must not prevent a public feed read. */ }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let failure = 'network';
  try {
    const source = new URL(FEED_URL);
    source.searchParams.set('refresh', String(Math.floor(Date.now() / 300000)));
    const upstream = await fetch(source.href, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      redirect: 'error', signal: controller.signal
    });
    failure = `upstream-${upstream.status}`;
    if (!upstream.ok) throw new Error('Unavailable feed');
    failure = 'format';
    if (!/\b(xml|rss)\b/i.test(upstream.headers.get('Content-Type') || '') || !upstream.body) throw new Error('Unavailable feed');
    failure = 'body';
    if (Number(upstream.headers.get('Content-Length')) > MAX_BYTES) throw new Error('Oversized feed');
    const reader = upstream.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, xml = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('Oversized feed'); }
      xml += decoder.decode(value, { stream: true });
    }
    xml += decoder.decode();
    if (!xml.trim() || /<!DOCTYPE/i.test(xml)) throw new Error('Invalid feed');
    const response = new Response(xml, { headers });
    if (cache && context.waitUntil) context.waitUntil(cache.put(key, response.clone()).catch(() => {}));
    return response;
  } catch {
    return new Response('Feed unavailable', { status: 502, headers: {
      'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'X-Feed-Error': failure
    } });
  } finally { clearTimeout(timeout); }
}
