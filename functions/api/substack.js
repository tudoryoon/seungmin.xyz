import snapshot from '../../data/substack-snapshot.js';
import {FEED_URL, readFeed, validateFeed} from '../../lib/substack-feed.js';

const FRESH_MS = 5 * 60 * 1000;
const headers = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox"
};
function responseFor(value, state) {
  return new Response(value.xml, {headers:{...headers,'X-Feed-State':state,'X-Feed-Updated-At':value.fetchedAt}});
}
async function cachedFeed(cache, key) {
  try {
    const hit = await cache?.match(key);
    if (!hit) return null;
    const fetchedAt = hit.headers.get('X-Feed-Updated-At');
    if (!Number.isFinite(Date.parse(fetchedAt))) return null;
    return {xml:await readFeed(hit),fetchedAt};
  } catch { return null; }
}
export async function onRequest(context) {
  const {request} = context;
  if (request.method !== 'GET') return new Response('Method not allowed', {
    status:405,headers:{Allow:'GET','Cache-Control':'no-store'}
  });
  // Long-lived last-known-good cache; queries/cookies never affect the public key.
  const key = new Request(new URL('/api/substack?cache=last-good-v2',request.url));
  let cache;
  try { cache = globalThis.caches?.default; } catch { /* Fall back to the bundled snapshot. */ }
  const cached = await cachedFeed(cache,key);
  const previous = cached && Date.parse(cached.fetchedAt) > Date.parse(snapshot.fetchedAt) ? cached : snapshot;
  if (cached && previous === cached && Date.now() - Date.parse(cached.fetchedAt) < FRESH_MS) return responseFor(cached,'fresh');

  async function refresh() {
    try {
      // A stable RSS URL can reuse Substack's own cache instead of bypassing it.
      const upstream = await fetch(FEED_URL, {
        headers:{Accept:'application/rss+xml, application/xml, text/xml'},
        redirect:'manual',signal:AbortSignal.timeout(8000)
      });
      const xml = await readFeed(upstream);
      if (!validateFeed(xml) && validateFeed(previous.xml)) throw new Error('Unexpected empty feed');
      const next = {xml,fetchedAt:new Date().toISOString()};
      if (cache) {
        const saved = responseFor(next,'fresh');
        saved.headers.set('Cache-Control','public, max-age=2592000');
        try { await cache.put(key,saved); } catch { /* Cache writes are optional. */ }
      }
      return responseFor(next,'fresh');
    } catch { return responseFor(previous,previous === snapshot ? 'snapshot' : 'stale'); }
  }
  // A slow/blocked origin never delays the cached reading surface.
  if (context.waitUntil) {
    context.waitUntil(refresh());
    return responseFor(previous,previous === snapshot ? 'snapshot' : 'stale');
  }
  return refresh();
}
